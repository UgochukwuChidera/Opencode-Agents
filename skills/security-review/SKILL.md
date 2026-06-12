---
name: security-review
description: Use when reviewing code for security vulnerabilities, auditing authentication/authorization, handling secrets, or assessing OWASP Top 10 risks. Covers XSS, CSRF, injection attacks, auth patterns (JWT, OAuth, sessions), secret management, dependency scanning, CSP headers, and secure defaults.
---

# Security Review

## OWASP Top 10 — Quick Reference

| # | Vulnerability | What to Look For |
|---|--------------|------------------|
| 1 | **Broken Access Control** | No auth checks on endpoints, IDOR (user A sees user B's data), role bypass |
| 2 | **Cryptographic Failures** | Passwords stored in plaintext, HTTP instead of HTTPS, weak hashes (MD5, SHA1) |
| 3 | **Injection** | Raw SQL concatenation, eval(), unsafe `innerHTML`, shell command injection |
| 4 | **Insecure Design** | No rate limiting, missing encryption at rest, trust of client-side validation |
| 5 | **Security Misconfiguration** | Default credentials, debug endpoints in prod, verbose error messages, unnecessary features enabled |
| 6 | **Vulnerable Components** | Outdated npm/pip/gem packages, known CVEs in dependencies |
| 7 | **Auth Failures** | Weak password policies, no MFA, session fixation, JWTs without expiry |
| 8 | **Data Integrity Failures** | No CSRF protection, unsigned JWTs, missing integrity checks on updates |
| 9 | **Logging & Monitoring** | No audit trail, missing alerting on auth failures, insufficient logging |
| 10 | **SSRF** | User-supplied URLs fetched server-side without allowlisting |

## Web App Security Checklist

### Authentication
- [ ] Passwords hashed with bcrypt (cost ≥ 10), argon2, or scrypt — never MD5/SHA1
- [ ] Rate limiting on login endpoints (5 attempts → 15s lockout)
- [ ] Session tokens are: random, long (≥128 bits), HttpOnly, Secure, SameSite=Strict
- [ ] JWT: signed with strong secret (RS256 or HS256 with ≥256-bit key), short expiry (≤15 min), `iat`/`exp` validated
- [ ] Password reset tokens are one-time-use and expire in ≤ 1 hour
- [ ] MFA is offered for any privileged action

### Authorization
- [ ] Every endpoint checks the user **can** perform the action on **that specific resource**
- [ ] No IDOR — test: can user A access `/api/users/B/data`?
- [ ] Role-based checks at the controller/middleware level, not scattered in templates
- [ ] Admin endpoints are not discoverable via directory brute-force (no `/admin` that bypasses checks)

### Input Validation
- [ ] All user input is validated server-side (client validation is UX only)
- [ ] SQL: use parameterized queries or an ORM — **never** string interpolation
- [ ] HTML: use a sanitizer (DOMPurify, Bleach) before rendering user content
- [ ] File uploads: validate type by content (not extension), set size limits, store outside webroot
- [ ] Shell commands: avoid `exec()` / `eval()` / `child_process.exec()` with user input

### Output Encoding
- [ ] Context-aware encoding: HTML entity encode for HTML, JS encode for `<script>`, URL encode for query params
- [ ] Template engines with auto-escaping (React JSX, Handlebars, Jinja2) — prefer those
- [ ] JSON responses: set `Content-Type: application/json` and escape `<`/`>` to prevent XSS in old browsers

### Headers
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Secrets Management
- [ ] No secrets in source code — use environment variables or a vault (HashiCorp Vault, AWS Secrets Manager)
- [ ] `.env` files are in `.gitignore` — never committed
- [ ] API keys, tokens, passwords are rotated regularly
- [ ] Commit history scanned for accidental secret commits (git-secrets, truffleHog)

## API Security

### Rate Limiting
- Apply per-IP and per-user (authenticated)
- Stricter limits on auth endpoints, password reset, and mutation operations
- Return `Retry-After` header and `429` status

### CORS
```json
{
  "Access-Control-Allow-Origin": "https://trusted-frontend.com", // NOT "*" for auth APIs
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Credentials": "true"  // only if needed
}
```

## Dependency Security
- Run `npm audit`, `pip audit`, `cargo audit`, etc. in CI
- Pin major versions, review minor/patch updates
- Use Dependabot or Renovate for automated PRs
- For critical vulnerabilities: patch within 24h (critical), 7d (high), 30d (medium)
- Remove unused dependencies — they're attack surface

## Secure Defaults
```
❌ opt-in security ("you must add auth...")
✅ opt-out security ("auth is on by default")
❌ "We'll add HTTPS later"
✅ HTTPS from day 1 (LetsEncrypt is free)
❌ "No one will find this debug endpoint"
✅ Disable in production via env var
```

## Code Review Questions
1. Can a user access data they shouldn't? (IDOR check)
2. Is there any SQL/command injection path? (trace user input to exec)
3. Are secrets hardcoded?
4. Is encryption used correctly? (not just "uses crypto" but "uses it right")
5. Are error messages leaking internals? (stack traces = bad)
6. Is authentication checked on every protected route?
7. Is there a rate limit on this endpoint?
8. Are file uploads validated and stored safely?
9. Is CSP set and effective?
10. Would this pass a pen test?
