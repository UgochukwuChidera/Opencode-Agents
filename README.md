# Opencode Agents, Tools & Skills

Custom agent definitions, tool plugins, and skill instructions for [opencode](https://opencode.ai/), synchronized across Linux and Windows via symlinks/junctions.

## Structure

```
Opencode-Agents/
├── agents/         # 33 agent personality definitions (markdown)
├── tools/          # Custom tool plugins (ESM modules)
│   ├── index.mjs           # Main plugin aggregator (register this in opencode.jsonc)
│   ├── bash-tool.mjs       # Cross-platform shell execution
│   ├── web-search.mjs      # Web search via DuckDuckGo (no API key)
│   ├── web-fetch.mjs       # URL content fetcher
│   ├── system-info.mjs     # OS, CPU, memory, environment info
│   ├── file-tools.mjs      # File listing and search
│   ├── text-tools.mjs      # 24 text tools (hash, uuid, regex, sort, compress...)
│   ├── net-tools.mjs       # 11 network tools (dns, ping, ssl, whois...)
│   ├── format-tools.mjs    # 15 format tools (json, yaml, xml, csv, diff...)
│   ├── encode-tools.mjs    # 14 encode tools (base58, hex, jwt, pem...)
│   ├── crypto-web-tools.mjs # 6 crypto/web tools (jwt, semver, url...)
│   ├── media-tools.mjs     # 7 media tools (image, geo, qr, color...)
│   ├── date-tools.mjs      # 9 date tools (date, cron, clock...)
│   ├── math-tools.mjs      # 7 math tools (math, roman, dice...)
│   ├── windows-tools.mjs   # Path conversion, env vars, Windows info
│   ├── ai-detector.mjs     # AI-generated text detection
│   ├── ai-senior.mjs       # Senior AI detection aggregator
│   ├── plan-executor.mjs   # Meta-Architect plan queue extraction
│   ├── custom-tools.mjs    # Template for your own tools
│   └── bash-mcp.mjs        # Bash MCP server (deprecated)
├── skills/         # Skill instructions auto-loaded by opencode
│   ├── react-patterns/SKILL.md
│   ├── error-handling/SKILL.md
│   ├── api-design/SKILL.md
│   ├── testing-strategy/SKILL.md
│   ├── security-review/SKILL.md
│   ├── design-system-implementation/SKILL.md
│   ├── meta-architect-patterns/SKILL.md
│   ├── segmented-prompt-execution/SKILL.md
│   ├── pre-flight-protocol/SKILL.md         # ← NEW
│   ├── database-data-layer/SKILL.md         # ← NEW
│   ├── authentication-authorization/SKILL.md # ← NEW
│   └── deployment-devops/SKILL.md           # ← NEW
├── .spec/          # Spec-First state management (tracking + concurrency)
│   ├── schema.json           # Canonical schema v2.0 — session, cleanup, lifecycle
│   ├── current.json          # Canonical read-only context — only coordinator writes
│   ├── agents/               # Per-agent output files (parallel-safe writes, gitignored)
│   └── history/              # Archived session records after cleanup (gitignored)
├── LICENSE          # GNU General Public License v3.0
├── .gitignore       # Excludes spec stubs, caches, build artifacts
├── setup.sh        # Linux/macOS setup script
├── setup.bat       # Windows setup script
└── README.md       # This file
```

## Agents

Every agent follows the **Spec-First** pattern: READ `.spec/current.json` before ANY action, then CLASSIFY work vs delegation via the **Pre-Flight Protocol**. All 33 agents have mandatory pre-flight checks and a "My Job vs Not My Job" table baked in.

| Agent | Mode | Description |
|-------|------|-------------|
| **meta-architect-orchestrator** | `all` | Entry point for ALL developer requests — classifies task and delegates. NEVER writes code, runs commands, or touches git. Has the ABSOLUTE RULE. |
| **orchestrator** | `all` | Breaks down complex tasks, delegates to specialist sub-agents in parallel, merges agent files, tracks via `.spec/current.json`. Pre-flight + routing table baked in. |
| **meta-architect-planner** | `subagent` | Runs the 6-stage Meta-Architect planning pipeline — accumulates compact decision records in-memory, dispatches stage agents, writes plan.json |
| **meta-architect-executor** | `subagent` | Executes a Meta-Architect build plan — extracts prompt queue, dispatches prompt-executor for each, runs evaluators, merges agent files, calls debugger on failure |
| **design** | `all` | Dynamic orchestrator — ascertains details, synthesizes context via soul/oracle, produces design spec, dispatches to creator/executor, reviews via historian. Pre-flight + git delegation baked in. |
| **oracle** | `all` | Deep codebase understanding for large-scale architectural analysis — dispatches parallel explore sub-agents. Writes analysis to agent file. |
| **architect** | `subagent` | Turns analysis into actionable architecture plans — bridges oracle → structured plan → execution |
| **soul** | `subagent` | Synthesizes project essence — architecture, conventions, domain model. Fast, focused synthesis. |
| **creator** | `subagent` | Creative implementor — fuses ideas into elegant code. Writes agent file, delegates git to commit-crafter. Pre-flight + git delegation baked in. |
| **executor** | `subagent` | Implements code changes from specs — fast, clean, pattern-aware. Writes agent file, delegates git to commit-crafter. Pre-flight + git delegation baked in. |
| **prompt-executor** | `subagent` | Executes a single prompt from a Meta-Architect build plan — runs commands, creates files, retries up to 5 times. Writes per-prompt agent file. |
| **explorer** | `subagent` | Read-only codebase research — searches code, finds patterns, maps structure. Fast, parallel dispatch. |
| **explore** | `subagent` | Fast agent specialized for exploring codebases — quickly finds files by patterns, searches code for keywords |
| **historian** | `subagent` | Critical quality guardian — catches errors, over-engineering, security holes. Reviews code, runs tests, updates spec with findings. Writes to agent file. |
| **reviewer** | `subagent` | Reviews code for bugs, security, and best practices — thorough but not blocking. Writes findings to agent file. |
| **debugger** | `subagent` | Investigates runtime errors and test failures by systematic root cause analysis — reads code, traces backward, applies minimal fixes. Writes to agent file, delegates git. |
| **test-writer** | `subagent` | Writes thorough tests covering happy path, edge cases, error states, and regressions. Writes to agent file, delegates git. |
| **commit-crafter** | `subagent` | ONLY agent allowed to stage+commit. Stages files, writes conventional commits, writes commit metadata to agent file. Pre-flight baked in. |
| **git-wrangler** | `subagent` | ONLY agent allowed to handle complex git workflows — stash, pull, branch, merge, rebase, resolve conflicts, push. Writes action log to agent file. |
| **dependency-auditor** | `subagent` | Audits dependencies for updates and vulnerabilities. Writes to agent file. |
| **spec-verifier** | `subagent` | Verifies implemented components match Meta-Architect component specs — checks all 4 states, Tailwind classes, accessibility. Writes verdict to agent file. |
| **adr-enforcer** | `subagent` | Verifies code follows Architecture Decision Records — checks ORM, auth, API patterns, database types. Writes violations to agent file. |
| **build-plan-tracker** | `subagent` | Verifies plan.json prompts against files on disk — cross-references agent files for audit trail |
| **cleanup-agent** | `subagent` | System cleanup specialist — removes spec stubs after publish, tracks and prunes unused packages, frees disk space, reports waste with dry-run mode |
| **ui-designer** | `subagent` | Standalone UI/UX design agent — creates design systems, component specs with all 4 states, screen layouts, and animation maps. Writes to agent file. |
| **general** | `subagent` | General-purpose agent for researching complex questions and executing multi-step tasks |
| **meta-architect-stage-0** | `subagent` | Stack inference specialist — given an app description, outputs compact tech stack profile |
| **meta-architect-stage-1** | `subagent` | Clarification analyst — generates focused questions about product ambiguities |
| **meta-architect-stage-2** | `subagent` | Domain modeling expert — produces entity list, relationships, business rules, Mermaid ERD |
| **meta-architect-stage-3** | `subagent` | Software architect — produces ADR decisions, routes, security items, Mermaid system diagram |
| **meta-architect-stage-4** | `subagent` | UI/UX designer — produces design token summary, component specs, animation behaviors |
| **meta-architect-stage-5** | `subagent` | Build-prompt engineer — generates full implementation prompts with actual code and commands |
| **meta-architect-stage-6** | `subagent` | Build plan writer — compiles all stage outputs into the final plan.json file on disk |

## Skills

Skills are specialized Markdown instruction files that get loaded into the LLM's context when a task matches their trigger keywords.

| Skill | Description |
|-------|-------------|
| **react-patterns** | React component composition, hooks patterns, state management |
| **error-handling** | Go/Rust/TS/Python error patterns, structured logging, retry strategies |
| **api-design** | RESTful URL conventions, HTTP methods, pagination, OpenAPI docs |
| **testing-strategy** | Test pyramid, mocking rules, coverage targets, CI integration |
| **security-review** | OWASP Top 10, XSS, CSRF, auth patterns, secure defaults |
| **design-system-implementation** | UI components from design token specs, Tailwind, 4 states rule |
| **meta-architect-patterns** | Meta-Architect build plan execution, ADR enforcement, agent file protocol |
| **segmented-prompt-execution** | One-prompt-at-a-time execution from build plans, agent file integration |
| **pre-flight-protocol** | ⛔ Mandatory pre-flight check: READ → CLASSIFY → CHECK My Job vs Not My Job → STOP/GO → TRACK → LOG. Reusable across all agents. |
| **database-data-layer** | Prisma ORM, raw SQL, migrations, seed data, connection pooling, query optimization |
| **authentication-authorization** | JWT, OAuth, sessions, RBAC, MFA, password hashing, security headers |
| **deployment-devops** | Docker, docker-compose, CI/CD (GitHub Actions), Railway, Fly.io, Vercel, environment config |

## `.spec/` State Management & Concurrency Protocol

A **Spec-First** system orchestrates multi-agent workflows with zero race conditions on shared state.

### Architecture

```
.spec/
├── schema.json          # Canonical schema for all spec files
├── current.json         # READ-ONLY context for all agents (coordinator writes)
└── agents/              # WRITE target for parallel sub-agents
    ├── executor-{desc}.json
    ├── creator-{desc}.json
    ├── debugger-{desc}.json
    ├── historian.json
    ├── reviewer.json
    ├── commit-crafter-{desc}.json
    └── ... (one file per agent per batch)
```

### The Core Rule

> **Parallel agents NEVER write to `.spec/current.json`.** They only **read** from it. Each agent writes to its **own file** under `.spec/agents/{name}.json`. The **coordinator** is the sole writer of `current.json`, merging agent files at deterministic sync points.

### Agent File Lifecycle

1. **Created** — by a sub-agent when it completes its work
2. **Consumed** — by the coordinator, which merges all agent files into `current.json`
3. **Cleaned** — by `executor` before the next batch begins (not after merge, so debug data survives crashes)

### Why This Works

- **No race conditions** — each agent writes to a unique file path
- **No locks needed** — no mutexes, no distributed lock complexity
- **Crash-resilient** — if the coordinator crashes mid-merge, agent files survive for investigation
- **Auditable** — each agent's output is independently preserved

### Sync Points

The coordinator (`meta-architect-executor`) runs merges at fixed points:
- Between each parallel batch of prompts
- After verification/evaluation steps complete
- Before escalation or cleanup

## Pre-Flight Protocol

**Every agent** — from entry-point orchestrator to specialist sub-agents — has a mandatory **Pre-Flight Check** baked into its definition. Before any action, the agent runs:

```
1. READ    .spec/current.json for context
2. CLASSIFY the action (code? git? design? review?)
3. CHECK   the "My Job vs Not My Job" table
4. ✅ GO   if it's MY job → proceed
5. ❌ STOP if it's NOT my job → DELEGATE to the right agent
6. TRACK   progress via todowrite
7. LOG     results to .spec/agents/{name}.json
```

Each agent's table categorizes 20+ task types:
- **✅ My Job**: what this agent is designed to do (write code, debug, research, review, etc.)
- **❌ Not My Job → Delegate**: touch git (→ `commit-crafter` or `git-wrangler`), design decisions (→ `design`), review (→ `historian`), etc.

The protocol is codified as a reusable skill at `skills/pre-flight-protocol/SKILL.md`.

## Git Delegation Rule

A **HARD RULE** across all 32 agents:

> **Only `commit-crafter` and `git-wrangler` may run git commands. All other agents must delegate git operations.**

Simple commits → `commit-crafter`  
Complex workflows (merge, rebase, push, conflict resolution) → `git-wrangler`

Every non-git agent has this rule prominently stated in its definition. The entry-point orchestrator (`meta-architect-orchestrator`) has `edit: deny` and `bash: deny` — it physically cannot write files or run commands.

## Cross-Platform OS Adaptation

Every agent now detects the operating system before running commands. The OS context is stored in `.spec/current.json` under `session.os`.

### OS Detection (Step 1.5 of Pre-Flight)

Between READ and CLASSIFY in the pre-flight loop, agents check `session.os.platform`:
- Not set → run `platform` tool → persist to `.spec/current.json`
- Set → adapt commands to the detected OS

### Adapted Commands Per OS

| OS | Shell | Path Style | Delete | Recursive Delete | Search |
|---|---|---|---|---|---|
| Linux | bash | `/home/` | `rm file` | `rm -rf dir/` | `grep` |
| macOS | zsh | `/Users/` | `rm file` | `rm -rf dir/` | `grep` |
| Windows (cmd) | cmd.exe | `C:\Users\` | `del file` | `rmdir /s /q dir` | `findstr` |
| Windows (pwsh) | pwsh | `C:\Users\` | `Remove-Item` | `Remove-Item -Recurse` | `Select-String` |
| Git Bash | bash | `C:/Users/` | `rm file` | `rm -rf dir/` | `grep` |

This ensures tool calls and shell commands work regardless of the host OS. The `pre-flight-protocol` skill includes full cross-platform tables.

## Session & Cleanup Lifecycle

The complete lifecycle of a multi-agent operation:

```
create_session → dispatch_agents → agents_write_agent_files → 
coordinator_merge → coordinator_publish(current.json) → 
dispatch_cleanup → cleanup-agent_removes_stubs → 
archive_session_to_history
```

### Session Tracking

Each operation gets a unique `session.id` in `.spec/current.json`:
- `session.work_items_total` — set by coordinator when work is dispatched
- `session.work_items_completed` — incremented as agents finish
- `session.phase` — transitions: `planning → execution → cleanup → complete`

Coordinators (`meta-architect-executor`, `orchestrator`) populate these fields during merge steps.

### Package Tracking

Code-writing agents (`executor`, `creator`, `prompt-executor`) now record every package they install in their agent file under `packages_installed`. The `cleanup-agent` reads these after operations complete, checks if each package is actually imported in the source code, and removes unused ones.

### Session History Archival

After cleanup completes, the `cleanup-agent` archives a session record to `.spec/history/{session_id}.json` containing:
- Session metadata (start/end time, description)
- Agent count and types used
- Files created, packages installed/removed
- Space freed

This directory is in `.gitignore` — it's operational metadata for audit trail, not source code.

## License

This project is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See the [LICENSE](LICENSE) file for the full GPL v3.0 text.

## Tools (108 total)

Custom tools registered via the `@opencode-ai/plugin` SDK. Available to all agents after installing the plugin.

### Shell & System (4)
| Tool | Description |
|------|-------------|
| **bash** | Execute shell commands with auto-detected shell |
| **powershell** | PowerShell execution (Windows only) |
| **system-info** | OS, CPU, memory, uptime, environment |
| **platform** | Quick platform detection |

### Web (2)
| Tool | Description |
|------|-------------|
| **web-search** | Search the web via DuckDuckGo |
| **web-fetch** | Fetch content from URLs (GET, POST, etc.) |

### Files (2)
| Tool | Description |
|------|-------------|
| **file-list** | List files with sizes, dates, recursive |
| **file-search** | Find files by name pattern |

### Text Processing (24)
| Tool | Description |
|------|-------------|
| **hash** | Generate cryptographic hashes (MD5, SHA1, SHA256, SHA512...) |
| **uuid** | Generate UUID v4 and v7 |
| **base64** | Encode/decode Base64 data (standard + URL-safe) |
| **case-convert** | Convert between string cases |
| **text-stats** | Count characters, words, lines, sentences |
| **regex** | Test/match/replace text with regex patterns |
| **sort** | Sort lines (asc/desc, numeric, unique) |
| **uniq** | Deduplicate and count line frequencies |
| **shuffle** | Randomly shuffle or pick from a list |
| **tr** | Transliterate/replace characters |
| **slug** | Slugify strings (strip accents, URL-safe) |
| **compress** | Gzip/deflate/brotli compress/decompress |
| **markdown** | Extract headings, links, ToC from markdown |
| **pad** | Pad text to width (left/right/center) |
| **wrap** | Word-wrap text at column width |
| **head** | First N lines of text |
| **tail** | Last N lines of text |
| **wc** | Count words, lines, characters, bytes |
| **split** | Split text into chunks |
| **paste** | Join lines with delimiter |
| **join** | Merge two texts on a column key |
| **cut** | Extract columns by delimiter |
| **sed** | Find/replace with regex support |
| **grep** | Search text by regex pattern with context |

### Network (11)
| Tool | Description |
|------|-------------|
| **dns** | DNS lookups (A, AAAA, MX, TXT, NS, CNAME, ANY) |
| **port-check** | Test TCP port connectivity |
| **http-check** | Check HTTP/HTTPS endpoint status |
| **whois** | Domain registration lookup |
| **dig** | Full DNS resolution with record types |
| **ip** | Show public IP and geolocation |
| **ping** | ICMP echo simulation via TCP |
| **traceroute** | Trace network hop path |
| **ssl** | Check SSL certificate info (issuer, expiry, SANs) |
| **headers** | Fetch HTTP response headers only |
| **http-status** | HTTP status code lookup with description |

### Format Conversion (15)
| Tool | Description |
|------|-------------|
| **json** | Format, validate, minify, or query JSON |
| **yaml** | YAML ↔ JSON conversion |
| **xml** | Format, minify, or query XML |
| **csv** | Query/filter CSV with column selection |
| **tsv** | TSV ↔ JSON conversion |
| **ini** | Parse INI config files with sections |
| **toml** | TOML ↔ JSON conversion |
| **properties** | Parse Java .properties files |
| **plist** | Parse Apple XML plist format |
| **msgpack** | MsgPack encode/decode (simulated) |
| **diff** | Line-diff two texts (LCS algorithm) |
| **patch** | Apply unified diff patches |
| **table** | Pretty-print JSON arrays as aligned ASCII tables |
| **chart** | Render ASCII bar charts from data |
| **progress** | Render a progress bar `[====>    ] 45%` |

### Encoding (14)
| Tool | Description |
|------|-------------|
| **base58** | Base58 encode/decode (Bitcoin alphabet) |
| **hex** | Hex encode, decode, or hexdump |
| **rot13** | Apply Rot13, Caesar, or Atbash ciphers |
| **uuid-parse** | Parse UUID version, variant, and timestamp |
| **quoted-printable** | MIME Quoted-Printable encode/decode |
| **punycode** | IDN ↔ Punycode conversion |
| **html-entities** | Encode/decode HTML entities |
| **unicode** | Look up Unicode character info |
| **ascii85** | Adobe Ascii85 encode/decode |
| **binary** | Text ↔ binary (8-bit) representation |
| **octal** | Decimal ↔ octal conversion |
| **pem** | Parse PEM certificates and keys |
| **ntlm** | Generate NTLM password hash |
| **pickle** | Safely inspect Python pickle data |

### Crypto & Web (6)
| Tool | Description |
|------|-------------|
| **jwt** | Decode JWT header + payload (no verify) |
| **semver** | Validate, compare, and bump semver versions |
| **url** | Parse, encode, or decode URL components |
| **template** | Render `{{key}}` templates with JSON data |
| **gitignore** | Generate .gitignore by project type |
| **license** | Get full license text by SPDX identifier |

### Media (7)
| Tool | Description |
|------|-------------|
| **image** | Get image dimensions, format, and EXIF from magic bytes |
| **mime** | Look up MIME types by extension or magic bytes |
| **color** | Convert between hex, rgb, and hsl color formats |
| **geo** | Calculate haversine distance between coordinates |
| **qr** | Generate QR-like ASCII art from text |
| **emoji** | Search emoji by name or keyword |
| **xkcd** | Fetch xkcd comic metadata by number |

### Date & Time (9)
| Tool | Description |
|------|-------------|
| **date** | Format/convert dates with timezone support |
| **cron** | Describe, validate, or preview cron schedules |
| **duration** | Parse "2h30m" or format milliseconds |
| **countdown** | Time until/since a target date |
| **business-days** | Add/subtract business days, skip weekends |
| **clock** | Show current time in multiple timezones |
| **age** | Calculate age from date of birth |
| **timer** | Named stopwatch with start/stop/lap |
| **wait** | Display countdown timeline for N seconds |

### Math & Random (7)
| Tool | Description |
|------|-------------|
| **math** | Safe expression evaluator (shunting-yard, no `eval()`) |
| **roman** | Convert between numbers and Roman numerals |
| **units** | Convert between units (weight, temp, length, data, speed) |
| **coin** | Flip a coin (crypto-random) |
| **dice** | Roll dice with standard notation (e.g., `2d6`) |
| **password** | Generate cryptographically secure passwords |
| **lottery** | Pick random items from a list |

### AI Detection (2)
| Tool | Description |
|------|-------------|
| **ai-detector** | Advanced AI-generated text detection across 12 signal dimensions |
| **ai-senior** | Senior AI Detection Aggregator — compiles results from multiple detectors |

### Build & Planning (1)
| Tool | Description |
|------|-------------|
| **plan-executor** | Read and extract prompt execution queue from Meta-Architect build plans |

### Cross-Platform (4)
| Tool | Description |
|------|-------------|
| **path-convert** | Convert paths between Win/Unix/WSL formats |
| **env** | Get environment variables |
| **path-join** | Join and normalize path segments |
| **win-sys** | Windows-specific system info |

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

Add this to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./tools/index.mjs"]
}
```

Restart opencode to load the tools.

## How It Works

- **`agents/`** folder symlinked to `~/.config/opencode/agents/`
- **`tools/`** folder symlinked to `~/.config/opencode/tools/`
  - Registered via `plugin` field in `opencode.jsonc`
- **`skills/`** folder symlinked to `~/.config/opencode/skills/`
  - Auto-discovered on startup — no config entry needed
- **`.spec/`** folder — state management and tracking for multi-agent workflows
  - `schema.json` defines the canonical structure
  - `current.json` is the read-only context (only coordinators write)
  - `agents/` holds per-agent output files for parallel-safe state management

### Spec-First Pattern

Every agent follows this flow:
1. **Spec-First**: Read `.spec/current.json` before any action
2. **Pre-Flight**: Classify work vs delegation via the My Job vs Not My Job table
3. **Git Delegation**: Never touch git — delegate to `commit-crafter` or `git-wrangler`
4. **Agent File**: Write results to `.spec/agents/{name}.json` for the coordinator to merge

### Concurrency Rules

- Parallel agents read from `current.json` — never write to it
- Each agent writes ONLY to its own file in `.spec/agents/`
- The coordinator merges agent files at deterministic sync points
- Agent files are cleaned by executor before the next batch starts (not after merge)

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

## Sync Workflow

```bash
cd ~/code/Opencode-Agents
git add .
git commit -m "Update tools"
git push
```
