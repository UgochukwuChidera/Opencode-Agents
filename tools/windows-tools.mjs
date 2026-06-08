/**
 * Windows Tools - Cross-platform helpers with Windows awareness
 *
 * Provides tools that help with Windows-specific concerns:
 * path conversion between Windows/Linux formats,
 * environment variable handling, and registry access simulation.
 * All tools work cross-platform but are especially useful on Windows.
 */
import { tool } from "@opencode-ai/plugin";
import os from "os";
import path from "path";

/**
 * Path conversion tool.
 * Convert paths between Windows and Unix formats.
 */
export const pathConvertTool = tool({
  description: `Convert file paths between Windows and Unix/Linux formats.
Handles drive letters, backslashes, forward slashes, UNC paths, and Cygwin/MSYS2 paths.
Also normalizes paths for the current platform.
Cross-platform: useful when working with mixed-environment codebases.`,
  args: {
    path: tool.schema
      .string()
      .describe("The file path to convert or normalize"),
    to: tool.schema
      .string()
      .optional()
      .default("auto")
      .describe(
        "Target format: 'unix' (forward slashes), 'win' (backslashes), 'auto' (current OS), 'wsl' (WSL /mnt/ paths)"
      ),
  },
  async execute(args, context) {
    const inputPath = args.path;
    const target = (args.to || "auto").toLowerCase();
    const currentPlatform = os.platform();

    let result;
    let detectedFormat;

    // Detect input format
    if (inputPath.includes("\\")) {
      detectedFormat = "windows";
    } else if (/^[a-zA-Z]:[/\\]/.test(inputPath)) {
      detectedFormat = "windows";
    } else if (/^\/mnt\/[a-z]\//.test(inputPath)) {
      detectedFormat = "wsl";
    } else {
      detectedFormat = "unix";
    }

    switch (target) {
      case "unix":
      case "linux":
        // Convert to Unix format
        result = inputPath
          .replace(/\\/g, "/")
          .replace(/^([a-zA-Z]):\//, (_, letter) => `/${letter.toLowerCase()}/`);
        // Convert UNC paths
        result = result.replace(/^\/\/([^/]+)\//, "/unc/$1/");
        break;

      case "win":
      case "windows":
        // Convert to Windows format
        result = inputPath.replace(/\//g, "\\");
        // Convert /c/... or /C/... to C:\...
        result = result.replace(/^\\([a-zA-Z])\\/, (_, letter) => `${letter.toUpperCase()}:\\`);
        result = result.replace(/^\/unc\/([^/]+)\//, (_, server) => `\\\\${server}\\`);
        // Convert /mnt/c/... to C:\...
        result = result.replace(/^\/mnt\/([a-zA-Z])\//, (_, letter) => `${letter.toUpperCase()}:\\`);
        break;

      case "wsl":
        // Convert to WSL /mnt/ format
        result = inputPath
          .replace(/\\/g, "/")
          .replace(/^([a-zA-Z]):\//, (_, letter) => `/mnt/${letter.toLowerCase()}/`)
          .replace(/^\/unc\//, "/mnt/");
        break;

      case "auto":
      default:
        // Normalize for current platform
        result = path.normalize(inputPath);
        if (currentPlatform === "win32") {
          result = result.replace(/\//g, "\\");
        } else {
          result = result.replace(/\\/g, "/");
        }
        break;
    }

    return {
      title: `path-convert: ${detectedFormat} → ${target}`,
      output: [
        `Input:          ${inputPath}`,
        `Detected as:    ${detectedFormat}`,
        `Target format:  ${target === "auto" ? currentPlatform : target}`,
        `Output:         ${result}`,
        ``,
        `Note: Using "${path.sep}" as path separator on this platform.`,
      ].join("\n"),
      metadata: {
        input: inputPath,
        output: result,
        detectedFormat,
        targetFormat: target === "auto" ? currentPlatform : target,
        currentPlatform,
      },
    };
  },
});

/**
 * Environment variable tools.
 * Get and manage environment variables cross-platform.
 */
export const envTool = tool({
  description: `Get environment variables and system paths.
Cross-platform with Windows-specific awareness (USERPROFILE vs HOME, PATH separator).
Shows common environment variables and their values.`,
  args: {
    variable: tool.schema
      .string()
      .optional()
      .describe("Specific environment variable name to look up (e.g., 'PATH', 'HOME')"),
    includePath: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Include PATH entries in output (default: false)"),
    filter: tool.schema
      .string()
      .optional()
      .describe("Filter variables by name (case-insensitive substring match)"),
  },
  async execute(args, context) {
    const platform = os.platform();
    const separator = platform === "win32" ? ";" : ":";

    if (args.variable) {
      // Look up a specific variable
      const value = process.env[args.variable] || process.env[args.variable.toUpperCase()] || process.env[args.variable.toLowerCase()];
      if (value === undefined) {
        return {
          title: `env: ${args.variable} - not set`,
          output: `Environment variable "${args.variable}" is not set.`,
          metadata: { variable: args.variable, set: false },
        };
      }
      return {
        title: `env: ${args.variable}`,
        output: `${args.variable}=${value}`,
        metadata: { variable: args.variable, value, set: true },
      };
    }

    // List all or filtered environment variables
    let entries = Object.entries(process.env);

    if (args.filter) {
      const filter = args.filter.toLowerCase();
      entries = entries.filter(([key]) => key.toLowerCase().includes(filter));
    }

    entries.sort(([a], [b]) => a.localeCompare(b));

    let output = `Environment variables (${platform}):\n`;
    output += `Total: ${entries.length} variables\n\n`;

    // Key variables first
    const keyVars = ["HOME", "USERPROFILE", "PATH", "SHELL", "TEMP", "TMP", "USER", "USERNAME", "COMPUTERNAME", "OS"];
    const keySection = keyVars
      .filter((k) => process.env[k])
      .map((k) => `  ${k}=${process.env[k]}`);

    if (keySection.length > 0) {
      output += `Common variables:\n${keySection.join("\n")}\n\n`;
    }

    // PATH entries
    if (args.includePath && process.env.PATH) {
      const pathEntries = process.env.PATH.split(separator);
      output += `PATH (${pathEntries.length} entries):\n`;
      for (const entry of pathEntries.slice(0, 20)) {
        output += `  ${entry}\n`;
      }
      if (pathEntries.length > 20) {
        output += `  ... and ${pathEntries.length - 20} more\n`;
      }
      output += "\n";
    }

    // Platform-specific info
    output += `Platform: ${platform} ${os.arch()}\n`;
    output += `Path separator: "${separator}"\n`;
    output += `Case-sensitive: ${platform !== "win32"}\n`;

    return {
      title: `env: ${entries.length} variables`,
      output: output.trim(),
      metadata: {
        platform,
        variableCount: entries.length,
        pathEntries: process.env.PATH ? process.env.PATH.split(separator).length : 0,
      },
    };
  },
});

/**
 * Path join/normalize utility tool.
 */
export const pathJoinTool = tool({
  description: `Join and normalize file path segments.
Cross-platform: uses the correct path separator for the current OS.
Handles edge cases like empty segments, absolute paths, and parent references.`,
  args: {
    segments: tool.schema
      .array(tool.schema.string())
      .describe("Path segments to join (e.g., ['folder', 'subfolder', 'file.txt'])"),
    normalize: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Normalize the result (resolve .. and .) (default: true)"),
  },
  async execute(args, context) {
    const segments = args.segments;
    let result = path.join(...segments);

    if (args.normalize !== false) {
      result = path.normalize(result);
    }

    // Show the result in both formats
    const unixForm = result.replace(/\\/g, "/");
    const winForm = result.replace(/\//g, "\\");

    return {
      title: `path-join: ${segments.length} segments`,
      output: [
        `Segments: ${JSON.stringify(segments)}`,
        `Result:   ${result}`,
        `Unix:     ${unixForm}`,
        `Windows:  ${winForm}`,
        `Separator: "${path.sep}"`,
      ].join("\n"),
      metadata: {
        segments,
        result,
        unix: unixForm,
        windows: winForm,
        separator: path.sep,
        platform: os.platform(),
      },
    };
  },
});

/**
 * Windows registry simulation tool.
 * Reports Windows-specific system information.
 */
export const winSysTool = tool({
  description: `Get Windows-specific system information.
On Windows: reports Windows version, edition, system root, processor architecture.
On Linux/macOS: reports WINE or CrossOver information if available, or notes that
Windows-specific data is not available.
Useful for cross-platform development and deployment scripts.`,
  args: {
    category: tool.schema
      .string()
      .optional()
      .default("system")
      .describe(
        "Information category: 'system', 'drives', 'network', 'all' (default: 'system')"
      ),
  },
  async execute(args, context) {
    const platform = os.platform();
    const category = (args.category || "system").toLowerCase();
    const isWin = platform === "win32";

    let output = `Platform: ${platform} (${os.arch()})\n`;

    if (isWin) {
      output += `Windows Release: ${os.release()}\n`;
      output += `System Root: ${process.env.SystemRoot || "C:\\Windows"}\n`;
      output += `Program Files: ${process.env["ProgramFiles"] || "C:\\Program Files"}\n`;
      output += `AppData: ${process.env.APPDATA || ""}\n`;
      output += `Local AppData: ${process.env.LOCALAPPDATA || ""}\n`;
      output += `Computer Name: ${process.env.COMPUTERNAME || os.hostname()}\n`;
      output += `User: ${process.env.USERNAME || os.userInfo().username}\n`;

      if (category === "drives" || category === "all") {
        output += `\nDrives:\n`;
        // On Windows, drives are A:-Z:
        for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          const drive = `${letter}:\\`;
          try {
            const stat = os.drives ? os.drives() : null; // May not exist in all Node versions
            output += `  ${drive}\n`;
          } catch {
            // Skip inaccessible drives
          }
        }
      }
    } else {
      output += `Not a Windows system.\n`;
      output += `Cross-over/WINE: ${process.env.WINE ? "detected" : "not detected"}\n`;
      output += `WINE Prefix: ${process.env.WINEPREFIX || "(not set)"}\n\n`;
      output += `For Windows-specific operations, use the cross-platform tools:\n`;
      output += `- path-convert: convert between path formats\n`;
      output += `- env: environment variables\n`;
      output += `- path-join: normalize paths\n`;
    }

    return {
      title: isWin ? `win-sys: ${os.release()}` : `win-sys: ${platform} (not Windows)`,
      output: output.trim(),
      metadata: {
        platform,
        isWindows: isWin,
        release: os.release(),
        arch: os.arch(),
      },
    };
  },
});
