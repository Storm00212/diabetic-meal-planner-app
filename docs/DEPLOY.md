# Deploying GlucoPlate to Render

Two Render services: the **backend** (the API) and the **frontend** (the web
app). They are deployed separately, and the order matters.

---

## The order, and why

> **Do the backend first.**

The web app is a Vite single page app, and Vite **inlines environment
variables into the bundle at build time**. So the frontend's build needs the
backend's URL to already exist. If you build the frontend first you would have
to rebuild it once you know the backend URL.

There is one small loop, because the backend needs the frontend's URL for CORS:
the backend's `CORS_ORIGINS` has to list the frontend's origin. You close
that loop in step 4, by editing the backend's environment after the frontend
exists — Render redeploys automatically when you save an environment variable.

```
1. Backend  → get https://glucoplate-xxxx.onrender.com
2. Frontend → get https://glucoplate-web.onrender.com
3. Frontend → set VITE_API_URL to the backend URL   (rebuild)
4. Backend  → set CORS_ORIGINS to the frontend URL  (redeploy)
5. Test     → npm run test:clients -- <backend> <frontend>
```

---

## Step 1 — the backend (Render Web Service)

1. <https://render.com> → sign in with GitHub → **New → Web Service**.
2. Connect the repository.
3. Settings:

   | Field | Value |
   |---|---|
   | Name | `glucoplate-api` |
   | Region | Frankfurt (or Oregon — the same one as your Neon database) |
   | Branch | `main` |
   | Root Directory | *(leave blank)* |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run db:generate && npm run build:backend` |
   | Start Command | `npm run start:all` |
   | Instance Type | **Free** |
   | Health Check Path | `/api/health` |

   > **Why that build command.**
   > `npm install --include=dev` — Render sets `NODE_ENV=production`, which makes
   > npm skip devDependencies; the flag is also in the repo's `.npmrc`, so this
   > is belt and braces. The build needs `typescript`, `prisma` and `turbo`.
   >
   > `npm run db:generate` — the Prisma clients are **git-ignored** (each
   > service generates into its own folder so they cannot clobber each other),
   > so they have to be generated on the build machine.
   >
   > `npm run build:backend` — type-checks the four services and the gateway.
   > It deliberately skips the web app and the Expo app, which have their own
   > services.

4. **Environment** → add:

   ```
   NODE_VERSION   = 22.23.1
   NODE_ENV       = production
   LOG_LEVEL      = info
   JWT_SECRET     = <the same long random string from your .env.local>
   DATABASE_URL        = postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15
   DIRECT_DATABASE_URL = <the same URL>
   POOLED_DATABASE_URL = postgresql://neondb_owner:PASSWORD@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&pgbouncer=true&connection_limit=1&connect_timeout=15&pool_timeout=15
   SVC_AUTH_URL     = http://127.0.0.1:4001
   SVC_CATALOG_URL  = http://127.0.0.1:4002
   SVC_PLANNER_URL  = http://127.0.0.1:4003
   SVC_HEALTH_URL   = http://127.0.0.1:4004
   CORS_ORIGINS     = https://glucoplate-web.onrender.com
   ```

   The `SVC_*_URL` values are `localhost` because **all five services run in
   one container** — `npm run start:all` starts the gateway and the four
   domain services as separate processes, and the gateway proxies to them.
   (That is also how the free tier works: Render gives you 750 instance-hours
   a month, and five separate services would need 3,720.)

   > `CORS_ORIGINS` is a guess for now — you will replace it in step 4 with
   > the real frontend URL.

5. **Create Web Service.** The first build takes 3–6 minutes. Watch the log for
   `listening on http://0.0.0.0:<port>`.
6. When it goes green you get a URL like
   `https://glucoplate-api.onrender.com`. **Save it** — that is the API URL.
7. Check it:

   ```bash
   curl https://glucoplate-api.onrender.com/api/health
   # {"ok":true,"service":"gateway","upstream":{"auth":true,"catalog":true,"planner":true,"health":true}}
   ```

> **If the health check says `ok: false`** the services are up but the
> database is not. Check `DATABASE_URL` on Render, and check the Neon console
> for a paused compute.

> **If the build fails with `Cannot find module 'drizzle-kit'`** the build
> command is missing `--include=dev`.

---

## Step 2 — the frontend (Render Static Site)

