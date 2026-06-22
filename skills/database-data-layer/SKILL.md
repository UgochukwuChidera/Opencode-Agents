---
name: database-data-layer
description: Use when designing or implementing database schemas, data models, migrations, seeding, and query layers. Covers Prisma ORM, raw SQL patterns, migration strategies, seed data design, connection pooling, query optimization, and data layer testing. Use with Meta-Architect Stage 2 (domain modeling) outputs.
---

# Database / Data Layer

## Stack-First Principle

Choose your data layer based on the stack, then stick to the pattern:

| Stack | Primary ORM | Migration Tool | Notes |
|-------|-------------|----------------|-------|
| **Node/TypeScript** | Prisma | Prisma Migrate | Default for full-stack JS |
| **Node/TypeScript** | Drizzle | Drizzle Kit | Lighter than Prisma, SQL-like |
| **Python** | SQLAlchemy | Alembic | Mature, flexible |
| **Python** | Django ORM | Django migrations | Only if using Django |
| **Go** | GORM | golang-migrate | Most common Go ORM |
| **Go** | sqlx + sqlc | goose | More SQL control |
| **Rust** | Diesel | Diesel CLI | Type-safe, compile-time checked |
| **Rust** | SQLx | sqlx migrate | Async, compile-time checked |

## Prisma Patterns (Default for Meta-Architect)

### Schema Design Rules

```
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
}
```

- **@id** — always use `cuid()` or `uuid()`, never auto-increment ints for distributed systems
- **@unique** — add for every natural key (email, slug, externalId)
- **Relations** — always explicit (both sides), never implicit
- **@default** — set sensible defaults, not null
- **@updatedAt** — on every entity that gets mutated
- **Optional vs Required** — `String?` is optional, `String` is required. Be intentional.

### Relation Patterns

```prisma
// One-to-one
model User { profile Profile? }
model Profile { user User @relation(fields: [userId], references: [id]); userId String @unique }

// One-to-many
model User { posts Post[] }
model Post { author User @relation(fields: [authorId], references: [id]); authorId String }

// Many-to-many
model Post { tags Tag[] @relation("PostTags") }
model Tag { posts Post[] @relation("PostTags") }
```

### Migration Workflow

```bash
# Initial setup
npx prisma migrate dev --name init

# Development (auto-deletes data — never in prod)
npx prisma migrate dev --name add_user_role

# Production-safe
npx prisma migrate deploy           # apply pending migrations
npx prisma migrate reset --force    # only for dev/test reset

# Check status
npx prisma migrate status
npx prisma migrate diff --from-empty --to-schema-datamodel schema.prisma
```

**Golden rules:**
- Never edit migration files manually. Create a new migration.
- `prisma migrate dev` is for development only — it resets data.
- `prisma migrate deploy` is for production — it never resets.
- Always review the generated SQL before deploying.

### Seed Data Patterns

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Upsert to make seeds idempotent
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
    },
  });
  console.log('Seeded:', user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

```json
// package.json
{ "prisma": { "seed": "tsx prisma/seed.ts" } }
```

```
npx prisma db seed
```

Seed patterns:
- **Upsert** for idempotent seeding (safe to re-run)
- **Fixtures** for test data (isolated, deterministic)
- **Factories** for randomized data (dev/staging only)

## Query Layer Architecture

### Repository Pattern (Recommended)

```typescript
// users.repository.ts
import { PrismaClient } from '@prisma/client';

export class UsersRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: CreateUserInput) {
    return this.prisma.user.create({ data });
  }
}
```

Rules:
- Repositories return domain types, not raw Prisma types
- Repositories don't throw HTTP errors — they throw domain errors
- One repository per aggregate root, not per table
- Transactions cross repositories via `prisma.$transaction`

### Query Optimization

```typescript
// ✅ Selective includes — fetch only what you need
const user = await prisma.user.findUnique({
  where: { id },
  include: { profile: true },  // only include what's needed
});

// ✅ Pagination with cursor (not offset)
const posts = await prisma.post.findMany({
  take: 20,
  cursor: { id: cursor },
  orderBy: { createdAt: 'desc' },
});

// ❌ N+1 problem — avoid this in loops
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}
// ✅ Instead, use include or batch
const usersWithPosts = await prisma.user.findMany({
  include: { posts: true },
});
```

## SQL Migration Patterns

### When to Write Raw SQL
- Complex indexes (partial, covering, concurrent)
- Materialized views
- Full-text search setup
- Custom enum types
- Partitioning
- Triggers and functions

```sql
-- Concurrent index (no table lock on Postgres)
CREATE INDEX CONCURRENTLY idx_posts_author_created
ON posts(author_id, created_at DESC);

-- Partial index
CREATE INDEX idx_active_subscriptions
ON subscriptions(user_id)
WHERE status = 'active';

-- Materialized view for dashboard
CREATE MATERIALIZED VIEW dashboard_metrics AS
SELECT date_trunc('day', created_at) AS day,
       COUNT(*) AS signups
FROM users GROUP BY 1;
```

## Testing the Data Layer

```typescript
// Use a test database or SQLite for tests
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

beforeEach(async () => {
  // Clean slate between tests — fast truncation
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, posts CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Connection Pooling

```typescript
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  // Connection pool defaults are usually fine
  // For high traffic: adjust pool_size in DATABASE_URL
  // postgresql://user:pass@host:5432/db?schema=public&pool_size=10
});
```

- **Serverless**: Use Prisma Accelerate or serverless drivers (@prisma/accelerate, neon, planetscale)
- **Traditional**: PgBouncer or built-in pool
- **Lambda**: Minimum connections, short timeouts
- **Workers**: One connection, reuse across requests

## Data Layer Testing Rules

1. **Test your queries, not Prisma** — test the repository, not the ORM
2. **Use a real test database** — never mock Prisma client for integration tests
3. **Truncate between tests**, not drop-and-recreate (fast)
4. **Seed only what a test needs** — don't share seed state
5. **Test edge cases**: null relations, empty result sets, concurrent writes
