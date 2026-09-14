import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveQueueCount, resumeActiveQueues } from "@/lib/queue";

export async function GET() {
  try {
    const pendingCount = await prisma.jobTask.count({
      where: { status: "APPLYING" },
    });

    const activeQueues = getActiveQueueCount();

    // Auto-wake worker loop if tasks are pending but loop is not active
    if (pendingCount > 0 && activeQueues === 0) {
      resumeActiveQueues().catch(console.error);
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      pendingTasks: pendingCount,
      activeQueueLoops: activeQueues,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", error: err.message },
      { status: 500 }
    );
  }
}
