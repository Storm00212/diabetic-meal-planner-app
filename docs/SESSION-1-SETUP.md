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
| Kenyan data | 95 dishes across 14 counties, with KSh prices, carbs, GI, calories |
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

You do **not** need to install Postgres. The repo embeds one.

**Terminal 1** — the local database (leave running):

```bash
npm run db:local
```

```
  Local Postgres is running — one database, shared by every service.
    postgresql://postgres:postgres@127.0.0.1:5432/postgres
```

**Terminal 2** — create the schema, load the data, start everything:

```bash
npm run env:sync      # writes each service's .env
npm run db:generate   # one Prisma client per service
npm run db:push       # creates the schema
npm run db:seed       # 95 dishes, 6 accounts, 12 sample plans
npm run dev           # the gateway, the four services and the web app
```

`npm run dev` starts the gateway, the four services and the web app. Open
**<http://localhost:5173>**.

> Vite binds to `localhost` (IPv6) on Windows — `http://localhost:5173`
> works, `http://127.0.0.1:5173` may not.

### Working against the hosted database instead

The services and the schema must point at the same place, so use the same
flag for both:

```bash
npm run env:sync -- --neon   # the services use the hosted database
npm run db:push -- --neon    # and the schema goes there too
npm run db:seed
```

Put the hosted URL in the root `.env.local` as `DATABASE_URL` (and
`DIRECT_DATABASE_URL` if your host gives you a separate direct endpoint).

## 6. Check it

In a third terminal:

```bash
npm run smoke
```

