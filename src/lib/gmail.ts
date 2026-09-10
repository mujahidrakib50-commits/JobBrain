import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/gmail/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function getGoogleOAuthConfig(): Promise<GoogleOAuthConfig | null> {
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId.trim(),
      clientSecret: envClientSecret.trim(),
      redirectUri,
    };
  }

  // Check database configuration
  const dbConfig = await prisma.gmailOAuthConfig.findUnique({
    where: { id: "global" },
  });

  if (dbConfig?.clientId && dbConfig?.clientSecret) {
    return {
      clientId: dbConfig.clientId.trim(),
      clientSecret: dbConfig.clientSecret.trim(),
      redirectUri,
    };
  }

  return null;
}

export async function saveGoogleOAuthConfig(clientId: string, clientSecret: string) {
  return await prisma.gmailOAuthConfig.upsert({
    where: { id: "global" },
    update: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
    create: { id: "global", clientId: clientId.trim(), clientSecret: clientSecret.trim() },
  });
}

export async function getGoogleAuthUrl(userId: string): Promise<string> {
  const config = await getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google OAuth credentials are not configured. Please add Client ID & Secret.");
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const config = await getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || res.statusText}`);
  }

  const data = await res.json();
  const accessToken = data.access_token as string;
  const refreshToken = data.refresh_token as string | undefined;
  const expiresIn = (data.expires_in as number) || 3600;

  // Fetch user profile email
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let email = "Connected Account";
  if (userRes.ok) {
    const userData = await userRes.json();
    email = userData.email || email;
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
    email,
  };
}

export async function saveGmailAccountTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresIn: number; email: string }
) {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  const accessTokenEnc = encrypt(tokens.accessToken);
  const refreshTokenEnc = tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined;

  const existing = await prisma.gmailAccount.findUnique({ where: { userId } });

  return await prisma.gmailAccount.upsert({
    where: { userId },
    update: {
      email: tokens.email,
      accessTokenEnc,
      ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
      expiresAt,
    },
    create: {
      userId,
      email: tokens.email,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc || "",
      expiresAt,
    },
  });
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!account || !account.accessTokenEnc) return null;

  let accessToken = decrypt(account.accessTokenEnc);
  const now = new Date();

  // If token expires in less than 2 minutes, refresh it
  const isExpiringSoon = account.expiresAt && account.expiresAt.getTime() - now.getTime() < 120000;

  if (isExpiringSoon && account.refreshTokenEnc) {
    const refreshToken = decrypt(account.refreshTokenEnc);
    if (refreshToken) {
      const config = await getGoogleOAuthConfig();
      if (config) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              refresh_token: refreshToken,
              grant_type: "refresh_token",
            }).toString(),
          });

          if (res.ok) {
            const data = await res.json();
            const newAccessToken = data.access_token as string;
            const expiresIn = (data.expires_in as number) || 3600;
            const expiresAt = new Date(Date.now() + expiresIn * 1000);

            await prisma.gmailAccount.update({
              where: { userId },
              data: {
                accessTokenEnc: encrypt(newAccessToken),
                expiresAt,
              },
            });

            return newAccessToken;
          }
        } catch (e) {
          console.warn("Token refresh attempt failed:", e);
        }
      }
    }
  }

  return accessToken || null;
}

export interface RawEmailMessage {
  messageId: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: Date;
}

function decodeBase64(str: string): string {
  try {
    const sanitized = str.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(sanitized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmailBody(payload: any): string {
  if (!payload) return "";

  // Direct body
  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(decoded) : decoded;
  }

  // Multipart parts
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return stripHtml(decodeBase64(part.body.data));
      }
      if (part.parts) {
        const nested = extractEmailBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

export async function fetchRecentJobEmails(accessToken: string): Promise<RawEmailMessage[]> {
  // Query targeted at job-related communications to save bandwidth and API quota
  const query = "subject:(job OR application OR candidature OR offer OR rejected OR status OR entretien OR interview OR hiring OR recruited OR role) newer_than:30d";

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    // If targeted query yields nothing or error, fallback to general inbox query
    const fallbackUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20";
    const fallbackRes = await fetch(fallbackUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fallbackRes.ok) {
      throw new Error(`Gmail API list failed: ${fallbackRes.statusText}`);
    }
    const fallbackData = await fallbackRes.json();
    return await fetchMessageDetails(accessToken, fallbackData.messages || []);
  }

  const listData = await listRes.json();
  return await fetchMessageDetails(accessToken, listData.messages || []);
}

async function fetchMessageDetails(accessToken: string, messages: { id: string; threadId: string }[]): Promise<RawEmailMessage[]> {
  const results: RawEmailMessage[] = [];

  for (const m of messages.slice(0, 20)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const getHeader = (name: string) => {
        const found = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
        return found ? found.value : "";
      };

      const rawFrom = getHeader("From");
      const subject = getHeader("Subject") || "No Subject";
      const dateHeader = getHeader("Date");

      // Parse sender name and email
      let sender = rawFrom;
      let senderEmail = rawFrom;
      const match = rawFrom.match(/^(.*?)\s*<(.+?)>$/);
      if (match) {
        sender = match[1].replace(/["']/g, "").trim() || match[2];
        senderEmail = match[2].trim();
      }

      const receivedAt = dateHeader ? new Date(dateHeader) : (msgData.internalDate ? new Date(parseInt(msgData.internalDate)) : new Date());
      const bodyText = extractEmailBody(msgData.payload) || msgData.snippet || "";

      results.push({
        messageId: msgData.id,
        threadId: msgData.threadId || m.threadId,
        sender,
        senderEmail,
        subject,
        snippet: msgData.snippet || bodyText.slice(0, 160),
        bodyText: bodyText.slice(0, 3000),
        receivedAt: isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
      });
    } catch (e) {
      console.warn("Failed fetching message details:", m.id, e);
    }
  }

  return results;
}