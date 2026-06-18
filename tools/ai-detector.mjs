/**
 * AI Detector Tool
 *
 * A custom opencode plugin tool that analyzes text across 12 signal dimensions
 * to detect AI-generated content. Uses state-of-the-art signal analysis
 * including paragraph uniformity, contraction density, vocabulary analysis,
 * structural fingerprints, and model dialect detection.
 *
 * Returns a comprehensive JSON report with risk scores per signal and overall.
 */
import { tool } from "@opencode-ai/plugin";

// ─── Helper: word tokenizer ─────────────────────────────────────────────────
function tokenize(text) {
  return text.match(/[a-zA-Z0-9'-]+/g) || [];
}

function wordCount(text) {
  return tokenize(text).length;
}

function sentenceCount(text) {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches) return text.trim().length > 0 ? 1 : 0;
  return matches.length;
}

function paragraphCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const paras = trimmed.split(/\n\s*\n/);
  return paras.filter((p) => p.trim().length > 0).length;
}

// ─── Helper: risk mapping ────────────────────────────────────────────────────
function riskFromScore(score) {
  if (score < 0.15) return "high";
  if (score < 0.3) return "medium";
  return "low";
}

function invertRiskFromScore(score) {
  // For signals where HIGH score = low risk (e.g., diversity)
  if (score > 0.7) return "low";
  if (score > 0.5) return "medium";
  return "high";
}

function densityRisk(density, thresholds) {
  // thresholds: [lowMax, mediumMax] where density <= lowMax = low, <= mediumMax = medium, else high
  const [lowMax, mediumMax] = thresholds;
  if (density <= lowMax) return "low";
  if (density <= mediumMax) return "medium";
  return "high";
}

function overallRiskLevel(score) {
  if (score <= 19) return "very_low";
  if (score <= 39) return "low";
  if (score <= 59) return "medium";
  if (score <= 79) return "high";
  return "very_high";
}

// ─── Signal 1: Paragraph Uniformity ──────────────────────────────────────────
function analyzeParagraphUniformity(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { score: 0, risk: "low", cv: 0, detail: "No paragraphs to analyze." };
  }

  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (paragraphs.length < 2) {
    return {
      score: 0,
      risk: "low",
      cv: 0,
      detail: "Only one paragraph found; coefficient of variation requires at least 2 paragraphs.",
    };
  }

  const wordLengths = paragraphs.map((p) => wordCount(p));
  const mean = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;

  if (mean === 0) {
    return { score: 0, risk: "low", cv: 0, detail: "All paragraphs are empty." };
  }

  const variance =
    wordLengths.reduce((acc, val) => acc + (val - mean) ** 2, 0) / wordLengths.length;
  const std = Math.sqrt(variance);
  const cv = std / mean;

  let risk, score;
  if (cv < 0.15) {
    risk = "high";
    score = Math.round(Math.max(0.7, 1.5 - cv * 3.33) * 100) / 100;
  } else if (cv <= 0.3) {
    risk = "medium";
    score = Math.round(Math.max(0, 0.85 - (cv - 0.15) * 5.67) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    cv: Math.round(cv * 1000) / 1000,
    detail:
      risk === "high"
        ? `Paragraph lengths are highly uniform (CV=${cv.toFixed(3)}). AI-generated text often produces paragraphs of similar length.`
        : risk === "medium"
          ? `Paragraph lengths show moderate variation (CV=${cv.toFixed(3)}).`
          : `Paragraph lengths show natural variation (CV=${cv.toFixed(3)}), typical of human writing.`,
  };
}

