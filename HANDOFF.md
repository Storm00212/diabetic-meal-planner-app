# GlucoPlate Handoff — Phase 2 Complete

## Current state (as of this session)

**Deployed URLs**
- Backend API: `https://diabetic-meal-planner-app.onrender.com` (Render Web Service, live)
- Frontend: `https://glucoplate-web.onrender.com/` (Render Static Site, live fallback — KEEP WORKING)
- Mobile: not deployed (Expo Go, local only)

**Repo structure (do not change)**
- `apps/backend` — Express API, one process, one Postgres database
- `apps/web` — Vite + React SPA, static build to `apps/web/dist`
- `apps/mobile` — Expo SDK 57 + Expo Router + NativeWind
- `packages/{types,domain,data,api-client,ui,config}` — shared contract

**Backend schema (apps/backend/prisma/schema.prisma)**
Existing models: `User`, `Payment`, `Dish`, `MealPlan`, `MealPlanItem`, `WeightLog`, `WeightTarget`, `Achievement`, `LlmUsageLog`

**Auth**
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` — JWT, shared by web + mobile
- Register accepts setting + diabetes level; limits derive from `DIABETES_LEVEL_META` in `@glucoplate/domain`
- User already has: `setting`, `diabetesLevel`, `dailyCarbTarget`, `dailyGiLimit`, `dailyCalorieLimit`, `dailyBudget`, `budgetAmount`, `budgetPeriod`, `isPremium`, `needsClinicianReview`, `allergies`, `dislikes`, `age`, `currentWeight`, `targetWeight`, `sex`, `activityLevel`

**Dishes**
- 95 Kenyan dishes in `packages/data/src/kenyan-dishes.json` (target: 150+)
- Tags stored as `region` + `mealTime`; no explicit tag array yet

**Planner**
- `generatePlan()` in `@glucoplate/domain` — GI first, then carbs, then cost; respects limits, budget, exclusions
- Output: slots, totals, withinBudget/Carbs/Gi, message

**Safety copy**
- `PLANNING_AID_NOTICE`, `clinicianBannerFor()`, `DIABETES_LEVEL_META` — already in `@glucoplate/domain`
- Critical/high-risk users get clinician banner

**Phase 2: AI Recommendations, QA Assistant, Game-style Popups — COMPLETE**

### LLM Integration (Groq, backend only)
- `GROQ_API_KEY` and `LLM_MODEL` (llama-3.1-8b-instant) configured in `.env.example` and `config.ts`
- Rate limiting: 10 requests/minute per user, 8s timeout, 5-min response caching
- Rule-based fallback for all LLM features (works without Groq)
- Emoji stripping on all LLM responses (server-side)
- Usage logging to `LlmUsageLog` table (tokens, latency, fallback flag)

### Personalised Recommendations (`POST /api/llm/recommendation`)
- Computes facts from real data: weight trend (7+ logs), carb trend (7-day avg vs target), streaks (carb/budget), plan counts
- LLM only phrases the facts — never invents numbers
- Falls back to template if Groq fails or rate-limited
- Includes user's diabetes level, setting, budget, limits, latest plan status
- Critical/high-risk users get clinician notice in facts

### QA Assistant — "Ask GlucoPlate" (`POST /api/llm/ask`)
- Grounded with app guide (5 views, planner, dishes, plans, health hub, settings, premium, safety)
- Refuses medication/insulin/dosing/diagnosis questions → redirects to clinician
- Always appends disclaimer: "I am an AI, not a doctor. Please consult your healthcare provider."
- Falls back to keyword-based answers if Groq unavailable
- Accessible on Health Hub page (web) — mobile pending

### Game-style Popups (`POST /api/llm/popup`, `GET/PATCH /api/llm/popups/stopped`)
- Types: `milestone`, `daily_challenge`, `tip`, `recommendation`
- Rules: max 1 popup per 10 min, dismissible, "Stop showing these" per type (persisted)
- Milestone triggers: `first_plan`, `first_weight`, `streak_3_days`, `streak_7_days`, `budget_met`, `plan_streak_5`
- Daily challenge at 9 AM local (once/day)
- Periodic tip/recommendation popups on plan generation
- LLM generates copy with templated fallbacks
- Keyboard accessible, screen-reader friendly, no emojis

### Web UI Updates
- **Overview (Today's Plate)**: Added `RecommendationsPanel` showing personalised AI recommendation with expandable facts
- **Health Hub**: Replaced `AIChat` with `AskGlucoPlate` — full chat interface with suggested questions
- **Planner**: Triggers `daily_challenge` and `recommendation` popups on generate; `budget_met` and streak milestones on save
- **Weight Tracker**: Triggers `first_weight` milestone on first log
- **Global PopupSystem**: `PopupProvider` wraps app, `usePopups`/`usePopupTriggers` hooks for components

### New API Endpoints
- `POST /api/llm/recommendation` — personalised recommendation
- `POST /api/llm/ask` — QA assistant
- `POST /api/llm/popup` — generate popup for trigger
- `GET /api/llm/popups/stopped` — list stopped popup types
- `PATCH /api/llm/popups/stopped` — toggle popup type stop/dismiss

### New Types (`@glucoplate/types`)
- `RecommendationResponse`, `AskRequest`, `AskResponse`
- `PopupType`, `PopupTrigger`, `Popup`, `PopupResponse`
- `StoppedPopupsResponse`, `UpdateStoppedPopupRequest`

### Updated Packages
- `@glucoplate/api-client`: Added `createLLMApi` with `recommendation()`, `ask()`, `popup()`, `stoppedPopups()`, `updateStoppedPopup()`
- `@glucoplate/backend`: New `llm` module (`llm.service.ts`, `recommendations.service.ts`, `assistant.service.ts`, `popups.service.ts`, `llm.routes.ts`)
- `@glucoplate/web`: New components `RecommendationsPanel`, `AskGlucoPlate`, `PopupSystem`

**Missing (Phase 3+)**
- 55+ more Kenyan dishes (breakfast, lunch, dinner, snacks, drinks, all regions)
- Premium gating (free=daily plan, premium=weekly plans + analytics + AI features)
- M-Pesa STK Push (Daraja sandbox)
- Mobile wiring + EAS Update
- Tests + `npm run verify`

**Environment variables (set on Render backend)**
- `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `NODE_ENV=production`, `NODE_VERSION=22.23.1`, `LOG_LEVEL=info`
- `GROQ_API_KEY`, `LLM_MODEL=llama-3.1-8b-instant`, `DEMO_MODE=true`
- Still needed: `MPESA_*`

