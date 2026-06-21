---
name: api-design
description: Use when designing REST or GraphQL APIs, defining endpoints, request/response shapes, error responses, pagination, versioning, authentication, or OpenAPI specs. Covers RESTful conventions, GraphQL patterns, pagination strategies, idempotency, rate limiting, and API documentation.
---
## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.



# API Design

## RESTful Conventions

### URL Structure
```
GET    /api/v1/users              → list users
POST   /api/v1/users              → create user
GET    /api/v1/users/:id          → get user
PATCH  /api/v1/users/:id          → partial update
PUT    /api/v1/users/:id          → full replacement (rare)
DELETE /api/v1/users/:id          → delete user
GET    /api/v1/users/:id/orders   → sub-resource collection
```

Rules:
- **Plural nouns** for resources (`/users`, not `/user`).
- **Lowercase kebab-case** for multi-word (`/order-items`, not `/orderItems`).
- **No verbs** in URLs — use HTTP methods to express intent.
- **Version prefix** (`/v1/`, `/v2/`) for breaking changes, not `Accept` header or query param.

### HTTP Methods
| Method | Safe | Idempotent | Body |
|--------|------|------------|------|
| GET    | ✅   | ✅         | ❌   |
| POST   | ❌   | ❌         | ✅   |
| PUT    | ❌   | ✅         | ✅   |
| PATCH  | ❌   | ❌         | ✅   |
| DELETE | ❌   | ✅         | ❌   |

### Status Codes — Be Precise
```
200 OK           → successful GET, PUT, PATCH
201 Created      → successful POST (include Location header)
204 No Content   → successful DELETE
400 Bad Request  → malformed syntax, missing required fields
401 Unauthorized → missing or invalid auth credentials
403 Forbidden    → authenticated but not allowed
404 Not Found    → resource doesn't exist
409 Conflict     → version conflict, duplicate, state mismatch
422 Unprocessable → semantic validation failure
429 Too Many Requests → rate limited
500 Internal     → unexpected server error
502/503/504      → upstream/gateway issues
```

## Request/Response Design

### Request Body (POST/PATCH)
```json
{
  "email": "user@example.com",
  "name": "string",
  "optional_field": "omit if null"
}
```
- Accept JSON (`application/json`). Accept `application/x-www-form-urlencoded` for simple forms only.
- Use **snake_case** for JSON keys (widest interop). camelCase is acceptable if frontend-dominated.
- **Never** accept raw IDs from clients for creation — generate on server or use idempotency keys.

### Response Envelope (Pagination)
```json
{
  "data": [
    { "id": "1", "name": "Alice" }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "total_pages": 8,
    "next": "/api/v1/users?page=2&per_page=20",
    "prev": null
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      { "field": "email", "code": "required", "message": "must not be blank" }
    ],
    "request_id": "req_abc123"
  }
}
```

## Pagination

### Cursor-based (preferred for lists)
```
GET /api/v1/users?cursor=eyJpZCI6IjQyIn0&limit=20
Response:
{
  "data": [...],
  "next_cursor": "eyJpZCI6Ijc3In0=",
  "has_more": true
}
```
- Stable under insertion — cursor points to an item, not an offset.
- Encode cursor as base64 of `{ id, sort_value }`.
- Use `limit`, not `per_page` (less ambiguous).

### Offset-based (OK for small/admin UIs)
```
GET /api/v1/users?page=1&per_page=20
```
- Unstable — inserting a row shifts all pages.
- Avoid for real-time feeds.

## Idempotency
- POST requests that create resources should accept an `Idempotency-Key` header.
- Server stores the key + response for 24h. Returns cached response on repeat.
- Use for payments, orders, any operation that must run exactly once.

## Rate Limiting
```
Response headers:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 87
  X-RateLimit-Reset: 1680000000
  Retry-After: 30

On 429:
  { "error": { "code": "RATE_LIMITED", "message": "Too many requests", "retry_after": 30 } }
```

## Authentication
- **Stateless**: JWT in `Authorization: Bearer <token>` header.
- **Stateful**: Session cookie (HttpOnly, Secure, SameSite=Strict).
- API keys: pass in `X-API-Key` header, not query params.
- Never return tokens in response bodies for GET requests.

## GraphQL

### Schema Design
```graphql
type User {
  id: ID!
  email: String!       # @deprecated if removing
  profile: Profile!
  orders(first: Int, after: String): OrderConnection!
}

type Query {
  user(id: ID!): User
  users(search: String, first: Int, after: String): UserConnection!
}
```

Rules:
- **Connections for lists** (Relay spec) — cursor-based pagination built in.
- **Mutations return the mutated object** — never just `{ success: true }`.
- **Input types** for mutation arguments, not inline fields.
- Use `@deprecated` with a reason, not sudden removal.

## OpenAPI / Documentation
- Ship `openapi.yaml` or `openapi.json` from the server.
- Include example values for every field.
- Document auth requirements at the top level (`securitySchemes`).
- Keep it accurate — stale docs are worse than no docs.
