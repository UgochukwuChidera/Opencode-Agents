/**
 * AI Senior Aggregator Tool
 *
 * Senior AI detection aggregator that compiles results from multiple
 * AI detectors (humanizer-mcp, ai-humanizer-mcp, custom detector) and
 * produces a single critical verdict with weighted aggregation, critical
 * overrides, dimension breakdown, and actionable recommendations.
 *
 * If no custom detector result is provided, the senior runs its own
 * independent analysis using paragraph uniformity, contraction density,
 * sentence-start diversity, AI vocabulary density, structural fingerprints,
 * transition words, rhetorical questions, and hedging analysis.
 */
import { tool } from "@opencode-ai/plugin";

// ═══════════════════════════════════════════════════════════════════
// WORD LISTS
// ═══════════════════════════════════════════════════════════════════

const AI_VOCABULARY = [
  "delve", "delve into", "delve deeper",
  "crucial",
  "arguably",
  "nuanced", "nuance",
  "tapestry",
  "leverage", "leveraging", "leveraged",
  "utilize", "utilization", "utilized", "utilizing",
  "paradigm", "paradigm shift",
  "transformative",
  "groundbreaking",
  "cutting-edge", "cutting edge",
  "state-of-the-art", "state of the art",
  "holistic", "holistically",
  "robust", "robustness",
  "seamless", "seamlessly",
  "empower", "empowering", "empowerment",
  "facilitate", "facilitates", "facilitating",
  "catalyze", "catalyzes", "catalyzing",
  "revolutionize", "revolutionizing",
  "innovative",
  "dynamic",
  "synergy", "synergies",
  "optimize", "optimizing", "optimization",
  "streamline", "streamlining",
  "bespoke",
  "game-changer", "game changer", "game-changing",
  "ever-evolving", "ever evolving",
  "rapidly evolving",
  "in the realm of",
  "it is important to note", "it is worth noting",
  "notably",
  "multifaceted",
  "cornerstone",
  "pivotal",
  "paramount",
  "unprecedented",
  "in today's digital",
  "fueled", "fuelled",
  "metamorphosis",
  "vibrant",
  "complexities",
  "navigate the",
  "interconnected",
  "thriving",
  "constantly evolving",
  "myriad",
  "plethora",
  "vast array",
  "countless",
  "first and foremost",
  "when it comes to",
  "in terms of",
  "in the context of",
  "in the world of",
  "the future of",
  "the power of",
  "the importance of",
  "the role of",
  "the impact of",
  "the need for",
  "the lack of",
  "the use of",
  "the concept of",
  "the idea of",
  "the notion of",
  "the realm of",
  "the landscape of",
  "the field of",
  "increasingly",
  "significant", "significantly",
  "comprehensive", "comprehensively",
  "tailored",
  "end-to-end", "end to end",
  "world-class", "world class",
  "scalable", "scalability",
  "actionable",
  "purpose-built",
  "mission-critical",
  "unlock the",
  "unleash",
  "supercharge",
];

const HEDGE_WORDS = [
  "might", "could", "perhaps", "possibly", "arguably",
  "may", "maybe", "presumably", "seemingly",
  "appears", "apparently", "tends to",
  "typically", "usually", "often", "sometimes",
  "can be considered",
  "it could be argued", "one could argue",
  "to some extent", "in some cases",
  "generally speaking", "broadly speaking",
  "relatively", "fairly",
  "somewhat", "rather",
];

const TRANSITION_WORDS = [
  "however", "therefore", "consequently", "additionally",
  "furthermore", "moreover", "nevertheless", "nonetheless",
  "notwithstanding", "thus", "hence", "accordingly",
  "alternatively", "conversely", "meanwhile", "subsequently",
  "in addition", "as a result", "for example", "for instance",
  "in contrast", "on the other hand", "in particular",
  "specifically", "importantly", "notably",
  "similarly", "likewise", "further", "besides",
  "otherwise", "instead",
];

const CONTRACTIONS_LIST = [
  "don't", "don\u2019t", "doesn't", "doesn\u2019t", "didn't", "didn\u2019t",
  "can't", "can\u2019t", "couldn't", "couldn\u2019t", "wouldn't", "wouldn\u2019t",
  "shouldn't", "shouldn\u2019t", "won't", "won\u2019t", "wouldn't", "wouldn\u2019t",
  "i'm", "i\u2019m", "you're", "you\u2019re", "he's", "he\u2019s",
  "she's", "she\u2019s", "it's", "it\u2019s", "we're", "we\u2019re",
  "they're", "they\u2019re",
  "i've", "i\u2019ve", "you've", "you\u2019ve", "we've", "we\u2019ve",
  "they've", "they\u2019ve",
  "i'll", "i\u2019ll", "you'll", "you\u2019ll", "he'll", "he\u2019ll",
  "she'll", "she\u2019ll", "it'll", "it\u2019ll", "we'll", "we\u2019ll",
  "they'll", "they\u2019ll",
  "isn't", "isn\u2019t", "aren't", "aren\u2019t", "wasn't", "wasn\u2019t",
  "weren't", "weren\u2019t",
  "hasn't", "hasn\u2019t", "haven't", "haven\u2019t", "hadn't", "hadn\u2019t",
  "mustn't", "mustn\u2019t", "needn't", "needn\u2019t",
  "let's", "let\u2019s",
  "that's", "that\u2019s", "there's", "there\u2019s", "here's", "here\u2019s",
  "who's", "who\u2019s", "what's", "what\u2019s",
  "where's", "where\u2019s", "why's", "why\u2019s",
  "how's", "how\u2019s",
  "y'all", "y\u2019all",
];

