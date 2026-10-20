# Session 1 + Monorepo — Setup Guide

Everything below is written for a **clean machine**. Follow the steps in order.
Total time: about 30 minutes if you already have a GitHub account.

---

## 0. What you have now

| Area | Status |
|---|---|
| Monorepo | Turborepo: 2 frontends, 1 gateway, 4 services, 6 shared packages |
| Databases | One per service (database-per-service), Prisma |
| Auth | Stateless JWT, verified by every service, shared `JWT_SECRET` |
| Kenyan data | 42 dishes with KSh prices, carbs, GI, calories |
| Personas | 5 demo users + 1 generic demo account, all with different plans |
| Planner | Carb-target and GI-limit aware — the 5 personas get 5 different plans |
| Safety | "Planning aid, not medical advice" everywhere + a clinician banner for the critical persona |
| Checks | `lint`, `typecheck`, `build` (13 workspaces) and `smoke` (45 cross-service checks) all pass |

📖 **[docs/MONOREPO.md](MONOREPO.md)** — the file tree, the debugging setup and
every root script.
📖 **[docs/SERVICE-TEMPLATE.md](SERVICE-TEMPLATE.md)** — how to add a service.

---

## 1. The hosting decision

### Postgres → **Neon Free** (one project, four branches)

| Option | Expiry | Verdict |
|---|---|---|
| **Neon Free** | **Never expires**, 1 GB/storage, 100 CU-hours/month/project, scale-to-zero after 5 min, **no credit card** | ✅ Use this |
| Render Free Postgres | **Expires 30 days after creation**, then deleted 14 days later | ❌ The judges' accounts would vanish |
| Supabase Free | No expiry, but the project **pauses after ~1 week of inactivity** | ⚠️ Workable, but a paused DB mid-demo is a bad look |
| Aiven Free | Requires a card now | ❌ |

You need **four branches** in one Neon project (one per service): `auth`,
`catalog`, `planner`, `health`. Each branch is a separate database with its
own pooled and direct connection strings.

### Web app → **Render Free web service**

- 0.1 CPU / 512 MB RAM
- **Spins down after 15 minutes without traffic**, ~1 minute to wake
- **750 free instance-hours per workspace per month**

⚠️ **This is the one place the microservices split bites.** Five services as
five Render services would need 5 × 744 = 3,720 hours, but the free tier only
gives 750. So the repo ships **`npm run start:all`**: all five services run
inside **one** container (separate processes, separate ports, separate
databases) and the gateway proxies to them over localhost. One free instance,
no cold-start chain, and the architecture is untouched.

### Other free-tier things to watch

1. **Cold start.** A free service sleeps after 15 minutes idle and takes ~1
   minute to wake. Open the app 2 minutes before you present, or leave the
   keep-alive loop running (§7 step 9).
2. **Neon scale-to-zero** adds ~0.5 s to the first query after 5 minutes
   idle. Invisible to users.
3. **Neon storage 1 GB per branch.** Your data is well under 1 MB.
4. **Prisma + pooled connections** need `?pgbouncer=true` on the runtime
   URL, because the pooler is in transaction mode and Prisma cannot use
   prepared statements through it. The schema already declares a separate
   `directUrl` for schema operations.
5. **M-Pesa Daraja sandbox** is free but shared and rate-limited. The
   callback URL must be registered on the Daraja account.
6. **Expo Go** is free but only supports recent SDKs.

---

## 2. Prerequisites

- **Node.js 22 LTS** (22.11 or newer). Next 16 needs ≥ 20.9; Expo SDK 57
  needs ≥ 20. Node 22 is the sweet spot for both.
- **Git**
- A **GitHub** account (Render deploys from it)
- **Expo Go** on your phone (only needed from Session 3)

```bash
node -v      # must print v22.x
npm -v
git --version
```

> If `npm install` finishes suspiciously fast and `drizzle-kit` is missing,
> your shell has `NODE_ENV=production` set. The repo ships a `.npmrc` with
> `include=dev` that fixes this permanently.

---

## 3. Get the code and install

```bash
git clone https://github.com/YOUR_USERNAME/diabetic-meal-planner-app.git
cd diabetic-meal-planner-app
npm install
```

## 4. Configure

