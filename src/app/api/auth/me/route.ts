import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let user = await getSessionUser();
    if (!user) {
      // Auto-onboard default single-user account
      user = await getOrCreateDefaultUser();
    }

    const activeKey = await prisma.apiKey.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true, label: true, provider: true, model: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        avatarUrl: user.profile?.avatarUrl || null,
      },
      activeBrain: activeKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
