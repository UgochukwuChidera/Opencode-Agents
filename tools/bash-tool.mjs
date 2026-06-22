/**
 * Shell Tool — THE unified shell execution tool.
 *
 * Cross-platform: auto-detects OS and uses the appropriate shell.
 * - Linux:   /bin/bash
 * - macOS:   /bin/zsh (fallback /bin/bash)
 * - Windows: pwsh.exe → powershell.exe → cmd.exe (fallback chain)
 *
 * This replaces the old bashTool + powershellTool redundancy.
 * ONE tool. ALL platforms. Auto-detected.
 */
import { tool } from "@opencode-ai/plugin";
import { spawn } from "child_process";
import os from "os";
import fs from "fs";

/**
 * Detect the best available shell for the current platform.
 * Returns { shell, args, shellName } for display.
 */
function getShellConfig() {
  const platform = os.platform();

  if (platform === "win32") {
    // Windows: try pwsh (PowerShell 7+) first, then powershell (5.1), then cmd
    const attempts = [
      { shell: "pwsh.exe",   args: ["-NoProfile", "-Command"], shellName: "pwsh" },
      { shell: "powershell.exe", args: ["-NoProfile", "-Command"], shellName: "powershell" },
      { shell: "cmd.exe",    args: ["/d", "/c"],               shellName: "cmd" },
    ];
    for (const candidate of attempts) {
      try {
        fs.accessSync(candidate.shell);
        return candidate;
      } catch {
        continue;
      }
    }
    // Last resort: let spawn resolve from PATH
    return { shell: "powershell.exe", args: ["-NoProfile", "-Command"], shellName: "powershell" };
  }

  if (platform === "darwin") {
    // macOS: zsh is default since Catalina
    try {
      fs.accessSync("/bin/zsh");
      return { shell: "/bin/zsh", args: ["-c"], shellName: "zsh" };
    } catch {
      return { shell: "/bin/bash", args: ["-c"], shellName: "bash" };
    }
  }

  // Linux: default to bash
  return { shell: "/bin/bash", args: ["-c"], shellName: "bash" };
}

/**
 * Execute a shell command using spawn for reliable cross-shell behavior.
 */
export async function executeCommand(command, options = {}) {
  const { cwd, timeout = 60000, env } = options;
  const { shell, args, shellName } = getShellConfig();
  const platform = os.platform();
  const allArgs = [...args, command];

  // Log which shell is being used (useful for debugging cross-platform issues)
  console.error(`[shell] platform=${platform} shell=${shell} shellName=${shellName}`);

  return new Promise((resolve) => {
    const child = spawn(shell, allArgs, {
      cwd: cwd || process.cwd(),
      timeout,
      env: env ? { ...process.env, ...env } : process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 2000);
    }, timeout);

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          exitCode: -1, stdout, stderr: stderr + "\n[ERROR: Command timed out after " + timeout + "ms]",
          platform, shell, shellName, error: "timed_out",
        });
      } else {
        resolve({
          exitCode: code ?? -1, stdout: stdout || "", stderr: stderr || "",
          platform, shell, shellName,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1, stdout: stdout || "", stderr: err.message,
        platform, shell, shellName, error: err.message,
      });
    });
  });
}

/**
 * Shell execution tool — the ONE shell tool for all platforms.
 *
 * Auto-detects OS and shell:
 *   Linux   → /bin/bash
 *   macOS   → /bin/zsh (fallback /bin/bash)
 *   Windows → pwsh.exe → powershell.exe → cmd.exe (fallback chain)
 *
 * No need for a separate "powershell" tool — this handles everything.
 */
export const bashTool = tool({
  description: `Execute shell commands on the local system.
THE unified shell tool — auto-detects OS and uses the right shell.
  Linux:   /bin/bash
  macOS:   /bin/zsh (fallback bash)
  Windows: pwsh.exe → powershell.exe → cmd.exe (fallback chain)
Returns detected platform + shell name in metadata for cross-platform awareness.
Supports timeout, working directory, and environment variables.`,
  args: {
    command: tool.schema
      .string()
      .describe("The shell command to execute (OS-native syntax — Unix on Linux/macOS, PowerShell or cmd on Windows)"),
    workdir: tool.schema
      .string()
      .optional()
      .describe("Working directory for the command (default: current project directory)"),
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
    if (result.stdout) output += result.stdout;
    if (result.stderr) {
      if (result.stdout) output += "\n--- stderr ---\n";
      output += result.stderr;
    }
    if (!output) output = "(command produced no output)";

    if (output.length > 100000) {
      output = output.slice(0, 100000) + `\n... [truncated ${output.length - 100000} more characters]`;
    }

    return {
      title: `shell: ${args.command.slice(0, 80)}${args.command.length > 80 ? "…" : ""}`,
      output,
      metadata: {
        exitCode: result.exitCode,
        platform: result.platform,
        shell: result.shell,
        shellName: result.shellName,
        commandLength: args.command.length,
      },
    };
  },
});

/**
 * @deprecated The powershellTool has been removed.
 * Use the unified bashTool instead — it auto-detects Windows and uses
 * PowerShell (or cmd) automatically. No separate PowerShell tool needed.
 *
 * If you need to force PowerShell syntax on Windows, just write PowerShell
 * commands — the tool will detect Windows and use pwsh.exe/powershell.exe.
 */
