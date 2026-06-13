# Bash Tool Routing Framework

## Overview

After consolidating redundant bash tools, there is **one canonical bash tool** and one deprecated compatibility shim.

| Tool | Type | Status | Location |
|------|------|--------|----------|
| `bash` | Plugin | ✅ **Canonical** | `bash-tool.mjs` → `index.mjs` |
| `bash` | MCP Server | ⚠️ **Deprecated** | `bash-mcp.mjs` (delegates to canonical) |

---

## Decision Table

| If you need... | Call this | Notes |
|---|---|---|
| Execute any shell command | `bash` (plugin tool via `bash_bash`) | Works everywhere |
| Custom environment variables | `bash` with `env` param | Plugin tool only |
| Cross-platform (Linux/macOS/Windows) | `bash` (plugin) | Auto-detects platform |
| PowerShell on Windows | `powershell` (plugin) | Separate tool, Windows only |
| MCP protocol bash (legacy) | `bash` (MCP server, now deprecated) | Delegates to same code |

---

## Flow Diagram (text)

```
Agent needs shell execution
            │
            ▼
    ┌───────────────────────┐
    │  Call bash_bash       │ ← Canonical path
    │  (params: command,    │
    │   workdir, timeout,   │
    │   env)                │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │  bash-tool.mjs        │
    │  executeCommand()     │ ← Single implementation
    └───────────┬───────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
  ┌──────────┐   ┌──────────┐
  │ /bin/bash│   │PowerShell│
  │ (Linux/  │   │ (Windows)│
  │  macOS)  │   │          │
  └──────────┘   └──────────┘

Legacy path (deprecated):
  bash MCP server → bash-mcp.mjs → executeCommand() (same code)
```

---

## Migration Guide

### If you were using the MCP bash server:
1. **No action needed** — it still works, but delegates to the plugin tool
2. **Recommended**: update any scripts/agents to call `bash_bash` (the plugin tool) directly
3. The MCP server will be removed entirely in a future update

### If you were using the plugin bash tool:
1. **No action needed** — this is the canonical tool
2. You already have access to all features (`env`, cross-platform, etc.)

---

## Tool Parameters

### Canonical Plugin Bash (`bash_bash`)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | ✅ | — | Shell command to execute |
| `workdir` | string | ❌ | project dir | Working directory |
| `timeout` | number | ❌ | 60000 | Timeout in ms (max 300000) |
| `env` | object | ❌ | — | Custom env vars (key-value) |

### Deprecated MCP Bash (compatibility only)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | ✅ | — | Shell command to execute |
| `workdir` | string | ❌ | cwd | Working directory |
| `timeout` | number | ❌ | 60000 | Timeout in ms (max 300000) |

> Note: MCP version does NOT support the `env` parameter. Use the plugin tool if you need custom env vars.

---

## Verification

To verify the consolidation is working:

```bash
# The canonical tool works
bash_bash command="echo 'hello from canonical bash tool'"

# The MCP shim still works (delegates to same code)
# (via MCP protocol — not directly callable in the same way)
```

## Future

- The MCP bash server (`bash-mcp.mjs`) will be **removed** once all callers migrate to the plugin tool
- After removal, only one `bash` implementation will exist
- New features and bug fixes go into `bash-tool.mjs` only
