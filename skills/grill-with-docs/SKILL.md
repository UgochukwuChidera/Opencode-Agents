---
name: grill-with-docs
description: Use when you need to conduct a structured design interview AND persist the results as documentation. Builds on grill-me, adding context discovery (reading existing CONTEXT.md/codebase), enriched grilling (language cross-reference with code), and documentation phases (writing CONTEXT.md and ADRs). Use before planning, during onboarding, or when establishing project conventions.
---
## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.



# Grill-With-Docs: Structured Interview + Documentation Protocol

## Relationship to grill-me

`grill-with-docs` loads the `grill-me` protocol as its core and adds three additional phases. It is a superset.

| Capability | grill-me | grill-with-docs |
|---|---|---|
| Structured questioning | ✅ | ✅ |
| Glossary extraction | ✅ | ✅ |
| Assumption surfacing | ✅ | ✅ |
| Pre-read existing CONTEXT.md | ❌ | ✅ |
| Codebase cross-reference | ❌ | ✅ |
| Write CONTEXT.md | ❌ | ✅ |
| Write ADRs | ❌ | ✅ |

## Five-Phase Protocol

### Phase 1 — Context Discovery

Before any questioning, gather existing context:

1. **Check for CONTEXT.md**: Read the project root `CONTEXT.md` if it exists. Extract glossary terms, active assumptions, and recent decisions.
2. **Check for ADRs**: Scan `docs/adrs/` directory for existing Architecture Decision Records.
3. **Check `.spec/current.json`**: If a spec exists, read its domain and decisions.
4. **Scan codebase**: Use `grep`/`glob` to find key terms already used in source code (entity names, function names, module names).
5. **Infer domain**: From the codebase structure, infer what the project does.

This phase ensures the interview starts informed rather than from zero.

### Phase 2 — Context Harvesting

Same as `grill-me` Phase 1, but informed by Phase 1 findings:
- "I see your codebase has an X entity — tell me about that."
- "Your CONTEXT.md mentions Y — has that changed?"
- "I noticed you're using Z framework — what drove that choice?"

Ask broad open questions about domain, goals, users, and constraints. Use pre-existing knowledge to ask better questions.

### Phase 3 — Language Refinement

Same as `grill-me` Phase 2, plus cross-reference with actual code patterns:
- "You use the term 'order' in conversation, but the code calls it 'purchase' — should these align?"
- "The glossary in CONTEXT.md defines X as A, but the codebase uses it as B — which is correct?"
- "I found these terms in the code: [list]. Are they still current?"

Build a glossary that bridges conversational language and codebase reality.

### Phase 4 — Decision Capture

Same as `grill-me` Phase 3, plus ADR detection:
- "This decision about X seems significant — should it become an ADR?"
- "Your current ADR NNN says Y, but we just decided Z — should we update it?"
- "Which of these assumptions should be formally recorded?"

Flag decisions that warrant formal documentation.

### Phase 5 — Documentation

Write or update documentation files:

1. **CONTEXT.md**: Write/update the project root `CONTEXT.md` with the full session output.
2. **ADRs**: For each decision flagged in Phase 4, create a new ADR file at `docs/adrs/NNNN-title-with-dashes.md`.

## CONTEXT.md Format

```markdown
# Project Context

## Overview
<one-paragraph description>

## Glossary
| Term | Definition | Source |
|------|-----------|--------|
| ... | ... | Interview / Code / Team |

## Active Assumptions
- <assumption> (status: active|validated|invalidated)

## Recent Decisions
- <decision> (date: YYYY-MM-DD)
```

## ADR Output Format

Files at `docs/adrs/NNNN-title-with-dashes.md` following:

```markdown
# NNNN. Title

Date: YYYY-MM-DD

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
<what prompted this decision>

## Decision
<what was decided>

## Consequences
<trade-offs, implications>
```

ADR numbering:
- Scan existing ADRs in `docs/adrs/` to find the highest number
- New ADR gets next sequential number (NNNN + 1)
- Title uses kebab-case from the decision name

## Codebase Scanning

Use `grep` and `glob` to find existing terms in source code:

- `glob "src/**/*.ts"` to find source files
- `grep "class\|interface\|type\|function\|const"` to find entity/function names
- Cross-reference glossary terms with actual code usage
- Flag mismatches between conversational terms and code terms

## Calling Convention

This skill is loaded by agents that need to both interview and persist. Always write CONTEXT.md after a session.

| Action | Agent to call |
|--------|--------------|
| Interview only | `grill-me` |
| Interview + persist | `grill-with-docs` (this skill) |
