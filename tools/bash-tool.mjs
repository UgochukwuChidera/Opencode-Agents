/**
 * Bash Tool - Cross-platform shell execution
 *
 * Executes shell commands using a proper subprocess with cross-platform support.
 * On Linux/macOS defaults to /bin/bash. On Windows uses PowerShell.
 */
import { tool } from "@opencode-ai/plugin";
import { spawn } from "child_process";
import os from "os";

/**
 * Get the shell and its arguments for the current platform.
 */
function getShellConfig() {
  const platform = os.platform();
  if (platform === "win32") {
    return {
      shell: "powershell.exe",
      args: ["-NoProfile", "-Command"],
    };
  }
  // Use /bin/bash explicitly — the tool is called "bash"
  return {
    shell: "/bin/bash",
    args: ["-c"],
  };
}

/**
 * Execute a shell command using spawn for reliable cross-shell behavior.
 * This avoids the double -c bug that exec() has when combining shell option
 * with manually constructed command strings.
 */
export async function executeCommand(command, options = {}) {
  const { cwd, timeout = 60000, env } = options;
  const { shell, args } = getShellConfig();

  // Build the full args: shell args + command
  const allArgs = [...args, command];

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
      // Give it a moment, then SIGKILL
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 2000);
    }, timeout);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + "\n[ERROR: Command timed out after " + timeout + "ms]",
          platform: os.platform(),
          shell,
          error: "timed_out",
        });
      } else {
        resolve({
          exitCode: code ?? -1,
          stdout: stdout || "",
          stderr: stderr || "",
          platform: os.platform(),
          shell,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: stdout || "",
        stderr: stderr || err.message,
        platform: os.platform(),
        shell,
        error: err.message,
      });
    });
  });
}

/**
 * Bash execution tool.
 * Allows running shell commands with cross-platform support.
 */
export const bashTool = tool({
  description: `Execute shell commands on the local system.
Cross-platform (Linux, macOS, Windows). Defaults to /bin/bash on Unix, PowerShell on Windows.
Use for running scripts, build commands, file operations, and system tasks.
Supports timeout, working directory, and environment variables.`,
  args: {
    command: tool.schema
      .string()
      .describe("The shell command to execute."),
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
 * This is a simpler alternative to the bash tool for Windows-specific tasks.
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

    return new Promise((resolve) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-Command", args.command], {
        cwd,
        timeout,
        env: { ...process.env },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => { stdout += data.toString(); });
      child.stderr.on("data", (data) => { stderr += data.toString(); });

      child.on("close", (code) => {
        const output = (stdout || "") + (stderr ? `\n--- stderr ---\n${stderr}` : "");
        resolve({
          title: `powershell: ${args.command.slice(0, 80)}`,
          output: output || "(no output)",
          metadata: { exitCode: code ?? -1, platform: "win32" },
        });
      });

      child.on("error", (err) => {
        resolve({
          title: `powershell: ${args.command.slice(0, 80)}`,
          output: err.message || "Command failed",
          metadata: { exitCode: -1, platform: "win32", error: err.message },
        });
      });
    });
  },
});