```bash
cp .env.example .env.local
```

Open `.env.local`:

```dotenv
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=verify-full
JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('base64'))">
CORS_ORIGINS=http://localhost:5173,http://localhost:8081,*
```

Then fan those values out to every workspace:

```bash
npm run env:sync
```

This writes `apps/svc-*/.env`, `apps/gateway/.env`, `apps/web/.env.local`
and `apps/mobile/.env`. All of them are git-ignored.

## 5. Run it locally

You do **not** need to install Postgres. The repo embeds one per service.

**Terminal 1** — the four local databases (leave running):

```bash
npm run db:local
```

```
  Local Postgres is running — one database per service.
    auth     postgresql://postgres:postgres@127.0.0.1:5432/postgres
    catalog  postgresql://postgres:postgres@127.0.0.1:5433/postgres
    planner  postgresql://postgres:postgres@127.0.0.1:5434/postgres
    health   postgresql://postgres:postgres@127.0.0.1:5435/postgres
```

**Terminal 2** — create the schemas, load the data, start everything:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

`npm run dev` starts the gateway, the four services and the web app. Open
**<http://localhost:5173>**.

> Vite binds to `localhost` (IPv6) on Windows — `http://localhost:5173`
> works, `http://127.0.0.1:5173` may not.

## 6. Check it

In a third terminal:

```bash
npm run smoke
```

