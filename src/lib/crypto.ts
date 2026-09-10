import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getSecretKey(): Buffer {
  const secret = process.env.APP_SECRET || "jobbrain_default_fallback_secret_32bytes!!";
  // Hash the secret with SHA-256 to guarantee 32 bytes
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv + tag + encrypted
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  try {
    const combined = Buffer.from(encryptedText, "base64");
    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error("Invalid encrypted payload size");
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const key = getSecretKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("Decryption failed:", err);
    return "";
  }
}

/**
 * Mask an API key showing only the last 4 characters
 */
export function maskKey(key: string): string {
  if (!key) return "••••••••";
  if (key.length <= 4) return "••••";
  return "••••••••" + key.slice(-4);
}