Expected: **`All checks passed.`** (45 checks: every service's health, the
gateway routing table, register/login/me, the 95-dish catalogue, the five
personas' plans, the clinician banner, CORS and request tracing).

```bash
npm run lint        # must print nothing
npm run typecheck   # must print nothing
npm run build       # must succeed
npm run test        # the domain tests
npm run smoke       # the cross-service flow
npm run audit       # every endpoint, directly and through the gateway
npm run test:swap   # the swap-and-save flow
```

All of them except the first three need the stack running.

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
95-dish catalogue, a completely different plan, a tighter budget, a tighter GI
ceiling, and a red **"Talk to your clinician first"** banner at the top of the
screen. That is the whole product thesis.

Other things to try:
- **Meal Planner → "Why this dish"** — every meal line explains itself in
  your own numbers: "KSh 70 — 35% of your KSh 200 daily budget, leaving
  KSh 130", "Glycemic index 55 sits right at your limit of 55". This is the
  single most persuasive screen in the app.
- **Swap** — press "Swap" on any meal and GlucoPlate finds a cheaper, lower-
  glycemic-index alternative from the same catalogue.
- **My Bucket** — 95 Kenyan dishes across 14 counties, with KSh prices,
  serving sizes and GI badges.
- **Settings → Your portion profile** — enter your height, weight, age and
  activity level and GlucoPlate works out your daily calories, carbohydrate,
  protein and fat targets from the Mifflin-St Jeor equation.
- **Analytics** — carb trends and the GI distribution of what you actually ate.
- Register a brand-new account on the spot — it gets the shared catalogue and
  its own default limits.
- Say the request id out loud: open the browser console with
  `VITE_DEBUG_API=true` and every request prints its id, which is the same id
  in every service's log. That is the "trace it across the system" story.

---

## 8. Deploy to the internet (free)

### 8a. One Neon database

1. <https://neon.com> → sign up (no card) → create a project `glucoplate`.
2. Region: **AWS Europe (Frankfurt)** or **Ireland** — closest to Kenya.
3. Open **Connection Details**. You want the **direct** connection string —
   the hostname **without** `-pooler`. Copy it as `DATABASE_URL`.
4. **Add the pool parameters.** Four services share this one branch, so every
   connection counts:

   ```
   ?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15
   ```

   - `connection_limit=1` — one connection per service, four in total.
   - `connect_timeout=15` — Neon scales to zero, and waking the compute takes
     seconds.
   - `pool_timeout=15` — do not fail fast while the pool is busy.
   - No `pgbouncer=true` on a direct endpoint: it disables prepared
     statements, which the direct connection supports perfectly well. It
     measured about three times slower.

   A complete URL looks like:

   ```
   postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15
   ```

5. Copy the **pooled** connection string too (the hostname **with**
   `-pooler`) into `POOLED_DATABASE_URL`, with `&pgbouncer=true` added. You
   do not need it for the demo, but it is what you would use if you deployed
   to a serverless host where many short-lived processes share a few
   connections.
6. Put the same string in `DIRECT_DATABASE_URL`, so `prisma db push` uses a
   connection that can run DDL.

### 8b. Create the schema and seed the hosted database

```bash
# macOS / Linux
export DATABASE_URL="postgresql://...&pgbouncer=true&connection_limit=2&connect_timeout=15&pool_timeout=15"
export DIRECT_DATABASE_URL="postgresql://..."

# Windows PowerShell
$env:DATABASE_URL="postgresql://...&pgbouncer=true&connection_limit=2&connect_timeout=15&pool_timeout=15"
$env:DIRECT_DATABASE_URL="postgresql://..."
```

Then:

```bash
npm run db:schema      # builds the combined schema from the four services
npm run db:push        # creates every table
npm run db:seed        # 95 dishes, 6 accounts, 12 sample plans
```

`npm run db:push` is safe to re-run: it applies the combined schema, which
knows about every table, so it never drops one.

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
   DATABASE_URL        = <the Neon direct URL + &sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15>
   DIRECT_DATABASE_URL = <the same URL>
   POOLED_DATABASE_URL = <the Neon pooled URL + &pgbouncer=true>   # optional, for serverless
   ```

   All five services share that one database. The `SVC_*_URL` values are
   localhost because they run inside the same container.

   > **Do not add a second `DATABASE_URL`.** One database, one variable, four
   > services. The pool parameters are what keep that within Neon's
   > connection limit.

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
| `db:push` cannot connect | `npm run db:local` is not running, or the schema was pushed to a different database than the services use. Use the same flag for both: `npm run env:sync -- --neon` and `npm run db:push -- --neon`. |
| Queries take 15+ seconds, or `Server has closed the connection` | The pool is exhausted. Use the **direct** endpoint (no `-pooler`) and `connection_limit=1`. Four services share one branch. |
| `P1001: Can't reach database server` | Neon was asleep. Add `connect_timeout=15` to the URL. |
| The health check says a service is down but it is fine | The hosted database was waking up. The gateway waits 30 s; if you changed that, put it back. |
| A service returns 401 for a token that svc-auth just minted | The `JWT_SECRET` differs between the services. Run `npm run env:sync` so they all share the root `.env.local` value, then restart the services. |
| `PrismaClientInitializationError: prepared statement s0 already exists` | The URL points at a pooled endpoint but is missing `?pgbouncer=true`. |
| The gateway returns 502 for one path | That upstream is down. `GET /api/health` shows which one. |
| Render shows a 1-minute loading page | Cold start. Hit the URL again, or keep it warm (below). |
| `npm install` removes `drizzle-kit`/`eslint` | `NODE_ENV=production` is set. The repo's `.npmrc` (`include=dev`) prevents this. |
| The mobile app cannot reach the API | A physical device needs your computer's LAN IP, not `localhost`. Set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000`. |

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
| `packages/data/src/` | the 95 dishes and the 5 personas |
| `packages/api-client/src/` | the typed clients and the request tracing |
| `scripts/local-postgres.mjs` | the four local databases |
| `scripts/sync-env.mjs` | fans `.env.local` out to every workspace |
| `scripts/start-all.mjs` | all five services in one container |
| `scripts/smoke.mjs` | the cross-service end-to-end test |
| `render.yaml` | the Render blueprint |
