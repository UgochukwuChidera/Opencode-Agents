/**
 * Bash Tool - Cross-platform shell execution
 *
 * Provides a configurable shell execution tool that works on Linux, macOS, and Windows.
 * Uses Node.js child_process with proper shell detection per platform.
 */
import { tool } from "@opencode-ai/plugin";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

/**
 * Detect the appropriate shell for the current platform.
 */
function detectShell() {
  const platform = os.platform();
  if (platform === "win32") {
    // Use PowerShell if available, fall back to cmd.exe
    return { shell: "powershell.exe", args: ["-NoProfile", "-Command"] };
  }
  const shell = os.userInfo().shell || "/bin/bash";
  return { shell, args: ["-c"] };
}

/**
 * Execute a shell command with timeout and working directory support.
 */
async function executeCommand(command, options = {}) {
  const { cwd, timeout = 60000, env } = options;
  const shellInfo = detectShell();
  const shellCmd = [...shellInfo.args, command].join(" ");

  try {
    const { stdout, stderr } = await execAsync(shellCmd, {
      cwd: cwd || process.cwd(),
      timeout: timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: env ? { ...process.env, ...env } : process.env,
      shell: shellInfo.shell,
      windowsHide: true,
    });

    return {
      exitCode: 0,
      stdout: stdout || "",
      stderr: stderr || "",
      platform: os.platform(),
      shell: shellInfo.shell,
    };
  } catch (error) {
    return {
      exitCode: error.code || error.status || -1,
      stdout: error.stdout || "",
      stderr: error.stderr || error.message || "",
      platform: os.platform(),
      shell: shellInfo.shell,
      error: error.message,
    };
  }
}

/**
 * Bash execution tool.
 * Allows running shell commands with cross-platform support.
 */
export const bashTool = tool({
  description: `Execute shell commands on the local system.
Cross-platform (Linux, macOS, Windows) with automatic shell detection.
Use for running scripts, build commands, file operations, and system tasks.
Supports timeout, working directory, environment variables, and PowerShell on Windows.`,
  args: {
    command: tool.schema
      .string()
      .describe("The shell command to execute. For Windows, PowerShell syntax is used."),
    workdir: tool.schema
      .string()
      .optional()
      .describe(
        "Working directory for the command (default: current project directory)"
      ),
    timeout: tool.schema
      .number()
      .optional()
      .default(60000)
      .describe("Timeout in milliseconds (default: 60000, max: 300000)"),
    env: tool.schema
      .record(tool.schema.string(), tool.schema.string())
      .optional()
      .describe("Optional environment variables to set for this command"),
  },
  async execute(args, context) {
    const maxTimeout = Math.min(args.timeout ?? 60000, 300000);

    const result = await executeCommand(args.command, {
      cwd: args.workdir || context.directory,
      timeout: maxTimeout,
      env: args.env,
    });

    let output = "";
    if (result.exitCode !== 0) {
      output += `[Exit code: ${result.exitCode}]\n`;
    }
    if (result.stdout) {
      output += result.stdout;
    }
    if (result.stderr) {
      if (result.stdout) output += "\n--- stderr ---\n";
      output += result.stderr;
    }
    if (!output) {
      output = "(command produced no output)";
    }

    // Truncate very long output
    if (output.length > 100000) {
      output = output.slice(0, 100000) + `\n... [truncated ${output.length - 100000} more characters]`;
    }

    return {
      title: `bash: ${args.command.slice(0, 80)}${args.command.length > 80 ? "…" : ""}`,
      output,
      metadata: {
        exitCode: result.exitCode,
        platform: result.platform,
        shell: result.shell,
        commandLength: args.command.length,
      },
    };
  },
});

/**
 * PowerShell-specific tool (Windows).
 * Only available on Windows; falls back to descriptive error on other platforms.
 */
export const powershellTool = tool({
  description: `Execute PowerShell commands on Windows.
Only available on Windows. On Linux/macOS, returns a descriptive error.
Use for Windows-specific scripting, registry access, and WMI queries.`,
  args: {
    command: tool.schema.string().describe("The PowerShell command to execute"),
    workdir: tool.schema
      .string()
      .optional()
      .describe("Working directory for the command"),
    timeout: tool.schema
      .number()
      .optional()
      .default(60000)
      .describe("Timeout in milliseconds"),
  },
  async execute(args, context) {
    if (os.platform() !== "win32") {
      return {
        title: "powershell: unavailable",
        output:
          "PowerShell tool is only available on Windows. Current platform: " +
          os.platform(),
        metadata: { available: false, platform: os.platform() },
      };
    }

    const cwd = args.workdir || context.directory;
    const timeout = Math.min(args.timeout ?? 60000, 300000);

    try {
      const { stdout, stderr } = await execAsync(args.command, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: "powershell.exe",
        windowsHide: true,
      });

      const output = (stdout || "") + (stderr ? `\n--- stderr ---\n${stderr}` : "");
      return {
        title: `powershell: ${args.command.slice(0, 80)}`,
        output: output || "(no output)",
        metadata: { exitCode: 0, platform: "win32" },
      };
    } catch (error) {
      return {
        title: `powershell: ${args.command.slice(0, 80)}`,
        output: error.stderr || error.message || "Command failed",
        metadata: {
          exitCode: error.code || error.status || -1,
          platform: "win32",
          error: error.message,
        },
      };
    }
  },
});
