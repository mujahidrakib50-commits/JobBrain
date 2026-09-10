import { NextResponse } from "next/server";
import { getGoogleOAuthConfig, saveGoogleOAuthConfig } from "@/lib/gmail";

export async function GET() {
  try {
    const config = await getGoogleOAuthConfig();
    return NextResponse.json({
      hasConfig: !!config,
      clientId: config?.clientId || null,
      redirectUri: config?.redirectUri || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { clientId, clientSecret } = await req.json();
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Both Client ID and Client Secret are required." }, { status: 400 });
    }

    await saveGoogleOAuthConfig(clientId, clientSecret);
    return NextResponse.json({ success: true, message: "Google OAuth credentials saved successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}