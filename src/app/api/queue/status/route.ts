import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { isQueueRunning, setQueueRunning } from "@/lib/queue";

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const running = await isQueueRunning(user.id);
    return NextResponse.json({ isRunning: running });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const currentRunning = await isQueueRunning(user.id);
    const newRunning = body.isRunning !== undefined ? !!body.isRunning : !currentRunning;

    await setQueueRunning(user.id, newRunning);

    return NextResponse.json({ isRunning: newRunning });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
