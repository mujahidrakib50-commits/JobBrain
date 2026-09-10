import { chromium, Browser, BrowserContext, Page, Frame } from "playwright";
import {
  ActiveBrain,
  FormFieldToMatch,
  matchFormFieldsWithProfile,
  extractAndTranslateMetadata,
  DetailedFormField,
} from "./ai";
import path from "path";
import fs from "fs";

let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!globalBrowser || !globalBrowser.isConnected()) {
    globalBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return globalBrowser;
}

/**
 * Dismiss cookie banners and consent overlays
 */
export async function dismissBanners(page: Page) {
  try {
    const cookieSelectors = [
      'button:has-text("Accepter")',
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Tout accepter")',
      '#didomi-notice-agree-button',
      '#onetrust-accept-btn-handler',
      '.axeptio_btn_accept',
      'button[id*="cookie"]',
      'button[class*="cookie"]',
    ];
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel);
      if (btn && (await btn.isVisible().catch(() => false))) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(800);
        break;
      }
    }
  } catch (e) {}
}

/**
 * Detect CAPTCHA signatures on the page
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    const hasCaptchaKeyword =
      /cf-turnstile|cf-challenge|recaptcha|hcaptcha|g-recaptcha|arkoselabs|verify you are human|bot detection/i.test(
        content
      );
    if (hasCaptchaKeyword) {
      const captchaElements = await page.$$(
        "iframe[src*='recaptcha'], iframe[src*='hcaptcha'], iframe[src*='turnstile'], .cf-turnstile, #cf-wrapper"
      );
      if (captchaElements.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Locate and trigger the application form
 */
export async function locateAndOpenApplicationForm(page: Page) {
  await dismissBanners(page);

  // Check if an application form is already visible
  const visibleForm = await page.$(
    'form:has(input[type="file"]), form:has(input[name*="candidate"]), form:has(input[name*="applicant"]), form:has(input[type="email"])'
  );
  if (visibleForm && (await visibleForm.isVisible().catch(() => false))) {
    return;
  }

  // Look for apply trigger
  const applySelectors = [
    'button:has-text("Postuler")',
    'a:has-text("Postuler")',
    'button:has-text("Candidater")',
    'a:has-text("Candidater")',
    'button:has-text("Apply")',
    'a:has-text("Apply")',
    'button:has-text("Bewerben")',
    'a:has-text("Bewerben")',
    'button:has-text("Invia candidatura")',
    'a:has-text("Invia candidatura")',
    'a[href*="apply"]',
    'a[href*="postuler"]',
    'a[href*="candidat"]',
    '[data-action*="apply"]',
    '[class*="apply-button"]',
  ];

  for (const sel of applySelectors) {
    const el = await page.$(sel);
    if (el && (await el.isVisible().catch(() => false))) {
      const href = await el.getAttribute("href");

      // If apply button leads to external or sub-page
      if (
        href &&
        (href.startsWith("http://") || href.startsWith("https://")) &&
        !href.startsWith(page.url()) &&
        !href.startsWith("#")
      ) {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2000);
        await dismissBanners(page);
        return;
      }

      // Click the button on page
      await el.click().catch(() => {});
      await page.waitForTimeout(2500);
      await dismissBanners(page);
      return;
    }
  }

  // Fallback: Scroll down to bottom where forms often reside
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

/**
 * Scrape basic job metadata (Title in English, original Company name, Language) from a URL
 */
