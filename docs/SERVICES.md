# The three services — technical guide

GlucoPlate is three deployable units that share one contract:

| Unit | Directory | What it is | Deployed as |
|---|---|---|---|
| **Backend API** | `apps/backend` | One Express app. Every endpoint, one database. | Render **Web Service** |
| **Frontend** | `apps/web` | A Vite + React single page app. | Render **Static Site** |
| **Mobile** | `apps/mobile` | An Expo app for Expo Go. | Not deployed — it runs on a phone |

They share `packages/*` (the contract, the business rules, the design tokens) and
`packages/api-client` (the typed client both clients use), so a change to an
endpoint is a compile error in every consumer.

```
packages/types        the API contract: DTOs, enums, request and response shapes
packages/domain      pure business rules: the planner, the budget maths, safety copy
packages/data        the seed fixtures: the Kenyan dishes and the demo personas
packages/api-client  the typed HTTP client both clients use, with request tracing
packages/ui          design tokens shared by web and mobile
packages/config      shared tsconfig and environment helpers
```

---

## 1. The Backend API

`apps/backend` — one Express process, one Prisma client, one database, one
port. The feature modules keep their boundaries, so the code stays organised,
but they talk to each other with direct function calls.

```
apps/backend/
├── prisma/
│   ├── schema.prisma    all seven models
│   └── seed.ts          accounts, catalogue and sample plans, in one script
├── src/
│   ├── index.ts         entry point
│   ├── app.ts           the Express app
│   ├── config.ts        the environment
│   ├── lib/             logger, prisma, errors, jwt, http
│   └── modules/         auth · dish · plans · weight · analytics · chat · nutrients
└── generated/prisma    the Prisma client, git-ignored
```

### Build

```bash
npm install --include=dev
npm run db:generate      # prisma generate -> apps/backend/generated/prisma
npm run build:backend    # builds the shared packages, then type-checks the API
```

`npm run build:backend` runs `node scripts/build-units.mjs backend`, which:

1. builds the shared packages in dependency order (`config`, `types`, `data`,
   `ui`, `domain`, `api-client`) — a fresh checkout has no `dist/` folders,
   so this has to happen first;
2. generates the Prisma client;
3. type-checks the API with `tsc --noEmit`.

It is deliberately plain `tsc` rather than Turborepo, so that pointing a
host's build command at one unit cannot recurse into the task that called it.

### Start

```bash
npm run dev:backend      # tsx watch, restarts on change
npm run start:backend    # the same, without the watcher (what a host runs)
```

It listens on `PORT` (default **4000**). Check it:

```bash
curl http://127.0.0.1:4000/api/health
# {"ok":true,"service":"glucoplate-api","database":"connected"}
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | The pooled Postgres connection. Must carry `?pgbouncer=true&connection_limit=1&connect_timeout=15&pool_timeout=15` on a pooled endpoint. |
| `DIRECT_DATABASE_URL` | **yes** | `DATABASE_URL` | The direct connection, used by `prisma db push` and the seed. |
| `JWT_SECRET` | **yes** | a dev fallback | Signs and verifies the access tokens. **Must be identical in every deployment** and at least 32 characters. |
| `CORS_ORIGINS` | no | `*` | Comma-separated list of browser origins allowed to call the API. Put the frontend's URL here. |
| `PORT` | no | `4000` | The port to listen on. Render injects it. |
| `NODE_ENV` | no | — | Set to `production` on the host. |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` \| `silent`. |
| `NODE_VERSION` | no | — | Render reads this to pick the Node version. Use `22.23.1`. |
| `JWT_TTL_SECONDS` | no | 7 days | How long an access token stays valid. |

### Database

One database, shared by the whole backend. The schema lives in
`apps/backend/prisma/schema.prisma`.

```bash
npm run env:sync                    # point the services at the local database
npm run db:generate                 # the Prisma client
npm run db:push                     # create the tables
npm run db:seed                     # 6 accounts, 95 dishes, 2 sample plans each
```

`npm run env:sync -- --neon` points the same scripts at the hosted database
instead. **Use the same flag for both** or the schema and the data end up in
different places.

---

## 2. The Frontend

`apps/web` — a Vite + React 19 + React Router 7 + Tailwind 4 single page app.
Feature-driven: `src/features/<domain>/` holds one folder per business domain,
`src/shared/components/` holds the pieces both the web and the mobile app
render.

```
apps/web/src/
├── main.tsx
├── app/
│   ├── App.tsx          the router
│   ├── AuthProvider.tsx the token and the current user
│   └── api.ts           the one API client instance
├── features/            auth · overview · catalog · planner · plans · analytics · health · settings
└── shared/components/   Logo · MedicalDisclaimer · ClinicianBanner
```

### Build

```bash
npm install --include=dev
npm run build:web       # -> apps/web/dist
```

