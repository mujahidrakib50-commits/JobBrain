import { ActiveBrain, callLLM } from "./ai";

export type EmailCategory = "REJECTION" | "POSITIVE" | "JOB_MATCH" | "IGNORE";

/**
 * Fast multi-language keyword heuristics for job emails
 */
function heuristicClassify(subject: string, bodyText: string, sender: string): EmailCategory | null {
  const combined = `${subject} ${bodyText} ${sender}`.toLowerCase();

  // 1. Explicit Rejection patterns
  const rejectionPatterns = [
    /unfortunately/i,
    /regret to inform/i,
    /not (been )?selected/i,
    /not moving forward/i,
    /pursue other candidates/i,
    /decided to proceed with other/i,
    /moved forward with another/i,
    /application was not successful/i,
    /won't be moving forward/i,
    /ne serons pas en mesure de/i,
    /malheureusement/i,
    /pas retenu/i,
    /votre candidature n'a pas/i,
    /ne donnerons pas suite/i,
    /d'autres profils/i,
    /leider müssen wir/i,
    /haben uns für einen anderen/i,
    /lamentamos informarle/i,
    /no continuaremos/i,
    /purtroppo/i,
    /non possiamo dare seguito/i,
  ];

  if (rejectionPatterns.some((pattern) => pattern.test(combined))) {
    return "REJECTION";
  }

  // 2. Explicit Positive / Next Steps / Interview patterns
  const positivePatterns = [
    /invitation to interview/i,
    /interview invite/i,
    /schedule an interview/i,
    /speak with you/i,
    /next steps/i,
    /phone screen/i,
    /coding assessment/i,
    /technical interview/i,
    /offer letter/i,
    /congratulations.*offer/i,
    /welcome to the team/i,
    /would love to learn more/i,
    /entretien d'embauche/i,
    /convoqué à un entretien/i,
    /échanger avec vous/i,
    /première étape/i,
    /nous aimerions échanger/i,
    /invitación a entrevista/i,
    /einladung zum vorstellungsgespräch/i,
    /colloquio conoscitivo/i,
    /invito al colloquio/i,
  ];

  if (positivePatterns.some((pattern) => pattern.test(combined))) {
    return "POSITIVE";
  }

  // 3. New Job Postings / Recommendations / Matching
  const jobMatchPatterns = [
    /new job(s)? (matching|recommended|for you)/i,
    /recommended jobs/i,
    /jobs you may be interested in/i,
    /new openings/i,
    /matching job alert/i,
    /top job picks/i,
    /job opportunities that match/i,
    /matches your profile/i,
    /recruiter reached out/i,
    /are you interested in a new role/i,
    /nouvelles offres/i,
    /offres correspondant à/i,
    /alerte emploi/i,
    /postes qui pourraient vous/i,
    /neue stellenangebote/i,
    /empleos recomendados/i,
    /nuove offerte di lavoro/i,
  ];

  if (jobMatchPatterns.some((pattern) => pattern.test(combined))) {
    return "JOB_MATCH";
  }

  // If sender is a major job portal/alert service
  if (/linkedin\.com|indeed\.com|glassdoor\.com|monster\.com|welcome to the jungle|meteojob/i.test(sender)) {
    if (/alert|recommend|opportunit|match|postes|offres|jobs/i.test(subject)) {
      return "JOB_MATCH";
    }
  }

  return null;
}

/**
 * Classify email using AI Brain (Gemini, Claude, GPT) or Heuristics fallback
 */
export async function classifyJobEmail(
  email: {
    subject: string;
    sender: string;
    snippet: string;
    bodyText: string;
  },
  brain: ActiveBrain | null
): Promise<EmailCategory> {
  // Step 1: Check heuristic patterns first
  const heuristicResult = heuristicClassify(email.subject, email.bodyText, email.sender);
  if (heuristicResult) {
    return heuristicResult;
  }

  // Step 2: If we have an AI Brain, ask it to accurately classify
  if (brain) {
    try {
      const systemPrompt = `You are an expert AI Job Application & Career Email Classifier.
Classify the given email into EXACTLY ONE of the following 4 categories:
- REJECTION: The email declines or rejects a job application, or states they chose other candidates.
- POSITIVE: The email invites to an interview, phone screen, coding test, offers next steps, expresses strong interest, or extends an offer.
- JOB_MATCH: The email is a job alert, new job recommendations matching the profile, or recruiter outreach about an open role.
- IGNORE: The email is NOT related to job applications or career opportunities (e.g. personal, marketing, receipts, newsletter, spam).

Respond with ONLY ONE WORD: REJECTION, POSITIVE, JOB_MATCH, or IGNORE.`;

      const userPrompt = `Email From: ${email.sender}
Subject: ${email.subject}
Snippet: ${email.snippet}
Body Preview:
${email.bodyText.slice(0, 1000)}`;

      const response = await callLLM(brain, systemPrompt, userPrompt);
      const cleanResp = response.trim().toUpperCase();

      if (cleanResp.includes("REJECTION")) return "REJECTION";
      if (cleanResp.includes("POSITIVE")) return "POSITIVE";
      if (cleanResp.includes("JOB_MATCH")) return "JOB_MATCH";
      if (cleanResp.includes("IGNORE")) return "IGNORE";
    } catch (err) {
      console.warn("AI Email Classification failed, relying on heuristics:", err);
    }
  }

  // Step 3: Check if general job application confirmation
  const combined = `${email.subject} ${email.bodyText}`.toLowerCase();
  if (
    /application received|candidature bien reçue|candidature enregistrée|confirmation of application|thank you for applying|merci pour votre candidature|vielen dank für ihre bewerbung/i.test(
      combined
    )
  ) {
    // Application acknowledgment is a positive/fair response
    return "POSITIVE";
  }

  // If it doesn't match any job category, ignore it
  return "IGNORE";
}