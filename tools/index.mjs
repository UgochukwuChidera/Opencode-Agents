/**
 * Opencode Tools Plugin
 *
 * Aggregates all custom tools into a single opencode plugin.
 * Register this plugin in opencode.jsonc:
 *
 *   {
 *     "plugin": ["./tools/index.mjs"]
 *   }
 *
 * File path is relative to ~/.config/opencode/opencode.jsonc.
 * If you symlinked tools/ to ~/.config/opencode/tools/, use "./tools/index.mjs".
 *
 * Each tool file exports its tool definition(s), which are collected here
 * and exposed to all opencode agents.
 *
 * To add your own custom tools:
 * 1. Create a new file in tools/ (e.g., my-custom-tool.mjs)
 * 2. Define your tool using the tool() function from @opencode-ai/plugin
 * 3. Import and add it to the `toolDefinitions` object below
 */
import { tool } from "@opencode-ai/plugin";

// Bash / shell execution
import { bashTool, powershellTool } from "./bash-tool.mjs";

// Web tools
import { webSearchTool } from "./web-search.mjs";
import { webFetchTool } from "./web-fetch.mjs";

// System information
import { systemInfoTool, platformTool } from "./system-info.mjs";

// File operations
import { fileListTool, fileSearchTool } from "./file-tools.mjs";

// Text processing
import {
  hashTool,
  uuidTool,
  base64Tool,
  caseConvertTool,
  textStatsTool,
} from "./text-tools.mjs";

// Network tools
import { dnsTool, portCheckTool, httpCheckTool } from "./net-tools.mjs";

// Windows / cross-platform tools
import {
  pathConvertTool,
  envTool,
  pathJoinTool,
  winSysTool,
} from "./windows-tools.mjs";

// ─── Custom user tools ──────────────────────────────────────────────
// Import and add your custom tools here:
// import { myTool } from "./custom-tools.mjs";

/**
 * Collect all tool definitions here.
 * Each key becomes the tool name visible to agents.
 */
const toolDefinitions = {
  // Shell execution
  bash: bashTool,
  powershell: powershellTool,

  // Web and search
  "web-search": webSearchTool,
  "web-fetch": webFetchTool,

  // System
  "system-info": systemInfoTool,
  platform: platformTool,

  // Files
  "file-list": fileListTool,
  "file-search": fileSearchTool,

  // Text utilities
  hash: hashTool,
  uuid: uuidTool,
  base64: base64Tool,
  "case-convert": caseConvertTool,
  "text-stats": textStatsTool,

  // Network
  dns: dnsTool,
  "port-check": portCheckTool,
  "http-check": httpCheckTool,

  // Cross-platform helpers
  "path-convert": pathConvertTool,
  env: envTool,
  "path-join": pathJoinTool,
  "win-sys": winSysTool,

  // ─── Add your custom tools here ──────────────────────────────────
  // mytool: myTool,
};

/**
 * Opencode Plugin Server
 *
 * This is the main plugin function. It receives PluginInput (context)
 * and optional user-provided options from opencode.jsonc.
 * It returns Hooks containing the tool definitions.
 */
const server = async (ctx, options) => {
  // `ctx` provides:
  //   ctx.$        - BunShell for running commands
  //   ctx.client   - Opencode API client
  //   ctx.project  - Current project info
  //   ctx.directory - Project directory
  //   ctx.worktree - Worktree root
  //   ctx.serverUrl - Server URL
  //
  // `options` contains user configuration from opencode.jsonc:
  //   e.g., ["path/to/plugin.mjs", { "option1": "value" }]

  return {
    // Register all tools
    tool: toolDefinitions,

    // Example: intercept tool execution for logging
    // "tool.execute.after": async (input, output) => {
    //   console.log(`[opencode-tools] Tool executed: ${input.tool}`);
    // },
  };
};

// Plugin identifier (required by opencode plugin loader)
export const id = "opencode-tools";

// Export as a PluginModule-compatible shape
// This allows both: `import { server } from "..."` and default import
export { server };
export default { id: "opencode-tools", server };