`npm run build:web` runs `node scripts/build-units.mjs web`: it builds the
shared packages (so `@glucoplate/domain` and `@glucoplate/api-client` resolve)
and then `vite build`. The output is a **static** site — `index.html`, an
`assets/` folder and a `_redirects` file for the SPA fallback.

### Start

```bash
npm run dev:web                       # the Vite dev server on :5173
npm run preview --workspace=@glucoplate/web   # serve the built site
```

In production the static files are served by the host's CDN, not by a process.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_URL` | **yes** | — | The Backend API's base URL. **Baked into the bundle at build time**, so changing it means a rebuild. |
| `VITE_DEBUG_API` | no | `false` | `true` prints every request and response with its request id. |

### One thing to get right

The app uses client-side routing, so a direct visit to `/dashboard/planner`
has to serve `index.html`. The repo ships `apps/web/public/_redirects` with
`/*  /index.html  200`, and Render's Static Site needs the same rule in its
**Rewrites** setting.

---

## 3. The Mobile app

`apps/mobile` — Expo SDK 57 with Expo Router and NativeWind. The routes live
in `apps/mobile/app/` (thin files that re-export a screen) and the screens
live in `apps/mobile/src/features/<domain>/`.

```
apps/mobile/
├── app.json
├── babel.config.js
├── metro.config.js
├── global.css           the NativeWind entry point
├── app/                 the Expo Router routes
└── src/
    ├── features/         auth · overview · catalog · planner · plans · analytics · health · settings
    ├── shared/           Logo · MedicalDisclaimer · ClinicianBanner
    └── lib/api-client.ts the typed client, with the token in SecureStore
```

### Build

```bash
npm install --include=dev
npm run build:mobile     # -> apps/mobile/dist (an Android bundle)
```

### Start

```bash
npm run dev:mobile       # Expo Go
npm run dev:mobile -- --web    # in a browser
```

Scan the QR code with **Expo Go** on the phone.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | **yes** | — | The Backend API's base URL. A phone cannot reach `localhost`, so on a device this has to be your computer's LAN address (`http://192.168.x.x:4000`) or the deployed API. |
| `EXPO_PUBLIC_DEBUG` | no | `false` | `true` prints every request and response with its request id. |

The mobile app is **not** deployed to Render. It talks to whichever API you
point it at.

---

## Running the whole thing locally

```bash
# terminal 1 — the local database
npm run db:local

# terminal 2
npm run env:sync
npm run db:generate && npm run db:push && npm run db:seed
npm run dev              # the backend, the web app and Expo together
```

| Unit | Address |
|---|---|
| Backend API | http://127.0.0.1:4000 |
| Frontend | http://localhost:5173 |
| Mobile | Expo Go, via the LAN address |

### The scripts

| Command | What it does |
|---|---|
| `npm run dev` | Everything, in parallel |
| `npm run dev:backend` / `dev:web` / `dev:mobile` | One unit |
| `npm run dev:web+backend` | The web app and the API — the debugging pair |
| `npm run build:backend` / `build:web` / `build:mobile` | Build one unit |
| `npm run db:local` | The local database |
| `npm run env:sync` | Write each unit's `.env` |
| `npm run db:generate` / `db:push` / `db:seed` | The database |
| `npm run lint` / `typecheck` / `test` | The quality gates, every unit |
| `npm run smoke` | The API, end to end |
| `npm run audit` | Every endpoint, and that auth is enforced on all of them |
| `npm run test:swap` | The swap-and-save flow |
| `npm run test:clients` | Both clients, against the API |

---

## How the three talk to each other

```
    web (5173)  ─┐
                 ├──►  Backend API (4000)  ──►  Postgres (one database)
   mobile       ─┘            │
                              └── one process, one Prisma client
```

- Both clients use `packages/api-client`, so they send the same requests and
  read the same shapes.
- The Backend API is a single process: the planner reads the catalogue and the
  user record with two ordinary queries, not two HTTP hops.
- Every request carries an `x-request-id`. The API echoes it back, logs it
  with the method, path, status and duration, and returns it in the error body
  — so one id follows a request from the browser into the log.

---

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for the click-by-click steps, the Render
settings and the free-tier limits.

The short version:

| | Backend API | Frontend |
|---|---|---|
| Render type | Web Service | Static Site |
| Build command | `npm install --include=dev && npm run db:generate && npm run build:backend` | `npm install --include=dev && npm run build:web` |
| Start command | `npm run start:backend` | — (static) |
| Publish path | — | `apps/web/dist` |
| Health check | `/api/health` | — |
| Environment | `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` | `VITE_API_URL` |

**Deploy the backend first.** `VITE_API_URL` is inlined into the frontend's
bundle at build time, so the frontend's build needs the backend's URL.
