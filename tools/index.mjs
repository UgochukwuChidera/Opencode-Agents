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

// ─── Shell execution ───────────────────────────────────────────────
import { bashTool } from "./bash-tool.mjs";

// ─── Web tools ─────────────────────────────────────────────────────
import { webSearchTool } from "./web-search.mjs";
import { webFetchTool } from "./web-fetch.mjs";

// ─── System information ────────────────────────────────────────────
import { systemInfoTool, platformTool } from "./system-info.mjs";

// ─── File operations ───────────────────────────────────────────────
import { fileListTool, fileSearchTool } from "./file-tools.mjs";

// ─── Text processing (24 tools) ────────────────────────────────────
import {
  // Original
  hashTool,
  uuidTool,
  base64Tool,
  caseConvertTool,
  textStatsTool,
  // New text tools
  regexTool,
  sortTool,
  uniqTool,
  shuffleTool,
  trTool,
  slugTool,
  compressTool,
  markdownTool,
  padTool,
  wrapTool,
  headTool,
  tailTool,
  wcTool,
  splitTool,
  pasteTool,
  joinTool,
  cutTool,
  sedTool,
  grepTool,
} from "./text-tools.mjs";

// ─── Network tools (11 tools) ──────────────────────────────────────
import {
  dnsTool,
  portCheckTool,
  httpCheckTool,
  whoisTool,
  digTool,
  ipTool,
  pingTool,
  tracerouteTool,
  sslTool,
  headersTool,
  statusTool,
} from "./net-tools.mjs";

// ─── Format tools (15 tools: json, xml, yaml, csv, etc.) ───────────
import {
  jsonTool,
  yamlTool,
  xmlTool,
  csvTool,
  tsvTool,
  iniTool,
  tomlTool,
  propertiesTool,
  plistTool,
  msgpackTool,
  diffTool,
  patchTool,
  tableTool,
  chartTool,
  progressTool,
} from "./format-tools.mjs";

// ─── Encode tools (14 tools: base58, hex, ciphers, etc.) ───────────
import {
  base58Tool,
  hexTool,
  rot13Tool,
  uuidParseTool,
  quotedPrintableTool,
  punycodeTool,
  htmlEntitiesTool,
  unicodeTool,
  ascii85Tool,
  binaryTool,
  octalTool,
  pemTool,
  ntlmTool,
  pickleTool,
} from "./encode-tools.mjs";

// ─── Crypto & Web tools (6 tools: jwt, semver, url, etc.) ──────────
import {
  jwtTool,
  semverTool,
  urlTool,
  templateTool,
  gitignoreTool,
  licenseTool,
} from "./crypto-web-tools.mjs";

// ─── Media tools (7 tools: image, mime, color, etc.) ───────────────
import {
  imageTool,
  mimeTool,
  colorTool,
  geoTool,
  qrTool,
  emojiTool,
  xkcdTool,
} from "./media-tools.mjs";

// ─── Windows / cross-platform tools ─────────────────────────────────
import {
  pathConvertTool,
  envTool,
  pathJoinTool,
  winSysTool,
} from "./windows-tools.mjs";

// ─── Date tools (9 tools) ──────────────────────────────────────────
import {
  dateTool,
  cronTool,
  durationTool,
  countdownTool,
  businessDaysTool,
  clockTool,
  ageTool,
  timerTool,
  waitTool,
} from "./date-tools.mjs";

// ─── Math tools (7 tools) ──────────────────────────────────────────
import {
  mathTool,
  romanTool,
  unitsTool,
  coinTool,
  diceTool,
  passwordTool,
  lotteryTool,
} from "./math-tools.mjs";

// ─── AI Detection tools (2 tools) ────────────────────────────────────
import { aiDetectorTool } from "./ai-detector.mjs";
import { aiSeniorTool } from "./ai-senior.mjs";

// Meta-Architect plan execution
import { planExecutorTool } from "./plan-executor.mjs";

/**
 * Collect all tool definitions here.
 * Each key becomes the tool name visible to agents.
 */
