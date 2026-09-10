import { NextResponse } from "next/server";
import { testBrainConnection } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { provider, model, key } = await req.json();

    if (!provider || !key) {
      return NextResponse.json(
        { success: false, message: "Provider and key are required" },
        { status: 400 }
      );
    }

    const result = await testBrainConnection(provider, model, key.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Connection failed" },
      { status: 500 }
    );
  }
}
