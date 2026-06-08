/**
 * System Info Tools - Cross-platform system information
 *
 * Provides tools to get operating system, hardware, and environment information.
 * Works on Linux, macOS, and Windows.
 */
import { tool } from "@opencode-ai/plugin";
import os from "os";

/**
 * Get comprehensive system information.
 */
function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();

  return {
    platform: {
      name: os.platform(),
      arch: os.arch(),
      release: os.release(),
      type: os.type(),
      hostname: os.hostname(),
      user: os.userInfo().username,
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
    },
    cpu: {
      model: cpus[0]?.model || "Unknown",
      cores: cpus.length,
      speed: cpus[0]?.speed || 0,
      loadAverage: {
        "1min": loadAvg[0]?.toFixed(2),
        "5min": loadAvg[1]?.toFixed(2),
        "15min": loadAvg[2]?.toFixed(2),
      },
    },
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(totalMem - freeMem),
      usagePercent: (((totalMem - freeMem) / totalMem) * 100).toFixed(1) + "%",
    },
    uptime: formatUptime(os.uptime()),
    node: process.version,
    shell: os.userInfo().shell || (os.platform() === "win32" ? "cmd.exe" : "/bin/sh"),
    eol: os.EOL === "\n" ? "LF" : "CRLF",
    endianness: os.endianness(),
  };
}

/**
 * Get current working directory and project info.
 */
function getEnvInfo() {
  return {
    cwd: process.cwd(),
    pid: process.pid,
    nodeVersion: process.version,
    execPath: process.execPath,
    env: {
      PATH: (process.env.PATH || "").split(os.platform() === "win32" ? ";" : ":"),
      HOME: process.env.HOME || process.env.USERPROFILE || "",
      SHELL: process.env.SHELL || "",
      TEMP: process.env.TEMP || process.env.TMP || "",
    },
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

/**
 * System information tool.
 * Returns comprehensive OS, CPU, memory, and environment details.
 */
export const systemInfoTool = tool({
  description: `Get comprehensive system information: OS type, architecture, CPU cores and model,
memory usage, uptime, Node.js version, shell, and environment details.
Cross-platform: works on Linux, macOS, and Windows.`,
  args: {
    detailed: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Include detailed environment info (PATH, env vars)"),
    section: tool.schema
      .string()
      .optional()
      .describe(
        "Specific section to return: 'platform', 'cpu', 'memory', 'env', or 'all' (default: 'all')"
      ),
  },
  async execute(args, context) {
    const info = getSystemInfo();

    let output = "";
    const section = (args.section || "all").toLowerCase();

    if (section === "all" || section === "platform") {
      output += `## Platform\n`;
      output += `OS: ${info.platform.type} ${info.platform.release}\n`;
      output += `Platform: ${info.platform.name} (${info.platform.arch})\n`;
      output += `Hostname: ${info.platform.hostname}\n`;
      output += `User: ${info.platform.user}\n`;
      output += `Home: ${info.platform.homedir}\n`;
      output += `Temp: ${info.platform.tmpdir}\n`;
      output += `Line endings: ${info.eol}\n`;
      output += `Node.js: ${info.node}\n\n`;
    }

    if (section === "all" || section === "cpu") {
      output += `## CPU\n`;
      output += `Model: ${info.cpu.model}\n`;
      output += `Cores: ${info.cpu.cores}\n`;
      output += `Speed: ${info.cpu.speed} MHz\n`;
      output += `Load Average: 1min=${info.cpu.loadAverage["1min"]} 5min=${info.cpu.loadAverage["5min"]} 15min=${info.cpu.loadAverage["15min"]}\n\n`;
    }

    if (section === "all" || section === "memory") {
      output += `## Memory\n`;
      output += `Total: ${info.memory.total}\n`;
      output += `Used: ${info.memory.used} (${info.memory.usagePercent})\n`;
      output += `Free: ${info.memory.free}\n\n`;
    }

    if (section === "all") {
      output += `## Uptime\n${info.uptime}\n\n`;
    }

    if (args.detailed && (section === "all" || section === "env")) {
      const env = getEnvInfo();
      output += `## Environment\n`;
      output += `CWD: ${env.cwd}\n`;
      output += `Shell: ${info.shell}\n`;
      output += `Node: ${env.nodeVersion}\n`;
      output += `PATH entries:\n`;
      for (const p of env.env.PATH.slice(0, 10)) {
        output += `  - ${p}\n`;
      }
      if (env.env.PATH.length > 10) {
        output += `  ... and ${env.env.PATH.length - 10} more\n`;
      }
    }

    return {
      title: `system-info: ${info.platform.name} (${info.platform.arch})`,
      output: output.trim(),
      metadata: {
        platform: info.platform.name,
        arch: info.platform.arch,
        release: info.platform.release,
        cpuCores: info.cpu.cores,
        memoryTotal: info.memory.total,
        nodeVersion: info.node,
      },
    };
  },
});

/**
 * Platform detection tool.
 * Quickly determines what platform we're running on.
 */
export const platformTool = tool({
  description: `Quickly detect the current platform and available tools.
Returns OS type, architecture, shell, and cross-platform compatibility info.
Useful for determining path separators, line endings, and available commands.`,
  args: {},
  async execute(args, context) {
    const platform = os.platform();
    const arch = os.arch();

    let compat = {
      pathSeparator: platform === "win32" ? "\\" : "/",
      lineEnding: platform === "win32" ? "CRLF (\\r\\n)" : "LF (\\n)",
      isWindows: platform === "win32",
      isMac: platform === "darwin",
      isLinux: platform === "linux",
      defaultShell: platform === "win32" ? "powershell.exe" : os.userInfo().shell || "/bin/bash",
      nodeVersion: process.version,
    };

    return {
      title: `platform: ${platform} (${arch})`,
      output: [
        `Platform: ${platform}`,
        `Architecture: ${arch}`,
        `Path separator: "${compat.pathSeparator}"`,
        `Line ending: ${compat.lineEnding}`,
        `Default shell: ${compat.defaultShell}`,
        `Node.js: ${compat.nodeVersion}`,
        `Home: ${os.homedir()}`,
        `Temporary: ${os.tmpdir()}`,
      ].join("\n"),
      metadata: compat,
    };
  },
});