// ─── Signal 2: Contraction Density ──────────────────────────────────────────
function analyzeContractionDensity(text) {
  const lower = text.toLowerCase();
  const words = tokenize(lower);

  const contractionPatterns = [
    /\bdon't\b/g, /\bdont\b/g,
    /\bit's\b/g,
    /\bi'm\b/g, /\bim\b/g,
    /\bcan't\b/g, /\bcant\b/g,
    /\bwon't\b/g, /\bwont\b/g,
    /\bisn't\b/g, /\baren't\b/g, /\bhasn't\b/g, /\bhaven't\b/g,
    /\bdidn't\b/g, /\bdoesn't\b/g, /\bwasn't\b/g, /\bweren't\b/g,
    /\bwe're\b/g, /\bwere\b/g,
    /\bthey're\b/g,
    /\byou're\b/g, /\byoure\b/g,
    /\bthat's\b/g, /\bthere's\b/g,
    /\bit'll\b/g,
    /\bi've\b/g, /\bive\b/g,
    /\bwe've\b/g, /\bweve\b/g,
    /\bthey've\b/g,
    /\bi'd\b/g, /\bwe'd\b/g, /\bthey'd\b/g,
    /\bhe'd\b/g, /\bshe'd\b/g,
    /\blet's\b/g,
    /\bwouldn't\b/g, /\bcouldn't\b/g, /\bshouldn't\b/g, /\bmustn't\b/g,
    /\bgonna\b/g, /\bwanna\b/g, /\bgotta\b/g,
    /\bkinda\b/g, /\bsorta\b/g, /\bdunno\b/g, /\bcuz\b/g, /\bcause\b/g,
  ];

  const expandedPatterns = [
    /\bdo not\b/g, /\bit is\b/g, /\bi am\b/g, /\bcannot\b/g, /\bwill not\b/g,
    /\bis not\b/g, /\bare not\b/g, /\bhas not\b/g, /\bhave not\b/g, /\bdid not\b/g,
    /\bdoes not\b/g, /\bwas not\b/g, /\bwere not\b/g, /\bwe are\b/g, /\bthey are\b/g,
    /\byou are\b/g, /\bthat is\b/g, /\bit will\b/g, /\bi have\b/g,
    /\bwe have\b/g, /\bthey have\b/g, /\bi would\b/g, /\bwe would\b/g, /\bthey would\b/g,
    /\bhe would\b/g, /\bshe would\b/g, /\blet us\b/g, /\bwould not\b/g, /\bcould not\b/g,
    /\bshould not\b/g, /\bmust not\b/g,
];

  let contractionCount = 0;
  for (const re of contractionPatterns) {
    const matches = lower.match(re);
    if (matches) contractionCount += matches.length;
  }

  let expandedCount = 0;
  for (const re of expandedPatterns) {
    const matches = lower.match(re);
    if (matches) expandedCount += matches.length;
  }

  const ratio = contractionCount / (contractionCount + expandedCount + 1);

  const totalOpportunities = contractionCount + expandedCount + 1;
  const rawRatio = totalOpportunities > 1 ? contractionCount / totalOpportunities : 1;
  let risk, score;
  if (rawRatio < 0.15) {
    risk = "high";
    // Continuous: 1.0 at ratio=0 → 0.5 at ratio=0.15
    score = Math.round((1.0 - rawRatio * 3.33) * 100) / 100;
  } else if (rawRatio < 0.5) {
    risk = "medium";
    // Continuous: 0.5 at ratio=0.15 → 0.0 at ratio=0.50
    score = Math.round((0.5 - (rawRatio - 0.15) * 1.43) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    ratio: Math.round(ratio * 1000) / 1000,
    detail:
      risk === "high"
        ? `Very few contractions used (ratio=${ratio.toFixed(3)}). AI-generated text tends to avoid contractions in favor of formal expanded forms.`
        : risk === "medium"
          ? `Moderate use of contractions (ratio=${ratio.toFixed(3)}).`
          : `Natural use of contractions (ratio=${ratio.toFixed(3)}), similar to human speech patterns.`,
  };
}

// ─── Signal 3: Sentence-Start Diversity ─────────────────────────────────────
function analyzeSentenceStartDiversity(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length < 3) {
    return {
      score: 0,
      risk: "low",
      diversity_ratio: 0,
      overused_starters: [],
      detail: "Too few sentences to reliably assess start diversity.",
    };
  }

  const starters = sentences.map((s) => {
    const words = s.trim().match(/[a-zA-Z0-9]+/g);
    return words && words.length > 0 ? words[0].toLowerCase() : "";
  }).filter((w) => w.length > 0);

  if (starters.length < 3) {
    return {
      score: 0,
      risk: "low",
      diversity_ratio: 0,
      overused_starters: [],
      detail: "Too few valid sentence starters to assess.",
    };
  }

  const unique = new Set(starters);
  const ratio = unique.size / starters.length;

  // Check overused starters
  const starterFreq = {};
  starters.forEach((s) => {
    starterFreq[s] = (starterFreq[s] || 0) + 1;
  });

  const commonStarters = ["the", "this", "it", "one", "a", "in"];
  const overused = commonStarters.filter((word) => {
    const freq = starterFreq[word] || 0;
    return freq / starters.length > 0.25;
  });

  let risk, score;
  if (ratio < 0.5) {
    risk = "high";
    score = Math.round(Math.max(0.6, 1.2 - ratio * 1.2) * 100) / 100;
  } else if (ratio <= 0.7) {
    risk = "medium";
    score = Math.round(Math.max(0, 0.75 - (ratio - 0.5) * 3.75) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  const overuseNote =
    overused.length > 0
      ? ` Overused starters: "${overused.join('", "')}" each account for >25% of sentences.`
      : "";

  return {
    score,
    risk,
    diversity_ratio: Math.round(ratio * 1000) / 1000,
    overused_starters: overused,
    detail:
      risk === "high"
        ? `Sentence starts lack diversity (ratio=${ratio.toFixed(3)}).${overuseNote} AI-generated text often begins sentences with the same words repeatedly.`
        : risk === "medium"
          ? `Sentence start diversity is moderate (ratio=${ratio.toFixed(3)}).${overuseNote}`
          : `Sentence starts show good diversity (ratio=${ratio.toFixed(3)}), typical of human writing.`,
  };
}

// ─── Signal 4: AI Vocabulary Density ─────────────────────────────────────────
const aiWords = new Set([
  "delve", "delves", "delved", "delving",
  "leverage", "leverages", "leveraged", "leveraging",
  "landscape", "landscapes",
  "navigate", "navigates", "navigating", "navigation",
  "testament", "testaments",
  "foster", "fosters", "fostered", "fostering",
  "harness", "harnesses", "harnessed", "harnessing",
  "embark", "embarks", "embarked", "embarking",
  "nuanced", "nuance",
  "furthermore", "moreover", "additionally", "consequently", "additionally",
  "transformative",
  "game-changer", "game-changing",
  "cutting-edge", "cuttingedge",
  "ever-evolving", "everevolving",
  "ever-changing", "everchanging",
  "rapidly-evolving", "rapidlyevolving",
  "fast-paced", "fastpaced",
  "groundbreaking",
  "revolutionize", "revolutionizes", "revolutionizing",
  "paradigm", "paradigms",
  "holistic", "holistically",
  "multifaceted",
  "unlock", "unlocks", "unlocked", "unlocking",
  "streamline", "streamlines", "streamlined", "streamlining",
  "optimize", "optimizes", "optimized", "optimizing",
  "elevate", "elevates", "elevated", "elevating",
  "embodies", "embodiment",
  "exemplifies",
  "underscore", "underscores", "underscoring",
  "robust", "robustness",
  "seamlessly",
  "tapestry",
  "realm", "realms",
  "pivotal",
  "cornerstone",
  "bedrock",
  "catalyst", "catalysts", "catalytic",
  "dynamic", "dynamically",
  "vibrant",
  "thriving",
  "flourish", "flourishes", "flourishing",
  "immerse", "immerses", "immersed", "immersive",
  "bespoke",
  "granular", "granularity",
  "actionable",
  "utilize", "utilizes", "utilized", "utilizing", "utilization",
  "tailored", "tailor",
  "unravel", "unravels", "unraveled", "unraveling",
  "unearth", "unearths", "unearthed",
  "crucial",
  "critical",
  "fundamental",
  "essential",
  "integral",
  "intrinsic",
  "overarching",
  "comprehensive",
  "meaningful",
  "impactful",
  "significant",
  "substantial",
  "profound",
  "considerable",
  "noteworthy",
  "unparalleled",
  "unprecedented",
  "unrivaled",
  "unmatched",
  "frictionless", "friction",
  "siloed", "silos",
  "agile", "agility",
  "synergize", "synergies",
  "ecosystem", "ecosystems",
  "roadmap", "roadmaps",
  "scalable",
  "turnkey",
  "stakeholder", "stakeholders",
  "vertical", "vertically",
  "horizontal", "horizontally",
  "cross-functional",
  "thought-leader", "thought-leadership",
  "pain-point", "pain-points",
  "best-in-class",
  "world-class",
  "enterprise-grade",
  "mission-critical",
  "value-add", "value-prop",
  "deliverables",
  "bandwidth",
  "touchpoint", "touchpoints",
  "journey",
  "flywheel",
  "tipping-point",
  "sea-change",
  "step-change",
  "proof-point", "proof-points",
  "bleeding-edge",
  "leading-edge",
  "white-space",
  "greenfield",
  "brownfield",
]);

const aiPhrases = [
  "it's worth noting", "it is worth noting",
  "it's important to", "it is important to",
  "in today's world", "in today's digital", "in today's rapidly", "in today's",
  "in an era of", "in this era of",
  "in the realm of",
  "when it comes to",
  "a deep dive into",
  "let's dive into",
  "let's explore",
  "let's take a closer look",
  "let's break down",
  "have you ever wondered", "have you ever noticed",
  "what if I told you",
  "the question isn't whether",
  "the truth is",
  "the reality is",
  "the fact is",
  "here's the thing",
  "here's why",
  "here's what",
  "here's how",
  "at the core",
  "at its core", "at its heart",
  "at the heart of",
  "in the grand scheme",
  "all things considered",
  "when all is said and done",
  "at the end of the day",
  "it remains to be seen",
  "only time will tell", "time will tell",
  "a mixed bag",
  "a double-edged sword",
  "a necessary evil",
  "the calm before the storm",
  "the elephant in the room",
  "the tip of the iceberg",
  "the bottom line", "the bottom line is",
  "not to mention",
  "last but not least",
  "first and foremost",
  "by and large",
  "for all intents and purposes",
  "in the final analysis",
  "in the long run",
  "in the short term",
  "in the grand scheme of things",
  "on the same page",
  "on the other hand",
  "on the one hand",
  "in the near future",
  "in the not-too-distant future",
  "in this day and age",
  "in this modern world",
  "in this digital age",
  "navigate the complex", "navigate the treacherous", "navigate the challenging",
  "navigate the ever-changing",
  "the landscape of",
  "the future of",
  "the power of",
  "the importance of",
  "the need for",
  "the role of",
  "the impact of",
  "the challenge of",
  "the rise of",
  "the advent of",
  "the emergence of",
  "the proliferation of",
];

function analyzeAIVocabularyDensity(text) {
  const lower = text.toLowerCase();
  const words = tokenize(lower);
  const totalWords = words.length;

  // Count single-word hits
  const wordHits = {};
  for (const w of words) {
    if (aiWords.has(w)) {
      wordHits[w] = (wordHits[w] || 0) + 1;
    }
  }

  // Count phrase hits
  const phraseHits = {};
  for (const phrase of aiPhrases) {
    // Use indexOf in a loop to count non-overlapping occurrences
    let idx = 0;
    let count = 0;
    while (idx < lower.length) {
      const pos = lower.indexOf(phrase, idx);
      if (pos === -1) break;
      count++;
      idx = pos + phrase.length;
    }
    if (count > 0) {
      phraseHits[phrase] = count;
    }
  }

  const totalWordHits = Object.values(wordHits).reduce((a, b) => a + b, 0);
  const totalPhraseHits = Object.values(phraseHits).reduce((a, b) => a + b, 0);
  const totalHits = totalWordHits + totalPhraseHits;
  const density = totalWords > 0 ? (totalHits / totalWords) * 100 : 0;

  let risk, score;
  if (density >= 6) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + density * 0.07) * 100) / 100;
  } else if (density >= 3) {
    risk = "medium";
    score = Math.round(((density - 3) / 3 * 0.55 + 0.3) * 100) / 100;
  } else if (density >= 2) {
    risk = "low";
    score = Math.round(((density - 2) / 1 * 0.25) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  // Build flagged word list (top 10)
  const flaggedWords = Object.entries(wordHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const flaggedPhrases = Object.entries(phraseHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  return {
    score,
    risk,
    density_per_100: Math.round(density * 100) / 100,
    flagged_words: flaggedWords,
    flagged_phrases: flaggedPhrases,
    detail:
      risk === "high"
        ? `High density of AI-associated vocabulary (${density.toFixed(2)} per 100 words). This is a strong indicator of AI-generated content.`
        : risk === "medium"
          ? `Moderate density of AI-associated vocabulary (${density.toFixed(2)} per 100 words).`
          : `Low density of AI-associated vocabulary (${density.toFixed(2)} per 100 words), consistent with natural writing.`,
  };
}

// ─── Signal 5: Structural Fingerprints ────────────────────────────────────────
const hedgeOpeners = [
  "in today's", "in an era of", "in this era", "in the rapidly", "in the ever",
  "when it comes to", "it's worth noting", "it is worth noting",
  "it's important to", "it is important to", "let's face it", "let's be honest",
  "the truth is", "the reality is",
];

const resolutionLanguage = [
  "in conclusion", "ultimately", "in the end", "the bottom line",
  "at the end of the day", "what matters most", "the key takeaway",
  "the most important", "it's up to us", "the choice is ours",
  "the path forward", "moving forward", "as we look to the future",
  "looking ahead",
];

function analyzeStructuralFingerprints(text) {
  const lower = text.toLowerCase();
  const totalWords = wordCount(text) || 1;

  // Hedge openers
  let hedgeCount = 0;
  const lines = lower.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    for (const opener of hedgeOpeners) {
      if (trimmed.startsWith(opener)) {
        hedgeCount++;
        break;
      }
    }
  }

  // Also check sentence-level hedge openers
  const sentences = lower.match(/[^.!?]+[.!?]+/g) || [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    for (const opener of hedgeOpeners) {
      if (trimmed.startsWith(opener)) {
        hedgeCount++;
        break;
      }
    }
  }

  // Tricolon lists: "X, Y, and Z" or "X, Y, Z" patterns
  const tricolonRe =
    /\b(\w+(?:\s+\w+)?),\s+(\w+(?:\s+\w+)?),\s+(?:and\s+)?(\w+(?:\s+\w+)?)\b/g;
  const tricolonMatches = lower.match(tricolonRe);
  const tricolonCount = tricolonMatches ? tricolonMatches.length : 0;

  // Em-dash connectors: — or -- used rhetorically
  const emDashMatches = text.match(/—|--/g);
  const emDashCount = emDashMatches ? emDashMatches.length : 0;

  // Check for rhetorical dash connectors: —not, —and, —but, —or
  const rhetoricalDashRe = /(?:—|--)(?:not|and|but|or)\b/gi;
  const rhetoricalDashMatches = text.match(rhetoricalDashRe);
  const rhetoricalDashCount = rhetoricalDashMatches ? rhetoricalDashMatches.length : 0;

  // Resolution closers in the last paragraph
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let resolutionCount = 0;
  if (paragraphs.length > 0) {
    const lastPara = paragraphs[paragraphs.length - 1].toLowerCase();
    for (const phrase of resolutionLanguage) {
      if (lastPara.includes(phrase)) {
        resolutionCount++;
      }
    }
  }

  const totalFingerprints =
    hedgeCount + tricolonCount + emDashCount + resolutionCount;
  const density = (totalFingerprints / totalWords) * 100;

  let risk, score;
  if (density >= 4) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + density * 0.1) * 100) / 100;
  } else if (density >= 1.5) {
    risk = "medium";
    score = Math.round(((density - 1.5) / 2.5 * 0.5 + 0.3) * 100) / 100;
  } else if (density >= 0.5) {
    risk = "low";
    score = Math.round(((density - 0.5) / 1 * 0.2) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    density_per_100: Math.round(density * 100) / 100,
    hedge_openers: hedgeCount,
    tricolon_lists: tricolonCount,
    em_dash_connectors: emDashCount,
    resolution_closers: resolutionCount,
    detail:
      risk === "high"
        ? `High density of structural AI fingerprints (${density.toFixed(2)} per 100 words). Found ${hedgeCount} hedge openers, ${tricolonCount} tricolon lists, ${emDashCount} em dashes, ${resolutionCount} resolution closers.`
        : risk === "medium"
          ? `Moderate structural fingerprint density (${density.toFixed(2)} per 100 words).`
          : `Low structural fingerprint density (${density.toFixed(2)} per 100 words), consistent with human writing.`,
  };
}

