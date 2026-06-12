---
name: testing-strategy
description: Use when writing tests, deciding what to test, structuring test files, choosing mock strategies, setting coverage goals, or designing test infrastructure. Covers test pyramid, unit vs integration vs e2e, mocking rules, test naming, CI integration, flaky test detection, and property-based testing.
---

# Testing Strategy

## The Test Pyramid (Practical)

```
       ╱╲
      ╱ E2E ╲          ← 5-10% — critical user journeys
     ╱────────╲
    ╱ Integration ╲    ← 20-30% — API/DB boundary tests
   ╱────────────────╲
  ╱   Unit Tests      ╲ ← 60-75% — logic, edge cases, pure functions
 ╱──────────────────────╲
```

**Don't be dogmatic** — a CLI tool might have 90% integration tests and no e2e. A data pipeline library might be 100% unit. Adjust based on what breaks.

## What to Test (and What NOT To)

### Always Test
- **Core business logic** — pricing, validation, state transitions
- **Edge cases** — empty states, boundary values, null/undefined
- **Error paths** — what happens when a dependency fails
- **Public API surface** — exported functions, endpoints, component props
- **Regression scenarios** — bugs you've fixed before

### Never Test
- **Frameworks** — don't test that React renders or Express routes work
- **Trivial getters/setters** — unless they have logic
- **Configuration values** — test the *behavior* config enables, not the config itself
- **Third-party behavior** — mock the boundary, not the internals
- **UI pixel positions** — test behavior, not visual layout

## Test Structure Conventions

### File Placement
```
src/
  utils/
    format.ts
    format.test.ts       ← co-located with source
  components/
    Button.tsx
    Button.test.tsx      ← co-located with component
  features/
    auth/
      login.test.ts      ← feature-level integration test
```

### Naming
```
describe('formatCurrency', () => {
  it('formats USD correctly', ...)           // ✅
  it('handles negative values', ...)         // ✅
  it('throws on invalid input', ...)         // ✅
  it('works', ...)                           // ❌
  it('formatCurrency', ...)                  // ❌ redundant
})
```

### AAA Pattern (Arrange-Act-Assert)
```typescript
it('computes total with discount', () => {
  // Arrange
  const items = [/* ... */];
  const discount = 0.1;

  // Act
  const total = calculateTotal(items, discount);

  // Assert
  expect(total).toBe(90);
});
```

## Mocking Rules

### What to Mock
- **Network calls** — `fetch`, `axios`, GraphQL clients
- **System time** — `Date.now()`, `setTimeout`
- **Randomness** — `Math.random()`, UUID generators
- **File system** — `fs.readFile` (unit tests only)
- **Environment** — `process.env`, config objects

### What NOT to Mock
- **String utilities, math, data structures** — use real implementations
- **Your own public API** — prefer real integration over mocked internals
- **Third-party SDKs** — mock at your boundary (wrap them first)

### Mock Names
```
// ❌ Ambiguous — what does "fake" mean?
const fakeDb = { find: () => ... }

// ✅ Clear intent
const inMemoryDb = new Map()
const mockPaymentGateway = { charge: vi.fn() }
const stubLogger = { info: vi.fn(), error: vi.fn() }
const fixtureUser = { id: 1, name: 'Alice' }
```

## Coverage Goals

```
Statements:   ≥ 80%
Branches:     ≥ 75%
Functions:    ≥ 80%
Lines:        ≥ 80%
```

Coverage is a **signal, not a target**. 100% coverage with worthless tests is worse than 70% with meaningful ones. If a branch is untestable by design (e.g., OS-level error that's near impossible to trigger), mark it `/* istanbul ignore next */` with a comment explaining why.

## Flaky Test Management

### Common Causes
```
✓ Async race conditions (missing await) → add proper waits
✓ Time-dependent tests (wall clock) → use fake timers
✓ Test order dependency → each test must set up and tear down its own state
✓ Network-dependent tests → mock or use Wiremock/Testcontainers
✓ Shared mutable state → reset between tests in beforeEach/afterEach
```

### When a Test Flakes
1. **Mark it** with `.skip` or `test.skip` immediately — don't let it poison CI.
2. **Tag it** `// FLAKY: <issue-url>` so it's tracked.
3. **Fix or delete** within the same sprint.

## Testing Patterns by Type

### Unit Tests
```typescript
// Pure function — no mocking needed
it('returns true for valid emails', () => {
  expect(isValidEmail('a@b.com')).toBe(true);
});
```

### Integration Tests
```typescript
// Test the boundary — real DB, mocked HTTP
it('persists user to database', async () => {
  const db = await createTestDatabase();
  const user = await createUser(db, { name: 'Alice' });
  expect(await db.query('SELECT * FROM users WHERE id = $1', [user.id])).toHaveLength(1);
  await db.destroy();
});
```

### E2E Tests
- Test **critical paths only**: login, purchase, signup flow.
- Use Playwright or Cypress.
- Keep selectors stable: `data-testid="submit-button"`, not CSS class names.
- Run in CI against a preview deployment, not production.

## Property-Based Testing
```typescript
// Instead of 5 hand-picked examples, test 100 random ones
it('reversing a string twice gives the original', () => {
  fc.assert(
    fc.property(fc.string(), (str) => {
      expect(reverse(reverse(str))).toBe(str);
    })
  );
});
```
Good for: parsing, serialization, validation, idempotent operations, sorting.

## CI Integration
- Unit + Integration: run on every push (fast, <5 min).
- E2E: run on merge to main / pre-release (slow, <20 min).
- Coverage: enforce threshold, fail if below.
- Test splitting: parallelize by file for speed.
