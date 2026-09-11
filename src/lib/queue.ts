import { prisma } from "./prisma";
import { getActiveBrain, DetailedFormField } from "./ai";
import { scrapeJobDetails, processJobApplication } from "./browser";
import { findBestProfileMatch } from "./embeddings";
import { getAccurateNetworkTime } from "./time";

const activeUserLoops = new Set<string>();

export async function isQueueRunning(userId?: string): Promise<boolean> {
  if (!userId) {
    const anyRunning = await prisma.queueState.findFirst({
      where: { isRunning: true },
    });
    return !!anyRunning;
  }
  const state = await prisma.queueState.findUnique({
    where: { id: userId },
  });
  return state ? state.isRunning : false;
}

export async function setQueueRunning(userId: string, running: boolean) {
  await prisma.queueState.upsert({
    where: { id: userId },
    update: { isRunning: running },
    create: { id: userId, isRunning: running },
  });

  if (running && !activeUserLoops.has(userId)) {
    runQueueWorkerLoop(userId).catch(console.error);
  }
}

/**
 * Main serial worker loop scoped per user (1 task at a time for the user)
 */
export async function runQueueWorkerLoop(userId: string) {
  if (!userId || activeUserLoops.has(userId)) return;
  activeUserLoops.add(userId);

  try {
    while (true) {
      const running = await isQueueRunning(userId);
      if (!running) {
        break;
      }

      // Find the next task in APPLYING status for this user
      const nextTask = await prisma.jobTask.findFirst({
        where: { userId, status: "APPLYING" },
        orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      });


      if (!nextTask) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      const activeBrain = await getActiveBrain(nextTask.userId);

      // Step 1: Scrape / refine details if missing or default
      if (!nextTask.title || nextTask.title === "Pending...") {
        try {
          const details = await scrapeJobDetails(nextTask.url, activeBrain);
          await prisma.jobTask.update({
            where: { id: nextTask.id },
            data: {
              title: details.title,
              organization: details.organization,
              detectedLang: details.detectedLang,
              captchaDetected: details.hasCaptcha,
              status: details.hasCaptcha ? "WAITING" : "APPLYING",
            },
          });

          if (details.hasCaptcha) {
            continue;
          }
        } catch (scrapeErr: any) {
          console.warn("Failed to scrape link metadata:", scrapeErr);
        }
      }

      // Re-fetch profile fields & attachments
      const profile = await prisma.profile.findUnique({
        where: { userId: nextTask.userId },
        include: {
          fields: true,
          attachments: true,
        },
      });

      const profileFields = (profile?.fields || []).map((f) => ({
        question: f.question,
        answer: f.answer,
        embedding: f.embedding,
      }));

      const attachments = (profile?.attachments || []).map((a) => ({
        question: a.question,
        filename: a.filename,
        fileUrl: a.fileUrl,
      }));

      // Step 2: Attempt application
      const result = await processJobApplication({
        url: nextTask.url,
        profileFields,
        attachments,
        brain: activeBrain,
      });

      if (result.status === "ALREADY_SUBMITTED") {
        console.log(`[Queue] Task ${nextTask.id} (${nextTask.title}) was already submitted previously. Automatically deleting task as requested.`);
        await prisma.jobTask.delete({ where: { id: nextTask.id } }).catch((e) => {
          console.warn("Error deleting already submitted task:", e);
        });
        continue;
      }

      if (result.status === "APPLIED") {
        const accurateTime = await getAccurateNetworkTime();
        await prisma.jobTask.update({
          where: { id: nextTask.id },
          data: {
            status: "APPLIED",
            appliedAt: accurateTime,
            submittedData: result.formFields ? JSON.stringify(result.formFields) : null,
            failureReason: null,
          },
        });
      } else if (result.status === "WAITING") {
        await prisma.jobTask.update({
          where: { id: nextTask.id },
          data: {
            status: "WAITING",
            missingQuestions: result.formFields
              ? JSON.stringify(result.formFields)
              : null,
            captchaDetected: !!result.captchaDetected,
            failureReason: result.error || null,
          },
        });
      } else {
        // FAILED: Retry up to 3 times
        const currentRetries = nextTask.retryCount + 1;
        if (currentRetries < 3) {
          await prisma.jobTask.update({
            where: { id: nextTask.id },
            data: {
              retryCount: currentRetries,
              failureReason: `Attempt ${currentRetries} failed: ${result.error || "Unknown error"}`,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 8000));
        } else {
          await prisma.jobTask.update({
            where: { id: nextTask.id },
            data: {
              status: "FAILED",
              retryCount: currentRetries,
              failureReason: result.error || "Failed after 3 attempts.",
            },
          });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (loopError) {
    console.error("Queue worker loop error:", loopError);
  } finally {
    activeUserLoops.delete(userId);
  }
}

/**
 * Handle restarting a waiting task:
 * - Upserts newly entered answers to profile
 * - Searches profile for empty boxes
 * - Only required fields block proceeding; optional fields are allowed to be empty!
 */
export async function restartWaitingTask(
  taskId: string,
  submittedAnswers: { question: string; answer: string; selector?: string }[],
  userId?: string
) {
  const task = await prisma.jobTask.findFirst({
    where: { id: taskId, ...(userId ? { userId } : {}) },
  });
  if (!task) throw new Error("Task not found");

  const profile = await prisma.profile.findUnique({
    where: { userId: task.userId },
    include: { fields: true, attachments: true },
  });
  if (!profile) throw new Error("Profile not found");

  // 1. Save all non-empty answered questions to Profile
  for (const item of submittedAnswers) {
    if (item.question && item.answer && item.answer.trim()) {
      await prisma.profileField.upsert({
        where: {
          profileId_question: {
            profileId: profile.id,
            question: item.question.trim(),
          },
        },
        update: { answer: item.answer.trim() },
        create: {
          profileId: profile.id,
          question: item.question.trim(),
          answer: item.answer.trim(),
        },
      });
    }
  }

  // 2. Re-fetch all profile fields and attachments
  const updatedProfile = await prisma.profile.findUnique({
    where: { id: profile.id },
    include: { fields: true, attachments: true },
  });
  const currentFields = updatedProfile?.fields || [];
  const currentAttachments = updatedProfile?.attachments || [];

  // 3. Inspect existing fields on the task
  let fieldsList: DetailedFormField[] = [];
  if (task.missingQuestions) {
    try {
      fieldsList = JSON.parse(task.missingQuestions);
    } catch {}
  }

  let missingRequiredCount = 0;
  const updatedFieldsList: DetailedFormField[] = [];

  for (const field of fieldsList) {
    const qText = field.questionEn || field.questionOriginal || "";

    const submitted = submittedAnswers.find(
      (a) =>
        (a.selector && a.selector === field.selector) ||
        a.question.toLowerCase() === qText.toLowerCase()
    );

    let val = field.currentVal || "";
    if (submitted && submitted.answer !== undefined) {
      val = submitted.answer.trim();
    }

    // If still empty, search profile
    if (!val.trim()) {
      if (field.isAttachment) {
        const qLower = qText.toLowerCase();
        for (const att of currentAttachments) {
          const attLower = att.question.toLowerCase();
          if (
            (qLower.includes("cv") || qLower.includes("resume")) &&
            (attLower.includes("cv") || attLower.includes("resume"))
          ) {
            val = att.fileUrl;
            break;
          } else if (
            (qLower.includes("cover") || qLower.includes("lettre")) &&
            (attLower.includes("cover") || attLower.includes("lettre"))
          ) {
            val = att.fileUrl;
            break;
          } else if (attLower.includes(qLower) || qLower.includes(attLower)) {
            val = att.fileUrl;
            break;
          }
        }
      } else if (field.type === "checkbox") {
        if (/consent|privacy|terms/i.test(qText)) {
          val = "true";
        }
      } else {
        const match = findBestProfileMatch(qText, currentFields, 0.65);
        if (match) {
          val = match.match.answer;
        } else {
          for (const pf of currentFields) {
            const pfLower = pf.question.toLowerCase();
            const qLower = qText.toLowerCase();
            if (
              qLower === pfLower ||
              (qLower.includes("first name") && pfLower.includes("first name")) ||
              (qLower.includes("last name") && (pfLower.includes("last name") || pfLower === "name")) ||
              (qLower.includes("email") && pfLower.includes("email")) ||
              (qLower.includes("phone") && pfLower.includes("phone"))
            ) {
              val = pf.answer;
              break;
            }
          }
        }
      }
    }

    const hasAnswer = val.trim().length > 0;
    // ONLY required fields block submission!
    if (!hasAnswer && field.isRequired) {
      missingRequiredCount++;
    }

    updatedFieldsList.push({
      ...field,
      currentVal: val,
      isMatched: hasAnswer,
    });
  }

  if (missingRequiredCount === 0) {
    // All required questions resolved! Move to front of Applying queue
    const lowestQueueTask = await prisma.jobTask.findFirst({
      where: { status: "APPLYING" },
      orderBy: { queuePosition: "asc" },
    });
    const newPosition = lowestQueueTask ? lowestQueueTask.queuePosition - 1 : 0;

    await prisma.jobTask.update({
      where: { id: taskId },
      data: {
        status: "APPLYING",
        queuePosition: newPosition,
        missingQuestions: JSON.stringify(updatedFieldsList),
        captchaDetected: false,
        failureReason: null,
        retryCount: 0,
      },
    });

    const isRunning = await isQueueRunning(task.userId);
    if (isRunning && !activeUserLoops.has(task.userId)) {
      runQueueWorkerLoop(task.userId).catch(console.error);
    }

    return { resolved: true, remaining: 0, allFields: updatedFieldsList };
  } else {
    // Still required questions missing: keep in WAITING with updated values filled
    await prisma.jobTask.update({
      where: { id: taskId },
      data: {
        missingQuestions: JSON.stringify(updatedFieldsList),
      },
    });

    return { resolved: false, remaining: missingRequiredCount, allFields: updatedFieldsList };
  }
}

/**
 * Apply to only one single task immediately without starting the whole queue:
 * Moves task to the bottom of the queue and applies to that particular task.
 */
export async function applySingleTask(taskId: string, userId?: string) {
  const task = await prisma.jobTask.findFirst({
    where: { id: taskId, ...(userId ? { userId } : {}) },
  });
  if (!task) throw new Error("Task not found");

  // Move to the very bottom of the queue
  const highestQueueTask = await prisma.jobTask.findFirst({
    where: { status: "APPLYING" },
    orderBy: { queuePosition: "desc" },
  });
  const bottomPosition = highestQueueTask ? highestQueueTask.queuePosition + 1 : 1;

  await prisma.jobTask.update({
    where: { id: taskId },
    data: { queuePosition: bottomPosition },
  });

  const activeBrain = await getActiveBrain(task.userId);

  // Scrape / translate metadata if not already done
  if (!task.title || task.title === "Pending..." || task.title === "Fetching details...") {
    try {
      const details = await scrapeJobDetails(task.url, activeBrain);
      await prisma.jobTask.update({
        where: { id: taskId },
        data: {
          title: details.title,
          organization: details.organization,
          detectedLang: details.detectedLang,
        },
      });
    } catch {}
  }

  // Fetch profile
  const profile = await prisma.profile.findUnique({
    where: { userId: task.userId },
    include: { fields: true, attachments: true },
  });

  const profileFields = (profile?.fields || []).map((f) => ({
    question: f.question,
    answer: f.answer,
    embedding: f.embedding,
  }));

  const attachments = (profile?.attachments || []).map((a) => ({
    question: a.question,
    filename: a.filename,
    fileUrl: a.fileUrl,
  }));

  // Process only this single task
  const result = await processJobApplication({
    url: task.url,
    profileFields,
    attachments,
    brain: activeBrain,
  });

  if (result.status === "ALREADY_SUBMITTED") {
    console.log(`[SingleApply] Task ${taskId} (${task.title}) was already submitted previously. Automatically deleting task as requested.`);
    await prisma.jobTask.delete({ where: { id: taskId } }).catch((e) => {
      console.warn("Error deleting already submitted task:", e);
    });
    return result;
  }

  if (result.status === "APPLIED") {
    const accurateTime = await getAccurateNetworkTime();
    await prisma.jobTask.update({
      where: { id: taskId },
      data: {
        status: "APPLIED",
        appliedAt: accurateTime,
        submittedData: result.formFields ? JSON.stringify(result.formFields) : null,
        failureReason: null,
      },
    });
  } else if (result.status === "WAITING") {
    await prisma.jobTask.update({
      where: { id: taskId },
      data: {
        status: "WAITING",
        missingQuestions: result.formFields ? JSON.stringify(result.formFields) : null,
        captchaDetected: !!result.captchaDetected,
        failureReason: result.error || null,
      },
    });
  } else {
    await prisma.jobTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failureReason: result.error || "Application submission failed.",
      },
    });
  }

  return result;
}

