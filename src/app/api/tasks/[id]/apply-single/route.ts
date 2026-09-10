import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { applySingleTask } from "@/lib/queue";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { id } = await context.params;

    // Run apply for single task
    const result = await applySingleTask(id);

    return NextResponse.json({
      success: true,
      status: result.status,
      error: result.error || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
