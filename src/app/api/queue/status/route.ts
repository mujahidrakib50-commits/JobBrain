import { NextResponse } from "next/server";
import { isQueueRunning, setQueueRunning } from "@/lib/queue";

export async function GET() {
  try {
    const running = await isQueueRunning();
    return NextResponse.json({ isRunning: running });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const currentRunning = await isQueueRunning();
    const newRunning = body.isRunning !== undefined ? !!body.isRunning : !currentRunning;

    await setQueueRunning(newRunning);

    return NextResponse.json({ isRunning: newRunning });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
