# The GlucoPlate monorepo

A Turborepo workspace: two frontends, one gateway, four domain services, each
with its own database, and a set of shared packages that hold the contract
between them.

- [1. The target file tree](#1-the-target-file-tree)
- [2. What moved where](#2-what-moved-where)
- [3. Multi-client debugging](#3-multi-client-debugging)
- [4. Root scripts](#4-root-scripts)
- [5. Ports and databases](#5-ports-and-databases)
- [6. Rules of the road](#6-rules-of-the-road)

---

## 1. The target file tree

```
glucoplate/
├── package.json                 # workspaces + every root script
├── turbo.json                   # the task graph
├── tsconfig.json                # extends packages/config
├── eslint.config.mjs            # one flat config for every workspace
├── .npmrc                       # include=dev (survives NODE_ENV=production)
├── .env.local                   # local secrets, git-ignored
│
├── apps/
│   ├── web/                     # ── Vite + React single page app ──
│   │   ├── index.html
│   │   ├── vite.config.ts       # port 5173, @/ -> src, Tailwind 4
│   │   ├── .env.local           # VITE_API_URL -> the gateway
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── styles.css
│   │       ├── app/             # cross-cutting app shell
│   │       │   ├── App.tsx      # the router
│   │       │   ├── AuthProvider.tsx  # token + current user
│   │       │   └── api.ts       # the one API client instance
│   │       ├── features/        # ── one folder per business domain ──
│   │       │   ├── auth/        # AuthPage, AuthForm
│   │       │   ├── overview/    # OverviewPage
│   │       │   ├── catalog/     # DishesPage, components/DishModal
│   │       │   ├── planner/     # PlannerPage
│   │       │   ├── plans/       # PlansPage
│   │       │   ├── analytics/   # AnalyticsPage
│   │       │   ├── health/      # HealthHubPage, components/AIChat
│   │       │   ├── settings/    # SettingsPage, components/BudgetSetup
│   │       │   └── shared/      # DashboardLayout
│   │       └── shared/
│   │           └── components/   # Logo, MedicalDisclaimer, ClinicianBanner
│   │
│   ├── mobile/                  # ── Expo / React Native ──
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── global.css           # the NativeWind entry point
│   │   ├── .env                 # EXPO_PUBLIC_API_URL
│   │   ├── app/                 # Expo Router routes (thin re-exports)
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── login.tsx
│   │   │   └── dashboard/{index,dishes,planner,plans,analytics,health-hub,settings}/index.tsx
│   │   └── src/
│   │       ├── features/        # ── one folder per business domain ──
│   │       │   ├── auth/        # LoginScreen
│   │       │   ├── overview/    # OverviewScreen
│   │       │   ├── catalog/     # DishesScreen, DishModal
│   │       │   ├── planner/     # PlannerScreen
│   │       │   ├── plans/       # PlansScreen
│   │       │   ├── analytics/   # AnalyticsScreen
│   │       │   ├── health/      # HealthHubScreen, AIChat, WeightTracker
│   │       │   └── settings/    # SettingsScreen
│   │       ├── shared/
│   │       │   └── components/   # Logo, MedicalDisclaimer, ClinicianBanner
│   │       └── lib/
│   │           └── api-client.ts # wraps @glucoplate/api-client
│   │
│   ├── gateway/                 # ── the single entry point ──
│   │   ├── .env
│   │   └── src/
│   │       ├── index.ts
│   │       ├── env.ts
│   │       ├── app.ts
│   │       ├── config.ts
│   │       ├── lib/{logger,errors,http,proxy,health}.ts
│   │       └── modules/proxy/proxy.routes.ts   # the routing table
│   │
│   ├── svc-auth/                # ── accounts, JWT, budgets, limits ──
│   │   ├── .env
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # User, Payment
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── env.ts
│   │       ├── app.ts
│   │       ├── config.ts
│   │       ├── lib/{logger,prisma,errors,jwt,http}.ts
│   │       └── modules/auth/{auth.routes,auth.service,auth.repository}.ts
│   │
│   ├── svc-catalog/             # ── the Kenyan dish catalogue ──
│   │   ├── prisma/{schema.prisma,seed.ts}
│   │   └── src/
│   │       ├── ...
│   │       └── modules/dish/{dish.routes,dish.service,dish.repository,dish.catalogue}.ts
│   │
│   ├── svc-planner/             # ── meal plans + the planner algorithm ──
│   │   ├── prisma/{schema.prisma,seed.ts}
│   │   └── src/
│   │       ├── ...
│   │       └── modules/plan/{plan.routes,plan.service,plan.repository}.ts
│   │
│   └── svc-health/              # ── weight, analytics, chat, nutrients ──
│       ├── prisma/{schema.prisma,seed.ts}
│       └── src/
│           ├── ...
│           └── modules/{weight,analytics,chat,nutrients}/
│
├── packages/                    # ── shared, versioned, reusable ──
│   ├── types/                   # the API contract: DTOs, enums, SERVICE_PORTS
│   ├── domain/                  # pure business rules: planner, budget, safety copy
│   ├── data/                    # seed fixtures: the 42 dishes, the 5 personas
│   ├── api-client/              # typed HTTP clients + request tracing
│   ├── ui/                      # design tokens shared by web and mobile
│   └── config/                  # tsconfig.base.json, shared env helpers
│
├── scripts/
│   ├── local-postgres.mjs       # four embedded Postgres instances
│   ├── sync-env.mjs             # fans the root .env.local out per workspace
│   └── smoke.mjs                # cross-service end-to-end test
│
└── docs/
    ├── SERVICE-TEMPLATE.md      # how to write a new service
    ├── MONOREPO.md              # this file
    └── SESSION-1-SETUP.md       # local setup + deploy walkthrough
```

### Why the gateway exists

The four services are genuinely independent — each owns its own database, its
own routes and its own port, and each can be started, stopped and debugged on
its own. The **gateway** is a thin reverse proxy in front of them so that:

- the web and mobile clients only ever need **one** base URL;
- a request can be **traced across every service it touched** from one place;
- a service can be swapped or scaled independently without the clients
  knowing.

The gateway contains no business logic and no database. Talking to a service
directly is always supported and is the normal way to debug one.

---

## 2. What moved where

| From (the old single Next.js app) | To |
|---|---|
| `src/app/api/auth/*` | `apps/svc-auth/src/modules/auth/` |
| `src/app/api/user/*`, `src/app/api/settings` | `apps/svc-auth/src/modules/auth/auth.routes.ts` |
| `src/app/api/dishes/*` | `apps/svc-catalog/src/modules/dish/` |
| `src/app/api/plans/*` | `apps/svc-planner/src/modules/plan/` |
| `src/app/api/weight`, `analytics`, `chat`, `nutrients` | `apps/svc-health/src/modules/` |
| `src/app/dashboard/*` (web pages) | `apps/web/src/features/<domain>/` |
| `src/app/login/*` | `apps/web/src/features/auth/` |
| `src/components/*` | `apps/web/src/shared/components/` **and** `apps/mobile/src/shared/components/` |
| `src/expo-app/*` | `apps/mobile/app/` (routes) + `apps/mobile/src/features/` (screens) |
| `src/db/schema.ts` (Drizzle) | one `prisma/schema.prisma` per service |
| `src/lib/planner.ts`, `budget.ts`, `medical.ts`, `format.ts` | `packages/domain/` |
| `src/lib/types.ts` | `packages/types/` |
| `src/lib/jwt.ts`, `auth.ts` | `apps/svc-auth/src/lib/jwt.ts` (+ a copy in every service that verifies tokens) |
| `src/lib/data/*.json` | `packages/data/src/` |
| `src/proxy.ts` (Next middleware) | `apps/gateway/` (a real proxy instead of a header injector) |
| `next.config.ts`, `postcss.config.mjs`, `drizzle.config.ts` | deleted — the old toolchain is gone |

### Adding a new service

See **[docs/SERVICE-TEMPLATE.md](SERVICE-TEMPLATE.md)**. The short version:

```bash
mkdir -p apps/svc-<name>/{src/lib,src/modules/<name>,prisma}
cp -r apps/svc-auth/src/lib apps/svc-<name>/src/
# then: package.json, prisma/schema.prisma, src/config.ts, src/modules/<name>/
npm run env:sync
npm run db:generate --workspace=@glucoplate/svc-<name>
npm run db:push     --workspace=@glucoplate/svc-<name>
```

Add it to `SERVICE_PORTS` in `packages/types`, to `SERVICE_PORTS`/`DB_PORTS` in
`scripts/sync-env.mjs`, and to the routing table in `apps/gateway/src/routes.ts`.

---

## 3. Multi-client debugging

The question "did this come from the web app, the mobile app, or which
backend service?" is answered by the **request id**.

### How it works

1. The client generates an `x-request-id` and sends it with every request.
2. Every service logs that id with the method, path, status and duration.
3. The gateway forwards the id to the upstream and adds `x-upstream` to the
   response, so the client can see which service answered.
4. The gateway logs the upstream's name next to the id.

So a single id ties together: the browser request, the gateway hop, the
service that handled it, and any service-to-service call in between
(svc-planner → svc-catalog, svc-health → svc-planner).

### Turning on client-side logging

```bash
# web  -> apps/web/.env.local
VITE_DEBUG_API=true

# mobile -> apps/mobile/.env
EXPO_PUBLIC_DEBUG=true
```

Every request and response is then printed to the console with its id:

```
[api:web] → POST http://127.0.0.1:4000/api/auth/login {"requestId":"req_a1b2c3","service":"gateway"}
[api:web] 200 POST http://127.0.0.1:4000/api/auth/login (42ms) {"requestId":"req_a1b2c3"}
```

### Server-side logging

```bash
LOG_LEVEL=debug   # debug | info | warn | error | silent
```

```
2026-10-19T22:56:15.708Z INFO  gateway    GET /api/plans 200 {"requestId":"req_x1y2z3","upstream":"planner","durationMs":31}
2026-10-19T22:56:15.712Z INFO  svc-planner GET /api/plans 200 {"requestId":"req_x1y2z3","durationMs":12}
```

Both lines share `req_x1y2z3`. That is the whole trace.

### Following one request

```bash
# 1. make a request and note the id
curl -i http://127.0.0.1:4000/api/plans -H "Authorization: Bearer $TOKEN"

# 2. grep every service's output for that id
grep "req_x1y2z3" service-logs/*.log
```

### Isolating a problem

| Symptom | Where to look |
|---|---|
| The UI shows an error before any request | The web/mobile console. Turn on `VITE_DEBUG_API` / `EXPO_PUBLIC_DEBUG`. |
| The request never reaches a service | The gateway log — the route table in `apps/gateway/src/routes.ts`. |
| The service returns 500 | That service's log. The `requestId` in the error body matches the client's. |
| The service is up but the data is wrong | The service's own database. Each service has its own. |
| A service-to-service call fails | Look for the upstream's name in the calling service's log. |

### The health check

```bash
curl http://127.0.0.1:4000/api/health
```

```json
{
  "ok": true,
  "service": "gateway",
  "upstream": { "auth": true, "catalog": true, "planner": true, "health": true }
}
```

Each service also answers on its own port, and returns 503 when its database
is unreachable — so "up" and "up but broken" are different answers.

---

## 4. Root scripts

```jsonc
{
  "scripts": {
    // ── everything at once ───────────────────────────────────────────
    "dev":              "turbo run dev --parallel",

    // ── one client ───────────────────────────────────────────────────
    "dev:web":         "turbo run dev --filter=@glucoplate/web",
    "dev:mobile":      "turbo run dev --filter=@glucoplate/mobile",

    // ── one service ───────────────────────────────────────────────────
    "dev:gateway":     "turbo run dev --filter=@glucoplate/gateway",
    "dev:auth":        "turbo run dev --filter=@glucoplate/svc-auth",
    "dev:catalog":     "turbo run dev --filter=@glucoplate/svc-catalog",
    "dev:planner":     "turbo run dev --filter=@glucoplate/svc-planner",
    "dev:health":      "turbo run dev --filter=@glucoplate/svc-health",

    // ── a client next to ONE service (the debugging pair) ────────────
    "dev:web+planner": "turbo run dev --filter=@glucoplate/web --filter=@glucoplate/svc-planner",
    "dev:mobile+gateway": "turbo run dev --filter=@glucoplate/mobile --filter=@glucoplate/gateway",

    // ── the backend as a group ───────────────────────────────────────
    "dev:backend":     "turbo run dev --filter=@glucoplate/svc-* --filter=@glucoplate/gateway --parallel",

    // ── quality gates ────────────────────────────────────────────────
    "build":           "turbo run build",
    "lint":            "turbo run lint",
    "typecheck":       "turbo run typecheck",
    "test":            "turbo run test",
    "clean":           "turbo run clean",

    // ── databases ─────────────────────────────────────────────────────
    "db:local":        "node scripts/local-postgres.mjs",
    "db:local:reset":  "node scripts/local-postgres.mjs --reset",
    "env:sync":        "node scripts/sync-env.mjs",
    "db:generate":     "turbo run db:generate",
    "db:push":         "turbo run db:push",
    "db:seed":         "turbo run db:seed",

    // ── the end-to-end test ───────────────────────────────────────────
    "smoke":           "node scripts/smoke.mjs",

    // ── one-shot setup ────────────────────────────────────────────────
    "setup":           "npm install && npm run env:sync && npm run db:generate && npm run db:push && npm run db:seed"
  }
}
```

### The combinations you will actually use

| Goal | Command |
|---|---|
| Work on the web app with everything running | `npm run dev` |
| Debug one service in isolation | `npm run dev:planner` (plus its database) |
| Debug the web app against one service | `npm run dev:web+planner` |
| Change the shared contract and see it ripple | `npm run dev` — the packages rebuild on change |
| Check the whole system | `npm run smoke` |

### How the pieces start up

```
npm run db:local      # terminal 1 — four Postgres instances, one per service
npm run env:sync      # terminal 2 — writes each service's .env
npm run db:push       # terminal 2 — creates the four schemas
npm run db:seed       # terminal 2 — 42 dishes, 6 accounts, 12 sample plans
npm run dev           # terminal 2 — the gateway, the four services, the web app
```

`npm run dev:mobile` starts Expo Go instead of the web app.

---

## 5. Ports and databases

| Service | Port | Own database | Local DB port |
|---|---|---|---|
| gateway | 4000 | — | — |
| svc-auth | 4001 | `users`, `payments` | 5432 |
| svc-catalog | 4002 | `dishes` | 5433 |
| svc-planner | 4003 | `meal_plans`, `meal_plan_items` | 5434 |
| svc-health | 4004 | `weight_logs`, `weight_targets` | 5435 |
| web (Vite) | 5173 | — | — |
| mobile (Expo) | 8081 | — | — |

The ports live in one place: `SERVICE_PORTS` in `packages/types`. The local
database ports live in `scripts/sync-env.mjs`. Nothing else hard-codes a port.

### Database-per-service, honestly

Each service really does have its own database, so a service cannot join
another service's tables. Where one service needs another's data it calls its
HTTP API and caches the answer for 60 seconds:

- `svc-planner` → `svc-catalog` for the dish catalogue, and → `svc-auth` for
  the caller's limits.
- `svc-health` → `svc-planner` for saved plans (analytics).

If an upstream is unreachable the cached copy is served, and only a cold
service with no cache returns a 503.

**Hosted Postgres:** give each service its own Neon branch (one project, four
branches) or its own Neon project. Then set `DATABASE_URL` and
`DIRECT_DATABASE_URL` per service in Render's environment settings. The pooled
URL needs `?pgbouncer=true` — the pooler is in transaction mode and Prisma
cannot use prepared statements through it.

---

## 6. Rules of the road

1. **A service never reads another service's database.** It calls the API.
2. **Every route lives in a feature module** under `src/modules/<domain>/`.
3. **Ownership is enforced in the query** — `where: { id, userId }`, never in
   the UI.
4. **One error shape**: throw `ApiError`; the middleware renders
   `{ error, code, requestId }`.
5. **Every request is traced** — `requestContext` assigns the id,
   `requestLogger` logs it, the response echoes it.
6. **The contract lives in `packages/types`.** If a request or a response
   changes, change it there first and the compiler finds every consumer.
7. **Business rules live in `packages/domain`** — pure functions, no HTTP, no
   SQL, no framework. Both the services and the clients use them.
8. **Money is KES.** Use `money()` from `@glucoplate/domain`.
9. **Never commit secrets.** `.env.local` and every `apps/*/.env` are
   git-ignored; `.env.example` is the only env file that is tracked.
10. **Safety copy is never hand-written.** Use `PLANNING_AID_NOTICE` and
    `clinicianBannerFor()` from `@glucoplate/domain`.
