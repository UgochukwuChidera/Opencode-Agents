/**
 * Text Tools - String manipulation, hashing, encoding utilities
 *
 * Provides tools for text processing: hashing, Base64, UUID generation,
 * case conversion, regex testing, and more.
 * All operations are local and cross-platform.
 */
import { tool } from "@opencode-ai/plugin";
import crypto from "crypto";

/**
 * Hash tool.
 * Generate hashes of text using various algorithms.
 */
export const hashTool = tool({
  description: `Generate cryptographic hashes of text.
Supports MD5, SHA1, SHA256, SHA512, and more algorithms.
Useful for checksums, password verification, and data integrity checks.
Cross-platform: works identically on all platforms.`,
  args: {
    text: tool.schema
      .string()
      .describe("The text to hash"),
    algorithm: tool.schema
      .string()
      .optional()
      .default("sha256")
      .describe(
        "Hash algorithm: md5, sha1, sha256, sha512, sha384, sha224, blake2b512, blake2s256 (default: sha256)"
      ),
    encoding: tool.schema
      .string()
      .optional()
      .default("hex")
      .describe("Output encoding: hex, base64, base64url (default: hex)"),
  },
  async execute(args, context) {
    const supportedAlgorithms = crypto.getHashes();
    const algorithm = args.algorithm.toLowerCase();

    if (!supportedAlgorithms.includes(algorithm)) {
      const similar = findSimilar(algorithm, supportedAlgorithms);
      return {
        title: `hash: unsupported algorithm "${algorithm}"`,
        output: `Unsupported algorithm: "${algorithm}".\nSupported: ${supportedAlgorithms.join(", ")}${similar ? `\nDid you mean: ${similar}?` : ""}`,
        metadata: { error: "unsupported_algorithm" },
      };
    }

    const encoding = args.encoding || "hex";
    const hash = crypto.createHash(algorithm).update(args.text, "utf8").digest(encoding);

    return {
      title: `hash: ${algorithm} (${encoding})`,
      output: `Algorithm: ${algorithm}\nEncoding:  ${encoding}\nInput:     ${args.text.slice(0, 100)}${args.text.length > 100 ? "…" : ""}\nHash:      ${hash}`,
      metadata: {
        algorithm,
        encoding,
        inputLength: args.text.length,
        hashLength: hash.length,
      },
    };
  },
});

/**
 * UUID tool.
 * Generate UUIDs (v4 and v7).
 */
export const uuidTool = tool({
  description: `Generate UUIDs (Universally Unique Identifiers).
Supports UUID v4 (random) and v7 (time-ordered).
Useful for generating IDs for entities, records, and tracking.`,
  args: {
    count: tool.schema
      .number()
      .optional()
      .default(1)
      .describe("Number of UUIDs to generate (1-100, default: 1)"),
    version: tool.schema
      .number()
      .optional()
      .default(4)
      .describe("UUID version: 4 (random) or 7 (time-ordered, default: 4)"),
  },
  async execute(args, context) {
    const count = Math.min(Math.max(1, args.count ?? 1), 100);
    const version = args.version === 7 ? 7 : 4;
    const uuids = [];

    for (let i = 0; i < count; i++) {
      if (version === 7) {
        uuids.push(generateUUIDv7());
      } else {
        uuids.push(crypto.randomUUID());
      }
    }

    const output = uuids.map((u, i) => `${i + 1}. ${u}`).join("\n");
    return {
      title: `uuid: ${count} v${version} UUID(s)`,
      output: output,
      metadata: { count, version, uuids },
    };
  },
});

/**
 * Generate a UUID v7 (time-ordered).
 */