1. **New → Static Site** → connect the same repository.
2. Settings:

   | Field | Value |
   |---|---|
   | Name | `glucoplate-web` |
   | Branch | `main` |
   | Root Directory | *(leave blank)* |
   | Build Command | `npm install --include=dev && npm run build:web` |
   | Publish Path | `apps/web/dist` |
   | Node Version | `22.23.1` |

3. **Environment** → add:

   ```
   VITE_API_URL = https://glucoplate-api.onrender.com
   ```

   This is the only variable the frontend needs. It is **baked into the
   bundle at build time**, so changing it means a rebuild — which Render does
   automatically when you save it.

4. **Create Static Site**. Save the URL it gives you:
   `https://glucoplate-web.onrender.com`.

5. **Rewrites** — in the Static Site's settings, under **Rewrites**, add:

   | Source | Destination | Status |
   |---|---|---|
   | `/*` | `/index.html` | `200` |

   The app uses client-side routing, so a direct visit to `/dashboard/planner`
   has to serve `index.html`. The repo also ships `apps/web/public/_redirects`
   with the same rule, so this is belt and braces.

---

## Step 3 — point the frontend at the backend

If you set `VITE_API_URL` in step 2 you can skip this. If you are adding it
later, set it and Render rebuilds:

```
VITE_API_URL = https://glucoplate-api.onrender.com
```

---

## Step 4 — point the backend's CORS at the frontend

In the **backend** service's environment, set:

```
CORS_ORIGINS = https://glucoplate-web.onrender.com
```

Render redeploys the backend when you save. (You can include both the
frontend URL and `http://localhost:5173` for local testing, separated by a
comma.)

---

## Step 5 — test the deployed pair

From your machine:

```bash
npm run test:clients -- https://glucoplate-api.onrender.com https://glucoplate-web.onrender.com
```

That runs 51 checks: the web client's whole journey, the mobile client's whole
journey, the web build, and the mobile bundle. Then:

```bash
npm run audit -- https://glucoplate-api.onrender.com
npm run smoke  -- https://glucoplate-api.onrender.com
```

---

## The free tier, honestly

| Thing | Limit | What it means for you |
|---|---|---|
| Backend (Web Service) | 750 instance-hours/month, sleeps after 15 min idle | **The first request after a pause takes 30–60 s** — Render has to wake the instance *and* Neon has to wake its compute. **Open the app two minutes before you present.** |
| Frontend (Static Site) | Free, never sleeps | No cold start for the UI itself. |
| Neon | One branch, a handful of connections | Four services share it; `connection_limit=1` each keeps it at four. |
| The keep-alive loop | Uses ~744 of your 750 hours | Only worth it on the machine you will present from. |

### Keeping the backend awake

Run this on the machine you will present from. It hits the **health** endpoint,
which queries the database, so it keeps **both** Render and Neon awake:

```bash
while true; do curl -s -o /dev/null https://glucoplate-api.onrender.com/api/health; sleep 300; done
```

---

## If something goes wrong

| Symptom | Cause |
|---|---|
| The frontend loads but every screen says "Failed to load" | The browser is calling the wrong API. Check `VITE_API_URL` was set **before** the build, and that the bundle points at it: `grep -r "onrender.com" apps/web/dist/assets` |
| The browser console says "blocked by CORS policy" | The backend's `CORS_ORIGINS` does not include the frontend's origin. |
| The frontend 404s on `/dashboard/planner` | The rewrite is missing. Add the `/*` → `/index.html` rule. |
| The backend build fails on the Prisma step | `DATABASE_URL` and `DIRECT_DATABASE_URL` must be set on Render **before** the build — `prisma generate` validates the datasource. |
| The backend build fails on `turbo` | The build command is missing `npm install --include=dev`. |
| Everything works locally but the deployed API is slow | The Neon compute is asleep on the first request. That is the 30–60 s wake-up. Keep it warm. |
| The deployed API returns 502 for one path | That upstream is down. `GET /api/health` names it. |

---

## What is *not* deployed here

The **mobile app**. It is an Expo app, run on a phone with Expo Go, and it
talks to the same gateway:

```bash
EXPO_PUBLIC_API_URL=https://glucoplate-api.onrender.com npm run dev:mobile
```

A phone on the same Wi-Fi can reach `https://glucoplate-api.onrender.com`
directly, so no LAN address is needed once the API is deployed.
