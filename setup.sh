#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_TARGET="$REPO_DIR/agents"
TOOLS_TARGET="$REPO_DIR/tools"
SKILLS_TARGET="$REPO_DIR/skills"
SPEC_TARGET="$REPO_DIR/.spec"

# ── OS Detection ──────────────────────────────────────────────────
detect_os() {
  case "$OSTYPE" in
    linux-gnu*)  echo "linux" ;;
    darwin*)     echo "macos" ;;
    msys*|cygwin*) echo "windows-git-bash" ;;
    *)           echo "unknown" ;;
  esac
}
OS="$(detect_os)"
echo "==> Detected OS: $OS ($OSTYPE)"

# ── OpenCode Config Directory ────────────────────────────────────
case "$OS" in
  linux|macos)
    OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
    ;;
  windows-git-bash)
    # Git Bash on Windows uses USERPROFILE
    OPENCODE_CONFIG_DIR="${USERPROFILE}/.config/opencode"
    ;;
  *)
    echo "Unsupported OS: $OSTYPE"
    exit 1
    ;;
esac

OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents"
OPENCODE_TOOLS_DIR="$OPENCODE_CONFIG_DIR/tools"
OPENCODE_SKILLS_DIR="$OPENCODE_CONFIG_DIR/skills"
OPENCODE_SPEC_DIR="$OPENCODE_CONFIG_DIR/.spec"

echo "==> Config dir: $OPENCODE_CONFIG_DIR"

# Ensure config directory exists
mkdir -p "$OPENCODE_CONFIG_DIR"

# ── Utility: create symlink ──────────────────────────────────────
link_dir() {
  local target="$1"
  local link="$2"
  local name="$3"
  if [[ -L "$link" ]] || [[ -d "$link" ]] || [[ -f "$link" ]]; then
    echo "  Removing existing: $link"
    rm -rf "$link"
  fi
  ln -s "$target" "$link"
  echo "  ✅ $name linked: $link -> $target"
}

# ── Link Agents ───────────────────────────────────────────────────
link_dir "$AGENTS_TARGET" "$OPENCODE_AGENTS_DIR" "Agents"

# ── Link Tools ────────────────────────────────────────────────────
link_dir "$TOOLS_TARGET" "$OPENCODE_TOOLS_DIR" "Tools"

# ── Link Skills ───────────────────────────────────────────────────
link_dir "$SKILLS_TARGET" "$OPENCODE_SKILLS_DIR" "Skills"

# ── Link .spec ────────────────────────────────────────────────────
if [[ -d "$SPEC_TARGET" ]]; then
  link_dir "$SPEC_TARGET" "$OPENCODE_SPEC_DIR" ".spec/"
else
  echo "  ⚠️  No .spec/ directory at $SPEC_TARGET — skipping"
fi

# ── Bootstrap .spec/current.json ──────────────────────────────────
CURRENT_JSON="$SPEC_TARGET/current.json"
if [[ ! -f "$CURRENT_JSON" ]]; then
  echo "  Creating bootstrap .spec/current.json..."
  cat > "$CURRENT_JSON" <<JSON
{
  "status": "planned",
  "session": {
    "id": "00000000-0000-0000-0000-000000000000",
    "start_time": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "phase": "complete",
    "description": "Bootstrap session — no active operation. Created by setup to enable cleanup lifecycle.",
    "work_items_total": 0,
    "work_items_completed": 0
  },
  "phase": "idle",
  "cleanup": {
    "last_cleanup_time": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "files_removed": 0,
    "packages_removed": [],
    "space_freed_bytes": 0,
    "space_freed_human": "0 B"
  }
}
JSON
  echo "  ✅ .spec/current.json created"
else
  echo "  ✅ .spec/current.json already exists"
fi

# ── Register plugin in opencode.jsonc ─────────────────────────────
PLUGIN_PATH="./tools/index.mjs"
JSONC_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
PLUGIN_LINE="    \"plugin\": [\"$PLUGIN_PATH\"]"

if [[ -f "$JSONC_FILE" ]]; then
  if grep -q '"plugin"' "$JSONC_FILE" 2>/dev/null; then
    echo "  ✅ Plugin already registered in opencode.jsonc"
  else
    echo "  ⚠️  Plugin not registered. Attempting auto-registration..."
    # Insert plugin line before the last closing brace
    sed -i.bak 's/^}$/'"$PLUGIN_LINE"'\n}/' "$JSONC_FILE"
    echo "  ✅ Plugin registered in opencode.jsonc"
  fi
else
  echo "  Creating opencode.jsonc with plugin entry..."
  cat > "$JSONC_FILE" <<JSONC
{
  "\$schema": "https://opencode.ai/config.json",
  "plugin": ["$PLUGIN_PATH"]
}
JSONC
  echo "  ✅ Created opencode.jsonc with plugin entry"
fi

# ── Summary ───────────────────────────────────────────────────────
AGENT_COUNT=$(ls -1 "$AGENTS_TARGET"/*.md 2>/dev/null | wc -l)
TOOL_COUNT=$(ls -1 "$TOOLS_TARGET"/*.mjs 2>/dev/null | wc -l)
SKILL_COUNT=$(ls -1d "$SKILLS_TARGET"/*/ 2>/dev/null | wc -l)

echo ""
echo "=========================================="
echo "  ✅ Setup Complete!"
echo "=========================================="
echo "  OS:       $OS"
echo "  Agents:   $AGENT_COUNT linked"
echo "  Tools:    $TOOL_COUNT linked"
echo "  Skills:   $SKILL_COUNT linked"
echo "  .spec/:   $( [[ -L "$OPENCODE_SPEC_DIR" ]] && echo 'linked' || echo 'not linked' )"
echo "  Plugin:   registered"
echo "=========================================="
echo ""
echo "  Agents: $AGENTS_TARGET"
echo "  Tools:  $TOOLS_TARGET"
echo "  Skills: $SKILLS_TARGET"
echo "  .spec:  $SPEC_TARGET"
echo ""
echo "Restart opencode to load everything."
