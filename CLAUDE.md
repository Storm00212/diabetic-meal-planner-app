# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview
GlucoPlate is a budget-aware, sugar-safe meal planner for people with diabetes in Kenya. It is a **Turborepo monorepo** with three deployable units — a **Backend API**, a **Frontend** web app and a **Mobile** app — that share one contract and one set of business rules.

## High-Level Architecture
- **Monorepo**: npm workspaces + Turborepo. Root `package.json` holds every script; `turbo.json` holds the task graph.
- **The three units**
  - `apps/backend` — one Express app, one Prisma client, one database, one port (4000). Every endpoint. The feature modules under `src/modules/` (`auth`, `dish`, `plans`, `weight`, `analytics`, `chat`, `nutrients`) keep their boundaries but call each other with ordinary function calls — there is no HTTP between them.
  - `apps/web` — Vite + React 19 + React Router 7 + Tailwind 4. Feature-driven: `src/features/<domain>/`.
  - `apps/mobile` — Expo SDK 57 / Expo Router + NativeWind. Routes in `app/`, screens in `src/features/<domain>/`.
- **Database**: PostgreSQL with Prisma. One database, owned by the backend. The schema is `apps/backend/prisma/schema.prisma`.
- **Auth**: stateless JWT (HS256, `jose`), 7-day expiry, verified by the backend with the shared `JWT_SECRET`. The web app mirrors the token into localStorage; the Expo app stores it in `expo-secure-store` and sends `Authorization: Bearer`.
- **Shared packages**: `@glucoplate/types` (the contract), `@glucoplate/domain` (pure business rules — the planner, the portion calculator, the "why this dish" explanations, the swap rules, the budget arithmetic, the safety copy), `@glucoplate/data` (seed fixtures), `@glucoplate/api-client` (the typed client both clients use, with request tracing), `@glucoplate/ui` (design tokens), `@glucoplate/config` (tsconfig + env helpers).

> **One backend, one database.** A module never reads another module's tables directly; it calls the function that owns them. The backend used to be five services (a gateway and four domain services) and is now one process — the planner's plan generation is two queries rather than two network round trips.
>
> **The pool parameters are not optional.** The hosted database allows only a handful of concurrent connections per branch and the whole backend shares one. The URL must carry `?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15` on the **direct** endpoint (the hostname without `-pooler`), which measured about three times faster than the pooled one. Getting it wrong does not fail loudly — it fails slowly, with fifteen-second queries and `Server has closed the connection` errors.
>
> **Never type-check a unit on its own.** `packages/*/dist` is a build artifact, so `npx tsc -p apps/<unit>/tsconfig.json` type-checks against a stale contract and reports a false green. Always use `turbo run typecheck`, which rebuilds the packages first.
>
> **Adding an endpoint means touching two places:** the module that owns it and `packages/types/src/index.ts` (the contract). If the clients use it, add the method to `packages/api-client/src/index.ts`. `npm run audit` catches a missing route, and `npm run test:clients` catches a client that reads a field the API does not return.

## Directory Structure
- `apps/web/src/`
  - `app/` — `App.tsx` (the router), `AuthProvider.tsx` (token + current user), `api.ts` (the one API client instance).
  - `features/<domain>/` — one folder per business domain (`auth`, `overview`, `catalog`, `planner`, `plans`, `analytics`, `health`, `settings`).
  - `shared/components/` — `Logo`, `MedicalDisclaimer`, `ClinicianBanner`.
- `apps/mobile/app/` — Expo Router route files; each is a one-line re-export of a screen in `src/features/`.
- `apps/backend/src/`
  - `index.ts` — entry: load env, listen, shut down cleanly.
  - `env.ts` — loads `.env` before anything reads it. **Must be the first import.**
  - `app.ts` — builds the Express app (no socket) and mounts every module router.
  - `config.ts` — reads and validates the environment.
  - `lib/` — `logger`, `prisma`, `errors`, `jwt`, `http` (asyncHandler, requestContext, requestLogger, requireAuth).
  - `modules/<feature>/` — `<feature>.routes.ts` (HTTP), `<feature>.service.ts` (rules), `<feature>.repository.ts` (SQL).
