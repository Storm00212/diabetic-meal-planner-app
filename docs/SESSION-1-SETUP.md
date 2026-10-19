# Session 1 — Backend Foundation: Setup Guide

Everything below is written for a **clean machine**. Follow the steps in order.
Total time: about 25 minutes if you already have a GitHub account.

---

## 0. What Session 1 delivered (so you know what you are looking at)

| Area | Status |
|---|---|
| Route discovery fixed | Next.js now owns `src/app` (was invisible at `src/app_web`); Expo Router moved to `src/expo-app` |
| Auth | Cookie sessions replaced with **JWT** access tokens (`src/lib/jwt.ts`, `src/lib/auth.ts`). `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Schema | `users`, `dishes`, `meal_plans`, `meal_plan_items`, `weight_logs`, `payments` rewritten in `src/db/schema.ts` |
| Kenyan data | 42 Kenyan dishes with KES prices, carbs, GI, calories (`src/lib/data/kenyan-dishes.json`) |
| Personas | 5 demo users + 1 generic demo account (`src/lib/data/personas.json`) |
| Planner | Carb-target and GI-limit aware, so the 5 personas get genuinely different plans (`src/lib/planner.ts`) |
| Currency | USD → KES everywhere (`src/lib/format.ts`) |
| Safety | "Planning aid, not medical advice" notice everywhere + "consult your clinician" banner for the critical persona |
| Local database | Embedded Postgres (`npm run db:local`) so you need no local Postgres install |
| Tests | `npm run smoke` — 45 end-to-end checks against a running server |

> **Note:** The web UI was **not** redesigned in this session, per your instruction.
> Two cosmetic gaps are listed in §9.

---

## 1. The hosting decision (read this before creating any accounts)

### Postgres → **Neon Free** (recommended)

| Option | Expiry | Storage | Verdict |
|---|---|---|---|
| **Neon Free** | **Never expires** | 1 GB/project, 100 CU-hours/month/project, scale-to-zero after 5 min | ✅ **Use this** |
| Render Free Postgres | **Expires 30 days after creation**, then deleted 14 days later | 1 GB | ❌ Judges' accounts would be wiped |
| Supabase Free | No expiry, but the project is **paused after ~1 week of inactivity** and resumes on a delay | 500 MB | ⚠️ Workable, but a paused DB mid-demo is a bad look |
| Aiven Free | Requires a card now | — | ❌ |

Neon Free needs **no credit card**, never expires, and is a real Postgres. Your
whole dataset (42 dishes, 6 users, plans) is well under 1 MB, so the 1 GB cap
is irrelevant. 100 CU-hours/month is ~400 hours of active compute — a demo
uses a rounding error of that.

### Web app → **Render Free web service**

- 0.1 CPU / 512 MB RAM
- **Spins down after 15 minutes without traffic**, and takes **~1 minute to
  wake up** on the next request
- 750 free instance-hours per workspace per month (one service that never
  sleeps uses ~744 of them — so you get **one** always-on service, not two)
- 5 GB outbound bandwidth/month, 500 build minutes/month
- Ephemeral filesystem, no SSH, no persistent disk

### ⚠️ Free-tier things that could bite you

1. **Cold start.** If nobody hits the app for 15 minutes it sleeps. The next
   visitor waits ~1 minute on a loading page. **Open the app 2 minutes before
   you present**, or leave a keep-alive ping running (see §7 step 9).
2. **One always-on service only.** 750 hours ÷ 744 hours = one. Do not create a
   second Render service expecting it to stay awake.
3. **Neon scale-to-zero.** After 5 minutes idle, Neon suspends compute and
   resumes in a few hundred milliseconds. Invisible to users.
4. **Neon storage 1 GB.** Fine for the demo. If you start storing logs or
   images, check it.
5. **M-Pesa Daraja sandbox** is free but shared and rate-limited. The
   sandbox shortcode is a test number — the STK push will show up as a
   prompt on the test MSISDN, and the callback only fires if the Daraja
   account has that callback URL registered.
6. **Expo Go** is free, but the Expo Go app only supports recent SDKs. If the
   app refuses to load, update Expo Go on the phone.

---

## 2. Prerequisites

- **Node.js 22 LTS** (22.11 or newer). Check with `node -v`.
  Next.js 16 needs Node ≥ 20.9; Expo SDK 57 needs Node ≥ 20. Node 22 is the
  sweet spot for both.
- **Git**
- A **GitHub** account (for Render to deploy from)
- **Expo Go** on your phone (only needed from Session 3)

Check your Node version:

```bash
node -v      # must print v22.x
npm -v
git --version
```

If you have an older Node, install 22 LTS from <https://nodejs.org> (or with
`nvm install 22`).

---

## 3. Get the code and install dependencies

```bash
git clone https://github.com/YOUR_USERNAME/diabetic-meal-planner-app.git
cd diabetic-meal-planner-app
npm install
```

> **If `npm install` finishes suspiciously fast and `drizzle-kit` is missing**,
> your shell has `NODE_ENV=production` set. The repo ships a `.npmrc` with
> `include=dev` that fixes this. If it still bites you, run
> `npm install --include=dev`.

---

## 4. Start a local Postgres (no install needed)

> **You already have a hosted database.** Your `.env.local` now points at
> Neon (`ep-summer-mouse-b4v2w9iz-pooler.c-6.us-east-2.aws.neon.tech`), the
> schema is pushed and the 42 dishes + 6 accounts are seeded there. You can
> skip straight to §5 and run `npm run dev`.
>
> Use the embedded local Postgres below only if you want to work offline or
> test without touching the shared Neon data.

The repo embeds a real Postgres (PGlite over the Postgres wire protocol), so
you do **not** need to install Postgres or Docker.

**Terminal 1** — leave this running:

```bash
npm run db:local
```

You should see:

```
  Local Postgres is running.
    host: 127.0.0.1
    port: 5432
    user: postgres
    pass: postgres
