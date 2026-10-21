# The GlucoPlate monorepo

A Turborepo workspace of **three deployable units** — a Frontend, a Backend
API and a Mobile app — plus the shared packages that hold the contract between
them.

- [The tree](#1-the-tree)
- [Why the backend is one process](#2-why-the-backend-is-one-process)
- [Multi-client debugging](#3-multi-client-debugging)
- [Root scripts](#4-root-scripts)
- [The connection configuration](#5-the-connection-configuration)
- [Rules of the road](#6-rules-of-the-road)

---

## 1. The tree

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
│   ├── backend/                 # ── the Backend API ──
│   │   ├── prisma/
│   │   │   ├── schema.prisma    all seven models
│   │   │   └── seed.ts          accounts, catalogue and sample plans
│   │   └── src/
│   │       ├── index.ts         entry point
│   │       ├── env.ts           loads .env before anything reads it
│   │       ├── app.ts           the Express app
│   │       ├── config.ts        the environment
│   │       ├── lib/             logger, prisma, errors, jwt, http
│   │       └── modules/         auth · dish · plans · weight · analytics · chat · nutrients
│   │
│   ├── web/                     # ── the Frontend ──
│   │   ├── index.html
│   │   ├── vite.config.ts       # port 5173, @/ -> src, Tailwind 4
│   │   ├── public/_redirects    # the SPA fallback
│   │   ├── .env.local           # VITE_API_URL -> the backend
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/             # App.tsx (the router), AuthProvider, api.ts
│   │       ├── features/        # ── one folder per business domain ──
│   │       │   ├── auth/        # AuthPage, AuthForm
│   │       │   ├── overview/    # OverviewPage
│   │       │   ├── catalog/     # DishesPage, components/DishModal
│   │       │   ├── planner/     # PlannerPage
│   │       │   ├── plans/       # PlansPage
│   │       │   ├── analytics/   # AnalyticsPage
│   │       │   ├── health/      # HealthHubPage, components/AIChat
│   │       │   └── settings/    # SettingsPage, components/BudgetSetup
│   │       └── shared/
│   │           └── components/   # Logo, MedicalDisclaimer, ClinicianBanner
│   │
│   └── mobile/                  # ── the Mobile app ──
│       ├── app.json
│       ├── babel.config.js
│       ├── metro.config.js
│       ├── global.css           # the NativeWind entry point
│       ├── .env                 # EXPO_PUBLIC_API_URL
│       ├── app/                 # Expo Router routes (thin re-exports)
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   ├── login.tsx
│       │   └── dashboard/{index,dishes,planner,plans,analytics,health-hub,settings}/index.tsx
│       └── src/
│           ├── features/        # ── one folder per business domain ──
│           │   ├── auth/        # LoginScreen
│           │   ├── overview/    # OverviewScreen
│           │   ├── catalog/     # DishesScreen, DishModal
│           │   ├── planner/     # PlannerScreen
│           │   ├── plans/       # PlansScreen
│           │   ├── analytics/   # AnalyticsScreen
│           │   ├── health/      # HealthHubScreen, AIChat, WeightTracker
│           │   └── settings/    # SettingsScreen
│           ├── shared/
│           │   └── components/   # Logo, MedicalDisclaimer, ClinicianBanner
│           └── lib/
│               └── api-client.ts # wraps @glucoplate/api-client
│
├── packages/                    # ── shared, versioned, reusable ──
│   ├── types/                   # the API contract: DTOs, enums
│   ├── domain/                  # pure business rules: planner, budget, safety copy
│   ├── data/                    # seed fixtures: the 95 dishes, the 5 personas
│   ├── api-client/              # typed HTTP clients + request tracing
│   ├── ui/                      # design tokens shared by web and mobile
│   └── config/                  # tsconfig.base.json, shared env helpers
│
├── scripts/
│   ├── local-postgres.mjs       # the embedded local database
│   ├── sync-env.mjs             # writes each unit's .env
│   ├── build-units.mjs          # builds one unit, with its dependencies
│   ├── db-units.mjs             # the database tasks
│   ├── smoke.mjs                # the API, end to end
│   ├── audit-endpoints.mjs      # every endpoint, and that auth is enforced
│   ├── test-swap.mjs            # the swap-and-save flow
│   └── test-clients.mjs         # both clients, against the API
│
└── docs/
    ├── SERVICES.md              # the three services: build, run, environment
    ├── DEPLOY.md                # the click-by-click Render steps
    ├── SERVICE-TEMPLATE.md      # how to write a new module
    └── SESSION-*.md             # what each session changed
```

**📖 [SERVICES.md](SERVICES.md)** has the commands and the environment
variables for each of the three units.

---

## 2. Why the backend is one process

The backend was five services (a gateway and four domain services) before.
That is more moving parts than the problem needed:

- The planner had to fetch the catalogue and the user profile over HTTP, with
  a cache, a timeout and a fallback, because a sleeping downstream service
  must not make the caller wait.
- Five services meant five Prisma clients, five sets of pool settings and
  five databases' worth of connections against one branch.
- The gateway kept a routing table that had to stay in step with the code, and
  a 404 was the failure mode whenever it did not.

Now it is **one process, one database client, one port**. The feature modules
under `src/modules/` still keep their boundaries, so the code stays organised,
but they call each other with ordinary function calls. Generating a plan is
two queries instead of two network round trips, and a plan no longer has a
sixty-second cache between the caller and the numbers.

The deployment is the same shape: one Render Web Service, one Neon database,
one `DATABASE_URL`.

---

## 3. Multi-client debugging

The question "did this come from the web app, the mobile app, or the
backend?" is answered by the **request id**.

1. The client generates an `x-request-id` and sends it with every request.
2. The API echoes it back on the response, logs it with the method, path,
   status and duration, and includes it in every error body.
3. If a client does not send one, the API generates it — so a request from
   `curl` is traceable too.

So one id ties together the browser request, the API's log line and the error
the user saw.

### Turning on client-side logging

```bash
# web  -> apps/web/.env.local
VITE_DEBUG_API=true

# mobile -> apps/mobile/.env
EXPO_PUBLIC_DEBUG=true
```

Every request and response is then printed with its id:

```
[api:web] → POST http://127.0.0.1:4000/api/auth/login {"requestId":"req_a1b2c3"}
[api:web] 200 POST http://127.0.0.1:4000/api/auth/login (42ms) {"requestId":"req_a1b2c3"}
```

### Server-side logging

```bash
LOG_LEVEL=debug   # debug | info | warn | error | silent
```

```
2026-10-21T19:25:01.255Z INFO  glucoplate-api GET /api/plans 200 {"requestId":"req_x1y2z3","durationMs":31}
```

### The health check

```bash
curl http://127.0.0.1:4000/api/health
# {"ok":true,"service":"glucoplate-api","database":"connected"}
```

It returns 503 when the database is unreachable, so "up" and "up but broken"
are different answers.

### Isolating a problem

| Symptom | Where to look |
|---|---|
| The UI shows an error before any request | The web/mobile console. Turn on `VITE_DEBUG_API` / `EXPO_PUBLIC_DEBUG`. |
| The request never reaches the API | The client's `VITE_API_URL` / `EXPO_PUBLIC_API_URL`. A phone cannot reach `localhost`. |
| The API returns 500 | The API's log, with the `requestId` from the error body. |
| The API is up but the data is wrong | The database. One database, seeded with `npm run db:seed`. |
| The build works locally but fails on the host | The host's `DATABASE_URL` and `DIRECT_DATABASE_URL` — `prisma generate` validates them. |

---

## 4. Root scripts

```jsonc
{
  "scripts": {
    "dev":                 "turbo run dev --parallel",
    "dev:backend":         "turbo run dev --filter=@glucoplate/backend",
    "dev:web":             "turbo run dev --filter=@glucoplate/web",
    "dev:mobile":          "turbo run dev --filter=@glucoplate/mobile",
    "dev:web+backend":     "turbo run dev --filter=@glucoplate/web --filter=@glucoplate/backend",
    "dev:mobile+backend":  "turbo run dev --filter=@glucoplate/mobile --filter=@glucoplate/backend",

    "build:backend":       "node scripts/build-units.mjs backend",
    "build:web":           "node scripts/build-units.mjs web",
    "build:mobile":        "node scripts/build-units.mjs mobile",

    "db:local":            "node scripts/local-postgres.mjs",
    "db:local:reset":      "node scripts/local-postgres.mjs --reset",
    "env:sync":           "node scripts/sync-env.mjs",
    "db:generate":         "node scripts/db-units.mjs generate",
    "db:push":             "node scripts/db-units.mjs push",
    "db:seed":             "node scripts/db-units.mjs seed",

    "lint":                "turbo run lint",
    "typecheck":           "turbo run typecheck",
    "test":                "turbo run test",
    "smoke":               "node scripts/smoke.mjs",
    "audit":               "node scripts/audit-endpoints.mjs",
    "test:swap":           "node scripts/test-swap.mjs",
    "test:clients":        "node scripts/test-clients.mjs"
  }
}
```

### The combinations you will actually use

| Goal | Command |
|---|---|
| Work on the web app with everything running | `npm run dev` |
| Debug the API and the web app together | `npm run dev:web+backend` |
| Build one unit for a host | `npm run build:web` (or `build:backend`, `build:mobile`) |
| Check the whole system | `npm run smoke` and `npm run audit` |
| Check both clients against the API | `npm run test:clients` |

---

## 5. The connection configuration

The hosted database allows only a handful of concurrent connections per
branch, and the whole backend shares one. Getting this wrong does not fail
loudly — it fails *slowly*, with queries that take fifteen seconds and
`Server has closed the connection` errors, because the pool is exhausted and
the host is closing connections the API is still holding.

What actually works, measured against the live database:

| Setting | Why |
|---|---|
| **Direct endpoint** (hostname without `-pooler`) | Measured roughly **three times faster** than the pooled endpoint (0.5 s vs 1.8 s for the same query). With a small client pool the pooler only gets in the way. |
| `connection_limit=1` | One connection for the whole backend, well inside the free limit. |
| `connect_timeout=15` | The host scales to zero; waking the compute takes seconds. |
| `pool_timeout=15` | Do not fail fast while the pool is busy. |
| `pgbouncer=true` | **Only** for a pooled endpoint. It disables prepared statements, which the pooler cannot support — but on a direct connection it is an unnecessary slowdown. |

The pooled string is kept as `POOLED_DATABASE_URL` for a serverless
deployment, where many short-lived processes need to share a few connections.

> **One lesson worth keeping:** `npm run db:push` and `npm run db:seed` must
> point at the same database. Use the same flag for both —
> `npm run env:sync -- --neon` and `npm run db:push -- --neon` — or the schema
> goes to one place and the data to another.

---

## 6. Rules of the road

1. **One backend, one database.** A module never reads another module's
   tables directly; it calls the function that owns them.
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
   SQL, no framework. Both the backend and the clients use them.
8. **Money is KES.** Use `money()` from `@glucoplate/domain`.
9. **Never commit secrets.** `.env.local` and every `apps/*/.env` are
   git-ignored; `.env.example` is the only env file that is tracked.
10. **Safety copy is never hand-written.** Use `PLANNING_AID_NOTICE` and
    `clinicianBannerFor()` from `@glucoplate/domain`.
11. **A new endpoint touches three places:** the module that owns it,
    `packages/types/src/index.ts` (the contract) and — if the clients use it —
    `packages/api-client/src/index.ts`. `npm run audit` catches a missing
    route, and `npm run test:clients` catches a client that reads a field the
    API does not return.
