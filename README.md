# Opencode Agents & Tools

Custom agent definitions and tools for [opencode](https://opencode.ai/), synchronized across Linux and Windows via symlinks/junctions.

## Structure

```
Opencode-Agents/
├── agents/         # 13 agent personality definitions (markdown)
├── tools/          # Custom tool plugins (ESM modules)
│   ├── index.mjs   # Main plugin aggregator (register this in opencode.jsonc)
│   ├── bash-tool.mjs      # Cross-platform shell execution
│   ├── web-search.mjs     # Web search via DuckDuckGo (no API key)
│   ├── web-fetch.mjs      # URL content fetcher
│   ├── system-info.mjs    # OS, CPU, memory, environment info
│   ├── file-tools.mjs     # File listing and search
│   ├── text-tools.mjs     # Hash, UUID, Base64, case conversion, text stats
│   ├── net-tools.mjs      # DNS lookup, port check, HTTP health check
│   ├── windows-tools.mjs  # Path conversion, env vars, Windows info
│   ├── custom-tools.mjs   # Template for your own tools
│   └── ...
├── setup.sh        # Linux/macOS setup script
├── setup.bat       # Windows setup script
└── README.md       # This file
```

## Agents

| Agent | Mode | Description |
|-------|------|-------------|
| **orchestrator** | `all` | Breaks down complex tasks and delegates to specialist sub-agents in parallel |
| **design** | `all` | Dynamic orchestrator of soul, creator, and historian agents |
| **oracle** | `all` | Deep codebase understanding for large-scale architectural analysis |
| **soul** | `subagent` | Synthesizes project essence — architecture, conventions, domain model |
| **creator** | `subagent` | Creative implementor — fuses ideas into elegant code |
| **executor** | `subagent` | Implements code changes from specs |
| **explorer** | `subagent` | Read-only codebase research |
| **historian** | `subagent` | Critical quality guardian — catches errors, over-engineering, security holes |
| **reviewer** | `subagent` | Reviews code for bugs, security, and best practices |
| **debugger** | `subagent` | Investigates runtime errors and test failures |
| **test-writer** | `subagent` | Writes tests covering edge cases and regressions |
| **commit-crafter** | `subagent` | Stages files and writes conventional commits |
| **dependency-auditor** | `subagent` | Audits dependencies for updates and vulnerabilities |

## Tools

Custom tools registered via the `@opencode-ai/plugin` SDK. Available to all agents after installing the plugin.

| Tool | Description | Cross-Platform |
|------|-------------|:---:|
| **bash** | Execute shell commands with auto-detected shell | ✅ |
| **powershell** | PowerShell execution (Windows only) | ✅ |
| **web-search** | Search the web via DuckDuckGo (no API key) | ✅ |
| **web-fetch** | Fetch content from URLs (GET, POST, etc.) | ✅ |
| **system-info** | OS, CPU, memory, uptime, environment | ✅ |
| **platform** | Quick platform detection | ✅ |
| **file-list** | List files with sizes, dates, recursive | ✅ |
| **file-search** | Find files by name pattern | ✅ |
| **hash** | Generate hashes (MD5, SHA1, SHA256, SHA512, etc.) | ✅ |
| **uuid** | Generate UUID v4 and v7 | ✅ |
| **base64** | Encode/decode Base64 data | ✅ |
| **case-convert** | Convert between string cases | ✅ |
| **text-stats** | Count chars, words, lines, sentences | ✅ |
| **dns** | DNS lookups (A, AAAA, MX, TXT, NS, CNAME, ANY) | ✅ |
| **port-check** | Test TCP port connectivity | ✅ |
| **http-check** | Check HTTP/HTTPS endpoint status | ✅ |
| **path-convert** | Convert paths between Win/Unix/WSL formats | ✅ |
| **env** | Get environment variables | ✅ |
| **path-join** | Join and normalize path segments | ✅ |
| **win-sys** | Windows-specific system info | ✅ |

## Setup

### Linux / macOS

```bash
git clone https://github.com/UgochukwuChidera/Opencode-Agents.git ~/code/Opencode-Agents
chmod +x ~/code/Opencode-Agents/setup.sh
~/code/Opencode-Agents/setup.sh
```

### Windows

```powershell
git clone https://github.com/UgochukwuChidera/Opencode-Agents.git $HOME\code\Opencode-Agents
.\setup.bat
```

### Manual Plugin Registration

After running setup, add this to `~/.config/opencode/opencode.jsonc` (Linux/macOS) or
`%LOCALAPPDATA%\opencode\opencode.jsonc` (Windows):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./tools/index.mjs"]
}
```

Restart opencode to load the tools. Verify with `opencode --version` and check that tools
appear in the LLM context.

## How It Works

- **`agents/`** folder is the single source of truth for agent definitions.
  - On Linux: symlinked to `~/.config/opencode/agents/`
  - On Windows: directory junction to `%LOCALAPPDATA%\opencode\agents\`

- **`tools/`** folder contains plugin modules that register additional tools.
  - On Linux: symlinked to `~/.config/opencode/tools/`
  - On Windows: directory junction to `%LOCALAPPDATA%\opencode\tools\`
  - Registered via `plugin` field in `opencode.jsonc`

Edit files here, commit, push, and pull on other machines — opencode sees changes instantly.

## Creating Custom Tools

See `tools/custom-tools.mjs` for a template. To add your own tool:

1. Create a new `.mjs` file in `tools/`
2. Define your tool using the `tool()` function from `@opencode-ai/plugin`
3. Import and register it in `tools/index.mjs`
4. Restart opencode

```javascript
// tools/my-tool.mjs
import { tool } from "@opencode-ai/plugin";

export const myTool = tool({
  description: "What my tool does",
  args: {
    input: tool.schema.string().describe("Input parameter"),
  },
  async execute(args, context) {
    return "Hello " + args.input;
  },
});
```

```javascript
// In tools/index.mjs
import { myTool } from "./my-tool.mjs";

const toolDefinitions = {
  // ... existing tools ...
  "my-tool": myTool,
};
```

## Sync Workflow

```bash
# After editing an agent or tool
cd ~/code/Opencode-Agents
git add agents/<name>.md tools/<name>.mjs
git commit -m "Update <name>"
git push

# On the other machine
cd ~/code/Opencode-Agents
git pull
```
