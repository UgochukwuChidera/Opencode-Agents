#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_TARGET="$REPO_DIR/agents"

# Determine the opencode global agents directory
if [[ "$OSTYPE" == "darwin"* ]]; then
  OPENCODE_AGENTS_DIR="$HOME/.config/opencode/agents"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OPENCODE_AGENTS_DIR="$HOME/.config/opencode/agents"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

# Remove existing agents directory/symlink if it exists
if [[ -L "$OPENCODE_AGENTS_DIR" ]] || [[ -d "$OPENCODE_AGENTS_DIR" ]]; then
  echo "Removing existing: $OPENCODE_AGENTS_DIR"
  rm -rf "$OPENCODE_AGENTS_DIR"
fi

# Create the symlink
echo "Creating symlink: $OPENCODE_AGENTS_DIR -> $AGENTS_TARGET"
ln -s "$AGENTS_TARGET" "$OPENCODE_AGENTS_DIR"

echo "Done! opencode agents are now linked to: $AGENTS_TARGET"
ls -la "$OPENCODE_AGENTS_DIR"
