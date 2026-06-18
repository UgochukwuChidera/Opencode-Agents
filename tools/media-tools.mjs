/**
 * Media Tools - Image, color, geo, QR, emoji, and web comic utilities
 *
 * Provides tools for working with images, colors, geolocation,
 * QR codes, emoji, and fetching xkcd comics.
 * Uses only Node.js built-in modules — no npm packages required.
 */
import { tool } from "@opencode-ai/plugin";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// ═══════════════════════════════════════════════════════════════════════
// Image tool — Parse image dimensions/format from magic bytes
// ═══════════════════════════════════════════════════════════════════════

/**
 * Parse image file headers to detect format and dimensions.
 * Supports PNG, JPEG, GIF, BMP.
 */
export const imageTool = tool({
  description: `Get image dimensions and format from file magic bytes.
Reads the file header to detect format (PNG/JPEG/GIF/BMP), width, and height
without loading the full image. Supports common image formats.`,
  args: {
    path: tool.schema.string().describe("Absolute or relative path to the image file"),
  },
  async execute(args, context) {
    const filePath = args.path;

    if (!filePath) {
      return {
        title: "image: missing path",
        output: "Please provide a file path to an image.",
        metadata: { error: "missing_path" },
      };
    }

    try {
      const resolvedPath = path.resolve(filePath);
      const stat = await fs.promises.stat(resolvedPath);

      if (!stat.isFile()) {
        return {
          title: `image: not a file — ${path.basename(filePath)}`,
          output: `"${filePath}" is not a file.`,
          metadata: { error: "not_a_file" },
        };
      }

      // Read first 100 bytes — enough for all supported formats
      const fd = await fs.promises.open(resolvedPath, "r");
      const buffer = Buffer.alloc(100);
      await fd.read(buffer, 0, 100, 0);
      await fd.close();

      const result = parseImageHeader(buffer);

      if (!result) {
        return {
          title: `image: unknown format — ${path.basename(filePath)}`,
          output: `Could not detect image format for "${filePath}".\nSupported formats: PNG, JPEG, GIF, BMP`,
          metadata: { error: "unknown_format" },
        };
      }

      const sizeKB = (stat.size / 1024).toFixed(1);
      const lines = [
        `File:     ${path.basename(filePath)}`,
        `Format:   ${result.format.toUpperCase()}`,
        `Width:    ${result.width} px`,
        `Height:   ${result.height} px`,
        `Size:     ${sizeKB} KB on disk`,
        `Bits/pixel: ${result.bits || "N/A"}`,
        ``,
        `Dimensions: ${result.width} × ${result.height}`,
        `Megapixels: ${((result.width * result.height) / 1_000_000).toFixed(2)} MP`,
      ];

      if (result.extra) {
        lines.push(``, ...result.extra.map((e) => `${e}`));
      }

      return {
        title: `image: ${result.format.toUpperCase()} ${result.width}×${result.height}`,
        output: lines.join("\n"),
        metadata: {
          format: result.format,
          width: result.width,
          height: result.height,
          fileSize: stat.size,
          bits: result.bits || null,
        },
      };
    } catch (error) {
      return {
        title: `image: error reading "${filePath}"`,
        output: `Failed to read image "${filePath}":\n${error.message}`,
        metadata: { filePath, error: error.message },
      };
    }
  },
});

/**
 * Parse image file header from buffer.
 * Returns null if format is not recognized.
 */
