---
name: deployment-devops
description: Use when setting up deployment, Docker, CI/CD, environment configuration, hosting, and infrastructure. Covers Dockerfile patterns, docker-compose for dev, CI pipeline setup (GitHub Actions), environment variable management, production hardening, and cloud deployment (Railway, Fly.io, AWS, Vercel).
---

# Deployment / DevOps

## Docker Patterns

### Multi-stage Dockerfile (Node)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system app && adduser --system -G app app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
USER app
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
```

### Layered Dockerfile for Fast Builds

```dockerfile
# Leverage Docker layer caching — least-changing layers first
FROM node:20-alpine
WORKDIR /app

# 1. Dependencies (rarely changes)
COPY package*.json ./
RUN npm ci --only=production

# 2. Build deps (changes occasionally)
RUN npm ci --only=development
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

# 3. App code (changes most frequently)
COPY src ./src
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### docker-compose for Development

```yaml
version: '3.8'
services:
  app:
    build: .
    ports: ['3000:3000']
    env_file: .env
    volumes:
      - .:/app          # hot reload
      - /app/node_modules
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: devpassword
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

volumes:
  pgdata:
```

## Environment Configuration

### File Structure

```
.env              # local dev (gitignored)
.env.example      # template (committed)
.env.production   # production secrets (deployed via CI, not in repo)
```

### Validation Pattern

```typescript
// env.ts — validated and typed
import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  REDIS_URL: process.env.REDIS_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
} as const;
```

## CI/CD (GitHub Actions)

### CI — Test & Lint Every Push

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test }
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: 'postgres://postgres:test@localhost:5432/postgres' }
      - run: npm test
        env: { DATABASE_URL: 'postgres://postgres:test@localhost:5432/postgres' }
      - run: npx tsc --noEmit
```

### CD — Deploy on Main

```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app .
      - run: echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
      - run: docker push ghcr.io/myorg/app:latest
      # Or: deploy to Railway / Fly.io / SSH + docker-compose
```

## Production Hardening Checklist

```
□ NODE_ENV=production
□ Logging to stdout (structured JSON), not to files
□ Health check endpoint: GET /health → { status: "ok" }
□ Graceful shutdown (SIGTERM handler)
□ Rate limiting (express-rate-limit, upstash)
□ CORS restricted to known origins
□ HTTP headers via helmet
□ No verbose error messages in production
□ Database: connection pooling, statement timeout, max connections
□ Secrets: never in code, always through env/CI secrets
□ Docker: run as non-root user
□ Docker: read-only root filesystem where possible
```

## Cloud Deployment Options

### Railway (Simplest)
```bash
railway login
railway init
railway up           # auto-detect Node, deploy
```

### Fly.io
```toml
# fly.toml
app = "myapp"
primary_region = "iad"
[http_service]
  internal_port = 3000
  force_https = true
```

```bash
fly launch
fly deploy
fly secrets set DATABASE_URL=...
```

### Vercel (Frontend)
```bash
vercel --prod
# Set env vars in Vercel dashboard
```

### AWS (Full Control)
```
ECS + Fargate → Docker containers, no servers
RDS → Managed Postgres
ElastiCache → Managed Redis
S3 → File storage
Secrets Manager → Env secrets
CloudFront → CDN
```

## Database in Production

| Concern | Solution |
|---------|----------|
| Connection pooling | PgBouncer or built-in pool |
| Backups | Automated daily + WAL archiving |
| Migrations | Run as separate deploy step, not at app startup |
| Read replicas | For read-heavy workloads |
| Migrations safety | `CREATE INDEX CONCURRENTLY` to avoid locks |

### Safe Migration Deploy

```bash
# Step 1: Apply migrations (no downtime)
npx prisma migrate deploy

# Step 2: Restart app with new code
docker compose up -d --build app
```

## Monitoring

```typescript
// Structured JSON logging (not console.log)
const logger = {
  info: (msg: string, meta?: object) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, timestamp: new Date().toISOString() })),
  error: (msg: string, err?: Error) =>
    console.error(JSON.stringify({ level: 'error', msg, error: err?.message, stack: err?.stack, timestamp: new Date().toISOString() })),
};
```

- **Health check**: GET /health — return DB connection status, memory, uptime
- **Metrics**: Prometheus + Grafana (or managed: Datadog, New Relic)
- **Logs**: stdout → CloudWatch / Loki / Papertrail
- **Alerts**: PagerDuty / Slack webhook on 5xx spike

## Zero-Downtime Deploy

```
1. Build new image
2. Push to registry
3. Start new container (alongside old)
4. Wait for health check
5. Route traffic to new container
6. Stop old container
```

Docker Compose:
```yaml
# docker-compose.prod.yml
app:
  deploy:
    replicas: 2
    update_config:
      parallelism: 1
      order: start-first  # zero-downtime
```
