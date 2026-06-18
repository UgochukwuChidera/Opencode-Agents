# Opencode Agents, Tools & Skills

Custom agent definitions, tool plugins, and skill instructions for [opencode](https://opencode.ai/), synchronized across Linux and Windows via symlinks/junctions.

## Structure

```
Opencode-Agents/
├── agents/         # 14 agent personality definitions (markdown)
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
│   ├── custom-tools.mjs    # Template for your own tools
│   └── bash-mcp.mjs        # Bash MCP server (deprecated)
├── skills/         # Skill instructions auto-loaded by opencode
│   ├── react-patterns/SKILL.md
│   ├── error-handling/SKILL.md
│   ├── api-design/SKILL.md
│   ├── testing-strategy/SKILL.md
│   └── security-review/SKILL.md
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

Skills are specialized Markdown instruction files that get loaded into the LLM's context when a task matches their trigger keywords.

| Skill | Description |
|-------|-------------|
| **react-patterns** | React component composition, hooks patterns, state management |
| **error-handling** | Go/Rust/TS/Python error patterns, structured logging, retry strategies |
| **api-design** | RESTful URL conventions, HTTP methods, pagination, OpenAPI docs |
| **testing-strategy** | Test pyramid, mocking rules, coverage targets, CI integration |
| **security-review** | OWASP Top 10, XSS, CSRF, auth patterns, secure defaults |

## Tools (105 total)

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