// ─── Signal 6: Transition Word Density ───────────────────────────────────────
const transitionWords = [
  "furthermore", "moreover", "additionally", "consequently",
  "nevertheless", "nonetheless", "however", "therefore", "thus",
  "hence", "accordingly", "meanwhile", "subsequently", "concurrently",
  "simultaneously", "contrarily", "conversely", "instead", "likewise",
  "similarly", "specifically", "namely", "notably", "particularly",
  "significantly",
];

function analyzeTransitionWordDensity(text) {
  const lower = text.toLowerCase();
  const words = tokenize(lower);
  const totalWords = words.length || 1;

  let transitionCount = 0;
  const transitionSet = new Set(transitionWords);
  for (const w of words) {
    if (transitionSet.has(w)) {
      transitionCount++;
    }
  }

  const density = (transitionCount / totalWords) * 100;

  let risk, score;
  if (density > 4) {
    risk = "high";
    score = Math.round(Math.min(1.0, density / 6) * 100) / 100;
  } else if (density >= 2) {
    risk = "medium";
    score = Math.round(((density - 2) / 2 * 0.5 + 0.2) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    density_per_100: Math.round(density * 100) / 100,
    detail:
      risk === "high"
        ? `High transition word density (${density.toFixed(2)} per 100 words). AI text often overuses explicit transitions.`
        : risk === "medium"
          ? `Moderate transition word density (${density.toFixed(2)} per 100 words).`
          : `Low transition word density (${density.toFixed(2)} per 100 words), natural for human writing.`,
  };
}

// ─── Signal 7: Rhetorical Questions ──────────────────────────────────────────
const rhetoricalStarts = [
  "have you ever", "what if", "do you", "did you", "can you",
  "could you", "would you", "are you", "isn't it", "don't you",
  "who doesn't", "what would", "how many of you", "how often do",
  "what's the", "what's your",
];

function analyzeRhetoricalQuestions(text) {
  const lower = text.toLowerCase();
  const sentences = lower.match(/[^.!?]+\?+/g);
  if (!sentences) {
    return {
      score: 0,
      risk: "low",
      count: 0,
      detail: "No questions found in the text.",
    };
  }

  let rhetoricalCount = 0;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    for (const starter of rhetoricalStarts) {
      if (trimmed.startsWith(starter)) {
        rhetoricalCount++;
        break;
      }
    }
  }

  const totalWords = wordCount(text) || 1;
  const density = (rhetoricalCount / totalWords) * 100;

  let risk, score;
  if (density > 2) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + density * 0.2) * 100) / 100;
  } else if (density > 0.5) {
    risk = "medium";
    score = Math.round(((density - 0.5) / 1.5 * 0.5 + 0.3) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    count: rhetoricalCount,
    detail:
      risk === "high"
        ? `High number of rhetorical questions (${rhetoricalCount}). AI text frequently uses rhetorical questions as engagement devices.`
        : risk === "medium"
          ? `Some rhetorical questions detected (${rhetoricalCount}).`
          : `Few or no rhetorical questions (${rhetoricalCount}), typical of natural writing.`,
  };
}

