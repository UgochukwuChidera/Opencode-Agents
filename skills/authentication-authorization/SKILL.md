---
name: authentication-authorization
description: Use when implementing auth — login, registration, session management, JWT, OAuth, password hashing, RBAC, API keys, MFA, and security headers. Covers both stateless (JWT) and stateful (session) patterns, social login, permission models, and auth testing.
---

# Authentication & Authorization

## First Decision: Stateless vs Stateful

| | JWT (Stateless) | Sessions (Stateful) |
|---|---|---|
| **Storage** | Client (token) | Server (DB/Redis) |
| **Scale** | No server state — easy horizontal scale | Need shared session store (Redis) |
| **Revoke** | Hard — wait for expiry or maintain blocklist | Instant — delete session |
| **Payload** | Visible to client (don't put secrets) | Opaque to client |
| **Best for** | APIs, mobile, SPAs, microservices | Server-rendered apps, high-security |
| **Library** | `jsonwebtoken`, `jose` | `express-session`, `iron-session` |

**Default for Meta-Architect projects:** JWT with refresh tokens (stateless API + stateful refresh).

## JWT Pattern (Default)

### Token Structure

```typescript
interface JwtPayload {
  sub: string;        // user id — never email (emails change)
  role: string;       // for quick authz checks
  iat: number;        // issued at
  exp: number;        // expiry
  jti?: string;       // token id (for revocation)
}
```

### Implementation

```typescript
// auth.service.ts
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

export function generateTokens(user: { id: string; role: string }) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, jti: crypto.randomUUID() },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken, expiresIn: 900 };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string; jti: string };
}
```

### Refresh Token Rotation

```typescript
// On every refresh: issue new pair, invalidate old refresh token
export async function refreshTokens(oldRefreshToken: string, prisma: PrismaClient) {
  const payload = verifyRefreshToken(oldRefreshToken);

  // Check if token was already used (rotation prevents replay)
  const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
  if (!stored) throw new Error('Token revoked — possible theft');

  // Delete old token, issue new pair
  await prisma.refreshToken.delete({ where: { jti: payload.jti } });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
  const tokens = generateTokens(user);

  await prisma.refreshToken.create({
    data: { jti: jwt.decode(tokens.refreshToken)!.jti, userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });

  return tokens;
}
```

### Auth Middleware

```typescript
// auth.middleware.ts
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = verifyAccessToken(header.split(' ')[1]);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'token_expired' });
  }
}
```

## Password Hashing

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;  // ~250ms — balance security vs speed

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- **Never** store plaintext passwords
- **Never** use MD5, SHA1, or SHA256 for passwords
- **Always** use bcrypt, argon2, or scrypt
- **Rate limit** login attempts (5 failures → 15min lockout)

## Password Reset Flow

```
1. User requests reset → generate crypto.randomToken(32)
2. Store hash(token) in DB with 1hr expiry
3. Email user the raw token (not the hash)
4. User submits token + new password
5. Verify hash(token) against stored hash
6. Invalidate all refresh tokens for that user
7. Confirm success, redirect to login
```

## OAuth / Social Login

```typescript
// strategy: google, github, discord, etc.
export async function handleOAuthCallback(provider: string, code: string) {
  // 1. Exchange code for access token
  const token = await exchangeCode(provider, code);
  
  // 2. Fetch user profile
  const profile = await fetchProfile(provider, token);
  
  // 3. Find or create user
  let user = await prisma.user.findUnique({
    where: { oauthId: `${provider}:${profile.id}` },
  });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        oauthId: `${provider}:${profile.id}`,
        oauthProvider: provider,
      },
    });
  }
  
  // 4. Issue JWT
  return generateTokens(user);
}
```

## Authorization (RBAC)

```typescript
// Define roles and permissions
const ROLES = {
  USER:   ['read:own', 'write:own'],
  MOD:    ['read:any', 'write:own', 'moderate:content'],
  ADMIN:  ['read:any', 'write:any', 'manage:users', 'manage:system'],
} as const;

type Permission = string;

export function authorize(userRole: string, requiredPermission: Permission): boolean {
  return (ROLES[userRole as keyof typeof ROLES] ?? []).includes(requiredPermission);
}

// Middleware
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!authorize(req.user.role, permission)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}
```

## API Keys (for Machine-to-Machine)

```typescript
// Generate: prefixed key for easy identification
function generateApiKey(): { prefix: string; key: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const prefix = raw.slice(0, 8);  // sk_live_abc123...
  const key = `sk_${prefix}_${raw}`;
  const hashed = crypto.createHash('sha256').update(key).digest('hex');
  return { prefix, key, hashed };
  // Store `hashed` in DB, return `key` to user once
}
```

## Security Headers

```typescript
// helmet setup for Express
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

## Auth Testing

```typescript
// Test helper — generates valid tokens for tests
export function createTestToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, TEST_SECRET, { expiresIn: '1h' });
}

// What to test:
// ✓ Successful login returns tokens
// ✓ Invalid credentials return 401
// ✓ Expired token returns 401
// ✓ Missing token returns 401
// ✓ Invalid role returns 403
// ✓ Refresh token rotation works
// ✓ Password reset flow completes
// ✓ Rate limiting kicks in after N attempts
// ✓ Concurrent sessions don't break
```
