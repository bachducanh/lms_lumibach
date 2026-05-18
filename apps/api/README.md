# @lumibach/api — NestJS Backend

REST API backend cho LMS_LumiBach (Phase 1+).

## Dev

```bash
# Từ monorepo root:
pnpm api:dev

# Health check:
curl http://localhost:4000/api/v1/health
```

## Structure

```
src/
├── main.ts                       # bootstrap, CORS, API versioning, prefix /api/v1
├── app.module.ts                 # root module
└── common/
    ├── prisma/                   # PrismaClient provider (re-exports @lumibach/db singleton)
    └── health/                   # GET /api/v1/health
```

## Conventions

- Port: 4000 (override với `API_PORT` env var)
- API prefix: `/api/v1/` (URI versioning, plan ready cho `/api/v2/` mobile)
- `.env`: load từ monorepo root `../../.env` (single source)
- Prisma: import từ `@lumibach/db` qua DI (`constructor(private prisma: PrismaClient)`)
- KHÔNG import trực tiếp từ `@prisma/client` — chỉ qua `@lumibach/db`