// ─── Signal 8: Hedging Density ───────────────────────────────────────────────
const hedgingPhrases = [
  "it can be argued", "it could be argued",
  "it might be", "it may be", "it seems", "it appears",
  "it tends to", "it is often", "it is generally",
  "it is widely", "it is commonly",
  "in many cases", "in some cases", "in most cases",
  "to some extent", "to a certain extent", "to a degree",
  "up to a point",
];

const hedgingWords = [
  "arguably", "perhaps", "maybe", "possibly", "likely",
  "potentially", "typically", "usually", "often", "sometimes",
  "frequently", "occasionally", "generally", "broadly",
  "largely", "mostly", "mainly", "primarily", "predominantly",
  "relatively", "comparatively", "fairly", "quite", "rather",
  "somewhat",
];

function analyzeHedgingDensity(text) {
  const lower = text.toLowerCase();
  const totalWords = wordCount(text) || 1;

  // Count hedging phrases
  let phraseTotal = 0;
  for (const phrase of hedgingPhrases) {
    let idx = 0;
    while (idx < lower.length) {
      const pos = lower.indexOf(phrase, idx);
      if (pos === -1) break;
      phraseTotal++;
      idx = pos + phrase.length;
    }
  }

  // Count hedging words (as whole words)
  let wordTotal = 0;
  const words = tokenize(lower);
  const hedgingSet = new Set(hedgingWords);
  for (const w of words) {
    if (hedgingSet.has(w)) {
      wordTotal++;
    }
  }

  const totalHedges = phraseTotal + wordTotal;
  const density = (totalHedges / totalWords) * 100;

  let risk, score;
  if (density > 6) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + density * 0.06) * 100) / 100;
  } else if (density >= 3) {
    risk = "medium";
    score = Math.round(((density - 3) / 3 * 0.5 + 0.3) * 100) / 100;
  } else if (density >= 1.5) {
    risk = "low";
    score = Math.round(((density - 1.5) / 1.5 * 0.2) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    density_per_100: Math.round(density * 100) / 100,
    detail:
      risk === "high"
        ? `High hedging density (${density.toFixed(2)} per 100 words). AI text often hedges assertions excessively.`
        : risk === "medium"
          ? `Moderate hedging density (${density.toFixed(2)} per 100 words).`
          : `Low hedging density (${density.toFixed(2)} per 100 words), natural for human writing.`,
  };
}