Expected: **`All checks passed.`** (45 checks: every service's health, the
gateway routing table, register/login/me, the 42-dish catalogue, the five
personas' plans, the clinician banner, CORS and request tracing).

```bash
npm run lint        # must print nothing
npm run typecheck   # must print nothing
npm run build       # must succeed
```

## 7. Demo script for the judges

Open <http://localhost:5173/login>. **All five persona accounts use the
password `Gluco@2026`.**

| Persona | Email | Setting | Diabetes | Budget | Carb cap | GI cap |
|---|---|---|---|---|---|---|
| Njeri Wanjiru, 22 | `njeri@glucoplate.app` | Student | Healthy | KSh 200 | 210 g | 55 |
| Brian Oduya, 9 | `brian@glucoplate.app` | Child | Prediabetes | KSh 150 | 150 g | 50 |
| Peter Mwangi, 41 | `peter@glucoplate.app` | Working class | Type 2 controlled | KSh 350 | 180 g | 55 |
| Grace Wanjiku, 68 | `grace@glucoplate.app` | Elderly | Type 2 high risk | KSh 250 | 120 g | 50 |
| Josephine Nyambura, 35 | `josephine@glucoplate.app` | Rural farmer | **Critical** | KSh 120 | 100 g | 45 |
| Demo Patient | `demo@glucoplate.app` | Working class | Type 2 controlled | KSh 300 | 180 g | 55 |

(`demo@` uses the password `demo123` — it is the one-click button.)

**The best 30 seconds of the demo:** sign in as `njeri@` and open the Meal
Planner. Note the plan and the total. Then sign in as `josephine@` — the same
42-dish catalogue, a completely different plan, a tighter budget, a tighter GI
ceiling, and a red **"Talk to your clinician first"** banner at the top of the
screen. That is the whole product thesis.

Other things to try:
- **My Bucket** — all 42 Kenyan dishes with KSh prices and GI badges.
- **Analytics** — carb trends and the GI distribution of what you actually ate.
- Register a brand-new account on the spot — it gets the shared catalogue and
  its own default limits.
- Say the request id out loud: open the browser console with
  `VITE_DEBUG_API=true` and every request prints its id, which is the same id
  in every service's log. That is the "trace it across the system" story.

---

## 8. Deploy to the internet (free)

### 8a. Four Neon branches

1. <https://neon.com> → sign up (no card) → create a project `glucoplate`.
2. Region: **AWS Europe (Frankfurt)** or **Ireland** — closest to Kenya.
3. Create four branches: `auth`, `catalog`, `planner`, `health`. Each needs
   its own branch so each service gets its own database.
4. For each branch, copy the **pooled** connection string. It ends in
   `-pooler`. Change `sslmode=require` to `sslmode=verify-full` (identical
   verified TLS, but it silences a warning on every start). Add
   `&pgbouncer=true` — Prisma needs it through a transaction-mode pooler.
5. Also copy the **direct** connection string for each branch (it does not
   end in `-pooler`) — that is `DIRECT_DATABASE_URL`.

### 8b. Create the schemas and seed the hosted databases

For each of the four branches:

```bash
# macOS / Linux
export DATABASE_URL="postgresql://...@ep-auth-pooler.../neondb?sslmode=verify-full&pgbouncer=true"
export DIRECT_DATABASE_URL="postgresql://...@ep-auth.../neondb?sslmode=verify-full"
npm run db:push --workspace=@glucoplate/svc-auth
npm run db:seed --workspace=@glucoplate/svc-auth
```

```powershell
# Windows PowerShell
$env:DATABASE_URL="postgresql://...@ep-auth-pooler.../neondb?sslmode=verify-full&pgbouncer=true"
$env:DIRECT_DATABASE_URL="postgresql://...@ep-auth.../neondb?sslmode=verify-full"
npm run db:push --workspace=@glucoplate/svc-auth
npm run db:seed --workspace=@glucoplate/svc-auth
```

Repeat for `svc-catalog`, `svc-planner`, `svc-health`.

> The `svc-planner` seed needs to know the user ids that `svc-auth` created.
> It assumes the personas are ids 1..6 in `PERSONAS` order and logs a
> warning saying so. If `svc-auth` was seeded on a fresh database that is
> correct. Otherwise pass `SEED_USER_IDS` as a JSON map of email → id.

### 8c. Create the Render web service

1. <https://render.com> → sign up with the same GitHub account.
2. **New → Web Service** → connect the repository. Or use the
   `render.yaml` blueprint in the repo root.
3. Settings:

   | Field | Value |
   |---|---|
   | Name | `glucoplate` |
   | Region | Frankfurt |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run build` |
   | Start Command | **`npm run start:all`** |
   | Instance Type | **Free** |
   | Health Check Path | `/api/health` |

   `npm run start:all` runs the gateway and the four services in one
   container. The gateway binds Render's `$PORT`; the services stay on
   4001–4004 inside the container and the gateway proxies to them.

4. **Environment**:

   ```
   NODE_VERSION   = 22.23.1
   NODE_ENV       = production
   JWT_SECRET     = <the same long random string>
   LOG_LEVEL      = info
   CORS_ORIGINS   = https://glucoplate.onrender.com
   SVC_AUTH_URL     = http://127.0.0.1:4001
   SVC_CATALOG_URL  = http://127.0.0.1:4002
   SVC_PLANNER_URL  = http://127.0.0.1:4003
   SVC_HEALTH_URL   = http://127.0.0.1:4004
   DATABASE_URL        = <the AUTH branch's pooled URL + ?pgbouncer=true>
   DIRECT_DATABASE_URL = <the AUTH branch's direct URL>
   ```

   > One container, one `DATABASE_URL` pair — but there are four databases.
   > The other three services read their own `DATABASE_URL` from their own
   > `.env`, which is **not** in the container. Two ways forward:
   >
   > - **Recommended:** give each service its own `DATABASE_URL` by giving
   >   each service its own `PORT`-scoped env file inside the image, or
   > - Use **one Neon branch per service** and add a `DATABASE_URL_<SERVICE>`
   >   variable per service, then have `scripts/sync-env.mjs` (or the
   >   container's start script) write the per-service `.env` at boot.
   >
   > The start script already loads each service's own `.env` **before** the
   > root one, so the simplest fix is to write the four `.env` files into the
   > image at build time from four environment variables:
   >
   > ```
   > AUTH_DATABASE_URL=...     CATALOG_DATABASE_URL=...
   > PLANNER_DATABASE_URL=...  HEALTH_DATABASE_URL=...
   > ```
   >
   > then in the build step:
   >
   > ```bash
   > npm run env:sync   # writes apps/svc-*/.env from AUTH_/CATALOG_/... variables
   > ```
   >
   > `scripts/sync-env.mjs` already reads `AUTH_DATABASE_URL`,
   > `CATALOG_DATABASE_URL`, `PLANNER_DATABASE_URL` and
   > `HEALTH_DATABASE_URL`. Add those four to Render's environment and add
   > `npm run env:sync` to the build command.

5. The first deploy takes ~3–5 minutes. Watch for `✓ Compiled successfully`.
6. `https://glucoplate.onrender.com/api/health` should return
   `{"ok":true,"service":"gateway","upstream":{...all true...}}`.
7. Check the deployed stack end to end:
   ```bash
   npm run smoke -- https://glucoplate.onrender.com
   ```

### 8d. Point the mobile app at the deployed gateway

```bash
EXPO_PUBLIC_API_URL=https://glucoplate.onrender.com npm run dev:mobile
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run db:local` says the port is in use | Another Postgres is running. Stop it, or `npm run db:local:reset` first. |
| `db:push` cannot connect | `npm run db:local` is not running, or you are pointing at the wrong branch. |
| A service returns 401 for a token that svc-auth just minted | The `JWT_SECRET` differs between the services. Run `npm run env:sync` so they all share the root `.env.local` value, then restart the services. |
| `PrismaClientInitializationError: prepared statement s0 already exists` | The runtime URL is missing `?pgbouncer=true`. |
| The gateway returns 502 for one path | That upstream is down. `GET /api/health` shows which one. |
| Render shows a 1-minute loading page | Cold start. Hit the URL again, or keep it warm (below). |
| `npm install` removes `drizzle-kit`/`eslint` | `NODE_ENV=production` is set. The repo's `.npmrc` (`include=dev`) prevents this. |
| The mobile app cannot reach the API | A physical device needs your computer's LAN IP, not `localhost`. Set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5173`… actually the *gateway's* port: `http://<your-LAN-IP>:4000`. |

### Keeping the demo warm (optional)

A free Render service sleeps after 15 minutes idle. If you want it always
awake, run this on the machine that will present:

```bash
while true; do curl -s -o /dev/null https://glucoplate.onrender.com/api/health; sleep 600; done
```

That uses ~744 of the 750 free instance-hours for the month.

---

## 10. What to send me next (Session 2)

Reply with one short message containing:

1. **Confirmation the local steps worked** — paste the output of
   `npm run smoke` (should end with `All checks passed.`), or the error.
2. **Your four Neon branch URLs and your Render URL** (hide the passwords), or
   a screenshot of the Neon branch settings with the passwords hidden.
3. **Any environment problems** — e.g. `npm run db:local` failed, or you are
   on an older Node.

### Proposed Session 2 agenda

> **The Kenyan dish catalogue and the planner's reasoning.**
>
> - Grow the catalogue from 42 to ~80–100 dishes with per-county coverage
>   (Luo, Kikuyu, Luhya, Swahili, Kalenjin, Coastal, Maasai, Meru) and
>   accurate per-serving nutrition taken from published Kenyan composition
>   tables rather than estimates.
> - Add serving multiples ("2 chapati") and a portion calculator driven by
>   the persona's age, sex and activity level.
> - Add a **"why this dish"** line to every plan entry — cost vs. budget,
>   GI vs. limit, carbs vs. cap. This is the single most persuasive thing
>   for a judging panel.
> - A **swap** action: "give me an equally cheap but lower-GI version".
> - Finish the web UI polish (the remaining hard-coded `$` labels).
>
> It needs no new accounts, no new services and no M-Pesa work, and it is
> what a judge looks at first.

---

## Appendix — where things live

| Path | What it is |
|---|---|
| `apps/web/src/features/` | the web screens, one folder per domain |
| `apps/mobile/src/features/` | the mobile screens, one folder per domain |
| `apps/gateway/src/routes.ts` | the routing table |
| `apps/svc-*/prisma/schema.prisma` | that service's database, and nothing else |
| `apps/svc-*/src/modules/` | that service's feature modules |
| `packages/types/src/index.ts` | the API contract and `SERVICE_PORTS` |
| `packages/domain/src/index.ts` | the planner, budget rules and safety copy |
| `packages/data/src/` | the 42 dishes and the 5 personas |
| `packages/api-client/src/` | the typed clients and the request tracing |
| `scripts/local-postgres.mjs` | the four local databases |
| `scripts/sync-env.mjs` | fans `.env.local` out to every workspace |
| `scripts/start-all.mjs` | all five services in one container |
| `scripts/smoke.mjs` | the cross-service end-to-end test |
| `render.yaml` | the Render blueprint |
