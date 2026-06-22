---
name: pre-flight-protocol
description: Use before taking any action — runs a mandatory pre-flight check against .spec/current.json to validate the intended action against the agent's allowed responsibilities. Covers role enforcement, delegation routing, spec integration, and dry-run validation.
---

# Pre-Flight Protocol

## Purpose
Before any agent takes an action, it MUST run a pre-flight check to validate that the action is within its allowed responsibilities. This prevents agents from doing work they should delegate.

## The Pre-Flight Loop — Read Before Every Action

```
┌──────────────────────────────────────────────────┐
│               PRE-FLIGHT LOOP                     │
├──────────────────────────────────────────────────┤
│ 1. READ  → .spec/current.json                     │
│            (current phase, work items, status)    │
│                                                   │
│ 2. CLASSIFY → what type of work is this?           │
│               (code, test, design, git, debug...) │
│                                                   │
│ 3. CHECK → is this MY job?                        │
│            Consult "My Job vs Not My Job" table    │
│                                                   │
│ 4. STOP or GO:                                    │
│    - ✅ MY job → proceed with action               │
│    - ❌ NOT my job → DELEGATE to right agent       │
│                                                   │
│ 5. TRACK → todowrite what was dispatched           │
│                                                   │
│ 6. LOG → update .spec/current.json outcome         │
└──────────────────────────────────────────────────┘
```

## My Job vs Not My Job

### For the Meta-Architect Orchestrator (entry point)

| ✅ MY Job (do it yourself) | ❌ NOT my Job (delegate immediately) |
|---|---|
| Classify the request | Write code / edit files |
| Read `.spec/current.json` for context | Run bash/shell commands |
| Dispatch to the right sub-agent | Touch git in any way |
| Write `todowrite` entries | Debug errors / test failures |
| Update `.spec/current.json` with outcomes | Design UI, components, or architecture |
| Ask the user to clarify ambiguous requests | Write tests |
| | Review code quality or security |
| | Research / explore the codebase |
| | Audit dependencies |
| | Write documentation or README |
| | Create files, directories, or configs |
| | Install packages or run builds |
| | Execute build plans (kick off only) |
| | Create skill files |

### For Sub-Agents (executor, creator, debugger, test-writer, etc.)

| ✅ MY Job (do it yourself) | ❌ NOT my Job (delegate) |
|---|---|
| Accept work from the orchestrator | Touch git — delegate to `commit-crafter` or `git-wrangler` |
| Read `.spec/current.json` for context | Assign work to other agents |
| Read/write files as instructed | Make design decisions (unless you ARE design) |
| Run commands as instructed | Change scope without asking the orchestrator |
| Write results to `.spec/agents/{name}.json` | |
| Report back to the orchestrator | |

## Spec Integration

### Pre-Flight Reads From `.spec/current.json`

Before acting, read the spec to determine:
- `status` — is something already in progress? (planning, executing, complete)
- `phase` — what stage are we in? (research, design, implement, review)
- `workItems` — what's currently pending or in-progress?
- `decisions` — what's already been decided?

### Post-Flight Writes To `.spec/current.json`

After delegation, the **coordinator** (orchestrator) updates:
- `workItems`: new items dispatched, status set to "in-progress"
- `decisions`: what was delegated and to whom
- `phase`: updated if transitioning between stages

## Dry-Run Mode

When in dry-run mode, run the pre-flight loop but STOP before dispatching:

```
1. READ spec → got context
2. CLASSIFY → this is a [code/test/design] task
3. CHECK → NOT my job → would delegate to [agent]
4. ⏸️ DRY-RUN — no action taken
5. OUTPUT: "Would delegate [X] to [agent] with [brief]"
```

Dry-run is useful for:
- Validating the delegation system itself
- Training / onboarding new agents
- Debugging routing issues
- User confidence checks ("show me what you WOULD do")

## Self-Audit

After every action, check:

- [ ] Did I run the pre-flight loop BEFORE acting?
- [ ] Is this action in my "✅ MY Job" column?
- [ ] If in "❌ NOT my Job" column → did I delegate?
- [ ] Did I read `.spec/current.json` first?
- [ ] Did I update `.spec/current.json` after?