// ─── Signal 9: Concrete vs Abstract Ratio ────────────────────────────────────
const abstractWords = new Set([
  "concept", "idea", "notion", "thought", "belief", "mindset", "perspective",
  "paradigm", "approach", "methodology", "framework", "strategy", "tactic",
  "principle", "value", "culture", "vision", "mission", "goal", "objective",
  "aspect", "factor", "element", "component", "dimension", "facet", "realm",
  "sense", "nature", "essence", "core", "heart", "soul", "spirit", "ethos",
  "theme", "subject",
  "problem", "challenge", "opportunity", "solution",
  "implication", "significance",
  "purpose", "rationale", "justification", "basis",
  "groundwork", "underpinning",
  "insight", "consciousness",
  "appreciation", "acknowledgment",
  "execution", "delivery", "evolution", "transformation",
  "transition", "shift", "movement", "advancement",
  "growth", "enrichment", "refinement",
  "fostering", "facilitation", "enablement",
  "empowerment", "stakeholder", "ecosystem", "synergy",
]);

function analyzeConcreteAbstractRatio(text) {
  const words = tokenize(text);
  const totalWords = words.length || 1;

  // Count abstract words
  let abstractCount = 0;
  for (const w of words) {
    if (abstractWords.has(w.toLowerCase())) {
      abstractCount++;
    }
  }

  // Count concrete indicators:
  // - Numbers (digits)
  // - Proper nouns (capitalized non-first-words in sentence)
  // - Dates (e.g., "2024", "January", "Monday")
  // - Measurements (e.g., "5km", "10lbs")

  let concreteCount = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const isNumber = /^\d+$/.test(w) || /^\d+[a-z]+$/i.test(w);
    const isProperNoun =
      /^[A-Z][a-z]+$/.test(w) && !/^(The|This|It|One|A|An|In|On|At|To|For|Of|And|But|Or|Nor|Yet|So|With|Without|From|By|About|As|Into|Through|During|Before|After|Above|Below|Between|Under|Over|Again|Further|Then|Once|Here|There|When|Where|Why|How|All|Each|Every|Both|Few|More|Most|Other|Some|Such|No|Nor|Not|Only|Own|Same|So|Than|Too|Very|Just|Because|Although|Unless|Until|While|If|Whether|Is|Are|Was|Were|Be|Been|Being|Have|Has|Had|Do|Does|Did|Will|Would|Can|Could|Shall|Should|May|Might|Must|About|Across|After|Along|Among|Around|At|Before|Behind|Between|Beyond|By|Down|During|Except|For|From|In|Inside|Into|Near|Of|Off|On|Out|Outside|Over|Through|To|Toward|Under|Up|Upon|With|Within|Without)$/;
    const isDate =
      /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(
        w
      );

    if (isNumber || (isProperNoun && i > 0) || isDate) {
      concreteCount++;
    }
  }

  const abstractRatio =
    abstractCount / (concreteCount + abstractCount + 1);

  let risk, score;
  if (abstractRatio > 0.75) {
    risk = "high";
    score = Math.round(Math.min(1.2, abstractRatio * 1.2) * 100) / 100;
  } else if (abstractRatio > 0.50) {
    risk = "medium";
    score = Math.round(((abstractRatio - 0.5) * 2.0 + 0.35) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    abstract_ratio: Math.round(abstractRatio * 1000) / 1000,
    detail:
      risk === "high"
        ? `High abstract-to-concrete ratio (${abstractRatio.toFixed(3)}). AI text tends to be abstract with few specific examples, numbers, or named entities.`
        : risk === "medium"
          ? `Moderate abstract-to-concrete ratio (${abstractRatio.toFixed(3)}).`
          : `Good balance of concrete and abstract language (ratio=${abstractRatio.toFixed(3)}), typical of human writing with specific details.`,
  };
}

