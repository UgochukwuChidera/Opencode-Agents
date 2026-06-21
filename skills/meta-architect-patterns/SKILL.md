---
name: meta-architect-patterns
description: Use when executing a Meta-Architect build plan from plan.json. Covers plan structure parsing, prompt execution order, component spec compliance, ADR enforcement, and design token usage. Also use when working with .meta-architect/plan.json, build context files, or Meta-Architect evaluators.
---

# Meta-Architect Patterns

## plan.json Structure

A Meta-Architect build plan is a JSON file at `.meta-architect/plan.json` with this structure:

```json
{
  "build_plan": {
    "metadata": { "project_name": "...", "status": "ready" },
    "sections": [ /* rendered markdown sections */ ],
    "prompts": {
      "A_scaffold": { "label": "...", "instructions": "...", "commands": [], "files_to_create": [] },
      "B_data_layer": { "label": "...", "instructions": "...", "prisma_schema": "...", "commands": [] },
      "C_backend": [ { "feature": "...", "depends_on": "B_data_layer", "instructions": "...", "files_to_create": [] } ],
      "C_ui": [ { "feature": "...", "depends_on": "...", "instructions": "...", "files_to_create": [] } ]
    }
  }
}
```

## Agent File Protocol — Concurrency Safety

When multiple agents run in parallel (which is the default), NO agent writes to `.spec/current.json`. Instead:

- **Every parallel agent** writes its output to `.spec/agents/{unique-name}.json`
- **Only the coordinator** (executor, orchestrator, planner) writes to `.spec/current.json` at deterministic sync points
- **The merge step** collects agent files and merges them into `current.json` under `agents.{key}`

See `.spec/schema.json` for the canonical structure definition.

## Execution Order

Always execute prompts in this strict order within each batch:

1. **Prompt A (Scaffold)** — Project structure, package.json, configs, Dockerfile
2. **Prompt B (Data Layer)** — Prisma schema, migrations, database setup
3. **C-Backend features** — One at a time, in the order listed. Each depends on B.
4. **C-UI features** — One at a time, in the order listed. Each depends on its backend counterpart.

Within a batch: parallel is safe (B and all C prompts run concurrently).
Across batches: sequential (A must finish before B+C starts).

Never skip a prompt. Never reorder across batches.

## Component Spec Compliance

Every component spec in the plan has 4 required states:
- **loading**: Skeleton, spinner, or pulse animation
- **empty**: Placeholder text, icon, or CTA when no data exists
- **error**: Error message, retry button, or fallback UI
- **success**: Normal rendered state with data

If any component is missing one of these states, flag it via the spec-verifier.

## Tailwind Classes from Design Tokens

Use exact Tailwind classes from the design_tokens section:
- Colors: `bg-{color}-{shade}`, `text-{color}-{shade}`, `border-{color}-{shade}`
- Spacing: `p-{size}`, `m-{size}`, `gap-{size}` (use the spacing scale, never arbitrary values)
- Typography: `text-{size} font-{weight}`
- Do not invent custom values — use only what's in the design tokens

## ADR Enforcement

ADRs are binding decisions. Before writing code that touches an ADR-covered concern:
1. Check which ADRs exist (plan.json → build_plan → sections → Architecture Decisions)
2. Follow the decision exactly — ADR 1 chose Prisma, so use Prisma, not raw SQL
3. If you must deviate, that's a new ADR, not a silent workaround

## Animation Map Usage

When implementing animations, reference the animation_map from the design stage:
- Use the exact Framer Motion props or CSS classes specified
- Page transitions, modal entries, hover effects — all are defined in the map
