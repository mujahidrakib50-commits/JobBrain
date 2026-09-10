import { prisma } from "./prisma";
import { getValidAccessToken, fetchRecentJobEmails } from "./gmail";
import { classifyJobEmail } from "./emailClassifier";
import { getActiveBrain } from "./ai";

let isPollerRunning = false;
let pollerInterval: NodeJS.Timeout | null = null;

export async function syncUserGmail(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { success: false, error: "Gmail account not connected or token invalid." };
  }

  const activeBrain = await getActiveBrain(userId);
  const rawEmails = await fetchRecentJobEmails(accessToken);

  let newCount = 0;
  const categoryCounts = {
    REJECTION: 0,
    POSITIVE: 0,
    JOB_MATCH: 0,
  };

  for (const email of rawEmails) {
    // Check if already stored
    const existing = await prisma.jobEmail.findUnique({
      where: {
        userId_messageId: {
          userId,
          messageId: email.messageId,
        },
      },
    });

    if (existing) continue;

    // Classify email
    const category = await classifyJobEmail(
      {
        subject: email.subject,
        sender: email.sender,
        snippet: email.snippet,
        bodyText: email.bodyText,
      },
      activeBrain
    );

    // Save only job-related emails
    if (category !== "IGNORE") {
      await prisma.jobEmail.create({
        data: {
          userId,
          messageId: email.messageId,
          threadId: email.threadId,
          sender: email.sender,
          senderEmail: email.senderEmail,
          subject: email.subject,
          snippet: email.snippet,
          bodyText: email.bodyText,
          category,
          receivedAt: email.receivedAt,
          isRead: false,
        },
      });

      newCount++;
      if (category in categoryCounts) {
        categoryCounts[category as keyof typeof categoryCounts]++;
      }
    }
  }

  // Update lastSyncAt
  await prisma.gmailAccount.update({
    where: { userId },
    data: { lastSyncAt: new Date() },
  });

  return {
    success: true,
    totalScanned: rawEmails.length,
    newJobEmails: newCount,
    categoryCounts,
  };
}

/**
 * Start background recurring sync for all connected accounts (every 2 minutes)
 */
export function startGmailPoller() {
  if (isPollerRunning) return;
  isPollerRunning = true;

  const runSync = async () => {
    try {
      const connectedAccounts = await prisma.gmailAccount.findMany();
      for (const acc of connectedAccounts) {
        await syncUserGmail(acc.userId).catch((err) => {
          console.warn(`Gmail sync failed for user ${acc.userId}:`, err);
        });
      }
    } catch (e) {
      console.error("Gmail poller iteration error:", e);
    }
  };

  // Run initial sync
  runSync();

  // Run every 2 minutes (120,000 ms)
  pollerInterval = setInterval(runSync, 120000);
}

export function stopGmailPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
  isPollerRunning = false;
}