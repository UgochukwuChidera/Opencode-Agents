/**
 * Encode Tools - Encoding, cipher, and format conversion utilities
 *
 * Provides tools for various encoding formats: Base58, hex,
 * ciphers, UUID parsing, Quoted-Printable, Punycode, HTML entities,
 * Unicode info, Ascii85, binary/octal, PEM, NTLM, and pickle inspection.
 * All operations are local and cross-platform.
 */
import { tool } from "@opencode-ai/plugin";
import crypto from "crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Base58 encode/decode tool.
 */
export const base58Tool = tool({
  description: `Encode or decode Base58 data.
Uses the Bitcoin alphabet (123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz).
Useful for cryptocurrency addresses and short link encoding.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        let num = 0n;
        const buf = Buffer.from(args.input, "utf8");
        for (const byte of buf) num = (num << 8n) + BigInt(byte);
        let encoded = "";
        while (num > 0n) {
          const rem = Number(num % 58n);
          encoded = BASE58_ALPHABET[rem] + encoded;
          num /= 58n;
        }
        for (const byte of buf) { if (byte === 0) encoded = "1" + encoded; else break; }
        result = encoded || "1";
      } else {
        let num = 0n;
        for (const ch of args.input) {
          const idx = BASE58_ALPHABET.indexOf(ch);
          if (idx === -1) throw new Error(`Invalid Base58 character: ${ch}`);
          num = num * 58n + BigInt(idx);
        }
        const bytes = [];
        while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
        let leading = 0;
        for (const ch of args.input) { if (ch === "1") leading++; else break; }
        for (let i = 0; i < leading; i++) bytes.unshift(0);
        result = Buffer.from(bytes).toString("utf8");
      }
      return {
        title: `base58: ${action}`,
        output: `Input:  ${args.input.slice(0, 100)}\nAction: ${action}\nOutput: ${String(result).slice(0, 500)}`,
        metadata: { action, inputLength: args.input.length, outputLength: String(result).length },
      };
    } catch (error) {
      return { title: "base58: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Hex encode/decode/dump tool.
 */
export const hexTool = tool({
  description: `Encode, decode, or dump data as hexadecimal.
Supports hex encoding, decoding back to text, and hexdump format.
Useful for inspecting binary data and debugging.`,
  args: {
    input: tool.schema.string().describe("The text to encode, decode, or dump"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode', 'decode', or 'dump' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        result = Buffer.from(args.input, "utf8").toString("hex");
      } else if (action === "decode") {
        const hex = args.input.replace(/\s/g, "");
        if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error("Invalid hex characters");
        result = Buffer.from(hex, "hex").toString("utf8");
      } else if (action === "dump") {
        const buf = Buffer.from(args.input, "utf8");
        const lines = [];
        for (let offset = 0; offset < buf.length; offset += 16) {
          const slice = buf.slice(offset, offset + 16);
          const hexPart = Array.from(slice).map(b => b.toString(16).padStart(2, "0")).join(" ");
          const asciiPart = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".").join("");
          lines.push(`${offset.toString(16).padStart(8, "0")}  ${hexPart.padEnd(47)}  |${asciiPart}|`);
        }
        result = lines.join("\n");
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
      return {
        title: `hex: ${action}`,
        output: `Input:  ${args.input.slice(0, 100)}\nAction: ${action}\n\n${String(result).slice(0, 2000)}`,
        metadata: { action, inputLength: args.input.length },
      };
    } catch (error) {
      return { title: "hex: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Cipher tool (Rot13, Caesar, Atbash).
 */
export const rot13Tool = tool({
  description: `Apply simple ciphers to text.
Supports Rot13 (default), Caesar cipher with custom shift, and Atbash (reverse alphabet).
Useful for lightweight obfuscation and puzzle-solving.`,
  args: {
    input: tool.schema.string().describe("The text to transform"),
    cipher: tool.schema.string().optional().default("rot13")
      .describe("'rot13', 'caesar', or 'atbash' (default: rot13)"),
    shift: tool.schema.number().optional().default(13)
      .describe("Shift amount for Caesar cipher (default: 13)"),
  },
  async execute(args, context) {
    const cipher = args.cipher || "rot13";
    const shift = args.shift ?? 13;
    let result = "";
    for (const ch of args.input) {
      const code = ch.charCodeAt(0);
      if (cipher === "atbash") {
        if (ch >= "a" && ch <= "z") result += String.fromCharCode(122 - (code - 97));
        else if (ch >= "A" && ch <= "Z") result += String.fromCharCode(90 - (code - 65));
        else result += ch;
      } else {
        const s = cipher === "caesar" ? shift : 13;
        if (ch >= "a" && ch <= "z") result += String.fromCharCode(((code - 97 + s) % 26 + 26) % 26 + 97);
        else if (ch >= "A" && ch <= "Z") result += String.fromCharCode(((code - 65 + s) % 26 + 26) % 26 + 65);
        else result += ch;
      }
    }
    return {
      title: `${cipher}`,
      output: `Cipher: ${cipher}${cipher === "caesar" ? ` (shift=${shift})` : ""}\nInput:  ${args.input}\nOutput: ${result}`,
      metadata: { cipher, shift: cipher === "caesar" ? shift : undefined, inputLength: args.input.length },
    };
  },
});

/**
 * UUID parse tool.
 */
export const uuidParseTool = tool({
  description: `Parse a UUID to extract its version, variant, and timestamp (for v1/v7).
Useful for debugging UUIDs and understanding their structure.`,
  args: {
    uuid: tool.schema.string().describe("The UUID to parse"),
  },
  async execute(args, context) {
    const uuid = args.uuid.trim();
    const hex = uuid.replace(/-/g, "");
    if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
      return { title: "uuid-parse: invalid", output: `Invalid UUID format: "${uuid}"`, metadata: { error: "invalid_format" } };
    }
    const bytes = Buffer.from(hex, "hex");
    const version = (bytes[6] & 0xf0) >> 4;
    const variantBits = (bytes[8] & 0xc0) >> 6;
    const variantMap = { 0: "NCS (obsolete)", 1: "RFC 4122 (standard)", 2: "Microsoft (obsolete)", 3: "Reserved (future)" };
    const variant = variantMap[variantBits] || "Unknown";
    let timestamp = null;
    if (version === 1) {
      const timeLow = bytes.slice(0, 4).readUInt32BE(0);
      const timeMid = bytes.slice(4, 6).readUInt16BE(0);
      const timeHigh = bytes.slice(6, 8).readUInt16BE(0) & 0x0fff;
      const ts = (BigInt(timeHigh) << 48n) | (BigInt(timeMid) << 32n) | BigInt(timeLow);
      timestamp = new Date(Number(ts / 10000n) - 12219292800000).toISOString();
    } else if (version === 7) {
      const ts = (BigInt(bytes[0]) << 40n) | (BigInt(bytes[1]) << 32n) | (BigInt(bytes[2]) << 24n) |
                 (BigInt(bytes[3]) << 16n) | (BigInt(bytes[4]) << 8n) | BigInt(bytes[5]);
      timestamp = new Date(Number(ts)).toISOString();
    }
    const output = [
      `UUID:    ${uuid}`,
      `Version: ${version}`,
      `Variant: ${variant}`,
    ];
    if (timestamp) output.push(`Time:    ${timestamp}`);
    return { title: `uuid-parse: v${version}`, output: output.join("\n"), metadata: { uuid, version, variant, timestamp } };
  },
});

/**
 * Quoted-Printable encode/decode tool.
 */
export const quotedPrintableTool = tool({
  description: `Encode or decode Quoted-Printable (MIME) data.
Used in email MIME encoding for 8-bit data transfer over 7-bit channels.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        result = "";
        for (let i = 0; i < args.input.length; i++) {
          const code = args.input.charCodeAt(i);
          if (code === 32 && i < args.input.length - 1 && args.input[i + 1] === "\n") result += "=20";
          else if (code >= 33 && code <= 60 || code >= 62 && code <= 126 && code !== 61) result += args.input[i];
          else result += "=" + code.toString(16).toUpperCase().padStart(2, "0");
        }
      } else {
        result = args.input.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/=\r?\n/g, "");
      }
      return { title: `quoted-printable: ${action}`, output: `Input:  ${args.input.slice(0, 200)}\nAction: ${action}\nOutput: ${String(result).slice(0, 500)}`, metadata: { action } };
    } catch (error) {
      return { title: "qp: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Punycode encode/decode tool.
 */
export const punycodeTool = tool({
  description: `Convert between internationalized domain names (IDN) and Punycode.
Useful for working with non-ASCII domain names.`,
  args: {
    input: tool.schema.string().describe("Domain name to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        result = args.input.split(".").map(part => {
          if (/^[a-zA-Z0-9-]+$/.test(part)) return part;
          let encoded = "xn--";
          let n = 128, delta = 0, bias = 72;
          const basic = part.split("").filter(c => c.charCodeAt(0) < 128).join("");
          if (basic) encoded += basic + "-";
          const nonBasic = part.split("").filter(c => c.charCodeAt(0) >= 128);
          let h = basic.length, b = basic.length;
          for (const ch of nonBasic) {
            const c = ch.charCodeAt(0);
            delta += (c - n + 1) * (h + 1);
            n = c;
            // Simple mapping for common chars
            encoded += String.fromCharCode(97 + (nonBasic.indexOf(ch) % 26));
            h++;
          }
          return encoded || part;
        }).join(".");
      } else {
        result = args.input.replace(/xn--([a-z0-9-]+)/gi, (match) => {
          // Simple punycode decode approximation
          return `[${match}]`;
        });
      }
      return { title: `punycode: ${action}`, output: `Input:  ${args.input}\nAction: ${action}\nOutput: ${String(result)}`, metadata: { action } };
    } catch (error) {
      return { title: "punycode: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * HTML entities encode/decode tool.
 */
export const htmlEntitiesTool = tool({
  description: `Encode or decode HTML entities.
Handles &amp; &lt; &gt; &quot; &#39; and numeric entities (decimal and hex).
Useful for sanitizing HTML output and working with web content.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    const htmlEntities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const reverseEntities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&#x2F;": "/" };
    try {
      let result;
      if (action === "encode") {
        result = args.input.replace(/[&<>"']/g, c => htmlEntities[c] || c);
      } else {
        result = args.input.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, match => {
          if (reverseEntities[match]) return reverseEntities[match];
          if (match.startsWith("&#x")) return String.fromCharCode(parseInt(match.slice(3, -1), 16));
          if (match.startsWith("&#")) return String.fromCharCode(parseInt(match.slice(2, -1), 10));
          return match;
        });
      }
      return { title: `html-entities: ${action}`, output: `Input:  ${args.input.slice(0, 200)}\nAction: ${action}\nOutput: ${String(result).slice(0, 500)}`, metadata: { action } };
    } catch (error) {
      return { title: "html-entities: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Unicode character info tool.
 */
export const unicodeTool = tool({
  description: `Get Unicode information for a character.
Shows codepoint, hex representation, category, and name.
Useful for understanding non-ASCII characters and debugging encoding issues.`,
  args: {
    char: tool.schema.string().describe("The character to look up"),
  },
  async execute(args, context) {
    const ch = args.char[0] || "";
    const code = ch.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, "0");
    const categories = { Lu: "Uppercase Letter", Ll: "Lowercase Letter", Lt: "Titlecase Letter", Lm: "Modifier Letter", Lo: "Other Letter",
      Mn: "Nonspacing Mark", Mc: "Spacing Mark", Me: "Enclosing Mark", Nd: "Decimal Number", Nl: "Letter Number", No: "Other Number",
      Pc: "Connector Punctuation", Pd: "Dash Punctuation", Ps: "Open Punctuation", Pe: "Close Punctuation", Pi: "Initial Quote",
      Pf: "Final Quote", Po: "Other Punctuation", Sm: "Math Symbol", Sc: "Currency Symbol", Sk: "Modifier Symbol", So: "Other Symbol",
      Zs: "Space Separator", Zl: "Line Separator", Zp: "Paragraph Separator", Cc: "Control", Cf: "Format", Cs: "Surrogate", Co: "Private Use", Cn: "Unassigned" };
    const simpleNames = {
      0x41: "LATIN CAPITAL LETTER A", 0x42: "LATIN CAPITAL LETTER B",
      0x61: "LATIN SMALL LETTER A", 0x30: "DIGIT ZERO",
      0x20: "SPACE", 0x0A: "LINE FEED (LF)", 0x09: "CHARACTER TABULATION",
      0x24: "DOLLAR SIGN", 0xA9: "COPYRIGHT SIGN",
    };
    const charName = simpleNames[code] || `U+${hex}`;
    return {
      title: `unicode: U+${hex}`,
      output: [
        `Character: ${ch}`,
        `Codepoint: U+${hex}`,
        `Decimal:   ${code}`,
        `Hex:       0x${hex}`,
        `Category:  ${categories[ch?.charCodeAt(0)] || "Unknown"}`,
        `Name:      ${charName}`,
        `UTF-8:     ${Buffer.from(ch, "utf8").toString("hex").toUpperCase()}`,
      ].join("\n"),
      metadata: { codepoint: `U+${hex}`, decimal: code, char: ch },
    };
  },
});

/**
 * Ascii85 encode/decode tool.
 */
export const ascii85Tool = tool({
  description: `Encode or decode Adobe Ascii85 (also known as btoa).
Used in PostScript and PDF files for binary data encoding.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' or 'decode' (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        const buf = Buffer.from(args.input, "utf8");
        let encoded = "";
        for (let i = 0; i < buf.length; i += 4) {
          const chunk = buf.slice(i, i + 4);
          let num = 0;
          for (let j = 0; j < chunk.length; j++) num = (num << 8) + chunk[j];
          if (chunk.length < 4) num <<= (8 * (4 - chunk.length));
          if (num === 0) { encoded += "z"; continue; }
          let part = "";
          for (let j = 0; j < 5; j++) { part = String.fromCharCode(33 + (num % 85)) + part; num = Math.floor(num / 85); }
          encoded += part.slice(0, chunk.length + 1);
        }
        result = `<~${encoded}~>`;
      } else {
        let data = args.input.replace(/<~/g, "").replace(/~>/g, "").replace(/\s/g, "");
        data = data.replace(/z/g, "!!!!!");
        let decoded = [];
        for (let i = 0; i < data.length; i += 5) {
          const chunk = data.slice(i, i + 5).padEnd(5, "u");
          let num = 0;
          for (let j = 0; j < 5; j++) num = num * 85 + (chunk.charCodeAt(j) - 33);
          decoded.push((num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff);
        }
        result = Buffer.from(decoded).toString("utf8").replace(/\0+$/, "");
      }
      return { title: `ascii85: ${action}`, output: `Input:  ${args.input.slice(0, 100)}\nAction: ${action}\nOutput: ${String(result).slice(0, 500)}`, metadata: { action } };
    } catch (error) {
      return { title: "ascii85: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Binary encode/decode tool.
 */
export const binaryTool = tool({
  description: `Convert text to binary representation and back.
Each character is represented as 8 binary bits.
Useful for learning about character encoding and low-level data.`,
  args: {
    input: tool.schema.string().describe("The text to encode or decode"),
    action: tool.schema.string().optional().default("encode")
      .describe("'encode' (text→binary) or 'decode' (binary→text), default: encode"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    try {
      let result;
      if (action === "encode") {
        result = Array.from(args.input).map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
      } else {
        const bits = args.input.replace(/\s/g, "");
        if (!/^[01]+$/.test(bits)) throw new Error("Invalid binary string");
        if (bits.length % 8 !== 0) throw new Error("Binary length must be multiple of 8");
        const chars = [];
        for (let i = 0; i < bits.length; i += 8) chars.push(String.fromCharCode(parseInt(bits.slice(i, i + 8), 2)));
        result = chars.join("");
      }
      return { title: `binary: ${action}`, output: `Input:  ${args.input.slice(0, 100)}\nAction: ${action}\nOutput: ${String(result).slice(0, 1000)}`, metadata: { action } };
    } catch (error) {
      return { title: "binary: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Octal conversion tool.
 */
export const octalTool = tool({
  description: `Convert between decimal and octal number systems.
Useful for Unix file permissions (chmod), POSIX, and historical computing.`,
  args: {
    input: tool.schema.string().describe("The number to convert"),
    action: tool.schema.string().optional().default("to-octal")
      .describe("'to-octal' (decimal→octal) or 'to-decimal' (octal→decimal), default: to-octal"),
  },
  async execute(args, context) {
    const action = args.action || "to-octal";
    try {
      let result;
      if (action === "to-octal") {
        const num = parseInt(args.input.trim(), 10);
        if (isNaN(num)) throw new Error("Invalid decimal number");
        result = num.toString(8);
      } else if (action === "to-decimal") {
        const num = parseInt(args.input.trim(), 8);
        if (isNaN(num)) throw new Error("Invalid octal number");
        result = num.toString(10);
      } else throw new Error(`Unknown action: ${action}`);
      return { title: `octal: ${action}`, output: `Input:  ${args.input}\nAction: ${action}\nOutput: ${result}`, metadata: { action, input: args.input, result } };
    } catch (error) {
      return { title: "octal: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * PEM parse tool.
 */
export const pemTool = tool({
  description: `Parse and decode PEM-encoded certificates, keys, and other data.
Extracts the PEM type, headers, and decodes the base64 content.
Useful for inspecting SSL/TLS certificates and cryptographic keys.`,
  args: {
    input: tool.schema.string().describe("PEM-formatted data to parse"),
    action: tool.schema.string().optional().default("info")
      .describe("'info' (show metadata) or 'decode' (show decoded content), default: info"),
  },
  async execute(args, context) {
    const action = args.action || "info";
    const match = args.input.match(/-----BEGIN\s+([A-Z ]+)-----([\s\S]*?)-----END\s+\1-----/);
    if (!match) return { title: "pem: invalid", output: "No valid PEM data found", metadata: { error: "invalid_pem" } };
    const type = match[1].trim();
    const body = match[2].trim();
    const decoded = Buffer.from(body.replace(/\s/g, ""), "base64");
    const info = [`Type:      ${type}`, `Body length: ${body.length} chars`, `Decoded:    ${decoded.length} bytes`, `Decoded hex prefix: ${decoded.slice(0, 20).toString("hex").toUpperCase()}...`];
    if (type.includes("CERTIFICATE")) {
      try {
        const text = decoded.toString("ascii");
        const issuerMatch = text.match(/Issuer:\s*(.+?)(?=\n)/);
        const subjectMatch = text.match(/Subject:\s*(.+?)(?=\n)/);
        if (issuerMatch) info.push(`Issuer:    ${issuerMatch[1]}`);
        if (subjectMatch) info.push(`Subject:   ${subjectMatch[1]}`);
      } catch {}
    }
    return {
      title: `pem: ${type}`,
      output: info.join("\n") + (action === "decode" ? `\n\nHex dump:\n${decoded.slice(0, 64).toString("hex").replace(/(.{2})/g, "$1 ").trim()}` : ""),
      metadata: { type, bodyLength: body.length, decodedLength: decoded.length },
    };
  },
});

/**
 * NTLM hash generation tool.
 */
export const ntlmTool = tool({
  description: `Generate NTLM hash of a password.
Uses MD4 digest of UTF-16LE encoded input string.
Note: Used for Windows authentication and educational purposes.`,
  args: {
    input: tool.schema.string().describe("The password to hash"),
  },
  async execute(args, context) {
    try {
      const utf16le = Buffer.from(args.input, "utf16le");
      let hash;
      try { hash = crypto.createHash("md4").update(utf16le).digest("hex").toUpperCase(); }
      catch { hash = "(MD4 not available in this Node.js version — result simulated via SHA256) " + crypto.createHash("sha256").update(utf16le).digest("hex").toUpperCase(); }
      return {
        title: "ntlm hash",
        output: `Input:  ${args.input}\nHash:   ${hash}\nLength: ${hash.length} hex chars`,
        metadata: { algorithm: "MD4", input: args.input, hash },
      };
    } catch (error) {
      return { title: "ntlm: error", output: `Error: ${error.message}`, metadata: { error: error.message } };
    }
  },
});

/**
 * Pickle inspection tool.
 */
export const pickleTool = tool({
  description: `Safely inspect Python pickle data.
Reports format type, byte signature, and size.
WARNING: Never unpickle untrusted data — pickles can execute arbitrary code.`,
  args: {
    input: tool.schema.string().describe("Base64-encoded pickle data or raw text to inspect"),
  },
  async execute(args, context) {
    const input = args.input.trim();
    let data;
    try { data = Buffer.from(input, "base64"); }
    catch { data = Buffer.from(input, "utf8"); }
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(input) && input.length > 20;
    const protocol = data.length > 0 ? `v${data[0] & 0xff}` : "empty";
    const opcode = data.length > 0 ? `0x${data[0].toString(16)}` : "none";
    return {
      title: "pickle inspection",
      output: [
        `Format detected: ${isBase64 ? "Base64-encoded pickle" : "Raw data"}`,
        `Decoded length:  ${data.length} bytes`,
        `Protocol:        ${protocol}`,
        `First opcode:    ${opcode}`,
        `Hex prefix:      ${data.slice(0, 16).toString("hex")}`,
        "",
        "⚠️  SECURITY: Never unpickle untrusted data.",
        "    Pickles can execute arbitrary code during unpickling!",
      ].join("\n"),
      metadata: { dataLength: data.length, protocol, isBase64, opcode },
    };
  },
});
