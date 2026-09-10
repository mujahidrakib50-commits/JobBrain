import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isQueueRunning, runQueueWorkerLoop } from "@/lib/queue";
import { scrapeJobDetails } from "@/lib/browser";
import { getActiveBrain } from "@/lib/ai";

export async function GET() {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const tasks = await prisma.jobTask.findMany({
      where: { userId: user.id },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { rawLinks } = await req.json();
    if (!rawLinks || typeof rawLinks !== "string") {
      return NextResponse.json({ error: "Links are required" }, { status: 400 });
    }

    // Robust extraction: handles 10+ links separated by newlines, spaces, commas, or glued together
    const spaced = rawLinks.replace(/(https?:\/\/)/gi, " $1");
    const matches = spaced.match(/https?:\/\/[^\s,;"'<>\)\]\}]+/gi) || [];

    const validUrls: string[] = [];
    for (let candidate of matches) {
      // Strip trailing punctuation commonly included in copy-paste
      candidate = candidate.replace(/[.,;:)\]]+$/, "").trim();
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          validUrls.push(parsed.toString());
        }
      } catch {}
    }

    // Fallback: line/whitespace splitting if needed
    if (validUrls.length === 0) {
      const tokens = rawLinks.split(/[\r\n\s,;]+/).map((t: string) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        try {
          const parsed = new URL(token);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            validUrls.push(parsed.toString());
          }
        } catch {}
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: "No valid URLs found. Please check your links." },
        { status: 400 }
      );
    }

    const lastTask = await prisma.jobTask.findFirst({
      where: { userId: user.id, status: "APPLYING" },
      orderBy: { queuePosition: "desc" },
    });
    let currentPosition = lastTask ? lastTask.queuePosition + 1 : 0;

    const createdTasks = [];
    for (const url of validUrls) {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.replace("www.", "").replace("carrieres.", "").replace("jobs.", "");
      const defaultOrg = host.split(".")[0];
      const capitalizedOrg = defaultOrg.charAt(0).toUpperCase() + defaultOrg.slice(1);

      const task = await prisma.jobTask.create({
        data: {
          userId: user.id,
          url,
          title: "Fetching details...",
          organization: capitalizedOrg,
          status: "APPLYING",
          queuePosition: currentPosition++,
        },
      });
      createdTasks.push(task);
    }

    // Immediately scrape details in the background so Applying tab shows accurate title & company
    const activeBrain = await getActiveBrain(user.id);
    (async () => {
      for (const t of createdTasks) {
        try {
          const details = await scrapeJobDetails(t.url, activeBrain);
          await prisma.jobTask.update({
            where: { id: t.id },
            data: {
              title: details.title,
              organization: details.organization, // Exact original company name!
              detectedLang: details.detectedLang,
              captchaDetected: details.hasCaptcha,
              status: details.hasCaptcha ? "WAITING" : "APPLYING",
            },
          });
        } catch (e) {
          console.warn("Background metadata fetch failed for", t.url, e);
        }
      }
    })().catch(console.error);

    // Trigger queue if running
    const isRunning = await isQueueRunning();
    if (isRunning) {
      runQueueWorkerLoop().catch(console.error);
    }

    return NextResponse.json({ success: true, count: createdTasks.length, tasks: createdTasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Task ID is required" }, { status: 400 });

    await prisma.jobTask.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