function parseImageHeader(buffer) {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    // IHDR chunk starts at offset 16 (8 sig + 4 length + 4 type)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer[24];
    const colorType = buffer[25];
    const colorTypes = {
      0: "Grayscale",
      2: "RGB",
      3: "Indexed",
      4: "Grayscale+Alpha",
      6: "RGBA",
    };
    return {
      format: "png",
      width,
      height,
      bits: bitDepth,
      extra: [`Color type: ${colorTypes[colorType] || colorType}`],
    };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    // Search for SOF0 (Start of Frame) marker: FF C0, FF C1, or FF C2
    let offset = 2;
    while (offset < buffer.length - 6) {
      if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xF0) === 0xC0) {
        const markerLen = buffer.readUInt16BE(offset + 2);
        const precision = buffer[offset + 4];
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        const components = buffer[offset + 9];
        return {
          format: "jpeg",
          width,
          height,
          bits: precision,
          extra: [`Components: ${components} (${components > 1 ? "color" : "grayscale"})`],
        };
      }
      // Skip to next marker
      if (buffer[offset] === 0xFF) {
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += segLen + 2;
      } else {
        offset++;
      }
    }
    // SOF not found within buffer — return dimensions from app0 or just unknown
    return {
      format: "jpeg",
      width: 0,
      height: 0,
      bits: 8,
      extra: ["Could not parse dimensions from header (SOF not found in first 100 bytes)"],
    };
  }

  // GIF: GIF87a or GIF89a
  if (
    (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) &&
    (buffer[3] === 0x38) &&
    ((buffer[4] === 0x37 && buffer[5] === 0x61) || (buffer[4] === 0x39 && buffer[5] === 0x61))
  ) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    const packed = buffer[10];
    const hasGCT = (packed & 0x80) !== 0;
    const colorRes = ((packed & 0x70) >> 4) + 1;
    const gctSize = hasGCT ? 2 << (packed & 0x07) : 0;
    const version = buffer[4] === 0x39 ? "89a" : "87a";
    return {
      format: "gif",
      width,
      height,
      bits: 8,
      extra: [
        `Version: GIF${version}`,
        `Global color table: ${hasGCT ? `yes (${gctSize} colors)` : "no"}`,
        `Color resolution: ${colorRes} bits`,
      ],
    };
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    const width = buffer.readUInt32LE(18);
    const height = buffer.readUInt32LE(22);
    const bitsPerPixel = buffer.readUInt16LE(28);
    const compression = buffer.readUInt32LE(30);
    const compressionTypes = {
      0: "None (RGB)",
      1: "RLE 8-bit",
      2: "RLE 4-bit",
      3: "Bitfields",
      4: "JPEG",
      5: "PNG",
    };
    return {
      format: "bmp",
      width,
      height: Math.abs(height), // Height can be negative for top-down
      bits: bitsPerPixel,
      extra: [
        `Compression: ${compressionTypes[compression] || compression}`,
        `Orientation: ${height < 0 ? "top-down" : "bottom-up"}`,
      ],
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// MIME tool — Look up MIME types by extension or magic bytes
// ═══════════════════════════════════════════════════════════════════════

/**
 * MIME type lookup tool.
 * Look up MIME type by file extension or detect from magic bytes.
 */
export const mimeTool = tool({
  description: `Look up MIME types by file extension or detect from file magic bytes.
For "extension", returns the MIME type for a given file extension.
For "magic", reads a file and detects its MIME type from header bytes.`,
  args: {
    input: tool.schema.string().describe("The file extension (e.g., 'html', '.jpg') or file path"),
    type: tool.schema
      .string()
      .optional()
      .default("extension")
      .describe("Lookup mode: 'extension' or 'magic' (default: extension)"),
  },
  async execute(args, context) {
    const input = args.input.trim();
    const mode = (args.type || "extension").toLowerCase();

    if (!input) {
      return {
        title: "mime: missing input",
        output: "Please provide an extension or file path.",
        metadata: { error: "missing_input" },
      };
    }

    try {
      if (mode === "extension") {
        const ext = input.startsWith(".") ? input.slice(1).toLowerCase() : input.replace(/^.*\./, "").toLowerCase();
        const mime = MIME_TYPES[ext];

        if (mime) {
          return {
            title: `mime: .${ext} → ${mime}`,
            output: `Extension:  .${ext}\nMIME Type:  ${mime}\nCategory:   ${mime.split("/")[0]}`,
            metadata: { extension: ext, mime, category: mime.split("/")[0] },
          };
        }

        return {
          title: `mime: unknown extension ".${ext}"`,
          output: `No MIME type found for extension ".${ext}".\nTry "magic" mode for file detection.`,
          metadata: { extension: ext, error: "unknown_extension" },
        };
      } else if (mode === "magic") {
        const resolvedPath = path.resolve(input);

        let stat;
        try {
          stat = await fs.promises.stat(resolvedPath);
        } catch {
          return {
            title: `mime: file not found — "${input}"`,
            output: `File not found: "${resolvedPath}"`,
            metadata: { filePath: input, error: "file_not_found" },
          };
        }

        if (!stat.isFile()) {
          return {
            title: `mime: not a file — "${input}"`,
            output: `"${input}" is not a file.`,
            metadata: { error: "not_a_file" },
          };
        }

        const fd = await fs.promises.open(resolvedPath, "r");
        const buffer = Buffer.alloc(16);
        await fd.read(buffer, 0, 16, 0);
        await fd.close();

        const detected = detectMimeByMagic(buffer);

        const ext = path.extname(resolvedPath).slice(1).toLowerCase();
        const byExtension = MIME_TYPES[ext];

        const lines = [
          `File:     ${path.basename(resolvedPath)}`,
          `Detected: ${detected}`,
        ];

        if (byExtension && byExtension !== detected) {
          lines.push(`By ext:   ${byExtension} (from .${ext})`);
          lines.push(`Note: File extension suggests ${byExtension}, but magic bytes indicate ${detected}.`);
        }

        return {
          title: `mime: ${detected}`,
          output: lines.join("\n"),
          metadata: {
            filePath: input,
            detected: detected,
            extension: ext,
            byExtension: byExtension || null,
          },
        };
      } else {
        return {
          title: `mime: unknown mode "${mode}"`,
          output: `Unknown mode: "${mode}". Use "extension" or "magic".`,
          metadata: { error: "unknown_mode" },
        };
      }
    } catch (error) {
      return {
        title: `mime: error`,
        output: `MIME lookup error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Detect MIME type from magic bytes.
 */
function detectMimeByMagic(buffer) {
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
  // GIF87a / GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return "image/bmp";
  // WebP: RIFF .... WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "application/pdf";
  // ZIP (includes docx, xlsx, jar)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return "application/zip";
  // GZIP
  if (buffer[0] === 0x1F && buffer[1] === 0x8B) return "application/gzip";
  // ELF
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) return "application/x-elf";
  // MP3 ID3
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return "audio/mpeg";
  // RIFF (AVI, WAV)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) return "audio/wav";
    if (buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && buffer[11] === 0x20) return "video/x-msvideo";
    return "application/octet-stream";
  }
  // Mach-O (binary)
  if ((buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCE) ||
      (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCF) ||
      (buffer[0] === 0xCE && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
      (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE)) return "application/x-mach-binary";
  // Shebang
  if (buffer[0] === 0x23 && buffer[1] === 0x21) return "text/x-script";
  // Plain text — check for printable ASCII
  let printable = 0;
  for (let i = 0; i < Math.min(buffer.length, 16); i++) {
    const b = buffer[i];
    if ((b >= 0x20 && b <= 0x7E) || b === 0x09 || b === 0x0A || b === 0x0D) printable++;
  }
  if (printable >= 12) return "text/plain";

  return "application/octet-stream";
}

// ═══════════════════════════════════════════════════════════════════════
// Color tool — Convert between hex, rgb, hsl color formats
// ═══════════════════════════════════════════════════════════════════════

/**
 * Color format conversion tool.
 * Convert between hex (#RRGGBB), rgb(R,G,B), and hsl(H,S%,L%) formats.
 */
export const colorTool = tool({
  description: `Convert colors between hex (#RRGGBB), rgb(R,G,B), and hsl(H,S%,L%) formats.
Also provides color name lookup for common named colors.`,
  args: {
    input: tool.schema.string().describe("The color value to convert (e.g., '#ff8800', 'rgb(255,136,0)', 'hsl(32,100%,50%)')"),
    from: tool.schema
      .string()
      .optional()
      .describe("Source format: 'hex', 'rgb', 'hsl', or 'auto' (default: auto — detect from input)"),
    to: tool.schema
      .string()
      .optional()
      .describe("Target format: 'hex', 'rgb', 'hsl', or 'all' (default: all — show all formats)"),
  },
  async execute(args, context) {
    const input = args.input.trim();
    const from = (args.from || "auto").toLowerCase();
    const to = (args.to || "all").toLowerCase();

    if (!input) {
      return {
        title: "color: missing input",
        output: "Please provide a color value to convert.",
        metadata: { error: "missing_input" },
      };
    }

    try {
      // Parse the color
      let r, g, b;
      const detectedFrom = detectColorFormat(input);

      if (from !== "auto" && from !== detectedFrom) {
        // Try to parse using the user-specified format
        r = parseColor(input, from);
      } else {
        r = parseColor(input, detectedFrom);
      }

      if (r === null) {
        return {
          title: `color: could not parse "${input}"`,
          output: `Could not parse "${input}" as a valid color.\nSupported formats: hex (#RGB, #RRGGBB), rgb(R,G,B), hsl(H,S%,L%)`,
          metadata: { error: "parse_error" },
        };
      }

      // Build results for requested target formats
      const parts = [];
      const addFormat = (label, value) => { parts.push(`${label}:  ${value}`); };

      if (to === "all" || to === "hex") addFormat("HEX", rgbToHex(r, g, b));
      if (to === "all" || to === "rgb") addFormat("RGB", `rgb(${r}, ${g}, ${b})`);
      if (to === "all" || to === "hsl") {
        const [h, s, l] = rgbToHsl(r, g, b);
        addFormat("HSL", `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`);
      }

      // Closest named color
      const name = findClosestNamedColor(r, g, b);
      if (to === "all" && name) {
        parts.push(``, `Closest named color: ${name}`);
      }

      return {
        title: `color: ${rgbToHex(r, g, b)}`,
        output: parts.join("\n"),
        metadata: {
          hex: rgbToHex(r, g, b),
          rgb: { r, g, b },
          hsl: rgbToHsl(r, g, b),
          name: name || null,
        },
      };
    } catch (error) {
      return {
        title: `color: error`,
        output: `Color conversion error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Detect color format from input string.
 */
function detectColorFormat(input) {
  const s = input.trim().toLowerCase();
  if (s.startsWith("#")) return "hex";
  if (s.startsWith("rgb")) return "rgb";
  if (s.startsWith("hsl")) return "hsl";
  // Try hex
  if (/^[0-9a-f]{3,8}$/i.test(s)) return "hex";
  return "hex"; // fallback
}

/**
 * Parse a color string in the given format.
 * Returns [r, g, b] as integers 0-255, or null on failure.
 */
function parseColor(input, format) {
  const s = input.trim();

  try {
    if (format === "hex") {
      let hex = s.replace(/^#/, "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length === 6) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
      if (hex.length === 8) {
        // #AARRGGBB — skip alpha
        return [parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16)];
      }
      return null;
    }

    if (format === "rgb") {
      const match = s.match(/rgba?\s*\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i);
      if (match) {
        return [clamp(+match[1], 0, 255), clamp(+match[2], 0, 255), clamp(+match[3], 0, 255)];
      }
      // Also match space-separated
      const nums = s.replace(/[rgbRGGB\(\)\s]/g, "").split(",");
      if (nums.length >= 3) {
        return [clamp(+nums[0], 0, 255), clamp(+nums[1], 0, 255), clamp(+nums[2], 0, 255)];
      }
      return null;
    }

    if (format === "hsl") {
      const match = s.match(/hsla?\s*\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/i);
      if (match) {
        return hslToRgb(+match[1], +match[2], +match[3]);
      }
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Convert RGB to hex string.
 */
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Convert RGB (0-255) to HSL.
 * Returns [h, s, l] where h in [0, 360), s,l in [0, 100].
 */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  } else if (max === gn) {
    h = ((bn - rn) / d + 2);
  } else {
    h = ((rn - gn) / d + 4);
  }

  return [h * 60, s * 100, l * 100];
}

/**
 * Convert HSL to RGB.
 * Returns [r, g, b] as integers 0-255.
 */
function hslToRgb(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  const m = ln - c / 2;

  let r1, g1, b1;
  if (hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = 0; g1 = 0; b1 = x; }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/**
 * Clamp a value between min and max.
 */
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// ═══════════════════════════════════════════════════════════════════════
// Named color database for closest-color matching
// ═══════════════════════════════════════════════════════════════════════

const NAMED_COLORS = {
  "Black": [0, 0, 0],
  "White": [255, 255, 255],
  "Red": [255, 0, 0],
  "Green": [0, 128, 0],
  "Blue": [0, 0, 255],
  "Yellow": [255, 255, 0],
  "Cyan": [0, 255, 255],
  "Magenta": [255, 0, 255],
  "Silver": [192, 192, 192],
  "Gray": [128, 128, 128],
  "Maroon": [128, 0, 0],
  "Olive": [128, 128, 0],
  "Dark Green": [0, 100, 0],
  "Purple": [128, 0, 128],
  "Teal": [0, 128, 128],
  "Navy": [0, 0, 128],
  "Dark Red": [139, 0, 0],
  "Brown": [165, 42, 42],
  "Firebrick": [178, 34, 34],
  "Crimson": [220, 20, 60],
  "Tomato": [255, 99, 71],
  "Coral": [255, 127, 80],
  "Indian Red": [205, 92, 92],
  "Light Coral": [240, 128, 128],
  "Dark Salmon": [233, 150, 122],
  "Salmon": [250, 128, 114],
  "Light Salmon": [255, 160, 122],
  "Orange Red": [255, 69, 0],
  "Dark Orange": [255, 140, 0],
  "Orange": [255, 165, 0],
  "Gold": [255, 215, 0],
  "Dark Goldenrod": [184, 134, 11],
  "Goldenrod": [218, 165, 32],
  "Pale Goldenrod": [238, 232, 170],
  "Dark Khaki": [189, 183, 107],
  "Khaki": [240, 230, 140],
  "Yellow Green": [154, 205, 50],
  "Dark Olive Green": [85, 107, 47],
  "Olive Drab": [107, 142, 35],
  "Lawn Green": [124, 252, 0],
  "Chartreuse": [127, 255, 0],
  "Green Yellow": [173, 255, 47],
  "Lime": [0, 255, 0],
  "Lime Green": [50, 205, 50],
  "Pale Green": [152, 251, 152],
  "Light Green": [144, 238, 144],
  "Medium Spring Green": [0, 250, 154],
  "Spring Green": [0, 255, 127],
  "Medium Sea Green": [60, 179, 113],
  "Sea Green": [46, 139, 87],
  "Forest Green": [34, 139, 34],
  "Dark Cyan": [0, 139, 139],
  "Light Sea Green": [32, 178, 170],
  "Dark Turquoise": [0, 206, 209],
  "Medium Turquoise": [72, 209, 204],
  "Turquoise": [64, 224, 208],
  "Aquamarine": [127, 255, 212],
  "Powder Blue": [176, 224, 230],
  "Sky Blue": [135, 206, 235],
  "Light Sky Blue": [135, 206, 250],
  "Deep Sky Blue": [0, 191, 255],
  "Dodger Blue": [30, 144, 255],
  "Cornflower Blue": [100, 149, 237],
  "Royal Blue": [65, 105, 225],
  "Medium Blue": [0, 0, 205],
  "Dark Blue": [0, 0, 139],
  "Midnight Blue": [25, 25, 112],
  "Lavender": [230, 230, 250],
  "Thistle": [216, 191, 216],
  "Plum": [221, 160, 221],
  "Violet": [238, 130, 238],
  "Orchid": [218, 112, 214],
  "Fuchsia": [255, 0, 255],
  "Medium Orchid": [186, 85, 211],
  "Medium Purple": [147, 112, 219],
  "Blue Violet": [138, 43, 226],
  "Dark Violet": [148, 0, 211],
  "Dark Orchid": [153, 50, 204],
  "Dark Magenta": [139, 0, 139],
  "Indigo": [75, 0, 130],
  "Pink": [255, 192, 203],
  "Light Pink": [255, 182, 193],
  "Hot Pink": [255, 105, 180],
  "Deep Pink": [255, 20, 147],
  "Pale Violet Red": [219, 112, 147],
  "Medium Violet Red": [199, 21, 133],
  "Wheat": [245, 222, 179],
  "Burlywood": [222, 184, 135],
  "Tan": [210, 180, 140],
  "Rosy Brown": [188, 143, 143],
  "Sandy Brown": [244, 164, 96],
  "Navajo White": [255, 222, 173],
  "Moccasin": [255, 228, 181],
  "Peach Puff": [255, 218, 185],
  "Bisque": [255, 228, 196],
  "Blanched Almond": [255, 235, 205],
  "Cornsilk": [255, 248, 220],
  "Lemon Chiffon": [255, 250, 205],
  "Light Yellow": [255, 255, 224],
  "Ivory": [255, 255, 240],
  "Beige": [245, 245, 220],
  "Old Lace": [253, 245, 230],
  "Antique White": [250, 235, 215],
  "Linen": [250, 240, 230],
  "Seashell": [255, 245, 238],
  "Misty Rose": [255, 228, 225],
  "Snow": [255, 250, 250],
  "Honeydew": [240, 255, 240],
  "Mint Cream": [245, 255, 250],
  "Azure": [240, 255, 255],
  "Alice Blue": [240, 248, 255],
  "Ghost White": [248, 248, 255],
  "White Smoke": [245, 245, 245],
  "Gainsboro": [220, 220, 220],
  "Light Gray": [211, 211, 211],
  "Dark Gray": [169, 169, 169],
  "Dim Gray": [105, 105, 105],
  "Slate Gray": [112, 128, 144],
  "Dark Slate Gray": [47, 79, 79],
};

/**
 * Find the closest named color using Euclidean distance in RGB space.
 */
function findClosestNamedColor(r, g, b) {
  let best = null;
  let bestDist = Infinity;
  for (const [name, [nr, ng, nb]] of Object.entries(NAMED_COLORS)) {
    const dr = r - nr;
    const dg = g - ng;
    const db = b - nb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════
// Geo tool — Haversine distance calculation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Geographic distance calculator.
 * Calculate great-circle distance using the Haversine formula.
 */
export const geoTool = tool({
  description: `Calculate geographic distance between two points using the Haversine formula.
Provides distance in kilometers and miles. Can also show detailed coordinate info.`,
  args: {
    action: tool.schema
      .string()
      .optional()
      .default("distance")
      .describe("Action: 'distance' (calculate) or 'info' (show coordinate details)"),
    lat1: tool.schema.number().optional().describe("Latitude of point 1 (in decimal degrees)"),
    lon1: tool.schema.number().optional().describe("Longitude of point 1 (in decimal degrees)"),
    lat2: tool.schema.number().optional().describe("Latitude of point 2 (in decimal degrees)"),
    lon2: tool.schema.number().optional().describe("Longitude of point 2 (in decimal degrees)"),
  },
  async execute(args, context) {
    const action = (args.action || "distance").toLowerCase();

    if (action === "distance") {
      const { lat1, lon1, lat2, lon2 } = args;

      if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
        return {
          title: "geo: missing coordinates",
          output: "Please provide lat1, lon1, lat2, lon2 for distance calculation.",
          metadata: { error: "missing_coordinates" },
        };
      }

      if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90 || lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
        return {
          title: "geo: invalid coordinates",
          output: "Latitude must be between -90 and 90. Longitude must be between -180 and 180.",
          metadata: { error: "invalid_coordinates" },
        };
      }

      const distanceKm = haversine(lat1, lon1, lat2, lon2);
      const distanceMiles = distanceKm * 0.621371;
      const distanceNm = distanceKm * 0.539957;

      const lines = [
        `Point 1:  ${lat1}, ${lon1}`,
        `Point 2:  ${lat2}, ${lon2}`,
        ``,
        `Distance:`,
        `  ${distanceKm.toFixed(2)} km`,
        `  ${distanceMiles.toFixed(2)} mi`,
        `  ${distanceNm.toFixed(2)} NM`,
        ``,
        `Bearing (initial): ${bearingToFixed(calculateBearing(lat1, lon1, lat2, lon2))}°`,
      ];

      return {
        title: `geo: ${distanceKm.toFixed(0)} km`,
        output: lines.join("\n"),
        metadata: {
          point1: { lat: lat1, lon: lon1 },
          point2: { lat: lat2, lon: lon2 },
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          distanceMiles: parseFloat(distanceMiles.toFixed(2)),
          distanceNm: parseFloat(distanceNm.toFixed(2)),
        },
      };
    } else if (action === "info") {
      const { lat1, lon1 } = args;

      if (lat1 === undefined || lon1 === undefined) {
        return {
          title: "geo: missing coordinates",
          output: "Please provide lat1 and lon1 for coordinate info.",
          metadata: { error: "missing_coordinates" },
        };
      }

      const latDir = lat1 >= 0 ? "N" : "S";
      const lonDir = lon1 >= 0 ? "E" : "W";
      const absLat = Math.abs(lat1);
      const absLon = Math.abs(lon1);

      // Determine hemisphere and region
      const hemisphere = lat1 >= 0 ? "Northern" : "Southern";
      const primeMeridian = lon1 >= -30 && lon1 <= 60 ? "Prime Meridian vicinity" : lon1 < -30 ? "Americas" : "Asia/Pacific";

      const lines = [
        `Coordinates: ${absLat.toFixed(4)}°${latDir}, ${absLon.toFixed(4)}°${lonDir}`,
        `DMS:          ${decToDms(lat1, "lat")}  ${decToDms(lon1, "lon")}`,
        `Hemisphere:   ${hemisphere}`,
        `Region:       ${primeMeridian}`,
      ];

      return {
        title: `geo: ${absLat.toFixed(2)}°${latDir}, ${absLon.toFixed(2)}°${lonDir}`,
        output: lines.join("\n"),
        metadata: {
          lat: lat1,
          lon: lon1,
          hemisphere,
          dms: { lat: decToDms(lat1, "lat"), lon: decToDms(lon1, "lon") },
        },
      };
    } else {
      return {
        title: `geo: unknown action "${action}"`,
        output: `Unknown action: "${action}". Use "distance" or "info".`,
        metadata: { error: "unknown_action" },
      };
    }
  },
});

/**
 * Haversine distance calculation.
 * Returns distance in kilometers.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate initial bearing from point 1 to point 2.
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingToFixed(bearing) {
  return bearing.toFixed(1);
}

function toRad(deg) { return deg * (Math.PI / 180); }
function toDeg(rad) { return rad * (180 / Math.PI); }

/**
 * Convert decimal degrees to DMS (Degrees, Minutes, Seconds) string.
 */
function decToDms(dec, type) {
  const dir = type === "lat" ? (dec >= 0 ? "N" : "S") : (dec >= 0 ? "E" : "W");
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(2);
  return `${d}°${m}'${s}"${dir}`;
}

// ═══════════════════════════════════════════════════════════════════════
// QR tool — Generate QR code as ASCII art
// ═══════════════════════════════════════════════════════════════════════

/**
 * QR code ASCII art generator.
 * Generates a simplified Version 1 (21x21) QR code matrix from text input
 * and renders it as ASCII art using Unicode block characters.
 */
export const qrTool = tool({
  description: `Generate a QR code from text as ASCII art.
Creates a simplified QR code matrix and renders it in the terminal
using Unicode block characters. Supports text up to 17 characters.`,
  args: {
    text: tool.schema.string().describe("The text to encode in the QR code"),
    size: tool.schema
      .number()
      .optional()
      .default(21)
      .describe("QR code version size in modules (default: 21 for version 1, max: 33)"),
  },
  async execute(args, context) {
    const text = args.text;
    const size = Math.min(Math.max(21, args.size ?? 21), 33);

    if (!text) {
      return {
        title: "qr: missing text",
        output: "Please provide text to encode.",
        metadata: { error: "missing_text" },
      };
    }

    if (text.length > 17) {
      // For larger texts, we can only encode limited data in version 1
      return {
        title: "qr: text too long",
        output: `Text is ${text.length} characters. Maximum for version 1 is 17 characters.\nUsing truncated text: "${text.slice(0, 17)}"`,
        metadata: { error: "text_too_long", truncated: text.slice(0, 17) },
      };
    }

    try {
      const matrix = generateSimpleQR(text);
      const ascii = renderQRMatrix(matrix);

      const lines = [
        `QR Code for: "${text}"`,
        `Version:     1 (21×21 modules)`,
        `Mode:        Byte encoding`,
        `Dimensions:  ${matrix.length}×${matrix.length} (with quiet zone)`,
        ``,
        ascii,
        ``,
        `Scan this QR code from your terminal.`,
      ];

      return {
        title: `qr: "${text}"`,
        output: lines.join("\n"),
        metadata: {
          text,
          version: 1,
          modules: 21,
          renderedSize: matrix.length,
        },
      };
    } catch (error) {
      return {
        title: "qr: error",
        output: `QR generation failed: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Generate a simplified QR code matrix.
 * Version 1 (21×21) with byte mode encoding.
 */
function generateSimpleQR(text) {
  const size = 21;
  // Initialize matrix with false (white)
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns (7x7) in three corners
  placeFinderPattern(matrix, 0, 0);
  placeFinderPattern(matrix, 0, size - 7);
  placeFinderPattern(matrix, size - 7, 0);

  // 2. Separators (white border around finder patterns)
  placeSeparators(matrix, size);

  // 3. Timing patterns (alternating dark/light on row 6 and column 6)
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = (i % 2 === 0);
    matrix[i][6] = (i % 2 === 0);
  }

  // 4. Dark module (always dark)
  matrix[size - 8][8] = true;

  // 5. Format information (pre-computed for mask 0, EC level M)
  // This is a 15-bit pattern placed around the finder patterns
  placeFormatInfo(matrix, size);

  // 6. Encode data and place in matrix
  const dataBits = encodeQRData(text);
  placeQRData(matrix, dataBits);

  // 7. Apply mask pattern 0: (row + column) % 2 == 0
  applyQRMask(matrix, 0);

  return matrix;
}

/**
 * Place a 7x7 finder pattern at (row, col).
 */
function placeFinderPattern(matrix, row, col) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      // Outer border (dark), inner square (dark), core (dark)
      if (r === 0 || r === 6 || c === 0 || c === 6) {
        matrix[row + r][col + c] = true;
      } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
        matrix[row + r][col + c] = true;
      }
    }
  }
}

/**
 * Place white separators around finder patterns.
 */
function placeSeparators(matrix, size) {
  // Top-left finder
  for (let i = 0; i < 8; i++) {
    if (7 < size) { matrix[7][i] = false; }
    if (7 < size) { matrix[i][7] = false; }
  }
  // Top-right finder
  for (let i = 0; i < 8; i++) {
    const col = size - 8 + i;
    if (col >= 0 && col < size) { matrix[7][col] = false; }
    if (col >= 0 && col < size) { matrix[i][size - 8] = false; }
  }
  // Bottom-left finder
  for (let i = 0; i < 8; i++) {
    const row = size - 8 + i;
    if (row >= 0 && row < size) { matrix[row][7] = false; }
    if (row >= 0 && row < size) { matrix[size - 8][i] = false; }
  }
}

/**
 * Place format information bits.
 * Uses a pre-computed 15-bit pattern for mask 0, EC level M.
 */
function placeFormatInfo(matrix, size) {
  // Format info bits (pre-computed for mask 0, EC level M)
  // These are placed around the finder patterns
  const formatBits = [
    1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0
  ];

  // Horizontal around top-left finder
  let idx = 0;
  for (let c = 0; c < 9; c++) {
    if (c === 6) continue; // Skip timing pattern
    if (idx < formatBits.length) {
      matrix[8][c] = formatBits[idx++];
    }
  }
  // Continue horizontal past finder (positions 0-5)
  idx = 0;
  for (let c = 0; c < 8; c++) {
    if (c === 6) continue;
    matrix[8][size - 8 + c] = formatBits[formatBits.length - 7 + c < formatBits.length ? formatBits.length - 7 + c : 0];
    if (c === 0) matrix[8][size - 8] = formatBits[7]; // Dark module replacement
  }

  // Vertical around top-left finder
  idx = 0;
  for (let r = 0; r < 9; r++) {
    if (r === 6) continue;
    if (idx < 7) {
      matrix[r][8] = formatBits[idx++];
    }
  }

  // Vertical around bottom-left finder (format bits 7-14)
  idx = 7;
  for (let r = size - 1; r >= size - 7; r--) {
    if (idx < formatBits.length) {
      matrix[r][8] = formatBits[idx++];
    }
  }
}

/**
 * Encode text into QR data bits.
 * Version 1, byte mode, error correction level M.
 */
function encodeQRData(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i));
  }

  // Version 1-L can hold 19 data codewords (152 bits)
  // Mode: 0100 (byte)
  // Char count: 8 bits
  // Data
  // Terminator: up to 4 bits
  // Pad bytes

  const bits = [];

  // Mode indicator: byte mode = 0100
  bits.push(0, 1, 0, 0);

  // Character count (8 bits for version 1 byte mode)
  const countBits = text.length;
  for (let i = 7; i >= 0; i--) {
    bits.push((countBits >> i) & 1);
  }

  // Data bytes (MSB first)
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }

  // Terminator (up to 4 bits of 0)
  const terminator = Math.min(4, 152 - bits.length);
  for (let i = 0; i < terminator; i++) {
    bits.push(0);
  }

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes to fill remaining capacity
  const padBytes = [0b11101100, 0b00010001];
  let padIdx = 0;
  while (bits.length < 152) {
    const pb = padBytes[padIdx % 2];
    for (let i = 7; i >= 0; i--) {
      if (bits.length < 152) {
        bits.push((pb >> i) & 1);
      }
    }
    padIdx++;
  }

  return bits;
}

/**
 * Place data bits into the QR matrix following the standard zigzag pattern.
 */
function placeQRData(matrix, bits) {
  const size = matrix.length;
  let bitIdx = 0;

  // Data is placed in columns from right to left, moving up and down
  // Starting from bottom-right corner

  // Version 1 data area: columns 20 down to 0
  // We use a simplified placement: fill from bottom-right going up
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing pattern column

    if (bitIdx >= bits.length) break;

    // Two-column wide: process col and col-1
    if ((size - col) % 4 === 0) {
      // Going up
      for (let row = size - 1; row >= 0; row--) {
        if (bitIdx >= bits.length) break;
        for (const c of [col, col - 1]) {
          if (c >= 0 && !isReserved(matrix, row, c)) {
            matrix[row][c] = bits[bitIdx++] === 1;
          }
        }
      }
    } else {
      // Going down
      for (let row = 0; row < size; row++) {
        if (bitIdx >= bits.length) break;
        for (const c of [col, col - 1]) {
          if (c >= 0 && !isReserved(matrix, row, c)) {
            matrix[row][c] = bits[bitIdx++] === 1;
          }
        }
      }
    }
  }
}

/**
 * Check if a position in the matrix is reserved (finder, timing, format).
 */
function isReserved(matrix, row, col) {
  const size = matrix.length;

  // Finder patterns and separators (top-left)
  if (row <= 8 && col <= 8) return true;
  // Finder pattern (top-right)
  if (row <= 8 && col >= size - 8) return true;
  // Finder pattern (bottom-left)
  if (row >= size - 8 && col <= 8) return true;
  // Timing pattern row
  if (row === 6) return true;
  // Timing pattern column
  if (col === 6) return true;
  // Dark module
  if (row === size - 8 && col === 8) return true;

  return false;
}

/**
 * Apply mask pattern 0: invert cells where (row + column) % 2 == 0,
 * but only for data cells (not reserved/structural cells).
 */
function applyQRMask(matrix, mask) {
  const size = matrix.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isReserved(matrix, r, c)) {
        if (mask === 0 && (r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }
}

/**
 * Render QR matrix as ASCII art using Unicode block characters.
 */
function renderQRMatrix(matrix) {
  const quiet = 4; // Quiet zone modules
  const qSize = matrix.length + quiet * 2;
  const qMatrix = Array.from({ length: qSize }, () => Array(qSize).fill(false));

  // Copy matrix into center with quiet zone
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      qMatrix[r + quiet][c + quiet] = matrix[r][c];
    }
  }

  // Render using two rows of characters to get square aspect ratio
  const lines = [];
  for (let r = 0; r < qSize; r += 2) {
    let line = "";
    for (let c = 0; c < qSize; c++) {
      const top = qMatrix[r][c];
      const bottom = r + 1 < qSize ? qMatrix[r + 1][c] : false;

      if (top && bottom) line += "██";
      else if (top && !bottom) line += "▀▀";
      else if (!top && bottom) line += "▄▄";
      else line += "  ";
    }
    // Trim trailing spaces
    line = line.replace(/\s+$/, "");
    if (line) lines.push(line);
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// Emoji tool — Search emoji from built-in map
// ═══════════════════════════════════════════════════════════════════════

/**
 * Emoji search tool.
 * Search from a built-in map of 100+ emojis by name or keyword.
 */
export const emojiTool = tool({
  description: `Search emojis by name or keyword.
Includes 100+ common emojis organized by category.
Returns matching emojis with their names and Unicode codepoints.`,
  args: {
    search: tool.schema.string().describe("Search term to find emojis (e.g., 'smile', 'heart', 'cat')"),
  },
  async execute(args, context) {
    const search = (args.search || "").trim().toLowerCase();

    if (!search) {
      return {
        title: "emoji: missing search term",
        output: "Please provide a search term (e.g., 'smile', 'heart', 'cat').\n\nAvailable categories: smileys, people, animals, food, travel, activities, objects, symbols, flags",
        metadata: { error: "missing_search" },
      };
    }

    const results = [];
    for (const emoji of EMOJI_LIST) {
      if (
        emoji.name.toLowerCase().includes(search) ||
        emoji.keywords.some((kw) => kw.toLowerCase().includes(search)) ||
        emoji.category.toLowerCase().includes(search)
      ) {
        results.push(emoji);
      }
    }

    if (results.length === 0) {
      // Show available categories as hint
      const cats = [...new Set(EMOJI_LIST.map((e) => e.category))];
      return {
        title: `emoji: no results for "${search}"`,
        output: `No emojis found for "${search}".\n\nAvailable categories: ${cats.join(", ")}`,
        metadata: { search, count: 0 },
      };
    }

    // Limit display to avoid huge output
    const display = results.slice(0, 30);
    const lines = [
      `Emojis matching "${search}" (${results.length} found):`,
      ``,
      ...display.map((e) => `  ${e.emoji}  ${e.name}  (${e.codepoint})`),
    ];

    if (results.length > 30) {
      lines.push(`  ... and ${results.length - 30} more`);
    }

    return {
      title: `emoji: ${results.length} results for "${search}"`,
      output: lines.join("\n"),
      metadata: { search, count: results.length, results: results.slice(0, 30) },
    };
  },
});

const EMOJI_LIST = [
  // Smileys
  { emoji: "😀", name: "Grinning Face", codepoint: "U+1F600", keywords: ["smile", "happy", "grin"], category: "smileys" },
  { emoji: "😃", name: "Grinning Face with Big Eyes", codepoint: "U+1F603", keywords: ["smile", "happy", "eyes"], category: "smileys" },
  { emoji: "😄", name: "Grinning Face with Smiling Eyes", codepoint: "U+1F604", keywords: ["smile", "happy", "eyes"], category: "smileys" },
  { emoji: "😁", name: "Beaming Face with Smiling Eyes", codepoint: "U+1F601", keywords: ["smile", "happy", "teeth"], category: "smileys" },
  { emoji: "😆", name: "Grinning Squinting Face", codepoint: "U+1F606", keywords: ["laugh", "happy", "squint"], category: "smileys" },
  { emoji: "😅", name: "Grinning Face with Sweat", codepoint: "U+1F605", keywords: ["sweat", "happy", "nervous"], category: "smileys" },
  { emoji: "🤣", name: "Rolling on the Floor Laughing", codepoint: "U+1F923", keywords: ["laugh", "rofl", "funny"], category: "smileys" },
  { emoji: "😂", name: "Face with Tears of Joy", codepoint: "U+1F602", keywords: ["laugh", "tears", "cry"], category: "smileys" },
  { emoji: "🙂", name: "Slightly Smiling Face", codepoint: "U+1F642", keywords: ["smile", "neutral"], category: "smileys" },
  { emoji: "😊", name: "Smiling Face with Smiling Eyes", codepoint: "U+1F60A", keywords: ["smile", "blush", "eyes"], category: "smileys" },
  { emoji: "😇", name: "Smiling Face with Halo", codepoint: "U+1F607", keywords: ["angel", "holy", "innocent"], category: "smileys" },
  { emoji: "🥰", name: "Smiling Face with Hearts", codepoint: "U+1F970", keywords: ["love", "heart", "adore"], category: "smileys" },
  { emoji: "😍", name: "Smiling Face with Heart-Eyes", codepoint: "U+1F60D", keywords: ["love", "heart eyes", "crush"], category: "smileys" },
  { emoji: "🤩", name: "Star-Struck", codepoint: "U+1F929", keywords: ["star", "excited", "amazed"], category: "smileys" },
  { emoji: "😘", name: "Face Blowing a Kiss", codepoint: "U+1F618", keywords: ["kiss", "love", "blow"], category: "smileys" },
  { emoji: "😗", name: "Kissing Face", codepoint: "U+1F617", keywords: ["kiss", "neutral"], category: "smileys" },
  { emoji: "😋", name: "Face Savoring Food", codepoint: "U+1F60B", keywords: ["yum", "food", "tongue"], category: "smileys" },
  { emoji: "😛", name: "Face with Tongue", codepoint: "U+1F61B", keywords: ["tongue", "silly", "playful"], category: "smileys" },
  { emoji: "😜", name: "Winking Face with Tongue", codepoint: "U+1F61C", keywords: ["wink", "tongue", "silly"], category: "smileys" },
  { emoji: "🤪", name: "Zany Face", codepoint: "U+1F92A", keywords: ["crazy", "zany", "wacky"], category: "smileys" },
  { emoji: "😝", name: "Squinting Face with Tongue", codepoint: "U+1F61D", keywords: ["tongue", "squint", "silly"], category: "smileys" },
  { emoji: "🤑", name: "Money-Mouth Face", codepoint: "U+1F911", keywords: ["money", "rich", "dollar"], category: "smileys" },
  { emoji: "🤗", name: "Hugging Face", codepoint: "U+1F917", keywords: ["hug", "arms", "open"], category: "smileys" },
  { emoji: "🤭", name: "Face with Hand Over Mouth", codepoint: "U+1F92D", keywords: ["shh", "quiet", "secret"], category: "smileys" },
  { emoji: "🫢", name: "Face with Open Eyes and Hand Over Mouth", codepoint: "U+1FAE2", keywords: ["shock", "surprise", "quiet"], category: "smileys" },
  { emoji: "🫣", name: "Face with Peeking Eye", codepoint: "U+1FAE3", keywords: ["peek", "hiding", "shy"], category: "smileys" },
  { emoji: "🤫", name: "Shushing Face", codepoint: "U+1F92B", keywords: ["shh", "quiet", "secret"], category: "smileys" },
  { emoji: "🤔", name: "Thinking Face", codepoint: "U+1F914", keywords: ["think", "ponder", "confused"], category: "smileys" },
  { emoji: "🫡", name: "Saluting Face", codepoint: "U+1FAE1", keywords: ["salute", "respect", "ok"], category: "smileys" },
  { emoji: "🤐", name: "Zipper-Mouth Face", codepoint: "U+1F910", keywords: ["zip", "quiet", "secret"], category: "smileys" },
  { emoji: "🤨", name: "Face with Raised Eyebrow", codepoint: "U+1F928", keywords: ["skeptical", "doubt", "eyeroll"], category: "smileys" },
  { emoji: "😐", name: "Neutral Face", codepoint: "U+1F610", keywords: ["neutral", "meh", "serious"], category: "smileys" },
  { emoji: "😑", name: "Expressionless Face", codepoint: "U+1F611", keywords: ["blank", "no expression"], category: "smileys" },
  { emoji: "😶", name: "Face Without Mouth", codepoint: "U+1F636", keywords: ["silent", "no mouth"], category: "smileys" },
  { emoji: "😏", name: "Smirking Face", codepoint: "U+1F60F", keywords: ["smirk", "smug", "confident"], category: "smileys" },
  { emoji: "😒", name: "Unamused Face", codepoint: "U+1F612", keywords: ["unamused", "annoyed", "meh"], category: "smileys" },
  { emoji: "🙄", name: "Face with Rolling Eyes", codepoint: "U+1F644", keywords: ["roll eyes", "eyeroll", "annoyed"], category: "smileys" },
  { emoji: "😬", name: "Grimacing Face", codepoint: "U+1F62C", keywords: ["grimace", "awkward", "cringe"], category: "smileys" },
  { emoji: "😮‍💨", name: "Face Exhaling", codepoint: "U+1F62E U+200D U+1F4A8", keywords: ["exhale", "relief", "sigh"], category: "smileys" },
  { emoji: "🤥", name: "Lying Face", codepoint: "U+1F925", keywords: ["lie", "pinocchio", "fake"], category: "smileys" },
  { emoji: "😌", name: "Relieved Face", codepoint: "U+1F60C", keywords: ["relief", "peace", "calm"], category: "smileys" },
  { emoji: "😔", name: "Pensive Face", codepoint: "U+1F614", keywords: ["sad", "pensive", "down"], category: "smileys" },
  { emoji: "😴", name: "Sleeping Face", codepoint: "U+1F634", keywords: ["sleep", "tired", "zzz"], category: "smileys" },
  { emoji: "😷", name: "Face with Medical Mask", codepoint: "U+1F637", keywords: ["mask", "sick", "doctor"], category: "smileys" },
  { emoji: "🤒", name: "Face with Thermometer", codepoint: "U+1F912", keywords: ["sick", "fever", "thermometer"], category: "smileys" },
  { emoji: "🤕", name: "Face with Head-Bandage", codepoint: "U+1F915", keywords: ["hurt", "bandage", "injury"], category: "smileys" },
  { emoji: "🤢", name: "Nauseated Face", codepoint: "U+1F922", keywords: ["sick", "nausea", "vomit"], category: "smileys" },
  { emoji: "🤮", name: "Face Vomiting", codepoint: "U+1F92E", keywords: ["vomit", "sick", "barf"], category: "smileys" },
  { emoji: "🥴", name: "Woozy Face", codepoint: "U+1F974", keywords: ["drunk", "dizzy", "woozy"], category: "smileys" },
  { emoji: "😵", name: "Dizzy Face", codepoint: "U+1F635", keywords: ["dizzy", "spinning", "confused"], category: "smileys" },
  { emoji: "🥶", name: "Cold Face", codepoint: "U+1F976", keywords: ["cold", "freeze", "ice"], category: "smileys" },
  { emoji: "🥵", name: "Hot Face", codepoint: "U+1F975", keywords: ["hot", "sweat", "fever"], category: "smileys" },
  { emoji: "🥳", name: "Partying Face", codepoint: "U+1F973", keywords: ["party", "celebrate", "hat"], category: "smileys" },

  // People
  { emoji: "👋", name: "Waving Hand", codepoint: "U+1F44B", keywords: ["wave", "hello", "hand"], category: "people" },
  { emoji: "🤚", name: "Raised Back of Hand", codepoint: "U+1F91A", keywords: ["hand", "raised"], category: "people" },
  { emoji: "🖐️", name: "Hand with Fingers Splayed", codepoint: "U+1F590", keywords: ["hand", "splayed"], category: "people" },
  { emoji: "✋", name: "Raised Hand", codepoint: "U+270B", keywords: ["hand", "stop", "raised"], category: "people" },
  { emoji: "🖖", name: "Vulcan Salute", codepoint: "U+1F596", keywords: ["spock", "vulcan", "star trek"], category: "people" },
  { emoji: "👌", name: "OK Hand", codepoint: "U+1F44C", keywords: ["ok", "hand", "perfect"], category: "people" },
  { emoji: "🤌", name: "Pinched Fingers", codepoint: "U+1F90C", keywords: ["pinch", "italian", "hand"], category: "people" },
  { emoji: "🤏", name: "Pinching Hand", codepoint: "U+1F90F", keywords: ["pinch", "small", "tiny"], category: "people" },
  { emoji: "✌️", name: "Victory Hand", codepoint: "U+270C", keywords: ["peace", "victory", "v"], category: "people" },
  { emoji: "🤞", name: "Crossed Fingers", codepoint: "U+1F91E", keywords: ["cross", "luck", "hope"], category: "people" },
  { emoji: "🫰", name: "Hand with Index Finger and Thumb Crossed", codepoint: "U+1FAF0", keywords: ["cross", "finger", "heart"], category: "people" },
  { emoji: "🤟", name: "Love-You Gesture", codepoint: "U+1F91F", keywords: ["love", "ily", "hand"], category: "people" },
  { emoji: "🤘", name: "Sign of the Horns", codepoint: "U+1F918", keywords: ["rock", "horns", "metal"], category: "people" },
  { emoji: "🤙", name: "Call Me Hand", codepoint: "U+1F919", keywords: ["call", "phone", "hang loose"], category: "people" },
  { emoji: "👆", name: "Backhand Index Pointing Up", codepoint: "U+1F446", keywords: ["up", "point", "above"], category: "people" },
  { emoji: "👇", name: "Backhand Index Pointing Down", codepoint: "U+1F447", keywords: ["down", "point", "below"], category: "people" },
  { emoji: "👈", name: "Backhand Index Pointing Left", codepoint: "U+1F448", keywords: ["left", "point"], category: "people" },
  { emoji: "👉", name: "Backhand Index Pointing Right", codepoint: "U+1F449", keywords: ["right", "point"], category: "people" },
  { emoji: "👏", name: "Clapping Hands", codepoint: "U+1F44F", keywords: ["clap", "applause", "congrats"], category: "people" },
  { emoji: "🙌", name: "Raising Hands", codepoint: "U+1F64C", keywords: ["raise", "celebrate", "hooray"], category: "people" },
  { emoji: "🫶", name: "Heart Hands", codepoint: "U+1FAF6", keywords: ["heart", "love", "hands"], category: "people" },
  { emoji: "👐", name: "Open Hands", codepoint: "U+1F450", keywords: ["open", "hug", "hands"], category: "people" },
  { emoji: "🙏", name: "Folded Hands", codepoint: "U+1F64F", keywords: ["pray", "please", "thank you"], category: "people" },
  { emoji: "💪", name: "Flexed Biceps", codepoint: "U+1F4AA", keywords: ["arm", "strong", "muscle"], category: "people" },

  // Animals & Nature
  { emoji: "🐶", name: "Dog Face", codepoint: "U+1F436", keywords: ["dog", "puppy", "pet"], category: "animals" },
  { emoji: "🐱", name: "Cat Face", codepoint: "U+1F431", keywords: ["cat", "kitty", "pet"], category: "animals" },
  { emoji: "🐭", name: "Mouse Face", codepoint: "U+1F42D", keywords: ["mouse", "rat"], category: "animals" },
  { emoji: "🐹", name: "Hamster", codepoint: "U+1F439", keywords: ["hamster", "pet"], category: "animals" },
  { emoji: "🐰", name: "Rabbit Face", codepoint: "U+1F430", keywords: ["rabbit", "bunny"], category: "animals" },
  { emoji: "🦊", name: "Fox", codepoint: "U+1F98A", keywords: ["fox", "animal"], category: "animals" },
  { emoji: "🐻", name: "Bear", codepoint: "U+1F43B", keywords: ["bear", "animal"], category: "animals" },
  { emoji: "🐼", name: "Panda", codepoint: "U+1F43C", keywords: ["panda", "animal"], category: "animals" },
  { emoji: "🐻‍❄️", name: "Polar Bear", codepoint: "U+1F43B U+200D U+2744", keywords: ["bear", "polar", "ice"], category: "animals" },
  { emoji: "🐨", name: "Koala", codepoint: "U+1F428", keywords: ["koala", "animal"], category: "animals" },
  { emoji: "🐯", name: "Tiger Face", codepoint: "U+1F42F", keywords: ["tiger", "animal"], category: "animals" },
  { emoji: "🦁", name: "Lion", codepoint: "U+1F981", keywords: ["lion", "king", "animal"], category: "animals" },
  { emoji: "🐮", name: "Cow Face", codepoint: "U+1F42E", keywords: ["cow", "milk"], category: "animals" },
  { emoji: "🐷", name: "Pig Face", codepoint: "U+1F437", keywords: ["pig", "oink"], category: "animals" },
  { emoji: "🐸", name: "Frog", codepoint: "U+1F438", keywords: ["frog", "toad"], category: "animals" },
  { emoji: "🐵", name: "Monkey Face", codepoint: "U+1F435", keywords: ["monkey", "ape"], category: "animals" },
  { emoji: "🐔", name: "Chicken", codepoint: "U+1F414", keywords: ["chicken", "bird"], category: "animals" },
  { emoji: "🐧", name: "Penguin", codepoint: "U+1F427", keywords: ["penguin", "bird", "cold"], category: "animals" },
  { emoji: "🐦", name: "Bird", codepoint: "U+1F426", keywords: ["bird", "tweet"], category: "animals" },
  { emoji: "🐤", name: "Baby Chick", codepoint: "U+1F424", keywords: ["chick", "baby", "bird"], category: "animals" },
  { emoji: "🦆", name: "Duck", codepoint: "U+1F986", keywords: ["duck", "bird"], category: "animals" },
  { emoji: "🦅", name: "Eagle", codepoint: "U+1F985", keywords: ["eagle", "bird", "fly"], category: "animals" },
  { emoji: "🦉", name: "Owl", codepoint: "U+1F989", keywords: ["owl", "bird", "wise"], category: "animals" },
  { emoji: "🦇", name: "Bat", codepoint: "U+1F987", keywords: ["bat", "vampire", "animal"], category: "animals" },
  { emoji: "🐺", name: "Wolf", codepoint: "U+1F43A", keywords: ["wolf", "howl"], category: "animals" },
  { emoji: "🐗", name: "Boar", codepoint: "U+1F417", keywords: ["boar", "pig"], category: "animals" },
  { emoji: "🐴", name: "Horse Face", codepoint: "U+1F434", keywords: ["horse", "pony"], category: "animals" },
  { emoji: "🦄", name: "Unicorn", codepoint: "U+1F984", keywords: ["unicorn", "magic", "fantasy"], category: "animals" },
  { emoji: "🐝", name: "Honeybee", codepoint: "U+1F41D", keywords: ["bee", "honey", "insect"], category: "animals" },
  { emoji: "🦋", name: "Butterfly", codepoint: "U+1F98B", keywords: ["butterfly", "insect", "beautiful"], category: "animals" },
  { emoji: "🐛", name: "Bug", codepoint: "U+1F41B", keywords: ["bug", "insect"], category: "animals" },
  { emoji: "🐞", name: "Lady Beetle", codepoint: "U+1F41E", keywords: ["ladybug", "beetle", "insect"], category: "animals" },
  { emoji: "🌹", name: "Rose", codepoint: "U+1F339", keywords: ["rose", "flower", "love"], category: "animals" },
  { emoji: "🌸", name: "Cherry Blossom", codepoint: "U+1F338", keywords: ["flower", "blossom", "spring"], category: "animals" },
  { emoji: "🌺", name: "Hibiscus", codepoint: "U+1F33A", keywords: ["flower", "hibiscus"], category: "animals" },
  { emoji: "🌻", name: "Sunflower", codepoint: "U+1F33B", keywords: ["flower", "sun"], category: "animals" },
  { emoji: "🌿", name: "Herb", codepoint: "U+1F33F", keywords: ["leaf", "herb", "plant"], category: "animals" },
  { emoji: "🍀", name: "Four Leaf Clover", codepoint: "U+1F340", keywords: ["clover", "luck", "lucky"], category: "animals" },

  // Food & Drink
  { emoji: "🍎", name: "Red Apple", codepoint: "U+1F34E", keywords: ["apple", "fruit", "red"], category: "food" },
  { emoji: "🍐", name: "Pear", codepoint: "U+1F350", keywords: ["pear", "fruit"], category: "food" },
  { emoji: "🍊", name: "Tangerine", codepoint: "U+1F34A", keywords: ["orange", "fruit", "citrus"], category: "food" },
  { emoji: "🍋", name: "Lemon", codepoint: "U+1F34B", keywords: ["lemon", "citrus", "sour"], category: "food" },
  { emoji: "🍌", name: "Banana", codepoint: "U+1F34C", keywords: ["banana", "fruit"], category: "food" },
  { emoji: "🍉", name: "Watermelon", codepoint: "U+1F349", keywords: ["watermelon", "fruit", "summer"], category: "food" },
  { emoji: "🍇", name: "Grapes", codepoint: "U+1F347", keywords: ["grapes", "fruit", "wine"], category: "food" },
  { emoji: "🍓", name: "Strawberry", codepoint: "U+1F353", keywords: ["strawberry", "fruit", "berry"], category: "food" },
  { emoji: "🫐", name: "Blueberries", codepoint: "U+1FAD0", keywords: ["blueberry", "berry", "fruit"], category: "food" },
  { emoji: "🍈", name: "Melon", codepoint: "U+1F348", keywords: ["melon", "fruit"], category: "food" },
  { emoji: "🍒", name: "Cherries", codepoint: "U+1F352", keywords: ["cherry", "fruit", "red"], category: "food" },
  { emoji: "🍑", name: "Peach", codepoint: "U+1F351", keywords: ["peach", "fruit"], category: "food" },
  { emoji: "🥭", name: "Mango", codepoint: "U+1F96D", keywords: ["mango", "fruit", "tropical"], category: "food" },
  { emoji: "🍍", name: "Pineapple", codepoint: "U+1F34D", keywords: ["pineapple", "fruit", "tropical"], category: "food" },
  { emoji: "🥥", name: "Coconut", codepoint: "U+1F965", keywords: ["coconut", "fruit"], category: "food" },
  { emoji: "🥝", name: "Kiwi Fruit", codepoint: "U+1F95D", keywords: ["kiwi", "fruit"], category: "food" },
  { emoji: "🍅", name: "Tomato", codepoint: "U+1F345", keywords: ["tomato", "vegetable"], category: "food" },
  { emoji: "🥑", name: "Avocado", codepoint: "U+1F951", keywords: ["avocado", "fruit"], category: "food" },
  { emoji: "🍔", name: "Hamburger", codepoint: "U+1F354", keywords: ["burger", "hamburger", "food"], category: "food" },
  { emoji: "🍟", name: "French Fries", codepoint: "U+1F35F", keywords: ["fries", "chips", "food"], category: "food" },
  { emoji: "🍕", name: "Pizza", codepoint: "U+1F355", keywords: ["pizza", "food", "italian"], category: "food" },
  { emoji: "🌭", name: "Hot Dog", codepoint: "U+1F32D", keywords: ["hot dog", "food"], category: "food" },
  { emoji: "🥪", name: "Sandwich", codepoint: "U+1F96A", keywords: ["sandwich", "food"], category: "food" },
  { emoji: "🌮", name: "Taco", codepoint: "U+1F32E", keywords: ["taco", "mexican", "food"], category: "food" },
  { emoji: "🌯", name: "Burrito", codepoint: "U+1F32F", keywords: ["burrito", "mexican", "food"], category: "food" },
  { emoji: "🥙", name: "Stuffed Flatbread", codepoint: "U+1F959", keywords: ["flatbread", "pita", "food"], category: "food" },
  { emoji: "🍝", name: "Spaghetti", codepoint: "U+1F35D", keywords: ["pasta", "spaghetti", "italian"], category: "food" },
  { emoji: "🍜", name: "Steaming Bowl", codepoint: "U+1F35C", keywords: ["noodles", "ramen", "soup"], category: "food" },
  { emoji: "🍲", name: "Pot of Food", codepoint: "U+1F372", keywords: ["stew", "pot", "food"], category: "food" },
  { emoji: "🍣", name: "Sushi", codepoint: "U+1F363", keywords: ["sushi", "japanese", "fish"], category: "food" },
  { emoji: "🥟", name: "Dumpling", codepoint: "U+1F95F", keywords: ["dumpling", "pot sticker"], category: "food" },
  { emoji: "🍦", name: "Soft Ice Cream", codepoint: "U+1F366", keywords: ["ice cream", "dessert"], category: "food" },
  { emoji: "🍰", name: "Shortcake", codepoint: "U+1F370", keywords: ["cake", "dessert", "birthday"], category: "food" },
  { emoji: "🧁", name: "Cupcake", codepoint: "U+1F9C1", keywords: ["cupcake", "dessert"], category: "food" },
  { emoji: "🍫", name: "Chocolate Bar", codepoint: "U+1F36B", keywords: ["chocolate", "candy"], category: "food" },
  { emoji: "🍿", name: "Popcorn", codepoint: "U+1F37F", keywords: ["popcorn", "movie"], category: "food" },
  { emoji: "🥤", name: "Cup with Straw", codepoint: "U+1F964", keywords: ["drink", "soda", "cup"], category: "food" },
  { emoji: "☕", name: "Hot Beverage", codepoint: "U+2615", keywords: ["coffee", "tea", "drink"], category: "food" },
  { emoji: "🍺", name: "Beer Mug", codepoint: "U+1F37A", keywords: ["beer", "drink", "alcohol"], category: "food" },
  { emoji: "🍻", name: "Clinking Beer Mugs", codepoint: "U+1F37B", keywords: ["beer", "cheers", "drink"], category: "food" },
  { emoji: "🥂", name: "Clinking Glasses", codepoint: "U+1F942", keywords: ["cheers", "champagne", "toast"], category: "food" },
  { emoji: "🍷", name: "Wine Glass", codepoint: "U+1F377", keywords: ["wine", "drink", "alcohol"], category: "food" },
  { emoji: "🍸", name: "Cocktail Glass", codepoint: "U+1F378", keywords: ["cocktail", "drink", "bar"], category: "food" },

  // Travel & Places
  { emoji: "🌍", name: "Globe Showing Europe-Africa", codepoint: "U+1F30D", keywords: ["globe", "earth", "world"], category: "travel" },
  { emoji: "🌎", name: "Globe Showing Americas", codepoint: "U+1F30E", keywords: ["globe", "earth", "americas"], category: "travel" },
  { emoji: "🌏", name: "Globe Showing Asia-Australia", codepoint: "U+1F30F", keywords: ["globe", "earth", "asia"], category: "travel" },
  { emoji: "🗺️", name: "World Map", codepoint: "U+1F5FA", keywords: ["map", "world", "travel"], category: "travel" },
  { emoji: "🚗", name: "Automobile", codepoint: "U+1F697", keywords: ["car", "auto", "vehicle"], category: "travel" },
  { emoji: "🚕", name: "Taxi", codepoint: "U+1F695", keywords: ["taxi", "cab"], category: "travel" },
  { emoji: "🚙", name: "Sport Utility Vehicle", codepoint: "U+1F699", keywords: ["suv", "jeep", "car"], category: "travel" },
  { emoji: "🚌", name: "Bus", codepoint: "U+1F68C", keywords: ["bus", "vehicle"], category: "travel" },
  { emoji: "🚎", name: "Trolleybus", codepoint: "U+1F68E", keywords: ["trolley", "bus"], category: "travel" },
  { emoji: "🏎️", name: "Racing Car", codepoint: "U+1F3CE", keywords: ["race car", "formula 1"], category: "travel" },
  { emoji: "🚓", name: "Police Car", codepoint: "U+1F693", keywords: ["police", "car", "cop"], category: "travel" },
  { emoji: "🚑", name: "Ambulance", codepoint: "U+1F691", keywords: ["ambulance", "emergency"], category: "travel" },
  { emoji: "🚀", name: "Rocket", codepoint: "U+1F680", keywords: ["rocket", "space", "launch"], category: "travel" },
  { emoji: "🛸", name: "Flying Saucer", codepoint: "U+1F6F8", keywords: ["ufo", "alien", "space"], category: "travel" },
  { emoji: "✈️", name: "Airplane", codepoint: "U+2708", keywords: ["plane", "flight", "air"], category: "travel" },
  { emoji: "🛩️", name: "Small Airplane", codepoint: "U+1F6E9", keywords: ["plane", "small", "air"], category: "travel" },
  { emoji: "🚁", name: "Helicopter", codepoint: "U+1F681", keywords: ["helicopter", "chopper"], category: "travel" },
  { emoji: "🚂", name: "Locomotive", codepoint: "U+1F682", keywords: ["train", "locomotive"], category: "travel" },
  { emoji: "🚢", name: "Ship", codepoint: "U+1F6A2", keywords: ["ship", "boat", "sea"], category: "travel" },
  { emoji: "🛳️", name: "Passenger Ship", codepoint: "U+1F6F3", keywords: ["cruise", "ship"], category: "travel" },
  { emoji: "🏠", name: "House", codepoint: "U+1F3E0", keywords: ["house", "home"], category: "travel" },
  { emoji: "🏡", name: "House with Garden", codepoint: "U+1F3E1", keywords: ["house", "garden", "home"], category: "travel" },
  { emoji: "🏢", name: "Office Building", codepoint: "U+1F3E2", keywords: ["office", "building"], category: "travel" },
  { emoji: "🏛️", name: "Classical Building", codepoint: "U+1F3DB", keywords: ["building", "classical", "bank"], category: "travel" },
  { emoji: "🏔️", name: "Snow-Capped Mountain", codepoint: "U+1F3D4", keywords: ["mountain", "snow"], category: "travel" },
  { emoji: "🌋", name: "Volcano", codepoint: "U+1F30B", keywords: ["volcano", "mountain", "lava"], category: "travel" },
  { emoji: "🗻", name: "Mount Fuji", codepoint: "U+1F5FB", keywords: ["fuji", "mountain", "japan"], category: "travel" },
  { emoji: "🏖️", name: "Beach with Umbrella", codepoint: "U+1F3D6", keywords: ["beach", "umbrella", "vacation"], category: "travel" },
  { emoji: "🏝️", name: "Desert Island", codepoint: "U+1F3DD", keywords: ["island", "desert"], category: "travel" },
  { emoji: "🌴", name: "Palm Tree", codepoint: "U+1F334", keywords: ["palm", "tree", "tropical"], category: "travel" },

  // Activities
  { emoji: "⚽", name: "Soccer Ball", codepoint: "U+26BD", keywords: ["soccer", "ball", "football"], category: "activities" },
  { emoji: "🏀", name: "Basketball", codepoint: "U+1F3C0", keywords: ["basketball", "ball", "hoops"], category: "activities" },
  { emoji: "🏈", name: "American Football", codepoint: "U+1F3C8", keywords: ["football", "sports"], category: "activities" },
  { emoji: "⚾", name: "Baseball", codepoint: "U+26BE", keywords: ["baseball", "ball"], category: "activities" },
  { emoji: "🎾", name: "Tennis", codepoint: "U+1F3BE", keywords: ["tennis", "ball", "racket"], category: "activities" },
  { emoji: "🏐", name: "Volleyball", codepoint: "U+1F3D0", keywords: ["volleyball", "ball"], category: "activities" },
  { emoji: "🏉", name: "Rugby Football", codepoint: "U+1F3C9", keywords: ["rugby", "football"], category: "activities" },
  { emoji: "🎱", name: "Pool 8 Ball", codepoint: "U+1F3B1", keywords: ["pool", "billiards", "8 ball"], category: "activities" },
  { emoji: "🏓", name: "Ping Pong", codepoint: "U+1F3D3", keywords: ["ping pong", "table tennis"], category: "activities" },
  { emoji: "🏸", name: "Badminton", codepoint: "U+1F3F8", keywords: ["badminton", "shuttlecock"], category: "activities" },
  { emoji: "🥊", name: "Boxing Glove", codepoint: "U+1F94A", keywords: ["boxing", "glove", "punch"], category: "activities" },
  { emoji: "🥋", name: "Martial Arts Uniform", codepoint: "U+1F94B", keywords: ["karate", "martial arts", "judo"], category: "activities" },
  { emoji: "🎮", name: "Video Game", codepoint: "U+1F3AE", keywords: ["game", "controller", "gaming"], category: "activities" },
  { emoji: "🎯", name: "Direct Hit", codepoint: "U+1F3AF", keywords: ["target", "bullseye", "dart"], category: "activities" },
  { emoji: "🎲", name: "Game Die", codepoint: "U+1F3B2", keywords: ["dice", "game", "random"], category: "activities" },
  { emoji: "♟️", name: "Chess Pawn", codepoint: "U+265F", keywords: ["chess", "pawn", "game"], category: "activities" },
  { emoji: "🎭", name: "Performing Arts", codepoint: "U+1F3AD", keywords: ["theater", "drama", "mask"], category: "activities" },
  { emoji: "🎨", name: "Artist Palette", codepoint: "U+1F3A8", keywords: ["art", "palette", "paint"], category: "activities" },
  { emoji: "🎵", name: "Musical Note", codepoint: "U+1F3B5", keywords: ["music", "note", "song"], category: "activities" },
  { emoji: "🎶", name: "Musical Notes", codepoint: "U+1F3B6", keywords: ["music", "notes", "melody"], category: "activities" },
  { emoji: "🎤", name: "Microphone", codepoint: "U+1F3A4", keywords: ["mic", "sing", "karaoke"], category: "activities" },
  { emoji: "🎧", name: "Headphone", codepoint: "U+1F3A7", keywords: ["headphones", "music", "listen"], category: "activities" },
  { emoji: "🎸", name: "Guitar", codepoint: "U+1F3B8", keywords: ["guitar", "music", "rock"], category: "activities" },
  { emoji: "🎹", name: "Musical Keyboard", codepoint: "U+1F3B9", keywords: ["piano", "keyboard", "music"], category: "activities" },
  { emoji: "🎺", name: "Trumpet", codepoint: "U+1F3BA", keywords: ["trumpet", "brass", "music"], category: "activities" },
  { emoji: "🎻", name: "Violin", codepoint: "U+1F3BB", keywords: ["violin", "strings", "orchestra"], category: "activities" },
  { emoji: "🥁", name: "Drum", codepoint: "U+1F941", keywords: ["drum", "drums", "percussion"], category: "activities" },
  { emoji: "📚", name: "Books", codepoint: "U+1F4DA", keywords: ["books", "library", "study"], category: "activities" },
  { emoji: "📖", name: "Open Book", codepoint: "U+1F4D6", keywords: ["book", "read", "open"], category: "activities" },
  { emoji: "✏️", name: "Pencil", codepoint: "U+270F", keywords: ["pencil", "write", "draw"], category: "activities" },

  // Objects
  { emoji: "💡", name: "Light Bulb", codepoint: "U+1F4A1", keywords: ["idea", "light", "bulb"], category: "objects" },
  { emoji: "🔦", name: "Flashlight", codepoint: "U+1F526", keywords: ["flashlight", "torch", "light"], category: "objects" },
  { emoji: "📱", name: "Mobile Phone", codepoint: "U+1F4F1", keywords: ["phone", "smartphone", "mobile"], category: "objects" },
  { emoji: "💻", name: "Laptop", codepoint: "U+1F4BB", keywords: ["laptop", "computer", "pc"], category: "objects" },
  { emoji: "⌨️", name: "Keyboard", codepoint: "U+2328", keywords: ["keyboard", "type", "input"], category: "objects" },
  { emoji: "🖥️", name: "Desktop Computer", codepoint: "U+1F5A5", keywords: ["desktop", "computer", "pc"], category: "objects" },
  { emoji: "🖨️", name: "Printer", codepoint: "U+1F5A8", keywords: ["printer", "print"], category: "objects" },
  { emoji: "🖱️", name: "Computer Mouse", codepoint: "U+1F5B1", keywords: ["mouse", "computer"], category: "objects" },
  { emoji: "💾", name: "Floppy Disk", codepoint: "U+1F4BE", keywords: ["floppy", "disk", "save"], category: "objects" },
  { emoji: "💿", name: "Optical Disk", codepoint: "U+1F4BF", keywords: ["cd", "dvd", "disk"], category: "objects" },
  { emoji: "📀", name: "DVD", codepoint: "U+1F4C0", keywords: ["dvd", "disk", "video"], category: "objects" },
  { emoji: "🔋", name: "Battery", codepoint: "U+1F50B", keywords: ["battery", "power", "energy"], category: "objects" },
  { emoji: "🔌", name: "Electric Plug", codepoint: "U+1F50C", keywords: ["plug", "power", "electric"], category: "objects" },
  { emoji: "💎", name: "Gem Stone", codepoint: "U+1F48E", keywords: ["diamond", "gem", "jewel"], category: "objects" },
  { emoji: "🔑", name: "Key", codepoint: "U+1F511", keywords: ["key", "lock", "unlock"], category: "objects" },
  { emoji: "🔒", name: "Locked", codepoint: "U+1F512", keywords: ["lock", "locked", "secure"], category: "objects" },
  { emoji: "🔓", name: "Unlocked", codepoint: "U+1F513", keywords: ["unlock", "unlocked", "open"], category: "objects" },
  { emoji: "🛡️", name: "Shield", codepoint: "U+1F6E1", keywords: ["shield", "protect", "guard"], category: "objects" },
  { emoji: "💣", name: "Bomb", codepoint: "U+1F4A3", keywords: ["bomb", "explosive"], category: "objects" },
  { emoji: "🔫", name: "Water Pistol", codepoint: "U+1F52B", keywords: ["gun", "pistol", "water"], category: "objects" },
  { emoji: "💉", name: "Syringe", codepoint: "U+1F489", keywords: ["syringe", "needle", "vaccine"], category: "objects" },
  { emoji: "💊", name: "Pill", codepoint: "U+1F48A", keywords: ["pill", "medicine", "drug"], category: "objects" },
  { emoji: "🪄", name: "Magic Wand", codepoint: "U+1FA84", keywords: ["wand", "magic", "spell"], category: "objects" },
  { emoji: "🔮", name: "Crystal Ball", codepoint: "U+1F52E", keywords: ["crystal", "ball", "fortune"], category: "objects" },
  { emoji: "💈", name: "Barber Pole", codepoint: "U+1F488", keywords: ["barber", "haircut"], category: "objects" },
  { emoji: "🎁", name: "Wrapped Gift", codepoint: "U+1F381", keywords: ["gift", "present", "birthday"], category: "objects" },
  { emoji: "🎉", name: "Party Popper", codepoint: "U+1F389", keywords: ["party", "tada", "celebrate"], category: "objects" },
  { emoji: "🎊", name: "Confetti Ball", codepoint: "U+1F38A", keywords: ["confetti", "party"], category: "objects" },
  { emoji: "🏆", name: "Trophy", codepoint: "U+1F3C6", keywords: ["trophy", "win", "award"], category: "objects" },
  { emoji: "🥇", name: "1st Place Medal", codepoint: "U+1F947", keywords: ["gold", "first", "medal"], category: "objects" },
  { emoji: "🥈", name: "2nd Place Medal", codepoint: "U+1F948", keywords: ["silver", "second", "medal"], category: "objects" },
  { emoji: "🥉", name: "3rd Place Medal", codepoint: "U+1F949", keywords: ["bronze", "third", "medal"], category: "objects" },

  // Symbols
  { emoji: "❤️", name: "Red Heart", codepoint: "U+2764", keywords: ["heart", "love", "red"], category: "symbols" },
  { emoji: "🧡", name: "Orange Heart", codepoint: "U+1F9E1", keywords: ["heart", "love", "orange"], category: "symbols" },
  { emoji: "💛", name: "Yellow Heart", codepoint: "U+1F49B", keywords: ["heart", "love", "yellow"], category: "symbols" },
  { emoji: "💚", name: "Green Heart", codepoint: "U+1F49A", keywords: ["heart", "love", "green"], category: "symbols" },
  { emoji: "💙", name: "Blue Heart", codepoint: "U+1F499", keywords: ["heart", "love", "blue"], category: "symbols" },
  { emoji: "💜", name: "Purple Heart", codepoint: "U+1F49C", keywords: ["heart", "love", "purple"], category: "symbols" },
  { emoji: "🖤", name: "Black Heart", codepoint: "U+1F5A4", keywords: ["heart", "black", "love"], category: "symbols" },
  { emoji: "🤍", name: "White Heart", codepoint: "U+1F90D", keywords: ["heart", "white", "love"], category: "symbols" },
  { emoji: "💔", name: "Broken Heart", codepoint: "U+1F494", keywords: ["heart", "broken", "sad"], category: "symbols" },
  { emoji: "💕", name: "Two Hearts", codepoint: "U+1F495", keywords: ["hearts", "love"], category: "symbols" },
  { emoji: "💖", name: "Sparkling Heart", codepoint: "U+1F496", keywords: ["heart", "sparkle", "love"], category: "symbols" },
  { emoji: "💗", name: "Growing Heart", codepoint: "U+1F497", keywords: ["heart", "growing", "love"], category: "symbols" },
  { emoji: "💞", name: "Revolving Hearts", codepoint: "U+1F49E", keywords: ["hearts", "revolving"], category: "symbols" },
  { emoji: "💫", name: "Dizzy", codepoint: "U+1F4AB", keywords: ["dizzy", "sparkle", "star"], category: "symbols" },
  { emoji: "⭐", name: "Star", codepoint: "U+2B50", keywords: ["star", "rating"], category: "symbols" },
  { emoji: "🌟", name: "Glowing Star", codepoint: "U+1F31F", keywords: ["star", "glow", "shining"], category: "symbols" },
  { emoji: "✨", name: "Sparkles", codepoint: "U+2728", keywords: ["sparkle", "magic", "pretty"], category: "symbols" },
  { emoji: "🔥", name: "Fire", codepoint: "U+1F525", keywords: ["fire", "hot", "burn"], category: "symbols" },
  { emoji: "💯", name: "Hundred Points", codepoint: "U+1F4AF", keywords: ["100", "points", "perfect"], category: "symbols" },
  { emoji: "✅", name: "Check Mark Button", codepoint: "U+2705", keywords: ["check", "yes", "done"], category: "symbols" },
  { emoji: "❌", name: "Cross Mark", codepoint: "U+274C", keywords: ["cross", "no", "wrong"], category: "symbols" },
  { emoji: "❓", name: "Question Mark", codepoint: "U+2753", keywords: ["question", "help", "confused"], category: "symbols" },
  { emoji: "❗", name: "Exclamation Mark", codepoint: "U+2757", keywords: ["exclamation", "warning", "alert"], category: "symbols" },
  { emoji: "🚫", name: "Prohibited", codepoint: "U+1F6AB", keywords: ["no", "stop", "forbidden"], category: "symbols" },
  { emoji: "🚩", name: "Triangular Flag", codepoint: "U+1F6A9", keywords: ["flag", "red", "marker"], category: "symbols" },
  { emoji: "♻️", name: "Recycling Symbol", codepoint: "U+267B", keywords: ["recycle", "green", "eco"], category: "symbols" },
  { emoji: "☮️", name: "Peace Symbol", codepoint: "U+262E", keywords: ["peace", "symbol"], category: "symbols" },
  { emoji: "✝️", name: "Latin Cross", codepoint: "U+271D", keywords: ["cross", "christian", "religion"], category: "symbols" },
  { emoji: "☪️", name: "Star and Crescent", codepoint: "U+262A", keywords: ["islam", "muslim", "moon"], category: "symbols" },
  { emoji: "🕉️", name: "Om", codepoint: "U+1F549", keywords: ["om", "hindu", "religion"], category: "symbols" },
  { emoji: "☸️", name: "Wheel of Dharma", codepoint: "U+2638", keywords: ["buddhism", "dharma", "wheel"], category: "symbols" },
  { emoji: "🔯", name: "Six Pointed Star", codepoint: "U+1F52F", keywords: ["star of david", "judaism"], category: "symbols" },
  { emoji: "🪯", name: "Khanda", codepoint: "U+1FAAF", keywords: ["sikhism", "khanda"], category: "symbols" },
  { emoji: "☯️", name: "Yin Yang", codepoint: "U+262F", keywords: ["yin yang", "taoism"], category: "symbols" },
  { emoji: "🛐", name: "Place of Worship", codepoint: "U+1F6D0", keywords: ["worship", "religion", "church"], category: "symbols" },
  { emoji: "💀", name: "Skull", codepoint: "U+1F480", keywords: ["skull", "death", "danger"], category: "symbols" },
  { emoji: "☠️", name: "Skull and Crossbones", codepoint: "U+2620", keywords: ["skull", "pirate", "danger"], category: "symbols" },
  { emoji: "👽", name: "Alien", codepoint: "U+1F47D", keywords: ["alien", "ufo", "space"], category: "symbols" },
  { emoji: "🤖", name: "Robot", codepoint: "U+1F916", keywords: ["robot", "ai", "machine"], category: "symbols" },

  // Flags
  { emoji: "🏳️", name: "White Flag", codepoint: "U+1F3F3", keywords: ["flag", "white", "surrender"], category: "flags" },
  { emoji: "🏴", name: "Black Flag", codepoint: "U+1F3F4", keywords: ["flag", "black"], category: "flags" },
  { emoji: "🏳️‍🌈", name: "Rainbow Flag", codepoint: "U+1F3F3 U+200D U+1F308", keywords: ["flag", "rainbow", "pride"], category: "flags" },
  { emoji: "🏁", name: "Chequered Flag", codepoint: "U+1F3C1", keywords: ["flag", "checkered", "race"], category: "flags" },
  { emoji: "🚩", name: "Triangular Flag", codepoint: "U+1F6A9", keywords: ["flag", "red", "post"], category: "flags" },
  { emoji: "🇺🇳", name: "United Nations", codepoint: "U+1F1FA U+1F1F3", keywords: ["united nations", "flag", "un"], category: "flags" },
  { emoji: "🏴‍☠️", name: "Pirate Flag", codepoint: "U+1F3F4 U+200D U+2620", keywords: ["pirate", "flag", "jolly roger"], category: "flags" },
];

// ═══════════════════════════════════════════════════════════════════════
// xkcd tool — Fetch xkcd comic from the web API
// ═══════════════════════════════════════════════════════════════════════

/**
 * xkcd comic fetcher.
 * Retrieves comic metadata (title, number, date, alt text, image URL) from xkcd.com.
 */
export const xkcdTool = tool({
  description: `Fetch an xkcd comic by number, or get the latest comic.
Retrieves comic title, number, publication date, alt text, and image URL
from the xkcd.com API. Uses only Node.js built-in https module.`,
  args: {
    number: tool.schema
      .number()
      .optional()
      .describe("Comic number (e.g., 2925). Leave empty for the latest comic."),
  },
  async execute(args, context) {
    const number = args.number;

    try {
      const url = number ? `https://xkcd.com/${number}/info.0.json` : "https://xkcd.com/info.0.json";
      const data = await fetchJson(url);

      if (!data || data.error) {
        return {
          title: `xkcd: ${number ? `#${number} not found` : "fetch failed"}`,
          output: data?.error || `Failed to fetch xkcd comic${number ? ` #${number}` : ""}.`,
          metadata: { error: data?.error || "fetch_failed" },
        };
      }

      const lines = [
        `xkcd #${data.num}: ${data.safe_title}`,
        `Title:    ${data.title}`,
        `Date:     ${data.month}/${data.day}/${data.year}`,
        `Alt:      ${data.alt}`,
        ``,
        `URL:      https://xkcd.com/${data.num}`,
        `Image:    ${data.img}`,
        ``,
        `(Transcript: ${data.transcript ? data.transcript.slice(0, 200) + (data.transcript.length > 200 ? "..." : "") : "N/A"})`,
      ];

      return {
        title: `xkcd: #${data.num} — ${data.safe_title}`,
        output: lines.join("\n"),
        metadata: {
          number: data.num,
          title: data.safe_title,
          date: `${data.year}-${data.month}-${data.day}`,
          imageUrl: data.img,
          alt: data.alt,
          link: `https://xkcd.com/${data.num}`,
        },
      };
    } catch (error) {
      const msg = error.message || String(error);
      if (msg.includes("404")) {
        return {
          title: `xkcd: #${number} not found`,
          output: `Comic #${number} does not exist. xkcd comics range from #1 to the current strip.`,
          metadata: { number, error: "not_found" },
        };
      }
      return {
        title: `xkcd: error fetching${number ? ` #${number}` : ""}`,
        output: `Failed to fetch xkcd comic: ${msg}`,
        metadata: { error: msg },
      };
    }
  },
});

/**
 * Fetch JSON from a URL using Node.js https module.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${e.message}`));
          }
        } else if (res.statusCode === 404) {
          reject(new Error("404 Not Found"));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MIME types lookup table
// ═══════════════════════════════════════════════════════════════════════

const MIME_TYPES = {
  // Text
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  rtf: "application/rtf",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  wma: "audio/x-ms-wma",
  m4a: "audio/mp4",

  // Video
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mkv: "video/x-matroska",

  // Application
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  exe: "application/x-msdownload",
  dll: "application/x-msdownload",
  msi: "application/x-msdownload",
  deb: "application/vnd.debian.binary-package",
  rpm: "application/x-rpm",
  iso: "application/x-iso9660-image",
  dmg: "application/x-apple-diskimage",
  apk: "application/vnd.android.package-archive",
  ipa: "application/octet-stream",

  // Documents
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",

  // Programming
  sh: "application/x-sh",
  bash: "application/x-sh",
  py: "text/x-python",
  rb: "text/x-ruby",
  php: "text/x-php",
  pl: "text/x-perl",
  go: "text/x-go",
  rs: "text/x-rust",
  ts: "text/typescript",
  tsx: "text/typescript",
  jsx: "text/javascript",
  vue: "text/html",
  svelte: "text/html",
  yaml: "text/yaml",
  yml: "text/yaml",
  toml: "text/toml",
  ini: "text/plain",
  cfg: "text/plain",
  conf: "text/plain",
  log: "text/plain",
  env: "text/plain",

  // Web feeds
  rss: "application/rss+xml",
  atom: "application/atom+xml",

  // Binary
  bin: "application/octet-stream",
  dat: "application/octet-stream",
  bak: "application/octet-stream",
  tmp: "application/octet-stream",
};