const HEDGE_OPENERS = [
  "it is important to note that",
  "it should be noted that",
  "it is worth noting that",
  "it is essential to",
  "it is crucial to",
  "it is necessary to",
  "it is interesting to",
  "it is significant that",
  "it should be mentioned",
  "it bears mentioning",
  "it goes without saying",
  "needless to say",
  "as we have seen",
  "as discussed",
  "as mentioned",
  "as previously noted",
  "as stated",
];

const RESOLUTION_CLOSERS = [
  "in conclusion",
  "to conclude",
  "in summary",
  "to summarize",
  "in closing",
  "to sum up",
  "all in all",
  "in the final analysis",
  "ultimately",
  "taking everything into account",
  "when all is said and done",
  "at the end of the day",
];

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function countWords(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function countSentences(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

function countParagraphs(text) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return Math.max(paragraphs.length, 1);
}

function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return (Math.sqrt(variance) / mean) * 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Count occurrences of phrases in text. Handles multi-word phrases.
 */
function countOccurrences(text, wordList) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const phrase of wordList) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      "\\b" + escaped.replace(/\s+/g, "\\s+") + "\\b",
      "gi"
    );
    const matches = lower.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

function countContractions(text) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const c of CONTRACTIONS_LIST) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("\\b" + escaped + "\\b", "gi");
    const matches = lower.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Extract the first word (lowercased, alpha-only) from each sentence.
 */
function getSentenceStarts(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const starts = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    const firstWord = trimmed.split(/\s+/)[0];
    if (firstWord) {
      const cleaned = firstWord.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (cleaned.length > 0) starts.push(cleaned);
    }
  }
  return starts;
}

/**
 * Simple tricolon detection: look for "X, Y, and Z" patterns.
 */
