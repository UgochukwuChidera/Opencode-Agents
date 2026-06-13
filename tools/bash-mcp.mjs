#!/usr/bin/env node

/**
 * @deprecated MCP Bash Server
 *
 * ⚠️  DEPRECATED — This MCP bash server is now a thin wrapper around
 *     the canonical plugin bash tool at ./bash-tool.mjs.
 *
 *     All agents should use the `bash` tool provided by the plugin
 *     (registered via index.mjs → bashTool) instead of calling this
 *     MCP server directly.
 *
 *     The plugin bash tool supports:
 *       - Cross-platform (Linux/macOS/Windows)
 *       - `env` parameter for custom environment variables
 *       - Better error handling and metadata
 *       - Same timeout (configurable, max 300s)
 *       - Output truncation at 100KB
 *
 *     Why consolidate:
 *       - Two `bash` tools caused confusion (which one to call?)
 *       - MCP version lacked `env` support and cross-platform fallback
 *       - Single implementation means less code to maintain
 *       - Plugin architecture is the canonical extension mechanism
 *
 *     To use the canonical bash tool, agents just call:
 *       bash_bash with params: command, workdir, timeout, env
 *
 * This file is kept as a compatibility shim for anything still
 * calling the MCP endpoint. It will be removed in a future update.
 */

import { executeCommand } from "./bash-tool.mjs";

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  processMessages();
});

function processMessages() {
  const parts = buffer.split("\n");
  while (parts.length > 1) {
    const line = parts.shift();
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        handleMessage(msg);
      } catch (e) {
        // Skip malformed messages
      }
    }
  }
  buffer = parts[0];
}

function sendMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handleMessage(msg) {
  const id = msg.id;

  switch (msg.method) {
    case "initialize":
      sendMessage({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: { name: "bash-mcp", version: "2.0.0" }
        }
      });
      break;

    case "tools/list":
      sendMessage({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "bash",
              description: "[DEPRECATED — use plugin bash tool instead] Execute shell commands. Uses /bin/bash on Linux/macOS.",
              inputSchema: {
                type: "object",
                properties: {
                  command: {
                    type: "string",
                    description: "The shell command to execute"
                  },
                  workdir: {
                    type: "string",
                    description: "Working directory (optional)"
                  },
                  timeout: {
                    type: "number",
                    description: "Timeout in milliseconds (default: 60000)"
                  }
                },
                required: ["command"]
              }
            }
          ]
        }
      });
      break;

    case "tools/call":
      const toolName = msg.params.name;
      const args = msg.params.arguments || {};

      if (toolName !== "bash") {
        sendMessage({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` }
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════
      //  Delegate to the canonical bash-tool implementation
      // ═══════════════════════════════════════════════════════════

      try {
        const result = await executeCommand(args.command, {
          cwd: args.workdir,
          timeout: args.timeout,
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
          output = "(no output)";
        }

        if (output.length > 100000) {
          output = output.slice(0, 100000) + `\n... [truncated]`;
        }

        sendMessage({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              { type: "text", text: output }
            ],
            isError: result.exitCode !== 0
          }
        });
      } catch (err) {
        sendMessage({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true
          }
        });
      }
      break;

    case "notifications/initialized":
      break;

    default:
      if (id !== undefined) {
        sendMessage({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown method: ${msg.method}` }
        });
      }
  }
}
