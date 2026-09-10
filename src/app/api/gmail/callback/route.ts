import { NextResponse } from "next/server";
import { exchangeGoogleCode, saveGmailAccountTokens } from "@/lib/gmail";
import { syncUserGmail } from "@/lib/gmailPoller";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateUserId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

  if (error || !code || !stateUserId) {
    console.error("Gmail OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}/?tab=inbox&error=${encodeURIComponent(error || "Authorization cancelled")}`);
  }

  try {
    const tokenData = await exchangeGoogleCode(code);
    await saveGmailAccountTokens(stateUserId, tokenData);

    // Trigger initial background sync right away
    syncUserGmail(stateUserId).catch((err) => {
      console.warn("Initial Gmail sync background error:", err);
    });

    return NextResponse.redirect(`${baseUrl}/?tab=inbox&connected=true`);
  } catch (err: any) {
    console.error("Gmail callback exchange error:", err);
    return NextResponse.redirect(`${baseUrl}/?tab=inbox&error=${encodeURIComponent(err.message || "Failed to link Gmail")}`);
  }
}