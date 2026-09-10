import { decrypt } from "./crypto";
import { prisma } from "./prisma";
import { translateToEnglishSync, cleanRawLabel, translateJobTitle } from "./translate";
import { findBestProfileMatch } from "./embeddings";

export interface FormFieldToMatch {
  selector: string;
  name: string;
  type: string; // text, email, tel, file, select, checkbox, textarea, etc.
  label: string;
  isRequired: boolean;
  placeholder?: string;
  options?: string[];
}

export interface DetailedFormField {
  id: string;
  selector: string;
  name: string;
  type: string;
  questionEn: string;
  questionOriginal: string;
  currentVal: string;
  isMatched: boolean;
  isRequired: boolean;
  isAttachment: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormFieldMatchResult {
  allFields: DetailedFormField[];
  matchedCount: number;
  missingRequiredCount: number;
  hasUnansweredQuestions: boolean;
}

export interface ActiveBrain {
  id: string;
  label: string;
  provider: string;
  model: string;
  key: string;
}

/**
 * Fetch the currently active API key/brain
 */
export async function getActiveBrain(userId: string): Promise<ActiveBrain | null> {
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { userId, isActive: true },
  });

  if (!apiKeyRecord) return null;

  const decryptedKey = decrypt(apiKeyRecord.encryptedKey);
  if (!decryptedKey) return null;

  return {
    id: apiKeyRecord.id,
    label: apiKeyRecord.label,
    provider: apiKeyRecord.provider.toLowerCase(),
    model: apiKeyRecord.model,
    key: decryptedKey,
  };
}

/**
 * Test connectivity for an API key
 */
export async function testBrainConnection(
  provider: string,
  model: string,
  key: string
): Promise<{ success: boolean; message: string }> {
  try {
    const prov = provider.toLowerCase();
    if (prov === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: "Connected to OpenAI successfully!" };
    } else if (prov === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model || "claude-3-5-haiku-20241022",
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: "Connected to Anthropic successfully!" };
    } else if (prov === "google") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: "Connected to Google Gemini successfully!" };
    } else if (prov === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: "Connected to OpenRouter successfully!" };
    }

    return { success: false, message: `Unsupported provider: ${provider}` };
  } catch (err: any) {
    return { success: false, message: err.message || "Connection failed" };
  }
}

/**
 * Universal LLM Completion call
 */
export async function callLLM(
  brain: ActiveBrain,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const prov = brain.provider;

  if (prov === "openai" || prov === "openrouter") {
    const endpoint =
      prov === "openrouter"
        ? "https://openrouter.ai/api/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brain.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: brain.model || (prov === "openrouter" ? "google/gemini-2.0-flash-001" : "gpt-4o-mini"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } else if (prov === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": brain.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: brain.model || "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic LLM call failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || "";
  } else if (prov === "google") {
    const model = brain.model || "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${brain.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google LLM call failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error(`Unsupported provider: ${prov}`);
}

/**
 * Clean job title and extract company name
 * Note: NEVER translate company names.
 */
export function sanitizeJobTitleAndOrg(rawTitle: string, rawOrg: string, url: string) {
  let title = (rawTitle || "").trim();
  let org = (rawOrg || "").trim();

  // If title has " - CompanyName" or " | CompanyName" or " at CompanyName"
  const splitMatch = title.split(/\s+[-|–—]\s+|\s+at\s+/i);
  if (splitMatch.length > 1) {
    title = splitMatch[0].trim();
    if (!org || org === "Company" || org.toLowerCase().includes("carrieres") || org.toLowerCase().includes("jobs")) {
      org = splitMatch[splitMatch.length - 1].trim();
    }
  }

  // Common French / foreign job abbreviations
  title = title
    .replace(/\bF\/H\b/gi, "(M/F)")
    .replace(/\bH\/F\b/gi, "(M/F)")
    .replace(/\bH\/X\b/gi, "(All Genders)")
    .trim();

  if (!org || org === "Company") {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace("www.", "").replace("carrieres.", "").replace("jobs.", "");
      org = host.split(".")[0];
      org = org.charAt(0).toUpperCase() + org.slice(1);
    } catch {
      org = "Company";
    }
  }

  return { title: title || "Job Opening", org: org || "Company" };
}

/**
 * Translate and extract title and organization to English.
 * MANDATE: Translate job title, but PRESERVE original company/agency name!
 */
