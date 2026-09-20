---
name: flow-refactor-blueprint
description: Use when refactoring a user flow that has performance or correctness bottlenecks — e.g. auth/login/signup flows, checkout, onboarding, dashboard loading. Covers flow mapping (DFDs + step-cost trace tables), bottleneck ranking with code refs, fixing the root mechanism (e.g. server actions instead of client singletons), centralizing redirect/error primitives, middleware hardening, query dedup, and verify-before-ship. Front-load triggers: "map the flow", "fix the bottleneck", "server action", "redirect whitelist", "preserve query", "dedup", "middleware fast-path", "Option B".
---

# Flow Refactor Blueprint

Reusable, decision-first workflow for tearing down a user flow that has
repeated RTTs, duplicate queries, client/server state races, or auth-token
conflicts. Ordering is strict: analysis before changes, leaves before
consumers, verify before ship.

## The 7 Stages

```
Stage 1 · Map before you change
Stage 2 · Pick the cure, not the symptom
Stage 3 · Build leaf-first (shared primitives before consumers)
Stage 4 · Thick server, thin client
Stage 5 · Harden the edges
Stage 6 · Close the cost loop (bank the RTT savings)
Stage 7 · Verify, then ship
```

---

## Stage 1 — Map before you change

Do NOT guess. Produce three artifacts **before editing a single file**:

1. **DFD Level-0** for the flow: every actor, process, data store, and auth
   boundary (browser client, middleware, server component, server action,
   GoTrue/IDP, DB). Include the token lifecycle if auth is involved.
2. **Step-by-step trace table**: numbered steps (1..N), each with the code ref
   (`file:line`), what happens, and its **cost** (network RTT, DB query, or
   `getUser()` call). Label every RTT explicitly.
3. **Class/ownership view**: where state lives (client singleton vs server
   cookie vs DB), who writes it, who reads it.

Then **cross-match the sibling flow** (e.g. signup vs login): map the copy's
flow against the primary's findings. Sibling flows share the same architecture
and will share the same bugs — this surfaces issues the primary flow didn't.

## Stage 2 — Pick the cure, not the symptom

- Rank the bottlenecks from the trace table, biggest first, **each with a code
  ref** so nothing is an uncheckable claim.
- Choose candidates to fix **by root mechanism**, not by surface symptom.
  Example: if the client singleton races the middleware on refresh tokens, the
  fix is to move the auth exchange to a **server action** (`redirect()` issues
  one 303 with `Set-Cookie`) — not to add more client-side retries.
- **Verify the runtime constraint before writing code.** Check the framework
  version and what it actually exports (e.g. React 18.3.1 has no
  `useFormState`/`useFormStatus` → orchestrate server actions with
  `useTransition` instead of building on primitives that don't exist).

## Stage 3 — Build leaf-first (shared primitives before consumers)

Centralize every primitive that more than one caller needs, **before** its
consumers:

- **One redirect/URL guard** (e.g. `isSafeRedirectPath` + a query-aware wrapper
  like `sanitizeRedirectPath`). Put it in one util; every route/action imports
  it. Duplicated whitelists drift (missing paths, stale patterns).
- **One error mapper** (`friendlyAuthError`): map known upstream codes to
  user-safe copy, generic fallback, no info disclosure.
- Then point all consumers (callback routes, server actions, forms) at the leaf.

Rule: nothing builds on a primitive that doesn't exist yet.

## Stage 4 — Thick server, thin client

- **Server actions own the exchange**: validate input → call the upstream →
  map errors → `redirect()` to a sanitized target.
- **Forms become dumb**: hidden `next` input, `useTransition` for pending,
  `new FormData(form)`, local error/success state. No browser supabase
  singleton imported into auth forms.
- Session-return branches matter: if the upstream returns a session directly
  (confirmation disabled), redirect immediately — don't dead-end the user on a
  "check your email" screen that never resolves.

## Stage 5 — Harden the edges

- **Middleware** (the global choke point):
  - Fast-path: skip the `getUser()` round-trip on public routes when no auth
    cookie is present (removes the auth RTT from unauthenticated visits).
  - Preserve the query string in the `next` param, and sanitize on read
    (validate pathname, carry query).
  - Clear poisoned/dead auth cookies on the login redirect so a refresh-fail
    loop can't persist.
- **Sign-out** should use full-page navigation (`window.location.assign`) to
  wipe the SPA router cache and in-memory singletons.

## Stage 6 — Close the cost loop (bank the RTT savings)

Go back to the Stage 1 trace table and the Stage 2 ranking; systematically
eliminate the duplicates:

- Fetch shared data **once** (e.g. deck rows + stats) into a snapshot, route it
  through every consumer that previously re-queried it.
- Preserve prior display limits when a shared fetch is unfiltered
  (slice to the old `.limit()` at read time).

## Stage 7 — Verify, then ship

- **Tests at the leaf/boundary**: unit-test the new primitives (guard, error
  mapper, sanitizer) and the server actions (err paths, safe/unsafe redirects,
  query preservation). Mock the data/upstream layer.
- **Full gate**: `typecheck → lint → full test suite`. Fix regressions.
- **Secrets hygiene before push**: confirm `.gitignore` shields
  `.env*`, keys, archives, and stray folders; verify nothing matching is
  staged.
- Commit with a message naming the mechanism you changed (not just "fixed
  bugs"), then push.

---

## Worked example (auth, Option B)

1. Mapped login: DFD + 10-step trace + class view → ranked 6 bottlenecks with refs.
2. Cross-mapped signup → found a confirmation-mode dead-end + session-return gap.
3. Chose server actions over the client singleton (root refresh-race fix).
4. Centralized `isSafeRedirectPath`, `sanitizeRedirectPath`, `friendlyAuthError`.
5. Server actions owned sign-in/sign-up + cookie + `redirect()`; forms thinned.
6. Middleware: public no-cookie fast-path, query-preserving `next`, poisoned-cookie clear.
7. Deduped library stats via a shared snapshot (2× → 1×).
8. Unit tests for actions + utils; 313/313 green → committed + pushed.
