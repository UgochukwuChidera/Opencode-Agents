---
name: grill-me
description: Use when conducting structured design interviews to discover shared language, uncover implicit assumptions, and refine project terminology before planning or implementation. Covers the three-phase questioning protocol, CONTEXT.md glossary creation, and Socratic follow-up patterns.
---
## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.



# Grill-Me: Structured Interview Protocol

## When to use

- **Before planning (pre-stage 1)** — establish shared vocabulary before architectural decisions
- **Before implementation** — clarify ambiguous requirements before coding
- **When exploring unfamiliar code** — map terminology to actual code patterns
- **When team has conflicting terminology** — resolve synonyms and establish shared definitions

## Three-Phase Protocol

### Phase 1 — Context Harvesting

Ask broad open questions about:
- **Domain**: "Tell me about the problem you're solving."
- **Goals**: "What does success look like for this project?"
- **Constraints**: "What are the non-negotiables — time, budget, tech, team?"
- **Users**: "Who will use this? What do they need?"
- **Existing context**: "What already exists? What have you tried?"

Goal: Build a map of the conversational landscape. Do not probe deeply yet — just collect terms and directions.

### Phase 2 — Language Refinement

Probe specific terms surfaced in Phase 1:
- "You mentioned X — what does X mean in your context?"
- "When you say Y, do you mean A or B?"
- "Is Z the same as W, or are they different concepts?"
- "Who uses term Q? Does it mean the same thing to everyone?"
- Find synonyms: "You used both 'order' and 'purchase' — are these the same thing?"

Goal: Establish shared definitions, eliminate ambiguity, build a glossary.

### Phase 3 — Decision Capture

Confirm understanding and surface what's unspoken:
- "Let me summarize what I think I understand..."
- "What assumptions are you making about X?"
- "What would break if Y were different?"
- "What trade-offs are you willing to accept?"
- "Is there anything we haven't discussed that could derail this project?"

Goal: Capture decisions, flag risks, identify remaining ambiguities.

## Question Types

| Type | Purpose | Examples |
|------|---------|----------|
| **Open** | Explore territory | "Tell me about...", "What happens when...", "How does X work today?" |
| **Socratic follow-ups** | Dig deeper | "Why is that?", "What does X mean in your context?", "How do you know?" |
| **Clarification** | Resolve ambiguity | "When you say Y, do you mean A or B?", "Is X the same as Z?" |
| **Assumption probe** | Test boundaries | "What would break if Z were different?", "What are you assuming about X?" |
| **Confirmation** | Verify understanding | "Let me check if I have this right: ...", "So the key constraint is X?" |

## Output Format

Agents using this skill produce a structured record in their agent file:

```json
{
  "phase": "grill-me",
  "session_id": "<uuid>",
  "domain": "inferred domain",
  "glossary": [
    {"term": "...", "definition": "...", "confidence": "high|medium|low"}
  ],
  "assumptions_surfaced": [...],
  "decisions": [...],
  "remaining_ambiguities": [...]
}
```

## CONTEXT.md Pattern

After a session, the caller can write a `CONTEXT.md` file to the project root with:
- **Project overview** — one-paragraph description of the domain
- **Glossary** — terms and definitions from the session
- **Active assumptions** — assumptions surfaced and their status
- **Decisions reached** — key decisions captured

This becomes persistent shared context across sessions.

## Calling Convention

This skill is loaded by any agent that needs to interview. It does NOT create files itself; the calling agent decides what to persist. For file creation, use `grill-with-docs`.

| Action | Agent to call |
|--------|--------------|
| Conduct interview only | Load this skill directly |
| Interview + persist as CONTEXT.md/ADRs | Load `grill-with-docs` (superset) |
