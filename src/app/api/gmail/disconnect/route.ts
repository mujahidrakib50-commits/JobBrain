import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    await prisma.gmailAccount.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true, message: "Gmail disconnected successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}