# Opencode Agents, Tools & Skills

Custom agent definitions, tool plugins, and skill instructions for [opencode](https://opencode.ai/), synchronized across Linux and Windows via symlinks/junctions.

## Structure

```
Opencode-Agents/
├── agents/         # 14 agent personality definitions (markdown)
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
│   └── bash-mcp.mjs       # Bash MCP server for isolated shell execution
├── skills/         # Skill instructions auto-loaded by opencode
│   ├── react-patterns/SKILL.md      # React component & hooks patterns
│   ├── error-handling/SKILL.md      # Error handling across languages
│   ├── api-design/SKILL.md          # REST & GraphQL API design
│   ├── testing-strategy/SKILL.md    # Test pyramid, mocking, coverage
│   └── security-review/SKILL.md     # OWASP, auth, secrets, vulns
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
| **git-wrangler** | `subagent` | Handles full git workflows — stash, pull, branch, merge, rebase, resolve conflicts, push |
| **dependency-auditor** | `subagent` | Audits dependencies for updates and vulnerabilities |

## Skills

Skills are specialized Markdown instruction files that get loaded into the LLM's context when a task matches their trigger keywords. They provide deep, structured guidance on specific domains.

Each skill auto-registers with opencode via its `name` and `description` frontmatter. When a relevant task appears, the model loads the skill automatically — no manual invocation needed.

| Skill | Description | Complements |
|-------|-------------|-------------|
| **react-patterns** | React component composition, hooks patterns, state management (Context vs Redux vs Zustand), performance optimization (memoization), custom hooks, compound components, error boundaries, a11y | `creator`, `executor` |
| **error-handling** | Go/Rust/TS/Python error patterns, structured logging, user-facing vs internal errors, retry strategies (exponential backoff, circuit breaker), panic recovery, database error handling | `debugger`, `historian` |
| **api-design** | RESTful URL conventions, HTTP methods & status codes, request/response shapes, pagination strategies (cursor vs offset), idempotency, rate limiting, auth patterns, GraphQL schema design, OpenAPI docs | `soul`, `oracle`, `design` |
| **testing-strategy** | Test pyramid ratios, what to test vs skip, file placement & naming, AAA pattern, mocking rules, coverage targets, flaky test management, property-based testing, CI integration | `test-writer`, `reviewer` |
| **security-review** | OWASP Top 10 quick reference, web app security checklist (auth, authorization, input validation, output encoding, headers), API security (CORS, rate limiting), dependency scanning, secure defaults, code review questions | `reviewer`, `historian` |

> Skills are auto-discovered at startup — no config changes needed. Just restart opencode after adding new ones.

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
`%USERPROFILE%\.config\opencode\opencode.jsonc` (Windows):

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
  - On Windows: directory junction to `%USERPROFILE%\.config\opencode\agents\`

- **`tools/`** folder contains plugin modules that register additional tools.
  - On Linux: symlinked to `~/.config/opencode/tools/`
  - On Windows: directory junction to `%USERPROFILE%\.config\opencode\tools\`
  - Registered via `plugin` field in `opencode.jsonc`

- **`skills/`** folder contains skill instruction files that are auto-discovered.
  - On Linux: symlinked to `~/.config/opencode/skills/`
  - On Windows: directory junction to `%USERPROFILE%\.config\opencode\skills\`
  - Auto-discovered on startup — no config entry needed

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

## Creating Custom Skills

Skills follow a simple Markdown format. To add your own skill:

1. Create a new folder in `skills/` (name must match the skill name)
2. Create a `SKILL.md` file inside it with frontmatter
3. Restart opencode — the skill is auto-discovered

```markdown
---
name: my-skill
description: Use when the user asks about X or mentions Y. Provides step-by-step guidance for doing Z.
---

# My Skill

Detailed instructions, examples, code snippets, and conventions here.
```

Rules:
- `name` is required, lowercase hyphen-separated, and must match the folder name
- `description` is required — front-load trigger keywords so the model loads it at the right time
- The file **must** be named `SKILL.md` exactly
- No config registration needed — opencode scans `skills/` recursively at startup

## Sync Workflow

```bash
# After editing an agent, tool, or skill
cd ~/code/Opencode-Agents
git add agents/<name>.md tools/<name>.mjs skills/<name>/SKILL.md
git commit -m "Update <name>"
git push

# On the other machine
cd ~/code/Opencode-Agents
git pull
```
