import { NextResponse } from "next/server";
import { resumeActiveQueues } from "@/lib/queue";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await resumeActiveQueues();
    const pendingCount = await prisma.jobTask.count({
      where: { status: "APPLYING" },
    });
    return NextResponse.json({
      success: true,
      message: "Worker heartbeat processed successfully",
      pendingTasks: pendingCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
