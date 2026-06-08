#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_TARGET="$REPO_DIR/agents"
TOOLS_TARGET="$REPO_DIR/tools"

# Determine the opencode global config directory
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
  OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents"
  OPENCODE_TOOLS_DIR="$OPENCODE_CONFIG_DIR/tools"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

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
echo "Done! opencode agents and tools are linked."
echo "  Agents: $AGENTS_TARGET"
echo "  Tools:  $TOOLS_TARGET"