export async function scrapeJobDetails(
  url: string,
  brain: ActiveBrain | null
): Promise<{
  title: string;
  organization: string;
  detectedLang: string;
  hasCaptcha: boolean;
}> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);
    await dismissBanners(page);

    const isCaptcha = await detectCaptcha(page);
    if (isCaptcha) {
      return {
        title: "Protected Application",
        organization: new URL(url).hostname.replace("www.", ""),
        detectedLang: "en",
        hasCaptcha: true,
      };
    }

    // Extract title
    let rawTitle = "";
    const h1 = await page.$("h1");
    if (h1) {
      rawTitle = (await h1.innerText().catch(() => "")) || "";
    }
    if (!rawTitle) {
      rawTitle = await page.title();
    }

    // Extract organization
    let rawOrg = "";
    const metaOrg = await page.$(
      'meta[property="og:site_name"], meta[name="author"], meta[name="company"], [class*="company"], [class*="organization"], [class*="employer"]'
    );
    if (metaOrg) {
      const content = await metaOrg.getAttribute("content");
      if (content) {
        rawOrg = content;
      } else {
        rawOrg = (await metaOrg.innerText().catch(() => "")) || "";
      }
    }

    // Detect language
    const htmlLang = (await page.getAttribute("html", "lang")) || "en";
    const detectedLang = htmlLang.slice(0, 2).toLowerCase();

    // Body snippet for LLM context
    const bodyText = (await page.innerText("body").catch(() => "")).slice(0, 1000);

    const translated = await extractAndTranslateMetadata(rawTitle, rawOrg, bodyText, url, brain);

    return {
      title: translated.title || rawTitle || "Job Opening",
      organization: translated.organization || rawOrg || "Company",
      detectedLang: translated.detectedLang || detectedLang || "en",
      hasCaptcha: false,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Extract application form fields with required vs optional detection
 */
export async function extractFormFields(page: Page): Promise<FormFieldToMatch[]> {
  const candidateFrames: (Page | Frame)[] = [page, ...page.frames()];

  for (const frame of candidateFrames) {
    const fields = await frame.evaluate(() => {
      // Find candidate application container
      let container: Element | null = document.querySelector(
        'form:has(input[type="file"]), form:has(input[name*="candidate"]), form:has(input[name*="applicant"]), form:has(input[type="email"])'
      );
      if (!container) {
        container = document.querySelector('form[action*="application"], form[action*="candidat"], form[id*="apply"], form[class*="apply"]');
      }
      if (!container) {
        container = document.body;
      }

      const elements = Array.from(container.querySelectorAll<HTMLElement>("input, textarea, select"));

      const valid = elements.filter((el) => {
        const type = (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase();
        if (["hidden", "submit", "button", "reset", "search"].includes(type)) return false;

        const name = (el.getAttribute("name") || "").toLowerCase();
        const id = (el.getAttribute("id") || "").toLowerCase();
        const cls = (el.className || "").toLowerCase();

        // Discard search inputs
        if (name.includes("search") || id.includes("search") || cls.includes("search")) return false;
        if (name === "q" || name === "query") return false;
        if (el.closest('header, nav, footer, [class*="search"], [id*="search"]')) return false;

        // Check visibility
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          if (type !== "file") return false;
        }

        return true;
      });

      return valid.map((el, i) => {
        const tagName = el.tagName.toLowerCase();
        const type = (el.getAttribute("type") || (tagName === "textarea" ? "textarea" : tagName === "select" ? "select" : "text")).toLowerCase();
        const name = el.getAttribute("name") || "";
        const id = el.getAttribute("id") || "";
        const placeholder = el.getAttribute("placeholder") || "";

        let labelEl: Element | null = null;
        if (id) {
          labelEl = document.querySelector(`label[for="${id}"]`);
        }
        if (!labelEl) {
          labelEl = el.closest("label");
        }
        if (!labelEl && el.parentElement) {
          const prev = el.previousElementSibling;
          if (prev && ["label", "span", "p", "div"].includes(prev.tagName.toLowerCase())) {
            labelEl = prev;
          } else {
            labelEl = el.parentElement;
          }
        }

        // Required vs Optional check
        const hasReqAttr = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
        const rawLabelText = labelEl ? labelEl.textContent || "" : "";
        const labelHtml = labelEl ? labelEl.innerHTML || "" : "";
        const hasStar =
          rawLabelText.includes("*") ||
          labelHtml.includes("abbr") ||
          /\brequis\b|\brequired\b|\bobligatoire\b|\bpflichtfeld\b/i.test(labelHtml);
        const isRequired = hasReqAttr || hasStar;

        // Clean label text: clone and strip out abbr / required badges
        let cleanText = "";
        if (labelEl) {
          const clone = labelEl.cloneNode(true) as HTMLElement;
          const toRemove = clone.querySelectorAll("abbr, .required, [title*='equis'], [title*='equired'], span");
          toRemove.forEach((r) => {
            if (r.textContent && (r.textContent.includes("*") || /\brequis\b|\brequired\b/i.test(r.textContent))) {
              r.remove();
            }
          });
          cleanText = (clone.textContent || "").replace(/[*:]/g, "").replace(/\s+/g, " ").trim();
        }

        if (!cleanText) {
          cleanText = placeholder || name || id || `Field ${i + 1}`;
        }

        let selector = "";
        if (id) {
          selector = `#${CSS.escape(id)}`;
        } else if (name) {
          selector = `${tagName}[name="${CSS.escape(name)}"]`;
        } else {
          selector = `${tagName}:nth-of-type(${i + 1})`;
        }

        let options: string[] | undefined = undefined;
        if (tagName === "select") {
          options = Array.from((el as HTMLSelectElement).options).map((o) => o.text.trim());
        }

        return {
          selector,
          name,
          type,
          label: cleanText,
          isRequired,
          placeholder,
          options,
        };
      });
    });

    if (fields.length > 0) {
      return fields;
    }
  }

  return [];
}

/**
 * Detects if the page displays an 'already submitted' / 'already applied' notification
 */
async function detectAlreadySubmitted(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // 1. Check alert / toast / notification containers
    const alertElements = document.querySelectorAll(
      '[role="alert"], .alert, .toast, .notification, .notice, .error, .banner, .flash, .message, .form-message, .status-message, [class*="alert"], [class*="notification"], [class*="error"], [class*="warning"]'
    );

    const alertPatterns = [
      /already\s+(applied|submitted)/i,
      /application\s+(has\s+already\s+been|already)\s+(received|submitted)/i,
      /you('ve|\s+have)\s+already\s+(applied|submitted)/i,
      /previously\s+applied/i,
      /d[eé]j[aà]\s+(postul[eé]|candidat[eé]|envoy[eé]|transmise)/i,
      /vous\s+avez\s+d[eé]j[aà]\s+postul[eé]/i,
      /candidature\s+d[eé]j[aà]/i,
      /bereits\s+(beworben|eingereicht)/i,
      /sie\s+haben\s+sich\s+bereits\s+beworben/i,
      /ya\s+(has\s+|te\s+has\s+)?(postulado|aplicado)/i,
      /hai\s+gi[aà]\s+(inviato|candidato)/i,
    ];

    for (const el of Array.from(alertElements)) {
      const text = (el.textContent || "").trim();
      if (text.length > 0 && text.length < 500) {
        if (alertPatterns.some((pat) => pat.test(text))) {
          return true;
        }
      }
    }

    // 2. Check full visible text for explicit sentences
    const bodyText = (document.body?.innerText || "").slice(0, 10000);
    const explicitBodyPatterns = [
      /you('ve|\s+have)\s+already\s+applied/i,
      /you('ve|\s+have)\s+already\s+submitted/i,
      /an\s+application\s+has\s+already\s+been\s+submitted/i,
      /application\s+already\s+received/i,
      /vous\s+avez\s+d[eé]j[aà]\s+postul[eé]/i,
      /votre\s+candidature\s+a\s+d[eé]j[aà]\s+[eé]t[eé]\s+(enregistr[eé]e|envoy[eé]e|prise)/i,
      /candidature\s+d[eé]j[aà]\s+transmise/i,
      /sie\s+haben\s+sich\s+bereits\s+auf\s+diese\s+stelle\s+beworben/i,
      /ya\s+te\s+has\s+postulado\s+a\s+esta\s+oferta/i,
    ];

    return explicitBodyPatterns.some((pat) => pat.test(bodyText));
  }).catch(() => false);
}

/**
 * Execute automation for an applying task
 */
export async function processJobApplication(params: {
  url: string;
  profileFields: { question: string; answer: string }[];
  attachments: { question: string; filename: string; fileUrl: string }[];
  brain: ActiveBrain | null;
}): Promise<{
  success: boolean;
  status: "APPLIED" | "WAITING" | "FAILED" | "ALREADY_SUBMITTED";
  formFields?: DetailedFormField[];
  captchaDetected?: boolean;
  error?: string;
}> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  try {
    await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2000);

    // 1. CAPTCHA Check
    const hasCaptcha = await detectCaptcha(page);
    if (hasCaptcha) {
      return {
        success: false,
        status: "WAITING",
        captchaDetected: true,
        error: "CAPTCHA detected on application page.",
      };
    }

    // 2. Open / Locate Form & dismiss cookies
    await locateAndOpenApplicationForm(page);

    // 3. Extract form fields
    const formFields = await extractFormFields(page);

    if (formFields.length === 0) {
      return {
        success: false,
        status: "WAITING",
        error: "Could not detect application form. Please verify the link or submit manually.",
        formFields: [
          {
            id: "f_manual_link",
            selector: "body",
            name: "manual",
            type: "text",
            questionEn: "Application Form Not Found Automatically",
            questionOriginal: "Application Form",
            currentVal: "",
            isMatched: false,
            isRequired: true,
            isAttachment: false,
            placeholder: "Open link to apply directly if external portal is used",
          },
        ],
      };
    }

    // 4. Match form fields with profile
    const matchResult = await matchFormFieldsWithProfile(
      formFields,
      params.profileFields,
      params.attachments,
      params.brain
    );

    // 5. If any REQUIRED questions are missing, pause and move to WAITING
    if (matchResult.hasUnansweredQuestions) {
      return {
        success: false,
        status: "WAITING",
        formFields: matchResult.allFields,
      };
    }

    // 6. Fill all fields (matched ones; skip empty optional ones)
    for (const field of matchResult.allFields) {
      if (!field.currentVal || field.currentVal.trim().length === 0) {
        // Empty optional field: skip
        continue;
      }

      try {
        const locator = page.locator(field.selector).first();
        const count = await locator.count();
        if (count === 0) continue;

        if (field.isAttachment) {
          let localFilePath = field.currentVal;
          if (!fs.existsSync(localFilePath)) {
            const candidate = path.join(process.cwd(), "uploads", path.basename(field.currentVal));
            if (fs.existsSync(candidate)) localFilePath = candidate;
          }
          if (fs.existsSync(localFilePath)) {
            await locator.setInputFiles(localFilePath).catch((e) => {
              console.warn(`File upload error on ${field.selector}:`, e);
            });
          }
        } else if (field.type === "checkbox" || field.type === "radio") {
          if (/true|yes|oui|ja|1/i.test(field.currentVal)) {
            await locator.check().catch(() => {});
          }
        } else if (field.type === "select") {
          await locator.selectOption({ label: field.currentVal }).catch(async () => {
            await locator.selectOption({ value: field.currentVal }).catch(() => {});
          });
        } else {
          await locator.fill(field.currentVal).catch(() => {});
        }
      } catch (err) {
        console.warn(`Error filling ${field.selector}:`, err);
      }
    }

    // 7. Submit form
    await page.waitForTimeout(1000);
    const submitBtn = await page.$(
      'input[type="submit"], button[type="submit"], button:has-text("Postuler"), button:has-text("Envoyer"), button:has-text("Submit"), button:has-text("Apply"), button:has-text("Candidater"), button:has-text("Invia")'
    );

    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
        submitBtn.click(),
      ]);
    }

    await page.waitForTimeout(2500);

    // Check if notification appeared saying already submitted
    const isAlreadySubmitted = await detectAlreadySubmitted(page);

    if (isAlreadySubmitted) {
      console.log("Detected 'already submitted' notification. Retrying submission one last time as requested...");
      await page.waitForTimeout(2000);

      // Try to apply one last time
      const retrySubmitBtn = await page.$(
        'input[type="submit"], button[type="submit"], button:has-text("Postuler"), button:has-text("Envoyer"), button:has-text("Submit"), button:has-text("Apply"), button:has-text("Candidater"), button:has-text("Invia")'
      );
      if (retrySubmitBtn) {
        await Promise.all([
          page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
          retrySubmitBtn.click(),
        ]).catch(() => {});
        await page.waitForTimeout(2500);
      }

      // If it still says already submitted, report ALREADY_SUBMITTED so the task will be deleted
      const stillAlreadySubmitted = await detectAlreadySubmitted(page);
      if (stillAlreadySubmitted) {
        console.log("Still says already submitted after retry. Task will be automatically deleted.");
        return {
          success: false,
          status: "ALREADY_SUBMITTED",
          error: "You have already submitted an application for this position. Task removed.",
        };
      }
    }

    return {
      success: true,
      status: "APPLIED",
      formFields: matchResult.allFields,
    };
  } catch (err: any) {
    return {
      success: false,
      status: "FAILED",
      error: err.message || "Application submission failed",
    };
  } finally {
    await context.close().catch(() => {});
  }
}