```

**Terminal 2** — create the tables and load the Kenyan data:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
JWT_SECRET=<paste a long random string>
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Generate a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Then create the schema and seed it:

```bash
npm run db:push     # creates tables
npm run db:seed     # 42 Kenyan dishes + 6 demo accounts
```

`db:push`, `db:seed` and `db:generate` all read `.env.local` automatically —
you do not need to export `DATABASE_URL` by hand. If you *do* export it in
your shell, that value wins.

You should see:

```
GlucoPlate seed complete.
  Kenyan dishes added this run : 42
  Users seeded                : 6
```

---

## 5. Run the web app

Still in **Terminal 2**:

```bash
npm run dev
```

Open <http://localhost:3000>. You should land on the login screen.

- Click **“✨ Explore the demo account”** → signs you in as `demo@glucoplate.app`.
- Or sign in as one of the personas (see §7).

---

## 6. Run the test suite (proves the backend works)

**Where to run it:** in the **project root** — the folder that contains
`package.json`, i.e. `C:\Users\User\Desktop\projects\diabetic-meal-planner-app`
on your machine. Do **not** run it from `scripts/` or `src/`.

**What it needs:** a running server. Two options:

| Target | Command | When to use |
|---|---|---|
| Local dev server | `npm run dev` in one terminal → `npm run smoke` in another | Everyday development |
| Your deployed app | `npm run smoke -- https://glucoplate.onrender.com` | Checking the Render deployment |

`npm run smoke` talks to `http://127.0.0.1:3000` by default, so start
`npm run dev` first (or pass a URL as shown above). It never writes to your
database except for one throwaway account it registers and cleans up around.

Expected output ends with:

```
All checks passed.
```

(45 checks — register, login, `/api/auth/me`, the 42-dish catalogue, budget
and GI limits for all five personas, the clinician banner, and CORS.)

Then, in the same terminal:

```bash
npm run lint        # must print nothing
npm run typecheck   # must print nothing
npm run build       # must succeed
```

---

## 7. Demo script for the judges

Open <http://localhost:3000/login> and use these accounts. **All five persona
accounts use the password `Gluco@2026`.**