- `packages/types/src/index.ts` — DTOs and enums. **Change the contract here first**; the compiler finds every consumer.
- `packages/domain/src/index.ts` — `generatePlan`, `dailyAllowance`, `exclusionsFor`, `PLANNING_AID_NOTICE`, `clinicianBannerFor`, `money`.
- `packages/domain/src/portion.ts` — `portionTargets`, `bmrCalories`, `dailyEnergy`, `portionsForDish`.
- `packages/domain/src/explain.ts` — `explainDish`, `explainPlan`, `swapCandidates`.
- `packages/domain/test/domain.test.mjs` — the tests for the numbers. Run with `npm run test --workspace=@glucoplate/domain`.

## Common Commands
### Development
- **Everything**: `npm run dev` (the backend, the web app and Expo in parallel).
- **One unit**: `npm run dev:backend` / `dev:web` / `dev:mobile`.
- **A client next to the backend** (the debugging pair): `npm run dev:web+backend`.
- **Type check**: `npm run typecheck`
- **Linting**: `npm run lint`
- **Build**: `npm run build`, or one unit with `build:backend` / `build:web` / `build:mobile`.
- **End-to-end test**: `npm run smoke` (needs the stack running)
- **Endpoint audit**: `npm run audit` (every route, and that auth is enforced on all of them)
- **Both clients**: `npm run test:clients`

> **Never type-check a unit on its own.** `packages/*/dist` is a build
> artifact, so `npx tsc -p apps/<unit>/tsconfig.json` type-checks against a
> stale contract and reports a false green. Always use `turbo run typecheck`,
> which rebuilds the packages first.

### Database
- **Local embedded Postgres**: `npm run db:local`. Wipe with `npm run db:local:reset`.
- **Per-unit env files**: `npm run env:sync` (writes `apps/backend/.env`, `apps/web/.env.local` and `apps/mobile/.env`). Add `-- --neon` to point the backend at the hosted database.
- **Generate a Prisma client**: `npm run db:generate`
- **Push a schema**: `npm run db:push`
- **Seed**: `npm run db:seed` (6 accounts, 95 dishes, 2 sample plans each)

> `db:push` and `db:seed` must point at the **same** database. Use the same
> flag for both, or the schema and the data end up in different places.

## Development Guidelines
- **A module never reads another module's tables.** It calls the function that owns them.
- **Every route lives in a feature module** under `src/modules/<domain>/`. No route handlers in `app.ts`.
- **Ownership is enforced in the query** — `where: { id, userId }`, never in the UI.
- **One error shape**: throw `ApiError`; the error middleware renders `{ error, code, requestId }`.
- **Every request is traced**: `requestContext` assigns an `x-request-id` (generating one if the client sent none), `requestLogger` logs it, the response echoes it. Clients may enable `VITE_DEBUG_API` / `EXPO_PUBLIC_DEBUG`.
- **Money is KES.** Use `money()` from `@glucoplate/domain`. Never hard-code a currency symbol.
- **Never commit secrets.** `JWT_SECRET` and the M-Pesa credentials live in `.env.local` and each unit's `.env` (all git-ignored) and in Render's environment settings.
- **UI components**: React Native primitives (`View`, `Text`, `TouchableOpacity`) for Expo screens; HTML + Tailwind for web screens.
- **Styling**: NativeWind classes for mobile, Tailwind 4 for web. The mobile app pins Tailwind 3 (the version NativeWind supports).
- **API calls**: use `apiFetch` (raw `Response`) when you need the status code, `apiJson` (parsed body) otherwise. Do not mix the two.
- **Safety copy**: never hand-write the disclaimer. Use `PLANNING_AID_NOTICE` and `clinicianBannerFor()` from `@glucoplate/domain`.
- **Route handlers**: resolve the caller with `requireAuth` and `callerId(req)`, and return 401 when there is no token.
