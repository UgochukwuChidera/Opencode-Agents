---
description: "⚠️ DEPRECATED — fused into git-wrangler. All git operations now go through git-wrangler."
mode: deprecated
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: deny
  bash: deny
  task:
    git-wrangler: allow
---

# ⚠️ DEPRECATED — Fused into Git-Wrangler

**commit-crafter has been fused into [git-wrangler](git-wrangler.md).**

All git operations — simple commits, complex workflows, merges, rebases, pushes — are now handled by **git-wrangler**.

## What to do

If another agent delegates to you or references you, they should be updated to delegate to `git-wrangler` instead.

## Why

This fusion eliminates the cyclic delegation problem between commit-crafter and git-wrangler, and consolidates all git authority into a single agent with appropriate granular bash permissions.
