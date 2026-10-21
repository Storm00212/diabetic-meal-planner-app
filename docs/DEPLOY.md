# Deploying GlucoPlate to Render

Two Render services: the **Backend API** and the **Frontend**. The mobile app
is not deployed — it runs on a phone with Expo Go and talks to whichever API
you point it at.

The commands, environment variables and local run instructions for all three
units are in **[SERVICES.md](SERVICES.md)**.

---

## The order, and why

> **Do the backend first.**

The web app is a Vite single page app, and Vite **inlines environment
variables into the bundle at build time**. So the frontend's build needs the
backend's URL to already exist. If you build the frontend first you would have
to rebuild it once you know the backend URL.

There is one small loop, because the backend needs the frontend's URL for
CORS: the backend's `CORS_ORIGINS` has to list the frontend's origin. You
close that loop in step 4, by editing the backend's environment after the
frontend exists — Render redeploys automatically when you save an environment
variable.

```
1. Backend  → get https://glucoplate-api.onrender.com
2. Frontend → get https://glucoplate-web.onrender.com
3. Frontend → set VITE_API_URL to the backend URL   (rebuild)
4. Backend  → set CORS_ORIGINS to the frontend URL  (redeploy)
5. Test     → npm run test:clients -- <backend> <frontend>
```

---

## Step 1 — the Backend API (Render Web Service)

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
   | Start Command | `npm run start:backend` |
   | Instance Type | **Free** |
   | Health Check Path | `/api/health` |

   > **Why that build command.**
   >
   > `npm install --include=dev` — Render sets `NODE_ENV=production`, which
   > makes npm skip devDependencies; the flag is also in the repo's `.npmrc`,
   > so this is belt and braces. The build needs `typescript`, `prisma` and
   > `tsx`.
   >
   > `npm run db:generate` — the Prisma client is **git-ignored** (it is
   > generated per unit so it cannot be clobbered), so it has to be generated
   > on the build machine.
   >
   > `npm run build:backend` — builds the shared packages in dependency order
   > and then type-checks the API. It is plain `tsc`, not Turborepo, so a
   > host's build command cannot recurse into the task that called it.

4. **Environment** → add:

   ```
   NODE_VERSION   = 22.23.1
   NODE_ENV       = production
   LOG_LEVEL      = info
   JWT_SECRET     = <the same long random string from your .env.local>
   DATABASE_URL        = postgresql://neondb_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15
   DIRECT_DATABASE_URL = <the same URL>
   CORS_ORIGINS     = https://glucoplate-web.onrender.com
   ```

   `PORT` is injected by Render — do not set it.

   > `CORS_ORIGINS` is a guess for now — you will replace it in step 4 with
   > the real frontend URL.

5. **Create Web Service**. The first build takes 3–6 minutes. Watch the log for
   `listening on http://0.0.0.0:<port>`.
6. When it goes green you get a URL like
   `https://glucoplate-api.onrender.com`. **Save it** — that is the API URL.
7. Check it:

   ```bash
   curl https://glucoplate-api.onrender.com/api/health
   # {"ok":true,"service":"glucoplate-api","database":"connected"}
   ```

> **If the health check says `ok: false`** the service is up but the database
> is not. Check `DATABASE_URL` on Render, and check the Neon console for a
> paused compute.

> **If the build fails with `Cannot find module 'prisma'`** the build command
> is missing `--include=dev`.

---

## Step 2 — the Frontend (Render Static Site)

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

## Why "Root Directory" is left blank

Render's **Root Directory** sets the working directory for the build and start
commands. In a monorepo it has to be the repository root, for three reasons:

1. **The build scripts only exist at the root.** `build:backend`, `build:web`
   and `build:mobile` are root scripts. `apps/web/package.json` only has
   `build: vite build`, so a root directory of `apps/web` fails with
   *"Missing script: build:web"*.
2. **The shared packages have to be built first, and their `dist/` is
   git-ignored.** A fresh checkout has no `packages/domain/dist`, so
   `vite build` on its own fails with *"Failed to resolve entry for package
   @glucoplate/domain"*. The root-driven build works, because the script
   builds the dependency packages first.
3. **The backend needs the whole repo at runtime.** `npm run start:backend`
   runs from the root and needs `scripts/` and every `packages/`.

`turbo` and `typescript` are root devDependencies, and npm workspaces install
the entire tree from the root with symlinks — so a blank root gives you every
unit's dependencies, correctly linked, in one `npm install`.

The trade-off is that the backend also downloads the Expo and React Native
dependencies, which makes the build a few minutes rather than one. With 500
build minutes a month that is not worth optimising away.

---

## The free tier, honestly

| Thing | Limit | What it means for you |
|---|---|---|
| Backend (Web Service) | 750 instance-hours **per workspace**, sleeps after 15 min idle | **The first request after a pause takes 30–60 s** — Render has to wake the instance *and* Neon has to wake its compute. **Open the app two minutes before you present.** |
| Frontend (Static Site) | Free, never sleeps, **consumes no instance hours** | No cold start for the UI itself. Only bandwidth and build minutes. |
| Neon | One branch, a handful of connections | The whole backend shares it; `connection_limit=1` keeps it well inside the limit. |
| The keep-alive loop | Uses ~744 of your 750 hours | Only worth it on the machine you will present from. |

### ⚠️ One always-on web service, that is all

Render gives the **workspace** 750 free instance-hours a month, and **every
free web service in the workspace draws from that one pool**. If you ever
create a second always-on web service, you go over the limit and Render
**suspends all of your free web services until the start of next month**.

The static site does not count against instance hours, so a backend plus a
frontend is fine.

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
| The backend build fails on `turbo` or `typescript` | The build command is missing `npm install --include=dev`. |
| Everything works locally but the deployed API is slow | The Neon compute is asleep on the first request. That is the 30–60 s wake-up. Keep it warm. |
| The deployed API returns 502 | Look at the backend's logs — one `x-request-id` ties the failing request to its cause. |

---

## The mobile app is not deployed here

It is an Expo app, run on a phone with Expo Go, and it talks to the same
backend:

```bash
EXPO_PUBLIC_API_URL=https://glucoplate-api.onrender.com npm run dev:mobile
```

A phone on any network can reach the deployed API, so no LAN address is
needed once the API is up.
