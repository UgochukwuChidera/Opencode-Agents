---
name: segmented-prompt-execution
description: Use when executing prompts sequentially from a build plan. Covers one-prompt-at-a-time execution, verification between prompts, state carry-forward, failure handling, and the no-improvisation rule. Use with plan.json, prompt queues, or execution-tracker tools.
---

# Segmented Prompt Execution

## Execution Model

Prompts from Meta-Architect build plans are executed as a strict sequential pipeline across batches. Within a batch, parallel execution is safe when prompts are independent.

### Rules

1. **Batc sequential, intra-batch parallel**: Execute Prompt A to completion before starting Prompt B. But B and C prompts within the same batch can run in parallel since they depend on A (which is done) but not on each other.

2. **Complete fully**: A prompt is complete only when:
   - All files listed in `files_to_create` exist on disk
   - All commands in `commands` have been run successfully
   - All listed code is in place
   - The agent file exists at `.spec/agents/{prompt_id}.json` with `status: "success"`

3. **Verify between batches**: After each batch, run the merge step:
   - Read all `.spec/agents/*.json` from the completed batch
   - Merge into `.spec/current.json` under `agents`
   - Run spec-verifier and adr-enforcer (they write to their own agent files)
   - Merge evaluator results
   - Confirm the project still compiles/runs

4. **State carries forward** via `.spec/current.json`:
   - Prompt B builds on the scaffold from A
   - C-Backend features build on the data layer from B
   - C-UI features build on the backend endpoints from C-Backend
   - Each batch receives the merged state from prior batches

5. **No improvisation**: Each prompt contains exact code, exact commands, exact file paths. Do not:
   - Add files not in the prompt
   - Change variable names or file paths
   - Use different libraries or patterns
   - "Improve" the implementation beyond what's specified
   - Add comments or explanations to the code

## Agent Files (Concurrency Safety)

Every parallel agent writes to `.spec/agents/{unique-name}.json` — NEVER to `.spec/current.json`.

The coordinator merges agent files into `current.json` at sync points:
1. After Prompt A completes
2. After the parallel B+C batch completes
3. After evaluators complete
4. After the final audit

## Failure Handling

When a prompt execution fails:

1. **Re-read** the prompt instructions and the error output
2. **Re-run** the failed command or file creation
3. **If still failing**, re-read the plan.json for that prompt and check for dependency issues
4. **If unrecoverable**, report the failure via the prompt's agent file with:
   - Which prompt failed
   - What failed (command, file, or verification)
   - The error output
   - Do NOT silently fix — the plan specifies exact code

## Prompts Are The Source Of Truth

The build plan is the ground truth. If the prompt says `prisma.user.findMany()`, write `prisma.user.findMany()`. Do not refactor to `prisma.user.findUnique()`. If a prompt specifies a file path `src/components/UserCard.tsx`, write to that exact path.

If you discover an issue with the prompt's code, report it — do not fix it yourself.
