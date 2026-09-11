import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.cookies.delete("jobbrain_session");
      return response;
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
