import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { RawEmailMessage } from "./gmail";
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

export function createImapClient(email: string, appPassword: string) {
  // Strip any spaces from the 16-character Google App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const cleanPassword = appPassword.replace(/\s+/g, "").trim();

  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: email.trim(),
      pass: cleanPassword,
    },
    logger: false,
  });
}

/**
 * Verify that the Gmail email and App Password are valid
 */
export async function testGmailAppPassword(email: string, appPassword: string): Promise<{ success: boolean; error?: string }> {
  const client = createImapClient(email, appPassword);
  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err: any) {
    console.error("IMAP connection test error:", err);
    return {
      success: false,
      error:
        err.message?.includes("Invalid credentials") || err.message?.includes("AUTHENTICATIONFAILED")
          ? "Authentication failed. Please verify your Gmail address and 16-character App Password."
          : (err.message || "Failed to connect to Gmail IMAP."),
    };
  }
}

/**
 * Save Gmail account with App Password
 */
export async function saveGmailAppPasswordAccount(userId: string, email: string, appPassword: string) {
  const cleanPassword = appPassword.replace(/\s+/g, "").trim();
  const encryptedPassword = encrypt(cleanPassword);

  return await prisma.gmailAccount.upsert({
    where: { userId },
    update: {
      email: email.trim(),
      authType: "APP_PASSWORD",
      accessTokenEnc: encryptedPassword,
      refreshTokenEnc: null,
      expiresAt: null,
    },
    create: {
      userId,
      email: email.trim(),
      authType: "APP_PASSWORD",
      accessTokenEnc: encryptedPassword,
    },
  });
}

/**
 * Fetch recent job emails via IMAP
 */
export async function fetchEmailsViaImap(email: string, encryptedPassword: string): Promise<RawEmailMessage[]> {
  const password = decrypt(encryptedPassword);
  if (!password) {
    throw new Error("Unable to decrypt stored App Password.");
  }

  const client = createImapClient(email, password);
  await client.connect();

  const results: RawEmailMessage[] = [];

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const totalMessages = status.messages || 0;
      if (totalMessages === 0) return [];

      // Fetch the latest 30 messages (e.g. from total-29 to total)
      const startSeq = Math.max(1, totalMessages - 29);
      const range = `${startSeq}:${totalMessages}`;

      const messages = client.fetch(range, {
        envelope: true,
        source: true,
        internalDate: true,
      });

      for await (const msg of messages) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);

          const rawSender = parsed.from?.text || "Unknown";
          let sender = rawSender;
          let senderEmail = rawSender;
          if (parsed.from?.value && parsed.from.value.length > 0) {
            sender = parsed.from.value[0].name || parsed.from.value[0].address || rawSender;
            senderEmail = parsed.from.value[0].address || rawSender;
          }

          const subject = parsed.subject || "No Subject";
          const rawDate = parsed.date || msg.internalDate || new Date();
          const receivedDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
          const validReceivedAt = isNaN(receivedDate.getTime()) ? new Date() : receivedDate;
          const bodyText = (parsed.text || parsed.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const snippet = bodyText.slice(0, 160);

          results.push({
            messageId: msg.envelope?.messageId || `imap-${msg.uid || msg.seq}`,
            threadId: `thread-${msg.envelope?.messageId || msg.seq}`,
            sender,
            senderEmail,
            subject,
            snippet,
            bodyText: bodyText.slice(0, 3000),
            receivedAt: validReceivedAt,
          });
        } catch (e) {
          console.warn("Failed parsing IMAP email:", e);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    try {
      client.close();
    } catch {}
    throw err;
  }

  // Return newest first
  return results.reverse();
}