**Free-tier constraints**
- Render free: 750 instance-hours/workspace/month, one always-on web service, sleeps after 15 min idle
- Neon free: one branch, ~10 concurrent connections (backend uses connection_limit=1)
- Groq free: 10 req/min per user (enforced), 30k tokens/min, 1k req/day — should handle demo
- Expo/EAS Update: free tier available

## Phase 2 Commands

### Backend
```bash
cd apps/backend
npm run db:generate    # regenerate Prisma client (Achievement, LlmUsageLog)
npm run db:push        # push schema
npm run db:seed        # seed users, dishes, plans
npm run build          # type-check + compile
npm run dev            # start dev server (port 4000)
```

### Web
```bash
cd apps/web
npm run dev            # Vite dev server (port 5173)
npm run build          # production build to dist/
```

### Mobile (pending wiring)
```bash
cd apps/mobile
npm run dev            # Expo dev server
```

## Next Steps (Phase 3)
1. Expand `kenyan-dishes.json` from 95 to 150+ dishes
2. Implement premium gating (free=daily, premium=weekly + analytics + AI)
3. M-Pesa STK Push (Daraja sandbox) with demo mode
4. Wire mobile app to API (same views, popups, assistant)
5. EAS Update deployment for Expo Go QR
6. Add automated tests and `npm run verify`

## Demo Credentials (DEMO_MODE=true)
One-click login buttons on `/login`:
- njeri@glucoplate.app / Gluco@2026 (student/healthy)
- brian@glucoplate.app / Gluco@2026 (child/prediabetes)
- peter@glucoplate.app / Gluco@2026 (working_class/type2_controlled, premium)
- grace@glucoplate.app / Gluco@2026 (elderly/type2_high_risk, needs clinician)
- josephine@glucoplate.app / Gluco@2026 (rural_farmer/critical, needs clinician)
- demo@glucoplate.app / demo123 (working_class/type2_controlled)

## Render Deploy Notes
- Keep static fallback at `https://glucoplate-web.onrender.com/` (or move to `/static-demo`)
- Backend health check: `GET /api/health`
- Keep-warm: ping `/api/health` every 10 min (cron or uptime monitor)
- CORS: add `https://glucoplate-web.onrender.com` to `CORS_ORIGINS`