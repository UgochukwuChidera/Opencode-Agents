---
name: flow-refactor-blueprint
description: Use when refactoring any user flow with performance or correctness bottlenecks — auth/login/signup, checkout, onboarding, dashboard loading, search, sync. Covers flow mapping (DFDs + step-cost trace tables), bottleneck ranking with code refs, fixing the root mechanism rather than the symptom, centralizing shared primitives (redirect guards, error mappers), thinning the client, hardening edge routes (middleware/guards), deduplicating shared queries, and verifying before shipping. Front-load triggers: "map the flow", "fix the bottleneck", "root cause", "server action vs client", "redirect whitelist", "preserve query", "dedup", "middleware fast-path", "too many requests", "repeated queries".
---

# Flow Refactor Blueprint

A decision-first workflow for tearing down a user flow that has repeated
round-trips, duplicate queries, client/server state races, or slow critical
paths. Ordering is strict: analysis before changes, leaves before consumers,
verify before ship. Works for any flow — auth, checkout, onboarding, feeds,
search, sync — not just one stack or domain.

## The 7 Stages

```
Stage 1 · Map before you change
Stage 2 · Pick the cure, not the symptom
Stage 3 · Build leaf-first (shared primitives before consumers)
Stage 4 · Move the work to the right layer
Stage 5 · Harden the edges
Stage 6 · Close the cost loop (bank the saved work)
Stage 7 · Verify, then ship
```

---

## Stage 1 — Map before you change

Do NOT guess. Produce three artifacts **before editing a single file**:

1. **DFD Level-0** for the flow: every actor, process, data store, and boundary
   (client, middleware/proxy, server component, server action, external
   service/IDP, database). Include any session/token lifecycle explicitly.
2. **Step-by-step trace table**: numbered steps (1..N), each with the code ref
   (`file:line`), what happens, and its **cost** (network round-trip, DB query,
   extra render, blocked thread). Label every round-trip explicitly.
3. **Class/ownership view**: where state lives (client singleton vs server
   cookie/session vs DB), who writes it, who reads it — and any two writers
   racing.

Then **cross-match the sibling flow**. Every flow has a copy (signup↔login,
cart↔wishlist, create↔edit). Map the copy against the primary's findings:
sibling flows share the same architecture and will share the same bugs —
this surfaces issues the primary flow didn't.

## Stage 2 — Pick the cure, not the symptom

- Rank the bottlenecks from the trace table, biggest first, **each with a code
  ref** so nothing is an uncheckable claim.
- Choose fixes **by root mechanism**, not by surface symptom. If the root is
  "two layers race on the same state", fix the ownership (move the write to one
  authoritative place) instead of patching the symptom with retries.
- **Verify the runtime constraint before writing code.** Check the framework
  version and what it actually exports before building on a primitive (e.g.
  don't use `useFormState` if the runtime doesn't ship it — orchestrate the
  same server action with an equivalent you can rely on).

## Stage 3 — Build leaf-first (shared primitives before consumers)

Centralize every primitive more than one caller needs, **before** its
consumers:

- **Safety guards** (redirect/URL whitelists, access checks, input
  sanitizers): one implementation, a strict primitive plus a wrapper that keeps
  allowed payloads (e.g. a query string). Every route/action imports it —
  duplicated copies drift (missing entries, stale patterns).
- **Error mapping**: one mapper from upstream error codes to user-safe copy,
  with a generic fallback and no info disclosure.
- Then point all consumers at the leaf.

Rule: nothing builds on a primitive that doesn't exist yet.

## Stage 4 — Move the work to the right layer

- State-changing exchanges belong **on the server** where you own the cookie /
  session write and can return a single authoritative redirect (no client
  singleton competing with a middleware refresh).
- **Clients become thin**: a form posts plain inputs; the client shows pending,
  error, and success states; it imports no singleton that holds authoritative
  state.
- Handle the "already-done" branch: if the upstream returns the end state
  immediately, go straight to the destination — never dead-end the user on an
  interstitial that can't resolve.

## Stage 5 — Harden the edges

- **Edge routes/guards** (middleware, interceptors, wrappers) are the global
  choke point:
  - Fast-path: skip expensive lookups (auth checks, session validation) on
    public or irrelevant routes when there is nothing to validate — this
    removes the hottest recurring cost.
  - Preserve user intent across the redirect (query strings, context) and
    sanitize it on read: validate the path, carry the payload.
  - Clear poisoned/dead state on failure paths so a retry loop can't persist.
- **Sign-out / disconnect** should use full-page navigation to wipe caches and
  in-memory singletons, not in-place router tricks.

## Stage 6 — Close the cost loop (bank the saved work)

Go back to the Stage 1 trace table and the Stage 2 ranking; systematically
eliminate the duplicates:

- Fetch shared data **once** into a snapshot, then route it through every
  consumer that previously re-queried it.
- When a shared fetch is intentionally unfiltered, preserve the old display
  limit at read time (slice to the previous `.limit()` semantics).

## Stage 7 — Verify, then ship

- **Tests at the leaf/boundary**: unit-test the new primitives (guard, error
  mapper, sanitizer) and the exchanges (failing paths, safe/unsafe inputs,
  preserved payloads). Mock the data/external layer.
- **Full gate**: `typecheck → lint → full test suite`. Fix regressions.
- **Secrets hygiene before push**: confirm `.gitignore` shields env files,
  keys, archives, and stray folders; verify nothing matching is staged.
- Commit with a message naming the mechanism you changed (not just "fixed
  bugs"), then push.

---

## Example instantiation (auth flow)

One concrete application of the general stages — your flow will differ, but the
order of operations holds:

1. Mapped the login flow: DFD + 10-step trace + class view → ranked the
   bottlenecks with code refs.
2. Cross-mapped signup against login → found a dead-end branch and a
   missing session-return path in the copy flow.
3. Chose to move the credential exchange to a server action (the root fix) over
   adding more client retries (the symptom).
4. Centralized the redirect guard, its query-aware wrapper, and the error
   mapper before touching any consumer.
5. Server action owned the exchange, cookie write, and redirect; the form was
   thinned to a plain post with pending/error/success.
6. Hardened the edge guard: skip auth lookups on public routes with nothing to
   validate, preserve the query string, clear poisoned state.
7. Deduped a shared stats query that two consumers each ran (2× → 1×).
8. Added leaf/boundary tests; typecheck + lint + full suite green → committed
   and pushed.
