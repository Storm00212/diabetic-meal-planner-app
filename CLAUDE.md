# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview
GlucoPlate is a budget-aware, sugar-safe meal planner for people with diabetes in Kenya. It is a **Turborepo monorepo**: a headless JSON API split into four domain services, a gateway, and two clients (Next.js-style web app and an Expo mobile app) that share one contract.

## High-Level Architecture
- **Monorepo**: npm workspaces + Turborepo. Root `package.json` holds every script; `turbo.json` holds the task graph.
- **Clients**
  - `apps/web` — Vite + React 19 + React Router 7 + Tailwind 4. Feature-driven: `src/features/<domain>/`.
  - `apps/mobile` — Expo SDK 57 / Expo Router + NativeWind. Routes in `app/`, screens in `src/features/<domain>/`.
- **Backend** — five Express apps, each with its own `prisma/` directory and its own explicit port:
  - `apps/gateway` (4000) — thin reverse proxy; the only URL the clients use.
  - `apps/svc-auth` (4001) — users, JWT access tokens, budgets, clinical limits, payments table.
  - `apps/svc-catalog` (4002) — the shared Kenyan dish catalogue plus user dishes.
  - `apps/svc-planner` (4003) — meal plans, plan items, the planner algorithm.
  - `apps/svc-health` (4004) — weight logs and targets, analytics, chat, nutrients.
- **Database-per-service.** No service reads another service's tables. `userId` is a plain integer copied from the caller's token, never a foreign key.
- **Auth**: stateless JWT (HS256, `jose`), 7-day expiry, verified by every service with the shared `JWT_SECRET`.
- **Shared packages**: `@glucoplate/types` (the contract), `@glucoplate/domain` (pure business rules), `@glucoplate/data` (seed fixtures), `@glucoplate/api-client` (typed clients + tracing), `@glucoplate/ui` (design tokens), `@glucoplate/config` (tsconfig + env helpers).

> **Database-per-service means service-to-service HTTP calls.** `svc-planner` fetches the catalogue from `svc-catalog` and the caller's limits from `svc-auth`; `svc-health` fetches plans from `svc-planner`. Each caches the answer for 60 seconds and serves the last cached copy if the upstream is down.

## Directory Structure
- `apps/web/src/`
  - `app/` — `App.tsx` (the router), `AuthProvider.tsx` (token + current user), `api.ts` (the one API client instance).
  - `features/<domain>/` — one folder per business domain (`auth`, `overview`, `catalog`, `planner`, `plans`, `analytics`, `health`, `settings`).
  - `shared/components/` — `Logo`, `MedicalDisclaimer`, `ClinicianBanner`.
- `apps/mobile/app/` — Expo Router route files; each is a one-line re-export of a screen in `src/features/`.
- `apps/svc-*/src/`
  - `index.ts` — entry: load env, listen, shut down cleanly.
  - `env.ts` — loads `.env` before anything reads it. **Must be the first import.**
  - `app.ts` — builds the Express app (no socket).
  - `config.ts` — reads and validates the environment.
  - `lib/` — `logger`, `prisma`, `errors`, `jwt`, `http` (asyncHandler, requestContext, requestLogger, requireAuth).
  - `modules/<feature>/` — `<feature>.routes.ts` (HTTP), `<feature>.service.ts` (rules), `<feature>.repository.ts` (SQL).
- `packages/types/src/index.ts` — DTOs, enums and `SERVICE_PORTS`. **Change the contract here first**; the compiler finds every consumer.
- `packages/domain/src/index.ts` — `generatePlan`, `dailyAllowance`, `exclusionsFor`, `PLANNING_AID_NOTICE`, `clinicianBannerFor`, `money`.

## Common Commands
### Development
- **Everything**: `npm run dev` (turbo runs the gateway, the four services and the web app in parallel).
- **One client**: `npm run dev:web` / `npm run dev:mobile`.
- **One service**: `npm run dev:auth` / `dev:catalog` / `dev:planner` / `dev:health` / `dev:gateway`.
- **A client next to one service** (the debugging pair): `npm run dev:web+planner`.
- **The backend only**: `npm run dev:backend`.
- **Type check**: `npm run typecheck`
- **Linting**: `npm run lint`
- **Build**: `npm run build`
- **End-to-end test**: `npm run smoke` (needs the stack running)

### Database
- **Local embedded Postgres** (one instance per service): `npm run db:local`. Wipe with `npm run db:local:reset`.
- **Per-workspace env files**: `npm run env:sync` (writes `apps/svc-*/.env`, `apps/gateway/.env`, `apps/web/.env.local`, `apps/mobile/.env` from the root `.env.local`).
- **Generate a Prisma client**: `npm run db:generate`
- **Push a schema**: `npm run db:push`
- **Seed**: `npm run db:seed`

## Development Guidelines
- **A service never reads another service's database.** It calls the API and caches the result.
- **Every route lives in a feature module** under `src/modules/<domain>/`. No route handlers in `app.ts`.
- **Ownership is enforced in the query** — `where: { id, userId }`, never in the UI.
- **One error shape**: throw `ApiError`; the error middleware renders `{ error, code, requestId }`.
- **Every request is traced**: `requestContext` assigns an `x-request-id`, `requestLogger` logs it, the response echoes it. Clients may enable `VITE_DEBUG_API` / `EXPO_PUBLIC_DEBUG`.
- **Money is KES.** Use `money()` from `@glucoplate/domain`. Never hard-code a currency symbol.
- **Never commit secrets.** `JWT_SECRET` and the M-Pesa credentials live in `.env.local` and each service's `.env` (all git-ignored) and in Render's environment settings.
- **UI components**: React Native primitives (`View`, `Text`, `TouchableOpacity`) for Expo screens; HTML + Tailwind for web screens.
- **Styling**: NativeWind classes for mobile, Tailwind 4 for web. The mobile app pins Tailwind 3 (the version NativeWind supports).
- **API calls**: use `apiFetch` (raw `Response`) when you need the status code, `apiJson` (parsed body) otherwise. Do not mix the two.
- **Safety copy**: never hand-write the disclaimer. Use `PLANNING_AID_NOTICE` and `clinicianBannerFor()` from `@glucoplate/domain`.
- **Route handlers**: resolve the caller with `getCurrentUser()` and return 401 when it is null.