function generateUUIDv7() {
  const bytes = crypto.randomBytes(16);
  const now = Date.now();

  // Set time-based prefix (first 6 bytes = 48-bit timestamp in ms)
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // Set version (7) in upper 4 bits of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant (10xx) in upper 2 bits of byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Format as UUID
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Base64 encode/decode tool.
 */
export const base64Tool = tool({
  description: `Encode or decode Base64 data.
Supports standard Base64, URL-safe Base64, and hex conversion.
Useful for encoding binary data, decoding JWT tokens, and data format conversion.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema
      .string()
      .optional()
      .default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
    variant: tool.schema
      .string()
      .optional()
      .default("standard")
      .describe("'standard' (with +/ and = padding) or 'urlsafe' (with -_ and no padding) (default: standard)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    const variant = args.variant || "standard";
    const isUrlSafe = variant === "urlsafe";

    try {
      let result;
      if (action === "encode") {
        const buf = Buffer.from(args.input, "utf8");
        result = isUrlSafe
          ? buf.toString("base64url")
          : buf.toString("base64");
      } else if (action === "decode") {
        let input = args.input;
        if (isUrlSafe) {
          input = input.replace(/-/g, "+").replace(/_/g, "/");
          // Add padding if needed
          while (input.length % 4) input += "=";
        }
        const buf = Buffer.from(input, "base64");
        result = buf.toString("utf8");
      } else {
        return {
          title: "base64: invalid action",
          output: `Invalid action: "${action}". Use "encode" or "decode".`,
          metadata: { error: "invalid_action" },
        };
      }

      return {
        title: `base64: ${action} (${variant})`,
        output: `Input:  ${args.input.slice(0, 200)}${args.input.length > 200 ? "…" : ""}\nAction: ${action}\nVariant: ${variant}\nOutput: ${result.slice(0, 500)}${result.length > 500 ? "…" : ""}`,
        metadata: {
          action,
          variant,
          inputLength: args.input.length,
          outputLength: result.length,
        },
      };
    } catch (error) {
      return {
        title: "base64: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * String case conversion tool.
 */
export const caseConvertTool = tool({
  description: `Convert text between different string cases.
Supports: camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE,
lower_case, Title Case, dot.case, and more.
Useful for code generation and data format conversion.`,
  args: {
    text: tool.schema.string().describe("The text to convert"),
    to: tool.schema
      .string()
      .describe(
        "Target case: camel, pascal, snake, kebab, upper, lower, title, dot, path, constant, swap, lowerFirst, upperFirst"
      ),
  },
  async execute(args, context) {
    const input = args.text;
    const target = args.to.toLowerCase();

    // Split into words
    const words = splitIntoWords(input);

    let result;
    switch (target) {
      case "camel":
        result = words.map((w, i) => i === 0 ? w.toLowerCase() : capitalize(w)).join("");
        break;
      case "pascal":
        result = words.map(capitalize).join("");
        break;
      case "snake":
        result = words.map((w) => w.toLowerCase()).join("_");
        break;
      case "kebab":
        result = words.map((w) => w.toLowerCase()).join("-");
        break;
      case "upper":
        result = words.map((w) => w.toUpperCase()).join("_");
        break;
      case "lower":
        result = words.map((w) => w.toLowerCase()).join("_");
        break;
      case "title":
        result = words.map(capitalize).join(" ");
        break;
      case "dot":
        result = words.map((w) => w.toLowerCase()).join(".");
        break;
      case "path":
        result = words.map((w) => w.toLowerCase()).join("/");
        break;
      case "constant":
        result = words.map((w) => w.toUpperCase()).join("_");
        break;
      case "swap":
        result = input.replace(/[a-zA-Z]/g, (c) =>
          c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
        );
        break;
      case "lowerfirst":
        result = input.charAt(0).toLowerCase() + input.slice(1);
        break;
      case "upperfirst":
        result = input.charAt(0).toUpperCase() + input.slice(1);
        break;
      default:
        return {
          title: "case-convert: unknown case",
          output: `Unknown target case: "${target}".\nAvailable: camel, pascal, snake, kebab, upper, lower, title, dot, path, constant, swap, lowerFirst, upperFirst`,
          metadata: { error: "unknown_case" },
        };
    }

    return {
      title: `case-convert: ${target}`,
      output: `Input:  ${input}\nTarget: ${target}\nOutput: ${result}`,
      metadata: {
        target,
        inputLength: input.length,
        outputLength: result.length,
        result,
      },
    };
  },
});

/**
 * Split text into words, handling various word separators.
 */
function splitIntoWords(text) {
  // Handle camelCase and PascalCase
  const words = [];
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prev = text[i - 1] || "";
    const next = text[i + 1] || "";

    if (/[\s_\-.:,/\\|]/.test(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
    } else if (/[A-Z]/.test(char) && /[a-z]/.test(prev) && current) {
      // Transition from lowercase to uppercase (camelCase boundary)
      words.push(current);
      current = char;
    } else if (/[A-Z]/.test(char) && /[a-z]/.test(next) && current) {
      // Transition from uppercase to lowercase (end of uppercase sequence)
      // e.g., "XMLParser" -> ["XML", "Parser"]
      if (current.length > 1 && /^[A-Z]+$/.test(current)) {
        // Keep the last uppercase letter with the new word
        words.push(current.slice(0, -1));
        current = current.slice(-1) + char;
      } else {
        current += char;
      }
    } else if (/[0-9]/.test(char) && /[a-zA-Z]/.test(prev) && current) {
      // Transition from letter to digit
      words.push(current);
      current = char;
    } else if (/[a-zA-Z]/.test(char) && /[0-9]/.test(prev) && current) {
      // Transition from digit to letter
      words.push(current);
      current = char;
    } else if (/[a-zA-Z0-9]/.test(char)) {
      current += char;
    }
  }

  if (current) {
    words.push(current);
  }

  return words.length > 0 ? words : [text];
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Find similar strings (for error messages).
 */
function findSimilar(input, candidates) {
  // Simple Levenshtein-based matching
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = levenshtein(input, c);
    if (score < bestScore && score <= 3) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Count words and characters in text.
 */
export const textStatsTool = tool({
  description: `Analyze text: count characters, words, lines, sentences, and paragraphs.
Useful for document statistics, code analysis, and content summaries.`,
  args: {
    text: tool.schema.string().describe("The text to analyze"),
  },
  async execute(args, context) {
    const text = args.text;
    const lines = text.split("\n");
    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+\s*/).filter(Boolean);
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);

    const charCount = text.length;
    const charNoSpace = text.replace(/\s/g, "").length;
    const wordCount = words.length;
    const lineCount = lines.length;
    const sentenceCount = sentences.length;
    const paragraphCount = paragraphs.length;

    // Reading time (rough: 200 words/minute)
    const readingTimeMin = Math.ceil(wordCount / 200);

    // Unique words
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))).size;

    return {
      title: `text-stats: ${wordCount} words, ${charCount} chars`,
      output: [
        `Characters (total):  ${charCount}`,
        `Characters (no spaces): ${charNoSpace}`,
        `Words:              ${wordCount}`,
        `Unique words:       ${uniqueWords}`,
        `Lines:              ${lineCount}`,
        `Sentences:          ${sentenceCount}`,
        `Paragraphs:         ${paragraphCount}`,
        `Reading time:       ~${readingTimeMin} min`,
        ``,
        `Avg word length:    ${(charNoSpace / wordCount).toFixed(1)} chars` + (wordCount > 0 ? "" : ""),
        `Avg sentence length: ${(wordCount / sentenceCount).toFixed(1)} words` + (sentenceCount > 0 ? "" : ""),
      ].join("\n"),
      metadata: {
        charCount,
        wordCount,
        lineCount,
        sentenceCount,
        paragraphCount,
        uniqueWords,
        readingTimeMin,
      },
    };
  },
});
