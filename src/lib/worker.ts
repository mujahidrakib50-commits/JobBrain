import { prisma } from "./prisma";
import { resumeActiveQueues } from "./queue";

declare global {
  var __jobbrain_worker_started__: boolean | undefined;
}

let workerInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;

export function startBackgroundWorker() {
  if (globalThis.__jobbrain_worker_started__) {
    return;
  }
  globalThis.__jobbrain_worker_started__ = true;

  console.log("[Worker] Background task supervisor initialized.");

  // Immediately resume any active queues from PostgreSQL
  resumeActiveQueues().catch((err) => {
    console.error("[Worker] Initial resumeActiveQueues error:", err);
  });

  // Watchdog loop every 15 seconds to ensure any interrupted applying tasks continue
  workerInterval = setInterval(async () => {
    try {
      await resumeActiveQueues();
    } catch (err) {
      console.error("[Worker] Watchdog error:", err);
    }
  }, 15000);

  // Keep-alive loop: every 4 minutes, if there are pending tasks in APPLYING status,
  // ping the public URL to keep Render awake so background processing never stops!
  keepAliveInterval = setInterval(async () => {
    try {
      const pendingCount = await prisma.jobTask.count({
        where: { status: "APPLYING" },
      });

      if (pendingCount > 0) {
        const appUrl =
          process.env.RENDER_EXTERNAL_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://jobbrain-465c.onrender.com";

        console.log(`[Worker] Keep-alive pinging ${appUrl}/api/health (${pendingCount} applying tasks remaining)`);
        await fetch(`${appUrl}/api/health`, {
          headers: { "x-keep-alive": "true" },
        }).catch((e) => {
          console.warn("[Worker] Keep-alive ping warning:", e.message);
        });
      }
    } catch (err) {
      console.error("[Worker] Keep-alive check error:", err);
    }
  }, 4 * 60 * 1000);
}