function countTricolons(text) {
  let count = 0;
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const matches = sentence.match(
      /\b\w+\s*,\s*\w+\s*,\s*(?:and\s+)?\w+/gi
    );
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Count specific concrete details: numbers > 9 (excluding 1900-2099), dates,
 * capitalized proper nouns, percentages, currency amounts.
 */
function detectConcreteSpecificity(text) {
  let signals = 0;

  // Numbers excluding single digits and common years
  const numbers = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const specificNumbers = numbers.filter((n) => {
    const num = parseInt(n, 10);
    return num > 9 && (num < 1900 || num > 2099);
  });
  signals += specificNumbers.length;

  // Dates in various formats
  const dates =
    text.match(
      /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g
    ) || [];
  signals += dates.length;

  // Proper nouns (consecutive capitalized words)
  const properNouns = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) || [];
  signals += Math.floor(properNouns.length * 0.5);

  // Percentages
  const percentages = text.match(/\b\d+(?:\.\d+)?%/g) || [];
  signals += percentages.length;

  // Currency amounts
  const currencies = text.match(/[$€£¥]\s*\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  signals += currencies.length;

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// FALLBACK DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Run the senior's own detection analysis on raw text.
 * Returns scores for all dimensions plus an overall score.
 */
function runDetection(text) {
  const wordCount = countWords(text);
  if (wordCount === 0) {
    return {
      overall_score: 0,
      structural_fingerprint_count: 0,
      contraction_density: 0,
      vocab_flag: false,
      dimensions: {
        burstiness_variance: {
          score: 0,
          detail: "No text to analyze",
        },
        vocabulary_tells: {
          score: 0,
          detail: "No text to analyze",
        },
        structural_patterns: {
          score: 0,
          detail: "No text to analyze",
        },
        contractions_formality: {
          score: 0,
          detail: "No text to analyze",
        },
        sentence_rhythm: {
          score: 0,
          detail: "No text to analyze",
        },
        hedging_certainty: {
          score: 0,
          detail: "No text to analyze",
        },
      },
    };
  }

  const sentenceCount = countSentences(text);
  const paragraphCount = countParagraphs(text);

  // ── 1. Paragraph Uniformity (Burstiness Variance) ──
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0);
  const paragraphLengths = paragraphs.map((p) => countWords(p));
  const paraCV = coefficientOfVariation(paragraphLengths);
  // Low CV (uniform paragraphs) → high AI score
  const burstinessScore = clamp(100 - paraCV * 1.2, 0, 100);

  let burstinessDetail;
  if (paraCV < 20) {
    burstinessDetail = `Paragraph CV: ${paraCV.toFixed(1)}% — paragraphs are highly uniform in length, a strong indicator of AI generation`;
  } else if (paraCV < 50) {
    burstinessDetail = `Paragraph CV: ${paraCV.toFixed(1)}% — moderately uniform paragraph lengths`;
  } else if (paraCV < 80) {
    burstinessDetail = `Paragraph CV: ${paraCV.toFixed(1)}% — naturally varied paragraph lengths suggesting human writing`;
  } else {
    burstinessDetail = `Paragraph CV: ${paraCV.toFixed(1)}% — highly varied paragraph lengths characteristic of human writing`;
  }

  // ── 2. Contraction Density ──
  const contractionCount = countContractions(text);
  const contractionDensity = contractionCount / wordCount;
  // Low density (few contractions) → high AI score
  const contractionScore = clamp(100 - contractionDensity * 3000, 0, 100);

  let contractionDetail;
  if (contractionCount === 0) {
    contractionDetail = `No contractions found in ${wordCount} words — AI-written text typically avoids contractions`;
  } else if (contractionDensity < 0.003) {
    contractionDetail = `Contraction density: ${(contractionDensity * 100).toFixed(2)}% (${contractionCount} in ${wordCount} words) — very low, characteristic of AI text`;
  } else if (contractionDensity < 0.015) {
    contractionDetail = `Contraction density: ${(contractionDensity * 100).toFixed(2)}% (${contractionCount} in ${wordCount} words) — moderate contraction usage`;
  } else {
    contractionDetail = `Contraction density: ${(contractionDensity * 100).toFixed(2)}% (${contractionCount} in ${wordCount} words) — natural contraction usage suggesting human writing`;
  }

  // ── 3. Sentence-Start Diversity ──
  const sentenceStarts = getSentenceStarts(text);
  const uniqueStarts = new Set(sentenceStarts).size;
  const startDiversity =
    sentenceStarts.length > 0 ? uniqueStarts / sentenceStarts.length : 0;
  // Low diversity (repetitive starts) → high AI score
  const sentenceStartScore = clamp(100 - startDiversity * 100, 0, 100);

  let rhythmDetail;
  if (sentenceStarts.length === 0) {
    rhythmDetail = "No sentences detected for rhythm analysis";
  } else if (startDiversity < 0.3) {
    rhythmDetail = `Sentence-start diversity: ${(startDiversity * 100).toFixed(0)}% unique starts across ${sentenceStarts.length} sentences — very repetitive, a strong AI indicator`;
  } else if (startDiversity < 0.55) {
    rhythmDetail = `Sentence-start diversity: ${(startDiversity * 100).toFixed(0)}% unique starts across ${sentenceStarts.length} sentences — moderately repetitive`;
  } else if (startDiversity < 0.8) {
    rhythmDetail = `Sentence-start diversity: ${(startDiversity * 100).toFixed(0)}% unique starts across ${sentenceStarts.length} sentences — good variety`;
  } else {
    rhythmDetail = `Sentence-start diversity: ${(startDiversity * 100).toFixed(0)}% unique starts across ${sentenceStarts.length} sentences — excellent variety, characteristic of human writing`;
  }

  // ── 4. AI Vocabulary Density ──
  const aiVocabCount = countOccurrences(text, AI_VOCABULARY);
  const aiVocabDensity = aiVocabCount / wordCount;
  const vocabScore = clamp(aiVocabDensity * 600, 0, 100);
  const vocabFlag = aiVocabCount > 3;

  let vocabDetail;
  if (aiVocabCount === 0) {
    vocabDetail = "No AI-associated vocabulary detected";
  } else if (aiVocabCount <= 3) {
    vocabDetail = `AI vocabulary density: ${(aiVocabDensity * 100).toFixed(2)}% (${aiVocabCount} matches) — minimal, could be coincidental`;
  } else if (aiVocabCount <= 8) {
    vocabDetail = `AI vocabulary density: ${(aiVocabDensity * 100).toFixed(2)}% (${aiVocabCount} matches) — moderate presence of AI-associated phrasing`;
  } else {
    vocabDetail = `AI vocabulary density: ${(aiVocabDensity * 100).toFixed(2)}% (${aiVocabCount} matches) — heavy presence of AI-associated phrasing`;
  }

  // ── 5. Structural Fingerprints ──
  let structuralRawCount = 0;
  const fingerprintDetails = [];

  // Hedge openers
  const hedgeOpenerCount = countOccurrences(text, HEDGE_OPENERS);
  structuralRawCount += hedgeOpenerCount;
  if (hedgeOpenerCount > 0) {
    fingerprintDetails.push(
      `${hedgeOpenerCount} formulaic hedge opener(s)`
    );
  }

  // Tricolons
  const tricolonCount = countTricolons(text);
  structuralRawCount += tricolonCount;
  if (tricolonCount > 0) {
    fingerprintDetails.push(`${tricolonCount} tricolon list(s)`);
  }

  // Em-dashes
  const emDashCount = (text.match(/[\u2014\u2013]|--/g) || []).length;
  if (emDashCount > 1) {
    structuralRawCount += Math.min(emDashCount, 5);
    fingerprintDetails.push(`${emDashCount} em-dash(es)`);
  }

  // Resolution closers
  const closerCount = countOccurrences(text, RESOLUTION_CLOSERS);
  structuralRawCount += closerCount;
  if (closerCount > 0) {
    fingerprintDetails.push(
      `${closerCount} formulaic resolution closer(s)`
    );
  }

  const structuralScore = clamp(structuralRawCount * 10, 0, 100);

  let structuralDetail;
  if (fingerprintDetails.length === 0) {
    structuralDetail =
      "No strong structural fingerprints detected";
  } else if (fingerprintDetails.length <= 2) {
    structuralDetail = `Structural fingerprints: ${fingerprintDetails.join("; ")}`;
  } else {
    structuralDetail = `Multiple structural fingerprints detected: ${fingerprintDetails.join("; ")} — characteristic of AI-generated structure`;
  }

  // ── 6. Transition Word Density ──
  const transitionCount = countOccurrences(text, TRANSITION_WORDS);
  const transitionDensity = transitionCount / wordCount;
  const transitionScore = clamp(transitionDensity * 500, 0, 100);

  // ── 7. Rhetorical Questions ──
  const questionSentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().endsWith("?"));
  const rhetoricalScore = clamp(questionSentences.length * 15, 0, 100);

  // ── 8. Hedging Density ──
  const hedgeCount = countOccurrences(text, HEDGE_WORDS);
  const hedgeDensity = hedgeCount / wordCount;
  const hedgingScore = clamp(hedgeDensity * 600, 0, 100);

  let hedgingDetail;
  if (hedgeCount === 0) {
    hedgingDetail = "No hedging language detected";
  } else if (hedgeDensity < 0.01) {
    hedgingDetail = `Hedging density: ${(hedgeDensity * 100).toFixed(2)}% (${hedgeCount} hedging words) — minimal`;
  } else if (hedgeDensity < 0.03) {
    hedgingDetail = `Hedging density: ${(hedgeDensity * 100).toFixed(2)}% (${hedgeCount} hedging words) — moderate hedging, could indicate cautious AI phrasing`;
  } else {
    hedgingDetail = `Hedging density: ${(hedgeDensity * 100).toFixed(2)}% (${hedgeCount} hedging words) — heavy hedging, characteristic of AI-generated text`;
  }

  // ── Weighted overall ──
  const dimensionScores = [
    burstinessScore,
    contractionScore,
    sentenceStartScore,
    vocabScore,
    structuralScore,
    transitionScore,
    rhetoricalScore,
    hedgingScore,
  ];

  const dimensionWeights = [1.0, 1.2, 1.0, 1.5, 1.3, 0.8, 0.5, 0.7];
  const weightedSum = dimensionScores.reduce(
    (sum, s, i) => sum + s * dimensionWeights[i],
    0
  );
  const totalWeight = dimensionWeights.reduce((a, b) => a + b, 0);
  const overallScore = clamp(
    Math.round(weightedSum / totalWeight),
    0,
    100
  );

  return {
    overall_score: overallScore,
    structural_fingerprint_count: structuralRawCount,
    contraction_density: contractionDensity,
    vocab_flag: vocabFlag,
    dimensions: {
      burstiness_variance: {
        score: Math.round(burstinessScore),
        detail: burstinessDetail,
      },
      vocabulary_tells: {
        score: Math.round(vocabScore),
        detail: vocabDetail,
      },
      structural_patterns: {
        score: Math.round(structuralScore),
        detail: structuralDetail,
      },
      contractions_formality: {
        score: Math.round(contractionScore),
        detail: contractionDetail,
      },
      sentence_rhythm: {
        score: Math.round(sentenceStartScore),
        detail: rhythmDetail,
      },
      hedging_certainty: {
        score: Math.round(hedgingScore),
        detail: hedgingDetail,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// SCORE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

const RISK_LEVEL_MAP = {
  low: 15,
  lowest: 5,
  very_low: 10,
  "very low": 10,
  moderate: 45,
  medium: 45,
  high: 75,
  elevated: 65,
  critical: 90,
  very_high: 90,
  "very high": 90,
  likely: 70,
  unlikely: 20,
  possible: 50,
  detected: 70,
  not_detected: 10,
  "not detected": 10,
};

/**
 * Attempt to extract a normalized 0-100 score from an external tool's JSON.
 * Returns null if no score can be determined.
 */
function normalizeExternalScore(result) {
  if (!result || typeof result !== "object") return null;

  // Direct numeric score fields (try multiple common names)
  for (const field of [
    "risk_score",
    "riskScore",
    "score",
    "ai_score",
    "aiScore",
    "overall_score",
    "overall",
    "probability",
    "confidence_score",
  ]) {
    if (typeof result[field] === "number") {
      const val = result[field];
      if (val > 1) return clamp(val, 0, 100);
      return clamp(val * 100, 0, 100);
    }
  }

  // Risk level string mapping
  for (const field of ["risk_level", "riskLevel", "level", "verdict"]) {
    if (typeof result[field] === "string") {
      const mapped = RISK_LEVEL_MAP[result[field].toLowerCase()];
      if (mapped !== undefined) return mapped;
    }
  }

  // Nested result objects (e.g., { result: { score: 75 } })
  for (const field of ["result", "data", "analysis", "report"]) {
    if (result[field] && typeof result[field] === "object") {
      const nested = normalizeExternalScore(result[field]);
      if (nested !== null) return nested;
    }
  }

  // Array-based signals
  if (Array.isArray(result.factors) && result.factors.length > 0) {
    return clamp(result.factors.length * 15, 0, 100);
  }
  if (Array.isArray(result.flagged) && result.flagged.length > 0) {
    return clamp(result.flagged.length * 20, 0, 100);
  }
  if (Array.isArray(result.signals) && result.signals.length > 0) {
    const avg =
      result.signals.reduce((s, sig) => {
        if (typeof sig === "number") return s + sig;
        if (sig && sig.score) return s + sig.score;
        return s + 50;
      }, 0) / result.signals.length;
    return clamp(avg, 0, 100);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// RISK LEVEL & CONFIDENCE
// ═══════════════════════════════════════════════════════════════════

function getRiskLevel(score) {
  if (score < 15) return "very_low";
  if (score < 35) return "low";
  if (score < 55) return "medium";
  if (score < 75) return "high";
  return "very_high";
}

function getConfidence(sourceCount, isShortText) {
  if (isShortText) return "low";
  if (sourceCount >= 3) return "high";
  if (sourceCount >= 2) return "medium";
  return "low";
}

// ═══════════════════════════════════════════════════════════════════
// DIMENSION BREAKDOWN BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a unified dimension breakdown from all available sources.
 * Falls back through custom → fallback → aggregated defaults.
 */
function buildDimensions(
  fallbackDimensions,
  humanizerParsed,
  aiHumanizerParsed,
  customParsed
) {
  const dims = {
    burstiness_variance: { score: 50, source: "aggregated", detail: "No data available" },
    vocabulary_tells: { score: 50, source: "aggregated", detail: "No data available" },
    structural_patterns: { score: 50, source: "aggregated", detail: "No data available" },
    contractions_formality: { score: 50, source: "aggregated", detail: "No data available" },
    sentence_rhythm: { score: 50, source: "aggregated", detail: "No data available" },
    hedging_certainty: { score: 50, source: "aggregated", detail: "No data available" },
  };

  // ── Custom detector dimensions (most authoritative) ──
  if (customParsed && typeof customParsed === "object") {
    const customDimSource = customParsed.dimensions || customParsed;
    for (const key of Object.keys(dims)) {
      const d = customDimSource[key];
      if (d && typeof d.score === "number") {
        dims[key] = {
          score: Math.round(clamp(d.score, 0, 100)),
          source: "custom",
          detail: d.detail || "",
        };
      }
    }

    // Try flat score fields as fallback for dimensions
    const flatMap = {
      burstiness: "burstiness_variance",
      burstiness_variance: "burstiness_variance",
      vocabulary: "vocabulary_tells",
      vocabulary_tells: "vocabulary_tells",
      structural: "structural_patterns",
      structural_patterns: "structural_patterns",
      contractions: "contractions_formality",
      contractions_formality: "contractions_formality",
      sentence_rhythm: "sentence_rhythm",
      rhythm: "sentence_rhythm",
      hedging: "hedging_certainty",
      hedging_certainty: "hedging_certainty",
    };
    for (const [srcKey, dimKey] of Object.entries(flatMap)) {
      if (
        dims[dimKey].source === "aggregated" &&
        typeof customParsed[srcKey] === "number"
      ) {
        dims[dimKey] = {
          score: Math.round(clamp(customParsed[srcKey], 0, 100)),
          source: "custom",
          detail: "",
        };
      }
    }
  }

  // ── Fallback detection dimensions ──
  if (fallbackDimensions) {
    for (const key of Object.keys(dims)) {
      const d = fallbackDimensions[key];
      if (d && typeof d.score === "number" && dims[key].source === "aggregated") {
        dims[key] = {
          score: Math.round(clamp(d.score, 0, 100)),
          source: "fallback",
          detail: d.detail || "",
        };
      }
    }
  }

  // ── Humanizer result (try to extract dimension-like data) ──
  if (humanizerParsed && typeof humanizerParsed === "object") {
    const humanizerDimMap = {
      burstiness: "burstiness_variance",
      burstiness_score: "burstiness_variance",
      vocabulary: "vocabulary_tells",
      vocabulary_score: "vocabulary_tells",
      structural: "structural_patterns",
      structural_score: "structural_patterns",
      contractions: "contractions_formality",
      contraction_score: "contractions_formality",
      rhythm: "sentence_rhythm",
      rhythm_score: "sentence_rhythm",
      hedging: "hedging_certainty",
      hedging_score: "hedging_certainty",
    };
    for (const [srcKey, dimKey] of Object.entries(humanizerDimMap)) {
      if (
        dims[dimKey].source === "aggregated" &&
        typeof humanizerParsed[srcKey] === "number"
      ) {
        dims[dimKey] = {
          score: Math.round(clamp(humanizerParsed[srcKey], 0, 100)),
          source: "humanizer",
          detail: humanizerParsed[srcKey + "_detail"] || "",
        };
      }
    }
  }

  return dims;
}

// ═══════════════════════════════════════════════════════════════════
// RECOMMENDATIONS GENERATOR
// ═══════════════════════════════════════════════════════════════════

function generateRecommendations(
  finalScore,
  dimensions,
  confidence,
  scores,
  overrideReasons,
  customScore,
  wordCount
) {
  const recs = [];

  // Short text
  if (wordCount < 100) {
    recs.push(
      "The text is very short (under 100 words), making AI detection unreliable. Consider analyzing a longer sample for a more accurate assessment."
    );
  }

  // Low source count
  if (confidence === "low" && wordCount >= 100) {
    recs.push(
      "Limited data sources were available for analysis. Provide additional detector results for a more confident verdict."
    );
  }

  // Disagreement between detectors
  const provided = Object.values(scores).filter(
    (s) => s.normalized !== null && s.normalized !== undefined
  );
  if (provided.length >= 2) {
    const maxS = Math.max(...provided.map((s) => s.normalized));
    const minS = Math.min(...provided.map((s) => s.normalized));
    if (maxS - minS > 40) {
      recs.push(
        `Significant disagreement between detectors (range: ${minS}–${maxS}). The custom detector's analysis is given extra weight. Review the specific signals flagged by each tool.`
      );
    }
  }

  // Dimension-specific signals
  const dimChecks = [
    {
      key: "vocabulary_tells",
      threshold: 60,
      msg: (s) =>
        `AI-associated vocabulary is a strong signal (score: ${s}). Review for characteristic AI phrasing such as "delve", "leverage", "paradigm", or "transformative".`,
    },
    {
      key: "structural_patterns",
      threshold: 60,
      msg: (s) =>
        `Structural fingerprints detected (score: ${s}). AI often uses formulaic rhetorical structures like hedge openers, tricolon lists, and resolution closers.`,
    },
    {
      key: "contractions_formality",
      threshold: 70,
      msg: (s) =>
        `Very low contraction usage (score: ${s}). Human writing typically uses contractions naturally. The formality level here is characteristic of AI-generated text.`,
    },
    {
      key: "burstiness_variance",
      threshold: 70,
      msg: (s) =>
        `Paragraph lengths are unusually uniform (score: ${s}). Human writing tends to have more varied paragraph structures.`,
    },
    {
      key: "hedging_certainty",
      threshold: 65,
      msg: (s) =>
        `High hedging density (score: ${s}). AI text often overuses cautious language ("might", "could", "perhaps") to maintain plausible deniability.`,
    },
    {
      key: "sentence_rhythm",
      threshold: 65,
      msg: (s) =>
        `Low sentence-start diversity (score: ${s}). AI often reuses the same sentence openers, creating a monotonous rhythm.`,
    },
  ];

  for (const check of dimChecks) {
    const dim = dimensions[check.key];
    if (dim && dim.score >= check.threshold) {
      recs.push(check.msg(dim.score));
    }
  }

  // Custom detector specific
  if (customScore !== null && customScore > 60) {
    recs.push(
      `The custom detector (weighted 2\u00d7) scored ${Math.round(customScore)}/100, indicating strong AI signals. Focus on the flagged dimensions for targeted editing.`
    );
  }

  // Override advice
  if (overrideReasons.length > 0) {
    recs.push(
      `Critical overrides were applied: ${overrideReasons.join("; ")}. These adjustments reduce false positives and false negatives.`
    );
  }

  // Overall verdict advice
  if (finalScore > 70) {
    recs.push(
      "The aggregate analysis suggests this text has strong AI-generation characteristics. Consider humanizing flagged sections and re-running detection."
    );
  } else if (finalScore < 30) {
    recs.push(
      "The aggregate analysis suggests this text is likely human-written. No significant AI-generation signals detected."
    );
  } else {
    recs.push(
      "The evidence is mixed. Review the dimension breakdown for specific areas of concern and compare with the text's context."
    );
  }

  return recs.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════
// TOOL DEFINITION
// ═══════════════════════════════════════════════════════════════════

export const aiSeniorTool = tool({
  description: `Senior AI Detection Aggregator.
Compiles results from multiple AI detectors (humanizer-mcp, ai-humanizer-mcp, custom ai-detector)
and produces a final critical verdict with weighted aggregation, critical overrides,
dimension breakdown, and actionable recommendations.

If no custom detector result is provided, the senior runs its own independent detection analysis
using paragraph uniformity, contraction density, sentence-start diversity, AI vocabulary density,
structural fingerprints, transition words, rhetorical questions, and hedging analysis.

Returns a comprehensive JSON report with final AI risk score, risk level, confidence,
dimension scores, and specific recommendations.`,

  args: {
    text: tool.schema
      .string()
      .describe("The text being analyzed for AI-generated characteristics"),
    humanizer_result: tool.schema
      .string()
      .optional()
      .describe("JSON result string from the humanizer-mcp tool"),
    ai_humanizer_result: tool.schema
      .string()
      .optional()
      .describe("JSON result string from the ai-humanizer-mcp tool"),
    custom_detector_result: tool.schema
      .string()
      .optional()
      .describe("JSON result string from the custom ai-detector tool"),
  },

  async execute(args, context) {
    const {
      text,
      humanizer_result,
      ai_humanizer_result,
      custom_detector_result,
    } = args;

    // ── Validate text ──
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      const output = {
        senior_version: "1.0",
        input_sources: {
          humanizer_mcp: humanizer_result ? "provided" : "not_provided",
          ai_humanizer_mcp: ai_humanizer_result ? "provided" : "not_provided",
          custom_detector: custom_detector_result
            ? "provided"
            : "not_provided",
        },
        detector_scores: {
          humanizer_mcp: { raw_score: null, normalized: null },
          ai_humanizer_mcp: { raw_score: null, normalized: null },
          custom_detector: { raw_score: null, normalized: null },
        },
        weights_applied: {
          humanizer_mcp: 1.0,
          ai_humanizer_mcp: 1.0,
          custom_detector: 2.0,
        },
        overall: {
          ai_risk_score: 0,
          risk_level: "very_low",
          confidence: "low",
          explanation: "No text provided for analysis.",
        },
        dimensions: {
          burstiness_variance: { score: 0, source: "aggregated", detail: "No text to analyze" },
          vocabulary_tells: { score: 0, source: "aggregated", detail: "No text to analyze" },
          structural_patterns: { score: 0, source: "aggregated", detail: "No text to analyze" },
          contractions_formality: { score: 0, source: "aggregated", detail: "No text to analyze" },
          sentence_rhythm: { score: 0, source: "aggregated", detail: "No text to analyze" },
          hedging_certainty: { score: 0, source: "aggregated", detail: "No text to analyze" },
        },
        critical_overrides: {
          applied: false,
          reasons: [],
        },
        recommendations: ["Provide text for AI detection analysis."],
      };

      context.metadata({
        title: "ai-senior: no text",
        metadata: { error: "no_text", textLength: 0 },
      });

      return {
        title: "ai-senior: no text provided",
        output: JSON.stringify(output, null, 2),
        metadata: { error: "no_text", textLength: 0 },
      };
    }

    const wordCount = countWords(text);
    const charCount = text.length;
    const isShortText = wordCount < 100;

    // ── Step 1: Parse all inputs ──
    let humanizerParsed = null;
    let aiHumanizerParsed = null;
    let customParsed = null;

    let humanizerStatus = humanizer_result ? "provided" : "not_provided";
    let aiHumanizerStatus = ai_humanizer_result
      ? "provided"
      : "not_provided";
    let customStatus = custom_detector_result
      ? "provided"
      : "not_provided";

    try {
      if (humanizer_result) humanizerParsed = JSON.parse(humanizer_result);
    } catch {
      humanizerStatus = "parse_error";
    }

    try {
      if (ai_humanizer_result)
        aiHumanizerParsed = JSON.parse(ai_humanizer_result);
    } catch {
      aiHumanizerStatus = "parse_error";
    }

    try {
      if (custom_detector_result)
        customParsed = JSON.parse(custom_detector_result);
    } catch {
      customStatus = "parse_error";
    }

    // ── Step 2: Run fallback detection if custom not available ──
    let fallbackResult = null;
    if (!customParsed) {
      fallbackResult = runDetection(text);
      customStatus = "fallback_used";
    }

    // ── Step 3: Normalize scores ──
    const humanizerScore = humanizerParsed
      ? normalizeExternalScore(humanizerParsed)
      : null;
    const aiHumanizerScore = aiHumanizerParsed
      ? normalizeExternalScore(aiHumanizerParsed)
      : null;
    let customScore = customParsed
      ? normalizeExternalScore(customParsed)
      : null;

    // If custom not provided, use fallback score
    if (customScore === null && fallbackResult) {
      customScore = fallbackResult.overall_score;
    }

    // Attempt to extract raw scores for display
    const getRawScore = (parsed) => {
      if (!parsed || typeof parsed !== "object") return null;
      return (
        parsed.risk_score ??
        parsed.riskScore ??
        parsed.score ??
        parsed.overall_score ??
        null
      );
    };

    const detectorScores = {
      humanizer_mcp: {
        raw_score: getRawScore(humanizerParsed),
        normalized:
          humanizerScore !== null ? Math.round(humanizerScore) : null,
      },
      ai_humanizer_mcp: {
        raw_score: getRawScore(aiHumanizerParsed),
        normalized:
          aiHumanizerScore !== null ? Math.round(aiHumanizerScore) : null,
      },
      custom_detector: {
        raw_score:
          getRawScore(customParsed) ??
          (fallbackResult ? fallbackResult.overall_score : null),
        normalized:
          customScore !== null ? Math.round(customScore) : null,
      },
    };

    // ── Step 4: Weighted aggregation ──
    const weightsApplied = {
      humanizer_mcp: 1.0,
      ai_humanizer_mcp: 1.0,
      custom_detector: customStatus === "fallback_used" ? 1.5 : 2.0,
    };

    const weightedItems = [];
    if (humanizerScore !== null) {
      weightedItems.push({
        score: humanizerScore,
        weight: weightsApplied.humanizer_mcp,
        label: "humanizer_mcp",
      });
    }
    if (aiHumanizerScore !== null) {
      weightedItems.push({
        score: aiHumanizerScore,
        weight: weightsApplied.ai_humanizer_mcp,
        label: "ai_humanizer_mcp",
      });
    }
    if (customScore !== null) {
      weightedItems.push({
        score: customScore,
        weight: weightsApplied.custom_detector,
        label: customStatus === "fallback_used" ? "fallback_detection" : "custom_detector",
      });
    }

    let weightedAvg = 50;
    if (weightedItems.length > 0) {
      const sumWeighted = weightedItems.reduce(
        (acc, item) => acc + item.score * item.weight,
        0
      );
      const sumWeights = weightedItems.reduce(
        (acc, item) => acc + item.weight,
        0
      );
      weightedAvg = sumWeights > 0 ? sumWeighted / sumWeights : 50;
    }

    // ── Step 5: Critical override logic ──
    const overrideReasons = [];
    let finalScore = weightedAvg;
    let appliedOverride = false;

    // False Negative Reduction — catching AI that other tools miss
    if (
      customScore !== null &&
      humanizerScore !== null &&
      aiHumanizerScore !== null
    ) {
      if (customScore > 60 && humanizerScore < 40 && aiHumanizerScore < 40) {
        finalScore += 15;
        overrideReasons.push(
          `Custom detector scored ${Math.round(customScore)} while both other tools scored <40 (${Math.round(humanizerScore)}, ${Math.round(aiHumanizerScore)}). Boosted by +15 — our tool spotted AI signals others missed.`
        );
        appliedOverride = true;
      }

      if (customScore > 70 && (humanizerScore > 50 || aiHumanizerScore > 50)) {
        finalScore += 10;
        overrideReasons.push(
          `Custom detector scored ${Math.round(customScore)} with converging evidence from at least one other tool. Boosted by +10.`
        );
        appliedOverride = true;
      }
    }

    // Triple tell: structural fingerprints + vocabulary flags + low contractions
    if (fallbackResult) {
      const structCount = fallbackResult.structural_fingerprint_count;
      const hasVocabFlag = fallbackResult.vocab_flag;
      const contractionRatio = fallbackResult.contraction_density;

      if (structCount > 5 && hasVocabFlag && contractionRatio < 0.002) {
        finalScore += 20;
        overrideReasons.push(
          `Triple tell detected: ${structCount} structural fingerprint(s), ${hasVocabFlag ? "vocabulary flags present" : "no vocabulary flags"}, and very low contraction density (${(contractionRatio * 100).toFixed(3)}%). Boosted by +20.`
        );
        appliedOverride = true;
      }
    }

    // False Positive Reduction — protecting human text
    if (
      customScore !== null &&
      humanizerScore !== null &&
      aiHumanizerScore !== null
    ) {
      if (customScore < 30 && humanizerScore > 60 && aiHumanizerScore > 60) {
        finalScore -= 15;
        overrideReasons.push(
          `Custom detector scored ${Math.round(customScore)} (human-like) while other tools scored >60. Reduced by -15 — trusting our tool's human verdict.`
        );
        appliedOverride = true;
      }
    }

    // Short text note (affects confidence, not score directly)
    if (isShortText && wordCount > 0) {
      overrideReasons.push(
        `Text is short (${wordCount} words, ${charCount} characters). Short text analysis has reduced reliability.`
      );
    }

    // Concrete specificity (specific details suggest human authorship)
    if (customScore !== null && customScore < 50 && wordCount >= 20) {
      const specificityScore = detectConcreteSpecificity(text);
      if (specificityScore > 5) {
        const reduction = Math.min(specificityScore * 1.5, 15);
        finalScore = Math.max(0, finalScore - reduction);
        overrideReasons.push(
          `Text contains specific concrete details (${specificityScore} signals: numbers, names, dates) suggesting human authorship. Reduced by -${Math.round(reduction)}.`
        );
        appliedOverride = true;
      }
    }

    // Clamp final score
    finalScore = clamp(Math.round(finalScore), 0, 100);

    // ── Step 6: Build dimension breakdown ──
    const fallbackDims = fallbackResult ? fallbackResult.dimensions : null;
    const dimensions = buildDimensions(
      fallbackDims,
      humanizerParsed,
      aiHumanizerParsed,
      customParsed
    );

    // ── Step 7: Risk level and confidence ──
    const riskLevel = getRiskLevel(finalScore);
    const sourceCount = weightedItems.length;
    const confidence = getConfidence(sourceCount, isShortText);

    // Build explanation
    const explanationParts = [];
    if (weightedItems.length === 0) {
      explanationParts.push(
        "No detector results could be parsed from any source."
      );
    } else {
      const srcDesc = weightedItems
        .map(
          (item) =>
            `${item.label}: ${Math.round(item.score)} (weight ${item.weight})`
        )
        .join(", ");
      explanationParts.push(
        `Weighted aggregation of ${weightedItems.length} source(s): ${srcDesc}.`
      );
    }

    if (appliedOverride) {
      explanationParts.push(
        `Applied ${overrideReasons.length} critical override(s).`
      );
    } else {
      explanationParts.push("No critical overrides applied.");
    }

    explanationParts.push(
      `Final score: ${finalScore}/100 (${riskLevel}). Confidence: ${confidence}.`
    );

    if (isShortText) {
      explanationParts.push(
        "CAUTION: Short text reduces detection reliability."
      );
    }

    // ── Step 8: Generate recommendations ──
    const recommendations = generateRecommendations(
      finalScore,
      dimensions,
      confidence,
      detectorScores,
      overrideReasons,
      customScore,
      wordCount
    );

    // ── Build final output ──
    const output = {
      senior_version: "1.0",
      input_sources: {
        humanizer_mcp: humanizerStatus,
        ai_humanizer_mcp: aiHumanizerStatus,
        custom_detector: customStatus,
      },
      detector_scores: detectorScores,
      weights_applied: {
        humanizer_mcp: weightsApplied.humanizer_mcp,
        ai_humanizer_mcp: weightsApplied.ai_humanizer_mcp,
        custom_detector: weightsApplied.custom_detector,
      },
      overall: {
        ai_risk_score: finalScore,
        risk_level: riskLevel,
        confidence: confidence,
        explanation: explanationParts.join(" ").trim(),
      },
      dimensions: dimensions,
      critical_overrides: {
        applied: appliedOverride,
        reasons: overrideReasons,
      },
      recommendations: recommendations,
    };

    context.metadata({
      title: `AI Senior: ${finalScore}/100 (${riskLevel})`,
      metadata: {
        finalScore,
        riskLevel,
        confidence,
        sourcesCount: sourceCount,
        wordCount,
        charCount,
        overridesApplied: appliedOverride,
      },
    });

    return {
      title: `ai-senior: ${finalScore}/100 — ${riskLevel}`,
      output: JSON.stringify(output, null, 2),
      metadata: {
        finalScore,
        riskLevel,
        confidence,
        wordCount,
        sourcesUsed: sourceCount,
        overridesApplied: appliedOverride,
      },
    };
  },
});
