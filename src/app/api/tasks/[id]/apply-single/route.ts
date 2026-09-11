import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { applySingleTask } from "@/lib/queue";

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

    // Run apply for single task belonging to authenticated user
    const result = await applySingleTask(id, user.id);

    return NextResponse.json({
      success: true,
      status: result.status,
      error: result.error || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