// ─── Signal 10: N-gram Repetition ────────────────────────────────────────────
function analyzeNgramRepetition(text) {
  const words = tokenize(text.toLowerCase());
  const totalWords = words.length;

  if (totalWords < 8) {
    return {
      score: 0,
      risk: "low",
      repeat_ratio: 0,
      detail: "Text too short for reliable n-gram analysis.",
    };
  }

  // Extract 4-grams
  const ngrams = {};
  for (let i = 0; i <= totalWords - 4; i++) {
    const ngram = words.slice(i, i + 4).join(" ");
    ngrams[ngram] = (ngrams[ngram] || 0) + 1;
  }

  const totalNgrams = Object.keys(ngrams).length;
  if (totalNgrams === 0) {
    return {
      score: 0,
      risk: "low",
      repeat_ratio: 0,
      detail: "No 4-grams found in the text.",
    };
  }

  const repeatedNgrams = Object.values(ngrams).filter((c) => c > 1).length;
  const repeatRatio = repeatedNgrams / totalNgrams;

  let risk, score;
  if (repeatRatio > 0.08) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + repeatRatio * 5) * 100) / 100;
  } else if (repeatRatio > 0.02) {
    risk = "medium";
    score = Math.round(((repeatRatio - 0.02) * 5 + 0.3) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    repeat_ratio: Math.round(repeatRatio * 1000) / 1000,
    detail:
      risk === "high"
        ? `High n-gram repetition (${(repeatRatio * 100).toFixed(1)}% of 4-grams repeat). AI text often reuses common phrases and patterns.`
        : risk === "medium"
          ? `Moderate n-gram repetition (${(repeatRatio * 100).toFixed(1)}% of 4-grams repeat).`
          : `Low n-gram repetition (${(repeatRatio * 100).toFixed(1)}% of 4-grams repeat), natural for human writing.`,
  };
}

// ─── Signal 11: Narrative Arc Tightness ──────────────────────────────────────
const callToActionWords = [
  "start", "begin", "try", "take action", "implement", "apply",
  "use", "leverage", "embrace", "adopt", "incorporate", "integrate",
  "make it a habit", "make it a priority", "make it part of",
  "don't wait", "start today", "take the first step",
  "the time is now", "now is the time",
];

function analyzeNarrativeArcTightness(text) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (paragraphs.length < 2) {
    return {
      score: 0,
      risk: "low",
      tightness_score: 0,
      detail: "Need at least 2 paragraphs to assess narrative arc.",
    };
  }

  const lastTwoParagraphs = paragraphs.slice(-2).join(" ").toLowerCase();
  const firstParagraph = paragraphs[0].toLowerCase();
  const lastParagraph = paragraphs[paragraphs.length - 1].toLowerCase();

  let tightnessScore = 0;

  // Check resolution language in last two paragraphs
  const resolutionSet = new Set(resolutionLanguage);
  for (const phrase of resolutionLanguage) {
    if (lastTwoParagraphs.includes(phrase)) {
      tightnessScore += 0.15;
    }
  }

  // Check call-to-action language
  for (const phrase of callToActionWords) {
    if (lastTwoParagraphs.includes(phrase)) {
      tightnessScore += 0.1;
    }
  }

  // Check if conclusion mirrors introduction
  const firstWords = new Set(tokenize(firstParagraph));
  const lastWords = tokenize(lastParagraph);
  const overlap =
    lastWords.filter((w) => firstWords.has(w)).length / Math.max(lastWords.length, 1);

  if (overlap > 0.4) {
    tightnessScore += 0.2;
  }

  // Clamp to 0-1
  tightnessScore = Math.min(tightnessScore, 1);

  let risk, score;
  if (tightnessScore > 0.5) {
    risk = "high";
    score = Math.round(Math.min(1.2, 0.5 + tightnessScore) * 100) / 100;
  } else if (tightnessScore > 0.2) {
    risk = "medium";
    score = Math.round(((tightnessScore - 0.2) * 1.67 + 0.3) * 100) / 100;
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    tightness_score: Math.round(tightnessScore * 1000) / 1000,
    detail:
      risk === "high"
        ? `Narrative arc is very tight (score=${tightnessScore.toFixed(3)}). The conclusion neatly wraps up with resolution language and/or call-to-action, a pattern common in AI-generated text.`
        : risk === "medium"
          ? `Moderate narrative arc tightness (score=${tightnessScore.toFixed(3)}).`
          : `Natural narrative arc (score=${tightnessScore.toFixed(3)}), not overly neat or formulaic.`,
  };
}

