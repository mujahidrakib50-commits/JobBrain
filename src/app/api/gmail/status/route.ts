import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthConfig } from "@/lib/gmail";
import { syncUserGmail, startGmailPoller } from "@/lib/gmailPoller";

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.gmailAccount.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        email: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    if (account) {
      startGmailPoller();
    }

    const config = await getGoogleOAuthConfig();

    return NextResponse.json({
      isConnected: !!account,
      email: account?.email || null,
      lastSyncAt: account?.lastSyncAt || null,
      hasConfig: !!config,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncUserGmail(user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}