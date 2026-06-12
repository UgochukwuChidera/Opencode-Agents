#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_TARGET="$REPO_DIR/agents"
TOOLS_TARGET="$REPO_DIR/tools"
SKILLS_TARGET="$REPO_DIR/skills"

# Determine the opencode global config directory
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
  OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents"
  OPENCODE_TOOLS_DIR="$OPENCODE_CONFIG_DIR/tools"
  OPENCODE_SKILLS_DIR="$OPENCODE_CONFIG_DIR/skills"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

# Ensure config directory exists
mkdir -p "$OPENCODE_CONFIG_DIR"

# ── Agents symlink ──────────────────────────────────────────────────
if [[ -L "$OPENCODE_AGENTS_DIR" ]] || [[ -d "$OPENCODE_AGENTS_DIR" ]]; then
  echo "Removing existing: $OPENCODE_AGENTS_DIR"
  rm -rf "$OPENCODE_AGENTS_DIR"
fi
echo "Creating symlink: $OPENCODE_AGENTS_DIR -> $AGENTS_TARGET"
ln -s "$AGENTS_TARGET" "$OPENCODE_AGENTS_DIR"
echo "  ✅ Agents linked to: $AGENTS_TARGET"

# ── Tools symlink ───────────────────────────────────────────────────
if [[ -L "$OPENCODE_TOOLS_DIR" ]] || [[ -d "$OPENCODE_TOOLS_DIR" ]]; then
  echo "Removing existing: $OPENCODE_TOOLS_DIR"
  rm -rf "$OPENCODE_TOOLS_DIR"
fi
echo "Creating symlink: $OPENCODE_TOOLS_DIR -> $TOOLS_TARGET"
ln -s "$TOOLS_TARGET" "$OPENCODE_TOOLS_DIR"
echo "  ✅ Tools linked to: $TOOLS_TARGET"

# ── Skills symlink ──────────────────────────────────────────────────
if [[ -L "$OPENCODE_SKILLS_DIR" ]] || [[ -d "$OPENCODE_SKILLS_DIR" ]]; then
  echo "Removing existing: $OPENCODE_SKILLS_DIR"
  rm -rf "$OPENCODE_SKILLS_DIR"
fi
echo "Creating symlink: $OPENCODE_SKILLS_DIR -> $SKILLS_TARGET"
ln -s "$SKILLS_TARGET" "$OPENCODE_SKILLS_DIR"
echo "  ✅ Skills linked to: $SKILLS_TARGET"

# ── Enable plugin in opencode.jsonc if not already present ──────────
PLUGIN_ENTRY='"./tools/index.mjs"'
if [ -f "$OPENCODE_CONFIG_DIR/opencode.jsonc" ]; then
  if ! grep -q "$PLUGIN_ENTRY" "$OPENCODE_CONFIG_DIR/opencode.jsonc" 2>/dev/null; then
    echo ""
    echo "⚠️  The tools plugin is not registered in opencode.jsonc."
    echo "   Add this to your $OPENCODE_CONFIG_DIR/opencode.jsonc:"
    echo ""
    echo '    "plugin": ["./tools/index.mjs"]'
    echo ""
  fi
fi

echo ""
echo "Done! opencode agents, tools, and skills are linked."
echo "  Agents: $AGENTS_TARGET"
echo "  Tools:  $TOOLS_TARGET"
echo "  Skills: $SKILLS_TARGET"