| Persona | Email | Setting | Diabetes level | Daily budget | Carb cap | GI cap | What to show |
|---|---|---|---|---|---|---|---|
| Njeri Wanjiru, 22 | `njeri@glucoplate.app` | Student | Healthy | KSh 200 | 210 g | 55 | The widest limits: oats, githeri, muthamaki |
| Brian Oduya, 9 | `brian@glucoplate.app` | Child | Prediabetes | KSh 150 | 150 g | 50 | Uji, lentil soup, boiled lentils |
| Peter Mwangi, 41 | `peter@glucoplate.app` | Working class | Type 2 controlled | KSh 350 | 180 g | 55 | The richest plan: nyama choma appears |
| Grace Wanjiku, 68 | `grace@glucoplate.app` | Elderly | Type 2 high risk | KSh 250 | 120 g | 50 | Tighter carb cap, **clinician banner appears** |
| Josephine Nyambura, 35 | `josephine@glucoplate.app` | Rural farmer | **Critical** | KSh 120 | 100 g | 45 | Tightest limits + **red “Talk to your clinician first” banner** |
| Demo Patient | `demo@glucoplate.app` | Working class | Type 2 controlled | KSh 300 | 180 g | 55 | The one-click button on the login page (password `demo123`) |

**The single best demo moment:** sign in as `njeri@glucoplate.app`, open the
Meal Planner, note the plan and the total. Then sign in as
`josephine@glucoplate.app` — same 42-dish catalogue, completely different
plan, a tighter budget, a tighter GI ceiling, and a red clinician banner at
the top of the screen. That is the whole product thesis in 30 seconds.

Other things to try:
- **My Bucket** shows all 42 Kenyan dishes with KSh prices and GI badges.
- **Settings → Health Profile** shows the diabetes type and allergies.
- Register a brand-new account on the spot — it gets the shared catalogue and
  its own default limits. (Judges can create their own accounts.)

---

## 8. Deploy to the internet (free)

### 8a. Create the Neon database

1. Go to <https://neon.com> → **Sign up** (GitHub or Google, no card needed).
2. **Create a project** → name it `glucoplate`.
3. **Region:** pick the closest to Kenya — *AWS Europe (Frankfurt)* or
   *AWS Europe (Ireland)*.
