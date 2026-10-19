# GlucoPlate 🥗

A budget-aware, sugar-safe meal planner for people with diabetes in Kenya.
Kenyan dishes, realistic KSh prices, glycemic-index aware, and honest about
the fact that it is a **planning aid, not medical advice**.

## 🌟 Overview

GlucoPlate builds a day's meals from a shared catalogue of 42 Kenyan dishes,
respecting each person's carbohydrate ceiling, glycemic index limit and
daily budget in Kenyan shillings. The same catalogue produces a different
plan for every persona — a university student, a primary school child, a
mechanic, a retired teacher and a smallholder farmer.

## 🚀 Architecture

- **Web**: Next.js 16 (App Router) in `src/app` — pages *and* the JSON API.
- **Mobile**: Expo SDK 57 / Expo Router in `src/expo-app`.
- **Shared**: `src/lib` — planner, budget rules, auth, safety copy.
- **Database**: PostgreSQL (Drizzle ORM) in `src/db/schema.ts`.
- **Auth**: stateless JWT access tokens (`src/lib/jwt.ts`), 7-day expiry.
  The web app mirrors the token into an httpOnly cookie; the Expo app sends
  it as `Authorization: Bearer <token>`.
- **Hosting**: Neon Free (Postgres) + Render Free (web service) — both $0.

## ✨ Key Features

- **Persona-aware planner** — carbohydrate target, GI ceiling, budget and
  allergies/dislikes all change the result (`src/lib/planner.ts`).
- **Kenyan dish catalogue** — 42 dishes with KSh prices, carbs, protein,
  fibre and GI (`src/lib/data/kenyan-dishes.json`).
- **Five demo personas** — healthy → critical, across student, child,
  working-class, elderly and rural-farmer settings
  (`src/lib/data/personas.json`).
- **Safety first** — a "planning aid, not medical advice" notice everywhere,
  and a red *talk to your clinician* banner for the critical and high-risk
  personas (`src/lib/medical.ts`).
- **Budget tracking** — daily / weekly / until-payday budgets in KSh, with
  a live KSh total on every plan.
- **Analytics** — carb trends and GI distribution over saved plans.

## 🛠️ Getting Started

**Prerequisites:** Node.js 22 LTS, Git. Expo Go on your phone for the mobile
app.

```bash
git clone https://github.com/YOUR_USERNAME/diabetic-meal-planner-app.git
cd diabetic-meal-planner-app
npm install

cp .env.example .env.local     # then edit DATABASE_URL and JWT_SECRET
npm run db:local                # terminal 1: embedded Postgres, no install needed
npm run db:push && npm run db:seed   # terminal 2: schema + Kenyan data
npm run dev                     # http://localhost:3000
```

Full step-by-step guide, hosting setup and the demo script:
**[docs/SESSION-1-SETUP.md](docs/SESSION-1-SETUP.md)**

### Demo accounts

| Email | Password | Persona |
|---|---|---|
| `njeri@glucoplate.app` | `Gluco@2026` | Student, healthy |
| `brian@glucoplate.app` | `Gluco@2026` | Child, prediabetes |
| `peter@glucoplate.app` | `Gluco@2026` | Working class, type 2 controlled |
| `grace@glucoplate.app` | `Gluco@2026` | Elderly, type 2 high risk |
| `josephine@glucoplate.app` | `Gluco@2026` | Rural farmer, **critical** |
| `demo@glucoplate.app` | `demo123` | One-click demo button |

## 🧪 Checks

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # next build
npm run smoke      # 45 end-to-end API checks against a running server
```

## 📂 Project Structure

```
src/app/            Next.js web app + JSON API
src/app/api/        Route handlers (auth, dishes, plans, payments-ready schema, ...)
src/expo-app/       Expo Router mobile app
src/lib/            Shared logic: planner, budget, auth, JWT, medical copy
src/lib/data/       Kenyan dishes + personas (JSON, single source of truth)
src/db/             Drizzle schema and connection
src/components/     Shared React components (web + mobile)
drizzle/            SQL migrations
scripts/            seed.mjs, smoke.mjs
```

## ⚖️ Medical Disclaimer

*GlucoPlate is a planning aid, not medical advice. It does not diagnose or
treat diabetes. Always follow the meal plan your doctor or dietitian gave
you, and check with them before making dietary changes. Users on the
high-risk and critical ladders see a "talk to your clinician" banner.*
