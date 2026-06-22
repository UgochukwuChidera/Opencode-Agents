---
name: tool-preference
description: Use when deciding whether to use a plugin tool or bash. Covers the tool-over-bash philosophy, escape hatch rules, and references the canonical tool manifest at .spec/TOOL-MANIFEST.md.
---

## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.

# Tool Preference Guide

## Principle

Prefer built-in tools (`read`, `glob`, `grep`, `task`, `todowrite`) and **108 plugin tools** over bash equivalents. They're cross-platform, have structured output, and better error messages.

## Bash is the Escape Hatch

Use bash when:
- No dedicated tool exists for what you need
- Shell pipelines or process management
- Build/test/install commands
- Dynamic operations that don't map to a tool

## The Manifest

See `.spec/TOOL-MANIFEST.md` for the complete bash→tool mapping reference (all 108 tools).
