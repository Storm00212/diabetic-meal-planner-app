# GlucoPlate 🥗

A budget-aware, sugar-safe meal planner for people with diabetes in Kenya.
Kenyan dishes, realistic KSh prices, glycemic-index aware, and honest about
the fact that it is a **planning aid, not medical advice**.

## 🌟 Overview

GlucoPlate builds a day's meals from a shared catalogue of 95 Kenyan dishes,
respecting each person's carbohydrate ceiling, glycemic index limit and
daily budget in Kenyan shillings. The same catalogue produces a different
plan for every persona — a university student, a primary school child, a
mechanic, a retired teacher and a smallholder farmer.

## 🏗️ Architecture

A **Turborepo monorepo**: two frontends, one gateway, four domain services
sharing one database, and a set of shared packages holding the contract
between them.

```
apps/
├── web/          Vite + React single page app        (port 5173)
├── mobile/       Expo / React Native                 (Expo Go)
├── gateway/      the single entry point               (port 4000)
├── svc-auth/     accounts, JWT, budgets, limits       (port 4001)
├── svc-catalog/  the Kenyan dish catalogue            (port 4002)
├── svc-planner/  meal plans + the planner algorithm   (port 4003)
└── svc-health/   weight, analytics, chat, nutrients   (port 4004)

packages/
├── types/        the API contract: DTOs, enums, SERVICE_PORTS
├── domain/       pure business rules: planner, budget, safety copy
├── data/         seed fixtures: the 95 dishes, the 5 personas
├── api-client/   typed HTTP clients + request tracing
├── ui/           design tokens shared by web and mobile
└── config/       shared tsconfig and env helpers
```

Each service owns its **own tables** — each generates a Prisma client for only
the models it owns, so a service physically cannot touch another service's
data. Where one service needs another's data it calls its HTTP API. The
**gateway** is a thin reverse proxy, so both clients only need one base URL
and a single `x-request-id` traces a request through every service it
touched.

Hosting: **Neon Free** (Postgres) + **Render Free** (web service) — both $0.
All four services share one Neon database, so the connection string needs
`?pgbouncer=true&connection_limit=2&connect_timeout=15&pool_timeout=15` to
stay inside Neon's ten-connection limit.

📖 **[docs/MONOREPO.md](docs/MONOREPO.md)** — the full blueprint, the file
tree, the debugging setup and every root script.
📖 **[docs/SERVICE-TEMPLATE.md](docs/SERVICE-TEMPLATE.md)** — how to write a
new service.

## ✨ Key Features

- **Persona-aware planner** — carbohydrate target, GI ceiling, budget and
  allergies/dislikes all change the result (`packages/domain`).
- **Kenyan dish catalogue** — 95 dishes across 14 counties, with KSh prices,
  carbs, protein, fibre, GI and a serving size for each.
- **"Why this dish"** — every plan line explains itself in the reader's own
  numbers: cost against the budget, GI against the limit, carbs against the cap.
- **Swap** — one tap finds a cheaper, lower-glycemic-index alternative for
  any dish in a plan.
- **Portion calculator** — height, weight, age and activity become daily
  calorie, carbohydrate, protein and fat targets.
- **Five demo personas** — healthy → critical, across student, child,
  working-class, elderly and rural-farmer settings. All five get a different plan.
- **Safety first** — a "planning aid, not medical advice" notice everywhere,
  and a red *talk to your clinician* banner for the critical and high-risk
  personas.
- **Budget tracking** — daily / weekly / until-payday budgets in KSh, with a
  live KSh total on every plan.
- **Analytics** — carb trends and GI distribution over saved plans.
- **One contract, three consumers** — web, mobile and every service import
  the same types from `@glucoplate/types`.

## 🛠️ Getting Started

**Prerequisites:** Node.js 22 LTS, Git. Expo Go on your phone for the mobile
app.

```bash
git clone https://github.com/YOUR_USERNAME/diabetic-meal-planner-app.git
cd diabetic-meal-planner-app
npm install

cp .env.example .env.local     # then edit DATABASE_URL and JWT_SECRET
npm run env:sync               # writes each workspace's own .env

# terminal 1
npm run db:local               # four embedded Postgres instances, no install needed

# terminal 2
npm run db:generate && npm run db:push && npm run db:seed
npm run dev                    # the gateway, the four services and the web app
```

Open <http://localhost:5173>. The full walkthrough, the hosting setup and the
demo script: **[docs/SESSION-1-SETUP.md](docs/SESSION-1-SETUP.md)**

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
npm run lint       # eslint, every workspace
npm run typecheck  # tsc, every workspace
npm run build      # every workspace
npm run test       # the domain tests
npm run smoke      # cross-service end-to-end test against a running stack
npm run audit      # every endpoint, directly and through the gateway
```

`npm run smoke` talks to the gateway the way the clients do, and to every
service directly, so it proves the whole system is wired together.
`npm run audit` exercises all 30 routes — that they exist, that they enforce
auth, and that they return the documented shape.

## ⚖️ Medical Disclaimer

*GlucoPlate is a planning aid, not medical advice. It does not diagnose or
treat diabetes. Always follow the meal plan your doctor or dietitian gave
you, and check with them before making dietary changes. Users on the
high-risk and critical ladders see a "talk to your clinician" banner.*
