import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { taskIds } = await req.json();
    if (!Array.isArray(taskIds)) {
      return NextResponse.json({ error: "taskIds array required" }, { status: 400 });
    }

    // Update each task's queuePosition according to index
    await prisma.$transaction(
      taskIds.map((id, index) =>
        prisma.jobTask.updateMany({
          where: { id, userId: user.id },
          data: { queuePosition: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
