import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { getGoogleAuthUrl, getGoogleOAuthConfig } from "@/lib/gmail";

export async function GET() {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const config = await getGoogleOAuthConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Google OAuth is not configured. Please add Client ID and Secret in settings.", needsConfig: true },
        { status: 400 }
      );
    }

    const authUrl = await getGoogleAuthUrl(user.id);
    return NextResponse.json({ url: authUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}