// ─── Signal 12: Model Dialect Fingerprinting ─────────────────────────────────
function analyzeModelFingerprint(text) {
  const lower = text.toLowerCase();
  const words = tokenize(lower);

  // GPT/ChatGPT signals: punchy, framework-heavy, numbered lists, contrast structures
  let gptScore = 0;
  if (/\bIt['']?s not\b.*\bIt['']?s\b/i.test(text)) gptScore += 2;
  if (/\b(?:Stop|Start)\s+\w+ing\b/i.test(text)) gptScore += 1.5;
  if (/\b(?:crucial|leverage|game-changer|game-changing)\b/i.test(lower)) gptScore += 1;
  if (/\b(?:framework|playbook|blueprint)\b/i.test(lower)) gptScore += 0.5;
  // Numbered lists: lines starting with digits or "First, Second, Third"
  const numberedListRe = /(?:^|\n)\s*\d+[.)]/gm;
  const numberedMatches = text.match(numberedListRe);
  if (numberedMatches && numberedMatches.length >= 2) gptScore += 1;
  // Action-oriented imperatives
  const imperativeRe = /\b(?:Implement|Build|Create|Develop|Design|Launch)\b/g;
  const imperativeMatches = text.match(imperativeRe);
  if (imperativeMatches && imperativeMatches.length >= 3) gptScore += 1;

  // Claude signals: reflective, nuanced, balanced, hedging
  let claudeScore = 0;
  if (/\bworth noting\b/i.test(lower)) claudeScore += 2;
  if (/\bnuanced\b/i.test(lower)) claudeScore += 1.5;
  if (/\b(?:on the other hand|however|that said|that being said)\b/i.test(lower))
    claudeScore += 1;
  if (/\b(?:consider|perhaps|it's worth|might be|may be)\b/i.test(lower))
    claudeScore += 0.5;
  // Long reflective sentences (longer average sentence length)
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    const avgLen =
      sentences.reduce((sum, s) => sum + wordCount(s), 0) / sentences.length;
    if (avgLen > 22) claudeScore += 1;
  }
  // Qualified assertions
  const qualifiedRe =
    /\b(?:tends to|often|generally|in many cases|to some extent)\b/gi;
  const qualifiedMatches = lower.match(qualifiedRe);
  if (qualifiedMatches && qualifiedMatches.length >= 2) claudeScore += 1;

  // Gemini signals: explanatory, educational, step-by-step
  let geminiScore = 0;
  if (/\blet's explore\b/i.test(lower)) geminiScore += 2;
  if (/\b(?:it's important to|it is important to)\b/i.test(lower)) geminiScore += 1.5;
  if (/\b(?:step-by-step|first,|second,|third,|finally,)\b/i.test(lower))
    geminiScore += 1;
  if (/\b(?:explain|understand|learn about)\b/i.test(lower)) geminiScore += 0.5;
  // Neutral measured tone — check for balanced argument markers
  if (
    /\b(?:both|neither|either|some\.\.\.others|on one hand|on the other hand)\b/i.test(
      lower
    )
  )
    geminiScore += 0.5;
  // Educational "let's" constructions
  const letsRe = /\blet's\s+(?:look|see|understand|explore|consider|learn|break\s+down)\b/gi;
  const letsMatches = lower.match(letsRe);
  if (letsMatches && letsMatches.length >= 1) geminiScore += 1;

  const totalWords = wordCount(text) || 1;
  const scores = {
    gpt: gptScore / Math.max(1, totalWords / 100),
    claude: claudeScore / Math.max(1, totalWords / 100),
    gemini: geminiScore / Math.max(1, totalWords / 100),
  };

  let bestGuess = "unknown";
  let maxScore = 0;
  const threshold = 0.5; // confidence threshold

  for (const [model, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestGuess = model;
    }
  }

  const confidence = maxScore > 1.5 ? "high" : maxScore > 0.8 ? "medium" : "low";
  const confidenceNumeric =
    maxScore > 1.5 ? 0.8 : maxScore > 0.8 ? 0.5 : 0.2;

  const displayGuess =
    maxScore >= threshold ? bestGuess : "unknown";

  let risk, score;
  if (displayGuess !== "unknown") {
    if (confidenceNumeric > 0.6) {
      risk = "high";
      score = Math.round(Math.min(1.0, confidenceNumeric * 1.2) * 100) / 100;
    } else {
      risk = "medium";
      score = Math.round(confidenceNumeric * 100) / 100;
    }
  } else {
    risk = "low";
    score = 0;
  }

  return {
    score,
    risk,
    best_guess: displayGuess,
    confidence: Math.round(confidenceNumeric * 100) / 100,
    detail:
      displayGuess !== "unknown"
        ? `Text exhibits patterns consistent with ${displayGuess.toUpperCase()} dialect (confidence: ${(confidenceNumeric * 100).toFixed(0)}%).`
        : "No strong model-specific dialect detected. Text does not clearly match GPT, Claude, or Gemini patterns.",
  };
}

// ─── Overall score computation ───────────────────────────────────────────────
function computeOverallScore(signals, wordCount) {
  // Weight definitions — heavily weighted toward most reliable signals.
  // paragraph_uniformity and contraction_density carry the most weight
  // because they are the strongest discriminators in formal AI text.
  const weights = {
    paragraph_uniformity: 0.29,
    contraction_density: 0.34,
    ai_vocabulary_density: 0.15,
    structural_fingerprints: 0.08,
    sentence_start_diversity: 0.05,
    transition_word_density: 0.02,
    hedging_density: 0.02,
    model_fingerprint: 0.03,
    concrete_abstract_ratio: 0.01,
    narrative_arc_tightness: 0.00,
    ngram_repetition: 0.00,
    rhetorical_questions: 0.00,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  // Count firing signals and compute weighted sum.
  // Signals at low risk (score=0) contribute nothing.
  let weightedSum = 0;
  let firingCount = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (signals[key] && signals[key].score !== undefined) {
      weightedSum += signals[key].score * weight;
      if (signals[key].risk !== "low" && signals[key].risk !== "none") {
        firingCount++;
      }
    }
  }

  if (firingCount === 0) return { ai_risk_score: 0, risk_level: "very_low" };

  const rawScore = (weightedSum / totalWeight) * 100;

  // Apply signal-count multiplier:
  //   Few signals = less confidence (could be noise)
  //   Many signals = corroborating evidence
  let multiplier;
  if (firingCount >= 6) multiplier = 1.20;
  else if (firingCount >= 5) multiplier = 1.10;
  else if (firingCount >= 4) multiplier = 1.00;
  else if (firingCount >= 3) multiplier = 0.95;
  else if (firingCount >= 2) multiplier = 0.55;
  else multiplier = 0.30;

  let finalScore = Math.round(rawScore * multiplier);

  // Apply short-text penalty
  let shortTextPenalty = 0;
  if (wordCount < 50) {
    shortTextPenalty = 0.3;
  } else if (wordCount < 100) {
    shortTextPenalty = 0.15;
  }

  finalScore = Math.round(finalScore * (1 - shortTextPenalty));

  return {
    ai_risk_score: finalScore,
    risk_level: overallRiskLevel(finalScore),
  };
}

// ─── Main analysis function ──────────────────────────────────────────────────
function analyzeText(text) {
  const trimmed = text.trim();
  const totalWords = wordCount(trimmed);

  // Edge case: empty or very short text
  if (!trimmed) {
    return {
      text_stats: { word_count: 0, sentence_count: 0, paragraph_count: 0 },
      signals: {
        paragraph_uniformity: { score: 0, risk: "low", cv: 0, detail: "Empty text." },
        contraction_density: { score: 0, risk: "low", ratio: 0, detail: "Empty text." },
        sentence_start_diversity: { score: 0, risk: "low", diversity_ratio: 0, overused_starters: [], detail: "Empty text." },
        ai_vocabulary_density: { score: 0, risk: "low", density_per_100: 0, flagged_words: [], flagged_phrases: [], detail: "Empty text." },
        structural_fingerprints: { score: 0, risk: "low", density_per_100: 0, hedge_openers: 0, tricolon_lists: 0, em_dash_connectors: 0, resolution_closers: 0, detail: "Empty text." },
        transition_word_density: { score: 0, risk: "low", density_per_100: 0, detail: "Empty text." },
        rhetorical_questions: { score: 0, risk: "low", count: 0, detail: "Empty text." },
        hedging_density: { score: 0, risk: "low", density_per_100: 0, detail: "Empty text." },
        concrete_abstract_ratio: { score: 0, risk: "low", abstract_ratio: 0, detail: "Empty text." },
        ngram_repetition: { score: 0, risk: "low", repeat_ratio: 0, detail: "Empty text." },
        narrative_arc_tightness: { score: 0, risk: "low", tightness_score: 0, detail: "Empty text." },
        model_fingerprint: { score: 0, risk: "low", best_guess: "unknown", confidence: 0, detail: "Empty text." },
      },
      overall: {
        ai_risk_score: 0,
        risk_level: "very_low",
        confidence: "low",
        summary: "Text is empty. Cannot perform analysis.",
      },
    };
  }

  const signals = {
    paragraph_uniformity: analyzeParagraphUniformity(trimmed),
    contraction_density: analyzeContractionDensity(trimmed),
    sentence_start_diversity: analyzeSentenceStartDiversity(trimmed),
    ai_vocabulary_density: analyzeAIVocabularyDensity(trimmed),
    structural_fingerprints: analyzeStructuralFingerprints(trimmed),
    transition_word_density: analyzeTransitionWordDensity(trimmed),
    rhetorical_questions: analyzeRhetoricalQuestions(trimmed),
    hedging_density: analyzeHedgingDensity(trimmed),
    concrete_abstract_ratio: analyzeConcreteAbstractRatio(trimmed),
    ngram_repetition: analyzeNgramRepetition(trimmed),
    narrative_arc_tightness: analyzeNarrativeArcTightness(trimmed),
    model_fingerprint: analyzeModelFingerprint(trimmed),
  };

  const overall = computeOverallScore(signals, totalWords);

  // Determine confidence level
  let confidence;
  if (totalWords < 50) {
    confidence = "low";
  } else if (totalWords < 150) {
    confidence = "medium";
  } else {
    confidence = "high";
  }

  // Build summary
  const highRiskSignals = Object.entries(signals)
    .filter(([, s]) => s.risk === "high")
    .map(([key]) => key.replace(/_/g, " "));

  let summary;
  if (overall.ai_risk_score >= 60) {
    summary = `Strong AI-generation signals detected. ${highRiskSignals.length} of 12 dimensions show high risk (${highRiskSignals.join(", ")}). Overall risk score: ${overall.ai_risk_score}/100 (${overall.risk_level}).`;
  } else if (overall.ai_risk_score >= 40) {
    summary = `Mixed signals detected. Some patterns consistent with AI generation, others are human-typical. Overall risk score: ${overall.ai_risk_score}/100 (${overall.risk_level}).`;
  } else if (overall.ai_risk_score >= 20) {
    summary = `Mostly natural writing patterns. Few AI-associated signals detected. Overall risk score: ${overall.ai_risk_score}/100 (${overall.risk_level}).`;
  } else {
    summary = `Text reads naturally with human-typical patterns. Minimal AI-generation signals detected. Overall risk score: ${overall.ai_risk_score}/100 (${overall.risk_level}).`;
  }

  return {
    text_stats: {
      word_count: totalWords,
      sentence_count: sentenceCount(trimmed),
      paragraph_count: paragraphCount(trimmed),
    },
    signals,
    overall: {
      ai_risk_score: overall.ai_risk_score,
      risk_level: overall.risk_level,
      confidence,
      summary,
    },
  };
}

// ─── Tool export ─────────────────────────────────────────────────────────────
export const aiDetectorTool = tool({
  description: `Advanced AI-generated text detection tool. Analyzes text across 12 signal dimensions including paragraph uniformity, contraction density, sentence-start diversity, AI vocabulary, structural fingerprints, transition word density, rhetorical questions, hedging, concrete/abstract ratio, n-gram repetition, narrative arc tightness, and model dialect fingerprinting.

Returns a comprehensive JSON report with per-signal risk scores and an overall AI risk assessment (0-100). Best used on text of 150+ words for reliable results.

Supports GPT, Claude, and Gemini dialect fingerprinting.`,
  args: {
    text: tool.schema
      .string()
      .describe("The text to analyze for AI-generation signals. Longer text (150+ words) produces more reliable results."),
  },
  async execute(args, context) {
    const result = analyzeText(args.text);

    const output = JSON.stringify(result, null, 2);

    context.metadata({
      title: `AI Detector: ${result.overall.risk_level} (${result.overall.ai_risk_score}/100)`,
      metadata: {
        risk_score: result.overall.ai_risk_score,
        risk_level: result.overall.risk_level,
        confidence: result.overall.confidence,
        word_count: result.text_stats.word_count,
        sentence_count: result.text_stats.sentence_count,
        paragraph_count: result.text_stats.paragraph_count,
      },
    });

    return {
      title: `ai-detector: ${result.overall.risk_level} (${result.overall.ai_risk_score}/100)`,
      output,
      metadata: {
        risk_score: result.overall.ai_risk_score,
        risk_level: result.overall.risk_level,
        confidence: result.overall.confidence,
        word_count: result.text_stats.word_count,
      },
    };
  },
});
