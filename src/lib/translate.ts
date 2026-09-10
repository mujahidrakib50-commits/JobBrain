/**
 * Multilingual dictionary and translation utilities for international job portals
 * Covers French, German, Italian, Spanish, Dutch, and Portuguese job application terms
 */

const DICTIONARY: Record<string, string> = {
  // Personal & contact details
  "prenom": "First Name",
  "first name": "First Name",
  "nom": "Last Name",
  "last name": "Last Name",
  "nom de famille": "Last Name",
  "surname": "Last Name",
  "family name": "Last Name",
  "name": "Last Name",
  "e-mail": "Email",
  "email": "Email",
  "courriel": "Email",
  "telephone": "Phone",
  "numero de telephone": "Phone",
  "phone": "Phone",
  "portable": "Mobile Phone",
  "mobile": "Mobile Phone",
  "adresse": "Address",
  "address": "Address",
  "ville": "City",
  "city": "City",
  "code postal": "Postal Code",
  "postal code": "Postal Code",
  "zip": "Postal Code",
  "pays": "Country",
  "country": "Country",
  "date de naissance": "Date of Birth",
  "date of birth": "Date of Birth",
  "nationalite": "Nationality",

  // Documents & attachments
  "importer un cv": "Upload CV / Resume",
  "import a cv": "Upload CV / Resume",
  "cv": "Upload CV / Resume",
  "curriculum vitae": "Upload CV / Resume",
  "resume": "Upload CV / Resume",
  "fichiers supplementaires": "Additional Files",
  "additional files": "Additional Files",
  "autres documents": "Additional Documents",
  "lettre de motivation": "Cover Letter",
  "cover letter": "Cover Letter",
  "message au recruteur": "Message to Recruiter",
  "photo": "Profile Photo",

  // Questions & terms
  "salaire souhaite": "Expected Salary",
  "pretentions salariales": "Salary Expectations",
  "expected salary": "Expected Salary",
  "remuneration": "Expected Compensation",
  "permis de conduire": "Driver's License",
  "driver's license": "Driver's License",
  "permis b": "Driver's License (Category B)",
  "vehicule personnel": "Personal Vehicle",
  "disponibilite": "Availability / Notice Period",
  "preavis": "Notice Period",
  "annees d'experience": "Years of Experience",
  "experience": "Years of Experience",
  "niveau d'etudes": "Education Level",
  "diplome": "Highest Diploma / Degree",
  "anglais": "English Proficiency",
  "consentement": "Data Privacy Consent",
  "politique de confidentialite": "Privacy Policy Agreement",

  // German (DE)
  "vorname": "First Name",
  "nachname": "Last Name",
  "geburtsdatum": "Date of Birth",
  "lebenslauf": "Upload CV / Resume",
  "anschreiben": "Cover Letter",
  "zeugnisse": "Certificates / Diplomas",
  "weitere dokumente": "Additional Documents",
  "fuehrerschein": "Driver's License",

  // Italian (IT)
  "cognome": "Last Name",
  "allega cv": "Upload CV / Resume",
  "curriculum": "Upload CV / Resume",
  "lettera di presentazione": "Cover Letter",
  "lettera motivazionale": "Cover Letter",
  "patente": "Driver's License",

  // Spanish (ES)
  "apellidos": "Last Name",
  "adjuntar cv": "Upload CV / Resume",
  "carta de presentacion": "Cover Letter",
  "permiso de conducir": "Driver's License",
};

/**
 * Clean unwanted metadata text from label (e.g. "Requis", "Required", "*", etc.)
 */
export function cleanRawLabel(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    .replace(/\b(requis|required|obligatoire|pflichtfeld|obbligatorio|campo obligatorio)\b/gi, " ")
    .replace(/[*:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/politique de confidentialit|privacy policy|protection des donn|consens à ce que/i.test(cleaned)) {
    if (/future.*opportunit|recontact/i.test(cleaned)) {
      return "Consent to be contacted for future job opportunities";
    }
    return "Data privacy policy consent";
  }

  return cleaned;
}

/**
 * Normalizes text for dictionary lookup
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Translate a form field question or label into clean English
 */
export function translateToEnglishSync(rawLabel: string): string {
  const cleaned = cleanRawLabel(rawLabel);
  if (!cleaned) return "Form Field";

  const norm = normalizeKey(cleaned);

  if (DICTIONARY[norm]) {
    return DICTIONARY[norm];
  }

  for (const [key, translated] of Object.entries(DICTIONARY)) {
    if (norm === key || norm.startsWith(key + " ") || norm.endsWith(" " + key)) {
      return translated;
    }
  }

  if (norm === "nom" || norm.endsWith(" nom")) {
    return "Last Name";
  }
  if (norm === "prenom") {
    return "First Name";
  }

  if (/^importer|^telecharger|^charger|^upload|^adjuntar|^hochladen/.test(norm)) {
    if (norm.includes("cv") || norm.includes("resume")) return "Upload CV / Resume";
    if (norm.includes("lettre") || norm.includes("cover")) return "Cover Letter";
    return "Upload Document";
  }

  if (norm.includes("lettre de motivation") || norm.includes("lettera") || norm.includes("anschreiben") || norm === "cover letter") {
    return "Cover Letter";
  }

  if (norm.includes("fichiers") || norm.includes("additional files") || norm.includes("autres documents")) {
    return "Additional Files";
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Universally translate any foreign Job Title to English
 */
export async function translateJobTitle(rawTitle: string): Promise<string> {
  if (!rawTitle) return "Job Opening";

  // Check common phrases first
  if (/commis de cuisine/i.test(rawTitle)) {
    return "Kitchen Assistant (M/F)";
  }

  // Strip company suffix e.g. " - Del Arte"
  let clean = rawTitle.replace(/\s+[-|–—]\s+.*$/, "").trim();

  // Check gender indicators
  const hasMF = /\bF\/H\b|\bH\/F\b|\b\(F\/H\)\b|\b\(H\/F\)\b|\bm\/w\/d\b/i.test(rawTitle);
  clean = clean.replace(/\bF\/H\b|\bH\/F\b|\b\(F\/H\)\b|\b\(H\/F\)\b|\bm\/w\/d\b/gi, "").trim();

  // Attempt free universal translation
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
        let translated = data[0].map((item: any) => item[0]).join("").trim();
        if (translated) {
          translated = translated.charAt(0).toUpperCase() + translated.slice(1);
          if (hasMF && !translated.includes("(M/F)")) {
            translated += " (M/F)";
          }
          return translated;
        }
      }
    }
  } catch (e) {
    // Ignore translation API failure
  }

  return rawTitle;
}
