import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { testGmailAppPassword, saveGmailAppPasswordAccount } from "@/lib/imap";
import { syncUserGmail } from "@/lib/gmailPoller";

export async function POST(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { email, appPassword } = await req.json();

    if (!email || !appPassword) {
      return NextResponse.json(
        { error: "Both Gmail address and App Password are required." },
        { status: 400 }
      );
    }

    // Test connection first
    const testResult = await testGmailAppPassword(email, appPassword);
    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || "Failed to authenticate with Gmail." },
        { status: 401 }
      );
    }

    // Save credentials encrypted
    await saveGmailAppPasswordAccount(user.id, email, appPassword);

    // Trigger initial background sync
    syncUserGmail(user.id).catch((err) => {
      console.warn("Initial IMAP Gmail sync background error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Gmail connected successfully via App Password!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}