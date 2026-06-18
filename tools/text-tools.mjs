/**
 * Text Tools - String manipulation, hashing, encoding utilities
 *
 * Provides tools for text processing: hashing, Base64, UUID generation,
 * case conversion, regex testing, and more.
 * All operations are local and cross-platform.
 */
import { tool } from "@opencode-ai/plugin";
import crypto from "crypto";
import zlib from "zlib";

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

/**
 * Regex tool.
 * Test, match, or replace text using regular expressions.
 */
export const regexTool = tool({
  description: `Test/match/replace strings with regular expressions.
Supports standard regex patterns, flags, and optional replacement.
Useful for pattern validation, extraction, and text transformation.`,
  args: {
    pattern: tool.schema.string().describe("The regex pattern (without delimiters)"),
    text: tool.schema.string().describe("The text to test/match/replace against"),
    flags: tool.schema.string().optional().default("g").describe("Regex flags (e.g. 'g', 'i', 'gi', default: 'g')"),
    action: tool.schema.string().optional().default("test").describe("Action: 'test', 'match', or 'replace' (default: test)"),
    replacement: tool.schema.string().optional().describe("Replacement string (required for 'replace' action)"),
  },
  async execute(args, context) {
    const { pattern, text, flags = "g", action = "test", replacement } = args;

    try {
      const regex = new RegExp(pattern, flags);

      switch (action) {
        case "test": {
          const result = regex.test(text);
          return {
            title: `regex: test ${result ? "matched" : "no match"}`,
            output: `Pattern: /${pattern}/${flags}\nText:    ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}\nResult:  ${result ? "✓ matched" : "✗ no match"}`,
            metadata: { pattern, flags, action, result },
          };
        }
        case "match": {
          const matches = [];
          let m;
          // Reset lastIndex for global flag
          regex.lastIndex = 0;
          while ((m = regex.exec(text)) !== null) {
            matches.push({
              full: m[0],
              groups: m.slice(1),
              index: m.index,
            });
            if (!regex.global) break;
          }
          const output = matches.length > 0
            ? matches.map((m, i) => `[${i}] at ${m.index}: ${JSON.stringify(m.full)}${m.groups.length ? ` groups: ${JSON.stringify(m.groups)}` : ""}`).join("\n")
            : "No matches found.";
          return {
            title: `regex: match — ${matches.length} result(s)`,
            output: `Pattern: /${pattern}/${flags}\nText:    ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}\n\n${output}`,
            metadata: { pattern, flags, action, matchCount: matches.length, matches },
          };
        }
        case "replace": {
          if (replacement === undefined) {
            return {
              title: "regex: missing replacement",
              output: "A 'replacement' string is required for the 'replace' action.",
              metadata: { error: "missing_replacement" },
            };
          }
          const result = text.replace(regex, replacement);
          const changed = result !== text;
          return {
            title: `regex: replace — ${changed ? "changed" : "unchanged"}`,
            output: `Pattern:     /${pattern}/${flags}\nReplacement: ${replacement}\n\nBefore: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}\nAfter:  ${result.slice(0, 200)}${result.length > 200 ? "…" : ""}`,
            metadata: { pattern, flags, action, replacement, changed, inputLength: text.length, outputLength: result.length },
          };
        }
        default:
          return {
            title: "regex: invalid action",
            output: `Invalid action: "${action}". Use "test", "match", or "replace".`,
            metadata: { error: "invalid_action" },
          };
      }
    } catch (error) {
      return {
        title: "regex: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Sort lines tool.
 */
export const sortTool = tool({
  description: `Sort lines of text alphabetically or numerically.
Supports ascending/descending order, numeric sort, and deduplication.`,
  args: {
    input: tool.schema.string().describe("The text to sort (one item per line)"),
    order: tool.schema.string().optional().default("asc").describe("Sort order: 'asc' or 'desc' (default: asc)"),
    numeric: tool.schema.boolean().optional().default(false).describe("Enable numeric sorting (default: false)"),
    unique: tool.schema.boolean().optional().default(false).describe("Remove duplicate lines (default: false)"),
  },
  async execute(args, context) {
    const { input, order = "asc", numeric = false, unique = false } = args;
    let lines = input.split("\n");

    if (unique) {
      lines = [...new Set(lines)];
    }

    const sorted = lines.sort((a, b) => {
      let cmp;
      if (numeric) {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        cmp = na - nb;
      } else {
        cmp = a.localeCompare(b);
      }
      return order === "desc" ? -cmp : cmp;
    });

    const result = sorted.join("\n");
    return {
      title: `sort: ${order}${numeric ? " numeric" : ""}${unique ? " unique" : ""}`,
      output: result,
      metadata: {
        order,
        numeric,
        unique,
        inputLines: input.split("\n").length,
        outputLines: sorted.length,
      },
    };
  },
});

/**
 * Uniq tool.
 * Deduplicate lines.
 */
export const uniqTool = tool({
  description: `Deduplicate adjacent lines in text.
Supports counting occurrences and showing only repeated lines.`,
  args: {
    input: tool.schema.string().describe("The text to process (one item per line)"),
    action: tool.schema.string().optional().default("uniq").describe("Action: 'uniq', 'count', or 'repeated' (default: uniq)"),
    ignoreCase: tool.schema.boolean().optional().default(false).describe("Ignore case when comparing (default: false)"),
  },
  async execute(args, context) {
    const { input, action = "uniq", ignoreCase = false } = args;
    const lines = input.split("\n");

    if (action === "uniq") {
      const result = [];
      for (let i = 0; i < lines.length; i++) {
        const curr = ignoreCase ? lines[i].toLowerCase() : lines[i];
        const prev = ignoreCase ? lines[i - 1]?.toLowerCase() : lines[i - 1];
        if (i === 0 || curr !== prev) {
          result.push(lines[i]);
        }
      }
      const output = result.join("\n");
      return {
        title: `uniq: ${output.split("\n").length} unique line(s)`,
        output,
        metadata: { action, ignoreCase, inputLines: lines.length, outputLines: result.length },
      };
    }

    if (action === "count") {
      const counts = new Map();
      for (const line of lines) {
        const key = ignoreCase ? line.toLowerCase() : line;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const result = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([line, count]) => `${count.toString().padStart(4)} ${line}`)
        .join("\n");
      return {
        title: `uniq: count — ${counts.size} unique`,
        output: result,
        metadata: { action, ignoreCase, inputLines: lines.length, uniqueLines: counts.size },
      };
    }

    if (action === "repeated") {
      const seen = new Map();
      const repeated = new Set();
      for (const line of lines) {
        const key = ignoreCase ? line.toLowerCase() : line;
        if (seen.has(key)) {
          repeated.add(key);
        }
        seen.set(key, true);
      }
      const result = lines.filter((line) => {
        const key = ignoreCase ? line.toLowerCase() : line;
        return repeated.has(key);
      });
      const output = [...new Set(result)].join("\n");
      return {
        title: `uniq: repeated — ${output.split("\n").filter(Boolean).length} line(s)`,
        output,
        metadata: { action, ignoreCase, inputLines: lines.length, repeatedLines: output.split("\n").filter(Boolean).length },
      };
    }

    return {
      title: "uniq: invalid action",
      output: `Invalid action: "${action}". Use "uniq", "count", or "repeated".`,
      metadata: { error: "invalid_action" },
    };
  },
});

/**
 * Shuffle tool.
 * Randomly shuffle lines or pick random items.
 */
export const shuffleTool = tool({
  description: `Shuffle lines randomly or pick a random subset.
Uses cryptographically secure random number generation.`,
  args: {
    items: tool.schema.string().describe("The items to shuffle (one per line)"),
    count: tool.schema.number().optional().describe("Number of items to pick (default: all, shuffled)"),
  },
  async execute(args, context) {
    const { items, count } = args;
    const lines = items.split("\n");
    const arr = [...lines];

    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const selected = count !== undefined ? arr.slice(0, Math.min(count, arr.length)) : arr;
    const output = selected.join("\n");

    const picked = count !== undefined ? count : arr.length;
    return {
      title: `shuffle: picked ${picked} of ${lines.length} item(s)`,
      output,
      metadata: {
        totalItems: lines.length,
        picked: selected.length,
        shuffled: count === undefined,
      },
    };
  },
});

/**
 * Tr tool.
 * Transliterate characters (like Unix `tr`).
 */
export const trTool = tool({
  description: `Transliterate characters in text (like Unix tr).
Replace or delete specified character sets.`,
  args: {
    input: tool.schema.string().describe("The input text"),
    from: tool.schema.string().describe("Characters to replace (or delete)"),
    to: tool.schema.string().describe("Replacement characters"),
    delete: tool.schema.boolean().optional().default(false).describe("Delete matching characters instead of replacing (default: false)"),
  },
  async execute(args, context) {
    const { input, from, to, delete: shouldDelete = false } = args;

    if (shouldDelete) {
      const result = input.replace(new RegExp(`[${from.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]`, "g"), "");
      return {
        title: "tr: delete",
        output: result,
        metadata: { action: "delete", deletedChars: input.length - result.length, inputLength: input.length, outputLength: result.length },
      };
    }

    const charMap = new Map();
    for (let i = 0; i < from.length; i++) {
      charMap.set(from[i], to[i] || "");
    }

    let result = "";
    for (const ch of input) {
      result += charMap.has(ch) ? charMap.get(ch) : ch;
    }

    return {
      title: "tr: transliterate",
      output: result,
      metadata: { action: "transliterate", fromLength: from.length, toLength: to.length, inputLength: input.length, outputLength: result.length },
    };
  },
});

/**
 * Slug tool.
 * Convert text to a URL-friendly slug.
 */
export const slugTool = tool({
  description: `Convert text to a URL-friendly slug.
Removes special characters, normalizes whitespace, and lowercases.`,
  args: {
    input: tool.schema.string().describe("The text to slugify"),
    separator: tool.schema.string().optional().default("-").describe("Word separator (default: '-')"),
    lowercase: tool.schema.boolean().optional().default(true).describe("Convert to lowercase (default: true)"),
  },
  async execute(args, context) {
    const { input, separator = "-", lowercase = true } = args;

    let slug = input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[^a-zA-Z0-9\s-]/g, "") // Remove non-alphanumeric (keep spaces and hyphens)
      .trim()
      .replace(/[\s-]+/g, separator) // Collapse whitespace/hyphens into separator
      .replace(new RegExp(`^${escapeRegex(separator)}+|${escapeRegex(separator)}+$`, "g"), ""); // Trim separator from ends

    if (lowercase) {
      slug = slug.toLowerCase();
    }

    return {
      title: "slug",
      output: slug || "(empty slug)",
      metadata: {
        inputLength: input.length,
        outputLength: slug.length,
        separator,
        lowercase,
      },
    };
  },
});

/**
 * Compress tool.
 * Gzip, deflate, or brotli compress/decompress text.
 */
export const compressTool = tool({
  description: `Compress or decompress text using gzip, deflate, or brotli.
Uses Node.js built-in zlib — no external dependencies required.`,
  args: {
    input: tool.schema.string().describe("The text to compress or decompress (base64-encoded for compressed data)"),
    action: tool.schema.string().optional().default("compress").describe("Action: 'compress' or 'decompress' (default: compress)"),
    algorithm: tool.schema.string().optional().default("gzip").describe("Algorithm: 'gzip', 'deflate', or 'brotli' (default: gzip)"),
  },
  async execute(args, context) {
    const { input, action = "compress", algorithm = "gzip" } = args;

    try {
      if (action === "compress") {
        const buf = Buffer.from(input, "utf8");
        let compressed;

        if (algorithm === "gzip") {
          compressed = zlib.gzipSync(buf);
        } else if (algorithm === "deflate") {
          compressed = zlib.deflateSync(buf);
        } else if (algorithm === "brotli") {
          compressed = zlib.brotliCompressSync(buf);
        } else {
          return {
            title: "compress: unknown algorithm",
            output: `Unknown algorithm: "${algorithm}". Use "gzip", "deflate", or "brotli".`,
            metadata: { error: "unknown_algorithm" },
          };
        }

        const encoded = compressed.toString("base64");
        const ratio = ((compressed.length / buf.length) * 100).toFixed(1);
        return {
          title: `compress: ${algorithm} (${ratio}%)`,
          output: `Algorithm: ${algorithm}\nOriginal:  ${buf.length} bytes\nCompressed: ${compressed.length} bytes (${ratio}%)\n\nBase64 output:\n${encoded}`,
          metadata: {
            action,
            algorithm,
            inputBytes: buf.length,
            outputBytes: compressed.length,
            ratio: parseFloat(ratio),
            base64: encoded,
          },
        };
      } else if (action === "decompress") {
        const buf = Buffer.from(input, "base64");
        let decompressed;

        if (algorithm === "gzip") {
          decompressed = zlib.gunzipSync(buf);
        } else if (algorithm === "deflate") {
          decompressed = zlib.inflateSync(buf);
        } else if (algorithm === "brotli") {
          decompressed = zlib.brotliDecompressSync(buf);
        } else {
          return {
            title: "compress: unknown algorithm",
            output: `Unknown algorithm: "${algorithm}". Use "gzip", "deflate", or "brotli".`,
            metadata: { error: "unknown_algorithm" },
          };
        }

        const text = decompressed.toString("utf8");
        return {
          title: `compress: decompress ${algorithm}`,
          output: `Algorithm:  ${algorithm}\nCompressed: ${buf.length} bytes\nDecompressed: ${decompressed.length} bytes\n\n${text.slice(0, 1000)}${text.length > 1000 ? "…" : ""}`,
          metadata: {
            action,
            algorithm,
            inputBytes: buf.length,
            outputBytes: decompressed.length,
            textLength: text.length,
          },
        };
      } else {
        return {
          title: "compress: invalid action",
          output: `Invalid action: "${action}". Use "compress" or "decompress".`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (error) {
      return {
        title: "compress: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Markdown tool.
 * Extract headings, links, or generate table of contents from markdown.
 */
export const markdownTool = tool({
  description: `Extract structure from markdown text.
Supports table of contents generation, heading extraction, link extraction, and stripping.`,
  args: {
    input: tool.schema.string().describe("The markdown text to process"),
    action: tool.schema.string().optional().default("toc").describe("Action: 'toc', 'headings', 'links', or 'strip' (default: toc)"),
  },
  async execute(args, context) {
    const { input, action = "toc" } = args;
    const lines = input.split("\n");

    switch (action) {
      case "headings": {
        const headings = [];
        for (const line of lines) {
          const match = line.match(/^(#{1,6})\s+(.+)$/);
          if (match) {
            headings.push({ level: match[1].length, text: match[2].trim(), raw: line });
          }
        }
        const output = headings.map((h) => `${"  ".repeat(h.level - 1)}${"#".repeat(h.level)} ${h.text}`).join("\n");
        return {
          title: `markdown: headings — ${headings.length} found`,
          output: output || "(no headings found)",
          metadata: { action, headingCount: headings.length, headings },
        };
      }
      case "links": {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const links = [];
        let m;
        while ((m = linkRegex.exec(input)) !== null) {
          links.push({ text: m[1], url: m[2] });
        }
        const output = links.map((l, i) => `[${i + 1}] ${l.text} → ${l.url}`).join("\n");
        return {
          title: `markdown: links — ${links.length} found`,
          output: output || "(no links found)",
          metadata: { action, linkCount: links.length, links },
        };
      }
      case "toc": {
        const headings = [];
        for (const line of lines) {
          const match = line.match(/^(#{1,6})\s+(.+)$/);
          if (match) {
            headings.push({ level: match[1].length, text: match[2].trim() });
          }
        }
        const toc = headings
          .map((h) => {
            const indent = "  ".repeat(h.level - 1);
            const slug = h.text
              .toLowerCase()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s]+/g, "-");
            return `${indent}- [${h.text}](#${slug})`;
          })
          .join("\n");
        return {
          title: `markdown: toc — ${headings.length} heading(s)`,
          output: toc || "(no headings found)",
          metadata: { action, headingCount: headings.length },
        };
      }
      case "strip": {
        const stripped = input
          .replace(/^#{1,6}\s+/gm, "") // headings
          .replace(/\*\*(.+?)\*\*/g, "$1") // bold
          .replace(/\*(.+?)\*/g, "$1") // italic
          .replace(/`{1,3}[^`]*`{1,3}/g, "") // inline code
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
          .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
          .replace(/>\s+/gm, "") // blockquotes
          .replace(/[-*+]\s+/gm, "") // list markers
          .replace(/\n{3,}/g, "\n\n"); // excess blank lines
        return {
          title: `markdown: strip — ${input.length - stripped.length} chars removed`,
          output: stripped.trim(),
          metadata: { action, inputLength: input.length, outputLength: stripped.length },
        };
      }
      default:
        return {
          title: "markdown: invalid action",
          output: `Invalid action: "${action}". Use "toc", "headings", "links", or "strip".`,
          metadata: { error: "invalid_action" },
        };
    }
  },
});

/**
 * Pad tool.
 * Pad text to a specified width.
 */
export const padTool = tool({
  description: `Pad text to a specified width.
Supports left, right, and center alignment with configurable padding character.`,
  args: {
    input: tool.schema.string().describe("The text to pad"),
    width: tool.schema.number().describe("Target width for padding"),
    position: tool.schema.string().optional().default("left").describe("Padding position: 'left', 'right', or 'center' (default: left)"),
    char: tool.schema.string().optional().default(" ").describe("Padding character (default: space)"),
  },
  async execute(args, context) {
    const { input, width, position = "left", char = " " } = args;
    const padChar = char.length > 0 ? char[0] : " ";

    if (input.length >= width) {
      return {
        title: `pad: no padding needed (${input.length} >= ${width})`,
        output: input,
        metadata: { width, position, padChar, padded: false, inputLength: input.length },
      };
    }

    const totalPad = width - input.length;
    let result;
    switch (position) {
      case "left":
        result = padChar.repeat(totalPad) + input;
        break;
      case "right":
        result = input + padChar.repeat(totalPad);
        break;
      case "center": {
        const left = Math.floor(totalPad / 2);
        const right = totalPad - left;
        result = padChar.repeat(left) + input + padChar.repeat(right);
        break;
      }
      default:
        return {
          title: "pad: invalid position",
          output: `Invalid position: "${position}". Use "left", "right", or "center".`,
          metadata: { error: "invalid_position" },
        };
    }

    return {
      title: `pad: ${position} (${width} chars)`,
      output: result,
      metadata: { width, position, padChar, padded: true, inputLength: input.length, outputLength: result.length },
    };
  },
});

/**
 * Wrap tool.
 * Word-wrap text to a specified width.
 */
export const wrapTool = tool({
  description: `Word-wrap text to a specified line width.
Preserves words and respects paragraph breaks.`,
  args: {
    input: tool.schema.string().describe("The text to wrap"),
    width: tool.schema.number().optional().default(80).describe("Maximum line width (default: 80)"),
    indent: tool.schema.string().optional().describe("Optional indent string for each line"),
  },
  async execute(args, context) {
    const { input, width = 80, indent = "" } = args;

    const paragraphs = input.split(/\n\s*\n/);
    const wrapped = paragraphs.map((para) => {
      const lines = [];
      const words = para.split(/\s+/).filter(Boolean);
      let current = "";

      for (const word of words) {
        if (current.length + word.length + 1 > width) {
          if (current) {
            lines.push(indent + current);
            current = word;
          } else {
            lines.push(indent + word);
          }
        } else {
          current = current ? current + " " + word : word;
        }
      }
      if (current) {
        lines.push(indent + current);
      }

      return lines.length > 0 ? lines.join("\n") : "";
    });

    const result = wrapped.join("\n\n");

    return {
      title: `wrap: ${width} cols${indent ? " + indent" : ""}`,
      output: result,
      metadata: { width, indentLength: indent.length, inputLength: input.length, outputLength: result.length },
    };
  },
});

/**
 * Head tool.
 * Return the first N lines of text.
 */
export const headTool = tool({
  description: `Return the first N lines of text.
Like the Unix head command.`,
  args: {
    input: tool.schema.string().describe("The input text"),
    lines: tool.schema.number().optional().default(10).describe("Number of lines to return (default: 10)"),
  },
  async execute(args, context) {
    const { input, lines = 10 } = args;
    const allLines = input.split("\n");
    const count = Math.max(0, lines);
    const head = allLines.slice(0, count);
    const result = head.join("\n");

    return {
      title: `head: ${head.length} line(s)`,
      output: result,
      metadata: { requested: count, returned: head.length, totalLines: allLines.length, truncated: head.length < allLines.length },
    };
  },
});

/**
 * Tail tool.
 * Return the last N lines of text.
 */
export const tailTool = tool({
  description: `Return the last N lines of text.
Like the Unix tail command.`,
  args: {
    input: tool.schema.string().describe("The input text"),
    lines: tool.schema.number().optional().default(10).describe("Number of lines to return (default: 10)"),
  },
  async execute(args, context) {
    const { input, lines = 10 } = args;
    const allLines = input.split("\n");
    const count = Math.max(0, lines);
    const tail = allLines.slice(-count);
    const result = tail.join("\n");

    return {
      title: `tail: ${tail.length} line(s)`,
      output: result,
      metadata: { requested: count, returned: tail.length, totalLines: allLines.length, truncated: tail.length < allLines.length },
    };
  },
});

/**
 * Wc tool.
 * Count words, lines, characters, and bytes in text.
 */
export const wcTool = tool({
  description: `Count words, lines, characters, and bytes in text.
Like the Unix wc command.`,
  args: {
    input: tool.schema.string().describe("The text to count"),
  },
  async execute(args, context) {
    const { input } = args;
    const lines = input.split("\n");
    const lineCount = lines.length;
    const wordCount = input.split(/\s+/).filter(Boolean).length;
    const charCount = input.length;
    const byteCount = Buffer.byteLength(input, "utf8");

    const linesNoEmpty = lines.filter(Boolean).length;
    const maxLineLength = Math.max(...lines.map((l) => l.length));

    return {
      title: `wc: ${lineCount} lines, ${wordCount} words, ${charCount} chars`,
      output: [
        `Lines:    ${lineCount}`,
        `  (non-empty): ${linesNoEmpty}`,
        `Words:    ${wordCount}`,
        `Chars:    ${charCount}`,
        `Bytes:    ${byteCount}`,
        `Max line length: ${maxLineLength}`,
      ].join("\n"),
      metadata: {
        lines: lineCount,
        linesNonEmpty: linesNoEmpty,
        words: wordCount,
        chars: charCount,
        bytes: byteCount,
        maxLineLength,
      },
    };
  },
});

/**
 * Split tool.
 * Split text into chunks by delimiter.
 */
export const splitTool = tool({
  description: `Split text into chunks by a delimiter.
Like the Unix split command for text content.`,
  args: {
    input: tool.schema.string().describe("The text to split"),
    delimiter: tool.schema.string().optional().default("\n").describe("Delimiter to split on (default: newline)"),
    limit: tool.schema.number().optional().describe("Maximum number of chunks (optional)"),
  },
  async execute(args, context) {
    const { input, delimiter = "\n", limit } = args;
    const parts = limit !== undefined ? input.split(delimiter, limit) : input.split(delimiter);

    const output = parts.map((part, i) => `[${i}] ${part.slice(0, 200)}${part.length > 200 ? "…" : ""}`).join("\n---\n");

    return {
      title: `split: ${parts.length} chunk(s)`,
      output: output || "(empty result)",
      metadata: {
        chunks: parts.length,
        delimiter: delimiter === "\n" ? "\\n" : delimiter,
        limit: limit || null,
        lengths: parts.map((p) => p.length),
      },
    };
  },
});

/**
 * Paste tool.
 * Join lines with a delimiter.
 */
export const pasteTool = tool({
  description: `Join lines of text with a delimiter.
Like the Unix paste command.`,
  args: {
    lines: tool.schema.string().describe("Lines to join (one per line)"),
    delimiter: tool.schema.string().optional().default(",").describe("Delimiter for joining (default: ',')"),
  },
  async execute(args, context) {
    const { lines, delimiter = "," } = args;
    const parts = lines.split("\n");
    const result = parts.join(delimiter);

    return {
      title: `paste: ${parts.length} item(s) joined`,
      output: result,
      metadata: { items: parts.length, delimiter, inputLength: lines.length, outputLength: result.length },
    };
  },
});

/**
 * Join tool.
 * Merge two texts on a column key (like a database join).
 */
export const joinTool = tool({
  description: `Merge two texts on a column key (like database JOIN).
Each text should have one record per line with fields separated by delimiter.`,
  args: {
    text1: tool.schema.string().describe("First table (one record per line)"),
    text2: tool.schema.string().describe("Second table (one record per line)"),
    key1: tool.schema.number().optional().default(0).describe("Key column index in text1 (0-based, default: 0)"),
    key2: tool.schema.number().optional().default(0).describe("Key column index in text2 (0-based, default: 0)"),
    delimiter: tool.schema.string().optional().default("\t").describe("Field delimiter (default: tab)"),
  },
  async execute(args, context) {
    const { text1, text2, key1 = 0, key2 = 0, delimiter = "\t" } = args;

    const lines1 = text1.split("\n").filter(Boolean);
    const lines2 = text2.split("\n").filter(Boolean);

    // Build lookup from text2
    const lookup = new Map();
    for (const line of lines2) {
      const fields = line.split(delimiter);
      const key = fields[key2]?.trim();
      if (key !== undefined) {
        if (!lookup.has(key)) lookup.set(key, []);
        lookup.get(key).push(fields);
      }
    }

    const results = [];
    let matched = 0;
    let unmatched = 0;

    for (const line of lines1) {
      const fields1 = line.split(delimiter);
      const key = fields1[key1]?.trim();
      const matches = lookup.get(key);
      if (matches) {
        for (const fields2 of matches) {
          results.push([...fields1, ...fields2].join(delimiter));
          matched++;
        }
      } else {
        results.push(line);
        unmatched++;
      }
    }

    const output = results.join("\n");
    return {
      title: `join: ${matched} matched, ${unmatched} unmatched`,
      output,
      metadata: {
        records1: lines1.length,
        records2: lines2.length,
        matched,
        unmatched,
        key1,
        key2,
        delimiter: delimiter === "\t" ? "\\t" : delimiter,
      },
    };
  },
});

/**
 * Cut tool.
 * Extract columns/fields from delimited text.
 */
export const cutTool = tool({
  description: `Extract columns/fields from delimited text.
Like the Unix cut command. Supports ranges (e.g. "1,3-5").`,
  args: {
    input: tool.schema.string().describe("The delimited text"),
    delimiter: tool.schema.string().optional().default("\t").describe("Field delimiter (default: tab)"),
    fields: tool.schema.string().describe("Fields to extract (e.g. '1', '1,3-5', '2-')"),
  },
  async execute(args, context) {
    const { input, delimiter = "\t", fields } = args;

    // Parse field spec like "1,3-5" or "2-"
    const indices = new Set();
    const parts = fields.split(",");
    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)-(\d+)?$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] !== undefined ? parseInt(rangeMatch[2], 10) : Infinity;
        for (let i = start; i <= end; i++) indices.add(i);
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n)) indices.add(n);
      }
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);

    const lines = input.split("\n");
    const result = lines.map((line) => {
      const fieldsArr = line.split(delimiter);
      return sortedIndices
        .map((i) => fieldsArr[i - 1] || "")
        .join(delimiter);
    });

    const output = result.join("\n");
    return {
      title: `cut: fields ${fields}`,
      output,
      metadata: { fields, delimiter: delimiter === "\t" ? "\\t" : delimiter, fieldCount: sortedIndices.length, lineCount: lines.length },
    };
  },
});

/**
 * Sed tool.
 * Find and replace using regex (like Unix sed).
 */
export const sedTool = tool({
  description: `Find and replace text using regular expressions.
Like Unix sed but returns the full result.`,
  args: {
    input: tool.schema.string().describe("The input text"),
    pattern: tool.schema.string().describe("The regex pattern to search for"),
    replacement: tool.schema.string().describe("The replacement string"),
    flags: tool.schema.string().optional().default("g").describe("Regex flags (default: 'g')"),
    literal: tool.schema.boolean().optional().default(false).describe("Treat pattern as literal string (default: false)"),
  },
  async execute(args, context) {
    const { input, pattern, replacement, flags = "g", literal = false } = args;

    try {
      let regex;
      if (literal) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(escaped, flags);
      } else {
        regex = new RegExp(pattern, flags);
      }

      const result = input.replace(regex, replacement);
      const changed = result !== input;
      const matchCount = (input.match(regex) || []).length;

      return {
        title: `sed: ${matchCount} replacement(s)${changed ? "" : " (no changes)"}`,
        output: result,
        metadata: {
          pattern,
          replacement,
          flags,
          literal,
          matchCount,
          changed,
          inputLength: input.length,
          outputLength: result.length,
        },
      };
    } catch (error) {
      return {
        title: "sed: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Grep tool.
 * Search text by regex pattern (like Unix grep).
 */
export const grepTool = tool({
  description: `Search text using regular expressions.
Like Unix grep. Supports inverted matching and context lines.`,
  args: {
    input: tool.schema.string().describe("The text to search"),
    pattern: tool.schema.string().describe("The regex pattern to search for"),
    flags: tool.schema.string().optional().default("g").describe("Regex flags (default: 'g')"),
    invert: tool.schema.boolean().optional().default(false).describe("Invert match (show non-matching lines, default: false)"),
    context: tool.schema.number().optional().describe("Number of context lines before/after each match"),
  },
  async execute(args, _ctx) {
    const { input, pattern, flags = "g", invert = false, context: contextLines } = args;

    try {
      const regex = new RegExp(pattern, flags);
      const lines = input.split("\n");
      const matching = [];
      const totalMatches = [];

      for (let i = 0; i < lines.length; i++) {
        const isMatch = regex.test(lines[i]);
        regex.lastIndex = 0; // Reset for global flag
        if (invert ? !isMatch : isMatch) {
          totalMatches.push(i);
        }
      }

      const matchSet = new Set(totalMatches);

      if (contextLines !== undefined && contextLines > 0) {
        // Add context lines around matches
        const contextSet = new Set();
        for (const idx of matchSet) {
          for (let c = -contextLines; c <= contextLines; c++) {
            const ci = idx + c;
            if (ci >= 0 && ci < lines.length) {
              contextSet.add(ci);
            }
          }
        }
        const sorted = [...contextSet].sort((a, b) => a - b);
        for (const idx of sorted) {
          const prefix = matchSet.has(idx) ? ">" : " ";
          matching.push(`${prefix} ${idx + 1}: ${lines[idx]}`);
        }
      } else {
        const sorted = [...matchSet].sort((a, b) => a - b);
        for (const idx of sorted) {
          matching.push(`${idx + 1}: ${lines[idx]}`);
        }
      }

      const output = matching.join("\n");
      return {
        title: `grep: ${totalMatches.length} match(es)${invert ? " (inverted)" : ""}`,
        output: output || "(no matches)",
        metadata: {
          pattern,
          flags,
          invert,
          contextLines: contextLines || 0,
          matchCount: totalMatches.length,
          totalLines: lines.length,
        },
      };
    } catch (error) {
      return {
        title: "grep: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
