---
name: segmented-prompt-execution
description: Use when executing prompts sequentially from a build plan. Covers one-prompt-at-a-time execution, verification between prompts, state carry-forward, failure handling, and the no-improvisation rule. Use with plan.json, prompt queues, or execution-tracker tools.
---

# Segmented Prompt Execution

## Execution Model

Prompts from Meta-Architect build plans are executed as a strict sequential pipeline. Each prompt builds on the output of the previous one.

### Rules

1. **One at a time**: Execute Prompt A to completion before starting Prompt B. Never run prompts in parallel, even if they appear independent.

2. **Complete fully**: A prompt is complete only when:
   - All files listed in `files_to_create` exist on disk
   - All commands in `commands` have been run successfully
   - All listed code is in place

3. **Verify between prompts**: After each prompt, verify:
   - Files exist at expected paths
   - The project still compiles/runs (run build or type check)
   - The spec-verifier passes for any new components

4. **State carries forward**:
   - Prompt B builds on the scaffold from A
   - C-Backend features build on the data layer from B
   - C-UI features build on the backend endpoints from C-Backend
   - Each prompt receives the full accumulated state from prior prompts

5. **No improvisation**: Each prompt contains exact code, exact commands, exact file paths. Do not:
   - Add files not in the prompt
   - Change variable names or file paths
   - Use different libraries or patterns
   - "Improve" the implementation beyond what's specified
   - Add comments or explanations to the code

## Failure Handling

When a prompt execution fails:

1. **Re-read** the prompt instructions and the error output
2. **Re-run** the failed command or file creation
3. **If still failing**, re-read the plan.json for that prompt and check for dependency issues
4. **If unrecoverable**, report the failure via the build-plan-tracker with:
   - Which prompt failed
   - What failed (command, file, or verification)
   - The error output
   - Do NOT silently fix — the plan specifies exact code

## Prompts Are The Source Of Truth

The build plan is the ground truth. If the prompt says `prisma.user.findMany()`, write `prisma.user.findMany()`. Do not refactor to `prisma.user.findUnique()`. If a prompt specifies a file path `src/components/UserCard.tsx`, write to that exact path.

If you discover an issue with the prompt's code, report it — do not fix it yourself.
