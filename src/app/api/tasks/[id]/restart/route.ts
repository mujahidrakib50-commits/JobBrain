import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { restartWaitingTask } from "@/lib/queue";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { id } = await context.params;
    const { answers } = await req.json();

    const result = await restartWaitingTask(id, answers || []);

    return NextResponse.json({
      success: true,
      resolved: result.resolved,
      remaining: result.remaining,
      message: result.resolved
        ? "All questions answered! Task moved to front of Applying queue."
        : `${result.remaining} questions still need answers.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