export async function extractAndTranslateMetadata(
  rawTitle: string,
  rawOrg: string,
  pageSnippet: string,
  url: string,
  brain: ActiveBrain | null
): Promise<{ title: string; organization: string; detectedLang: string }> {
  const sanitized = sanitizeJobTitleAndOrg(rawTitle, rawOrg, url);

  // Use universal translation engine for title
  let translatedTitle = await translateJobTitle(sanitized.title);

  // If an active AI Brain is available, refine further
  if (brain) {
    const systemPrompt = `You are an expert job listing parser and translator.
CRITICAL RULES:
1. Translate ONLY the job title / position name into clean, natural English (e.g. "Commis de cuisine (F/H)" -> "Kitchen Assistant (M/F)").
2. NEVER translate the company or agency name (e.g. if company is "Del Arte", keep "Del Arte", NEVER translate to "Of Art").
3. Detect the page's original language code (e.g. "fr", "de", "it", "es", "en").
Return strictly JSON:
{
  "title": "Clean English Job Title",
  "organization": "Exact Original Company Name",
  "detectedLang": "two-letter language code"
}`;

    const userPrompt = `URL: ${url}
Raw Title: ${rawTitle}
Candidate Org Name: ${sanitized.org}
Page snippet:
${pageSnippet.slice(0, 800)}`;

    try {
      const response = await callLLM(brain, systemPrompt, userPrompt);
      const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.title) translatedTitle = parsed.title;
    } catch (err) {
      console.warn("LLM metadata refinement error:", err);
    }
  }

  return {
    title: translatedTitle,
    organization: sanitized.org, // Exact original company name preserved!
    detectedLang: "en",
  };
}

/**
 * Form matching engine with required vs optional detection and prefilled answers
 */
export async function matchFormFieldsWithProfile(
  formFields: FormFieldToMatch[],
  profileFields: { question: string; answer: string; embedding?: string | null }[],
  attachments: { question: string; filename: string; fileUrl: string }[],
  brain: ActiveBrain | null
): Promise<FormFieldMatchResult> {
  const allDetailedFields: DetailedFormField[] = [];

  let matchedCount = 0;
  let missingRequiredCount = 0;

  for (let i = 0; i < formFields.length; i++) {
    const field = formFields[i];
    const questionEn = translateToEnglishSync(field.label || field.placeholder || field.name);
    const rawLabel = cleanRawLabel(field.label || field.placeholder || field.name);
    const isAttachment = field.type === "file";
    const isRequired = field.isRequired;

    let currentVal = "";
    let isMatched = false;

    if (isAttachment) {
      const lowerQ = questionEn.toLowerCase();
      for (const att of attachments) {
        const attLower = att.question.toLowerCase();
        if (
          lowerQ.includes("cv") ||
          lowerQ.includes("resume") ||
          lowerQ.includes("curriculum")
        ) {
          if (attLower.includes("cv") || attLower.includes("resume") || attLower.includes("curriculum")) {
            currentVal = att.fileUrl;
            isMatched = true;
            break;
          }
        } else if (lowerQ.includes("cover") || lowerQ.includes("lettre")) {
          if (attLower.includes("cover") || attLower.includes("motivation")) {
            currentVal = att.fileUrl;
            isMatched = true;
            break;
          }
        } else if (attLower.includes(lowerQ) || lowerQ.includes(attLower)) {
          currentVal = att.fileUrl;
          isMatched = true;
          break;
        }
      }
    } else if (field.type === "checkbox") {
      if (/consent|privacy|politique|terms|condition/i.test(questionEn) || /consent|privacy/i.test(field.name)) {
        currentVal = "true";
        isMatched = true;
      }
    } else {
      const match = findBestProfileMatch(questionEn, profileFields, 0.65);
      if (match) {
        currentVal = match.match.answer;
        isMatched = true;
      } else {
        const qLower = questionEn.toLowerCase();
        for (const pf of profileFields) {
          const pfLower = pf.question.toLowerCase();
          if (
            qLower === pfLower ||
            (qLower.includes("first name") && pfLower.includes("first name")) ||
            (qLower.includes("last name") && (pfLower.includes("last name") || pfLower === "name")) ||
            (qLower.includes("email") && pfLower.includes("email")) ||
            (qLower.includes("phone") && pfLower.includes("phone"))
          ) {
            currentVal = pf.answer;
            isMatched = true;
            break;
          }
        }
      }
    }

    const hasAnswer = isMatched && currentVal.trim().length > 0;
    if (hasAnswer) {
      matchedCount++;
    } else if (isRequired) {
      missingRequiredCount++;
    }

    allDetailedFields.push({
      id: `f_${i}_${Math.random().toString(36).substring(2, 7)}`,
      selector: field.selector,
      name: field.name,
      type: field.type,
      questionEn,
      questionOriginal: rawLabel,
      currentVal,
      isMatched: hasAnswer,
      isRequired,
      isAttachment,
      placeholder: field.placeholder,
      options: field.options,
    });
  }

  return {
    allFields: allDetailedFields,
    matchedCount,
    missingRequiredCount,
    // Only block if REQUIRED fields are missing! Optional fields can be empty!
    hasUnansweredQuestions: missingRequiredCount > 0,
  };
}
