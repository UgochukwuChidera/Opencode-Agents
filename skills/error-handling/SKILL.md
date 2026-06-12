---
name: error-handling
description: Use when handling errors, building error boundaries, designing error responses, or adding logging/observability. Covers Go-style error handling, Rust Result patterns, structured logging, user-facing vs internal errors, retry strategies, circuit breakers, and panic/recovery patterns across languages.
---

# Error Handling Patterns

## Philosophy

Good error handling answers three questions:
1. **What went wrong?** — specific, actionable message
2. **Why did it go wrong?** — root context (stack trace, state snapshot)
3. **What should happen next?** — recover, retry, or fail loud

## Language-Specific Patterns

### Go
```go
// Standard pattern — always check errors
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doing something: %w", err)
}

// Sentinel errors for callers to check
var ErrNotFound = errors.New("not found")

// Wrap with context. NEVER use `errors.New` or `fmt.Errorf` without %w
// for errors that need unwrapping. Use %v for internal-only context.
```

### Rust
```rust
// Result<T, E> — use this, not panics
fn parse(input: &str) -> Result<i32, ParseError> {
    input.parse().map_err(|e| ParseError::Invalid(e.to_string()))
}

// ? operator for propagation
fn process() -> Result<(), AppError> {
    let val = parse("42")?;  // early return on Err
    Ok(())
}

// anyhow for application, thiserror for libraries
// Use unwrap() ONLY in tests or when you've proven invariants hold.
```

### TypeScript / JavaScript
```typescript
// Custom error classes (not plain Error)
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Result type (Rust-inspired)
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function divide(a: number, b: number): Result<number> {
  if (b === 0) return { ok: false, error: new Error("division by zero") };
  return { ok: true, value: a / b };
}
```

### Python
```python
# Specific exceptions, not bare `except:`
class ConfigError(Exception):
    def __init__(self, key: str, message: str):
        self.key = key
        super().__init__(f"Config error for '{key}': {message}")

# EAFP (Easier to Ask Forgiveness than Permission) — Pythonic
try:
    result = risky_operation()
except SpecificError as e:
    logger.error("operation failed", exc_info=e)
    raise
```

## Logging & Observability

### Structured Logging Rules
```
Levels: DEBUG < INFO < WARN < ERROR < FATAL

Rule of thumb:
  DEBUG → developer details, disabled in prod
  INFO  → normal operations, state transitions
  WARN  → unexpected but handled (retry succeeded on 2nd attempt)
  ERROR → operation failed, needs investigation
  FATAL → process cannot continue (avoid unless truly unrecoverable)
```

### What to Include
```json
{
  "timestamp": "ISO-8601",
  "level": "ERROR",
  "message": "Failed to process payment",
  "request_id": "uuid",
  "user_id": "scoped-id",
  "error": "stripe: card_declined",
  "duration_ms": 342,
  "stack": "..."  // only at ERROR/FATAL
}
```

### Don't Log
- Passwords, tokens, API keys, PII, full credit cards
- Binary data or huge payloads (truncate >1KB)
- The same error at multiple levels (choose one)

## User-Facing vs Internal

| Aspect | User-Facing | Internal |
|--------|-------------|----------|
| Tone | "Something went wrong. Please try again." | Full stack + context |
| Detail | Minimal, actionable | Maximum context |
| Technical terms | ❌ | ✅ |
| Error code | "ERR-4231" (ticket-worthy) | Internal ID |
| Retry suggestion | ✅ "Refresh the page" | ❌ |

## Retry Strategy

### Exponential Backoff
```
Attempt 1: wait 100ms
Attempt 2: wait 200ms
Attempt 3: wait 400ms
Attempt 4: wait 800ms
...cap at 30s, jitter ±50%
```

### Circuit Breaker
```
Closed → (failures > threshold) → Open → (timeout) → Half-Open → (success) → Closed
                                         → (failure) → Open (restart timeout)
```

### When NOT to Retry
- 4xx errors (client's fault — retry won't help)
- Authentication failures (credentials are wrong)
- Validation errors (fix the input first)
- Rate limiting (back off, don't retry immediately)

## Recovering from Panics

### Go
```go
defer func() {
    if r := recover(); r != nil {
        log.Printf("panic recovered: %v", r)
        // Clean up resources, then either re-panic or return error
    }
}()
```

### Rust — just use `Result`. `panic!` is for bugs, not recoverable errors.
### Python — `except Exception:` (never bare `except:`)
### JS/TS — `.catch()` on promises, `try/catch` for sync, `window.onerror` / `process.on('unhandledRejection')`

## Database Errors
- Connection timeouts → retry with backoff
- Deadlocks → retry the transaction (the DB will pick a winner)
- Constraint violations → DON'T retry, surface to user
- Migration errors → roll back, fix, re-apply
