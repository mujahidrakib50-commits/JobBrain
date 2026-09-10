/**
 * Vector embeddings and semantic cosine similarity
 */

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates a local n-gram frequency hash vector (128 dimensions)
 * Provides fast, offline semantic similarity across synonyms, plurals, and translated variants.
 */
export function generateLocalEmbedding(text: string): number[] {
  const DIMENSIONS = 128;
  const vector = new Array(DIMENSIONS).fill(0);
  if (!text) return vector;

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (e.g., French accents: prénom -> prenom)
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);

  // Common synonym map to project equivalent concepts to similar buckets
  const SYNONYM_MAP: Record<string, string> = {
    prenom: "firstname",
    first: "firstname",
    given: "firstname",
    forename: "firstname",
    nom: "lastname",
    family: "lastname",
    surname: "lastname",
    last: "lastname",
    email: "email",
    courriel: "email",
    mail: "email",
    tel: "phone",
    telephone: "phone",
    phone: "phone",
    mobile: "phone",
    portable: "phone",
    salary: "salary",
    remuneration: "salary",
    salaire: "salary",
    compensation: "salary",
    pay: "salary",
    cv: "resume",
    resume: "resume",
    curriculum: "resume",
    letter: "coverletter",
    motivation: "coverletter",
    address: "address",
    adresse: "address",
    city: "city",
    ville: "city",
    zip: "postalcode",
    postal: "postalcode",
    country: "country",
    pays: "country",
    license: "driverlicense",
    permis: "driverlicense",
    driving: "driverlicense",
    experience: "experience",
    education: "education",
    studies: "education",
    diploma: "education",
    degree: "education",
  };

  const processedWords = words.map((w) => SYNONYM_MAP[w] || w);

  // Add word hashes
  for (const word of processedWords) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) & 0x7fffffff;
    }
    vector[hash % DIMENSIONS] += 2.0;

    // Add character 3-grams
    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        const trigram = word.substring(i, i + 3);
        let thash = 0;
        for (let j = 0; j < trigram.length; j++) {
          thash = (thash * 37 + trigram.charCodeAt(j)) & 0x7fffffff;
        }
        vector[thash % DIMENSIONS] += 1.0;
      }
    }
  }

  // Normalize vector to unit length
  const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < DIMENSIONS; i++) {
      vector[i] /= mag;
    }
  }

  return vector;
}

/**
 * Check match between a target form question and stored profile questions.
 * Returns the best matching profile field and confidence score (0 to 1).
 */
export function findBestProfileMatch<T extends { question: string; embedding?: string | null }>(
  targetQuestion: string,
  profileFields: T[],
  threshold = 0.65
): { match: T; score: number } | null {
  if (!targetQuestion || profileFields.length === 0) return null;

  const targetVec = generateLocalEmbedding(targetQuestion);
  let bestMatch: T | null = null;
  let bestScore = -1;

  for (const field of profileFields) {
    let fieldVec: number[];
    if (field.embedding) {
      try {
        fieldVec = JSON.parse(field.embedding);
      } catch {
        fieldVec = generateLocalEmbedding(field.question);
      }
    } else {
      fieldVec = generateLocalEmbedding(field.question);
    }

    const score = cosineSimilarity(targetVec, fieldVec);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = field;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { match: bestMatch, score: bestScore };
  }

  return null;
}