4. Neon gives you a **branch** (`main`). Open **Connection Details** and
   copy the **Pooled connection string** (it ends in `-pooler` and looks like
   `postgresql://USER:PASSWORD@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
5. Keep that string — you need it in three places.

> **Tip:** change `sslmode=require` to `sslmode=verify-full` in the URL. It
> is the same verified TLS connection, but it silences a harmless
> "SSL modes 'require' are treated as aliases for 'verify-full'" warning that
> node-postgres prints on every start. The `channel_binding=require` part can
> stay as Neon gave it to you.
>
> **Your own Neon project is already created and seeded** — you can skip
> 8a/8b and go straight to 8c.

### 8b. Push the schema and seed the hosted database

From your machine, in the project folder, with the Neon URL in your shell:

```bash
# macOS / Linux
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.../neondb?sslmode=require" npm run db:push

# Windows PowerShell
$env:DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.../neondb?sslmode=require"; npm run db:push
```

Then the same with `npm run db:seed`. Verify:

```bash
# macOS / Linux
DATABASE_URL="..." npm run smoke   # point at your Render URL later; for now skip
```

### 8c. Create the Render web service

1. Go to <https://render.com> → **Sign up** with the same GitHub account.
2. **New → Web Service** → connect the repository.
3. Settings:

   | Field | Value |
   |---|---|
   | Name | `glucoplate` |
   | Region | Frankfurt (same as your Neon region) |
   | Branch | `main` |
   | Root Directory | *(blank)* |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
   | Health Check Path | `/api/health` |

4. **Environment** → add:

   ```
   DATABASE_URL = <the Neon pooled connection string>
   JWT_SECRET   = <the same long random string you used locally>
   NODE_VERSION = 22.23.1
   CORS_ORIGINS = https://glucoplate.onrender.com
   ```

5. **Create Web Service**. The first deploy takes ~3–5 minutes. Watch the logs
   for `✓ Compiled successfully`.
6. When it goes green you get a URL like `https://glucoplate.onrender.com`.
7. Visit `https://glucoplate.onrender.com/api/health` — you should see
   `{"ok":true,"database":"connected"}`.

> **If the build fails with `DATABASE_URL is required`**, add `DATABASE_URL` to
> Render's environment variables (build and runtime share the same list) and
> redeploy.

### 8d. Point the mobile app at the deployed API (Session 3)

```bash
EXPO_PUBLIC_API_URL=https://glucoplate.onrender.com npm run mobile
```

---

## 9. Known gaps left for later sessions

| Gap | Session | Note |
|---|---|---|
| Web UI still shows some `$` labels next to KES amounts | 2 | `money()` already renders `KSh`; the remaining hard-coded labels are in the settings/overview screens |
| `nativewind` is installed but the Expo Babel plugin and Tailwind RN config are not wired up yet | 3 | Mobile screens will render unstyled until this is done |
| M-Pesa STK push not built | 5 | The `payments` table and all the env var names already exist |
| No rate limiting on login/register | 6 | Fine for a demo; add it before real users |

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run db:local` says the port is in use | Another Postgres is running. Stop it, or use a different port: `set LOCAL_PG_PORT=5433` (Windows) / `LOCAL_PG_PORT=5433 npm run db:local` (mac/Linux) |
| `npm run db:push` cannot connect | `npm run db:local` is not running in the other terminal |
| `getCurrentUser` returns nothing / redirect loop | `JWT_SECRET` changed after the cookie was issued — sign in again |
| `DATABASE_URL is not configured` | `.env.local` is missing or the app was started before you created it — restart `npm run dev` |
| Neon says `too many connections` | You are using the **direct** URL instead of the **pooled** one. Copy the `-pooler` connection string |
| Render shows a 1-minute loading page | Cold start. Hit the URL again, or keep it warm (below) |
| Build fails on Render: `Cannot find module 'drizzle-kit'` | Change the build command to `npm install --include=dev && npm run build` |

### Keeping the demo warm (optional)

A free Render service sleeps after 15 minutes idle. If you want it always
awake, run this in a separate terminal on the machine that will present:

```bash
# macOS / Linux
while true; do curl -s -o /dev/null https://glucoplate.onrender.com/api/health; sleep 600; done
```

This uses ~744 of your 750 free instance-hours for the month, so **only do
this if Render is hosting just this one service**.

---

## 11. What to send me next (Session 2)

Reply with one short message containing:

1. **Confirmation the local steps worked** — paste the output of
   `npm run smoke` (should end with `All checks passed.`), or the error if
   it did not.
2. **Your Neon URL and Render URL**, or a screenshot of the Neon connection
   details with the password hidden if you want me to write the deploy steps
   for you specifically.
3. **Any environment problems** — e.g. `npm run db:local` failed on your
   machine, or you are on an older Node.

### Proposed Session 2 agenda (most valuable next)

> **The Kenyan dish catalogue + planner quality.**
>
> - Expand the catalogue from 42 to ~80–100 dishes with per-county coverage
>   (Luo, Kikuyu, Luhya, Swahili, Kalenjin, Coastal, Maasai, Meru) and
>   accurate per-serving nutrition, sourced from published Kenyan
>   composition tables rather than estimates.
> - Add *serving multiples* (a "2 chapati" serving) and a per-person portion
>   calculator driven by the persona's age, sex and activity level.
> - Add a **"why this dish"** explanation to each plan line (cost vs. budget,
>   GI vs. limit, carbs vs. cap) — this is the single most persuasive thing
>   for a judging panel.
> - Replace the hard-coded `$` labels in the web UI with `KSh`.
> - Add a **swap** action: "give me an equally cheap but lower-GI version of
>   this meal".
>
> This is Session 2 because it is what a judge looks at first and it needs no
> new accounts, no new services and no M-Pesa work.

---

## Appendix — where things live

| Path | What it is |
|---|---|
| `src/app/` | Next.js web app + JSON API (App Router) |
| `src/app/api/` | All API route handlers |
| `src/expo-app/` | Expo Router mobile app |
| `src/lib/jwt.ts` | JWT sign/verify |
| `src/lib/auth.ts` | Password hashing, token issuing, current-user lookup |
| `src/lib/planner.ts` | The meal-plan algorithm |
| `src/lib/budget.ts` | Period budget → daily allowance |
| `src/lib/medical.ts` | Disclaimer text, diabetes-level metadata, clinician banner rules |
| `src/lib/seed.ts` | Shared-catalogue access + on-demand seeding |
| `src/lib/data/kenyan-dishes.json` | The 42 Kenyan dishes (single source of truth) |
| `src/lib/data/personas.json` | The 5 personas + demo account |
| `src/db/schema.ts` | Drizzle schema (6 tables) |
| `drizzle.config.ts` | Drizzle Kit config (reads `DATABASE_URL`) |
| `drizzle/0000_session1_foundation.sql` | The migration |
| `scripts/seed.mjs` | Seeder (idempotent) |
| `scripts/smoke.mjs` | End-to-end API test |
| `src/proxy.ts` | CORS headers for `/api/*` |