const toolDefinitions = {
  // ── Shell (unified — auto-detects OS) ──
  bash: bashTool,
  // NOTE: No separate "powershell" tool needed — bashTool auto-detects Windows

  // ── Web ──
  "web-search": webSearchTool,
  "web-fetch": webFetchTool,

  // ── System ──
  "system-info": systemInfoTool,
  platform: platformTool,

  // ── Files ──
  "file-list": fileListTool,
  "file-search": fileSearchTool,

  // ── Text utilities (24) ──
  hash: hashTool,
  uuid: uuidTool,
  base64: base64Tool,
  "case-convert": caseConvertTool,
  "text-stats": textStatsTool,
  regex: regexTool,
  sort: sortTool,
  uniq: uniqTool,
  shuffle: shuffleTool,
  tr: trTool,
  slug: slugTool,
  compress: compressTool,
  markdown: markdownTool,
  pad: padTool,
  wrap: wrapTool,
  head: headTool,
  tail: tailTool,
  wc: wcTool,
  split: splitTool,
  paste: pasteTool,
  join: joinTool,
  cut: cutTool,
  sed: sedTool,
  grep: grepTool,

  // ── Network (11) ──
  dns: dnsTool,
  "port-check": portCheckTool,
  "http-check": httpCheckTool,
  whois: whoisTool,
  dig: digTool,
  ip: ipTool,
  ping: pingTool,
  traceroute: tracerouteTool,
  ssl: sslTool,
  headers: headersTool,
  "http-status": statusTool,

  // ── Format (15) ──
  json: jsonTool,
  yaml: yamlTool,
  xml: xmlTool,
  csv: csvTool,
  tsv: tsvTool,
  ini: iniTool,
  toml: tomlTool,
  properties: propertiesTool,
  plist: plistTool,
  msgpack: msgpackTool,
  diff: diffTool,
  patch: patchTool,
  table: tableTool,
  chart: chartTool,
  progress: progressTool,

  // ── Encode (14) ──
  base58: base58Tool,
  hex: hexTool,
  rot13: rot13Tool,
  "uuid-parse": uuidParseTool,
  "quoted-printable": quotedPrintableTool,
  punycode: punycodeTool,
  "html-entities": htmlEntitiesTool,
  unicode: unicodeTool,
  ascii85: ascii85Tool,
  binary: binaryTool,
  octal: octalTool,
  pem: pemTool,
  ntlm: ntlmTool,
  pickle: pickleTool,

  // ── Crypto & Web (6) ──
  jwt: jwtTool,
  semver: semverTool,
  url: urlTool,
  template: templateTool,
  gitignore: gitignoreTool,
  license: licenseTool,

  // ── Media (7) ──
  image: imageTool,
  mime: mimeTool,
  color: colorTool,
  geo: geoTool,
  qr: qrTool,
  emoji: emojiTool,
  xkcd: xkcdTool,

  // ── Cross-platform ──
  "path-convert": pathConvertTool,
  env: envTool,
  "path-join": pathJoinTool,
  "win-sys": winSysTool,

  // ── Date (9) ──
  date: dateTool,
  cron: cronTool,
  duration: durationTool,
  countdown: countdownTool,
  "business-days": businessDaysTool,
  clock: clockTool,
  age: ageTool,
  timer: timerTool,
  wait: waitTool,

  // ── Math (7) ──
  math: mathTool,
  roman: romanTool,
  units: unitsTool,
  coin: coinTool,
  dice: diceTool,
  password: passwordTool,
  lottery: lotteryTool,

  // ── AI Detection (2) ──
  "ai-detector": aiDetectorTool,
  "ai-senior": aiSeniorTool,

  // Meta-Architect plan execution
  "plan-executor": planExecutorTool,
};

/**
 * Opencode Plugin Server
 *
 * This is the main plugin function. It receives PluginInput (context)
 * and optional user-provided options from opencode.jsonc.
 * It returns Hooks containing the tool definitions.
 */
const server = async (ctx, options) => {
  return {
    // Register all tools
    tool: toolDefinitions,
  };
};

// Plugin identifier (required by opencode plugin loader)
export const id = "opencode-tools";

// Export as a PluginModule-compatible shape
export { server };
export default { id: "opencode-tools", server };
