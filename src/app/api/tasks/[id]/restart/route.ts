import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { restartWaitingTask } from "@/lib/queue";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { answers } = await req.json();

    const result = await restartWaitingTask(id, answers || [], user.id);

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
