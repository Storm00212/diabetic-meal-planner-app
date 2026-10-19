# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview
GlucoPlate is a budget-aware, sugar-safe meal planner for people with diabetes in Kenya. It has a **headless architecture**: an **Expo (React Native)** app and a **Next.js** app share one JSON API and one PostgreSQL database.

## High-Level Architecture
- **Web app + API**: Next.js 16 (App Router) in `src/app`. The API routes live in `src/app/api/`.
- **Mobile app**: Expo SDK 57 / Expo Router in `src/expo-app`.
- **Database**: PostgreSQL with Drizzle ORM (`src/db/schema.ts`).
- **Auth**: stateless JWT access tokens (`src/lib/jwt.ts`), signed with `jose` (HS256) using `JWT_SECRET`. 7-day expiry. The web app also mirrors the token into an httpOnly cookie (`glucoplate_token`); the Expo app stores it in `expo-secure-store` and sends `Authorization: Bearer <token>`.
- **Key logic**: `src/lib/planner.ts` searches combinations of one dish per meal slot and scores them on carbohydrate fill, protein and average glycemic index, subject to the user's budget, carb target, GI ceiling and allergies/dislikes.

> **Route discovery matters.** Next.js resolves its App Router from `./app` and only falls back to `./src/app`. The Expo Router therefore lives in `src/expo-app` and is pointed at with `EXPO_ROUTER_APP_ROOT=src/expo-app` (see the `mobile` npm scripts). Never move the Expo routes back to the repository root.

## Directory Structure
- `src/app/`: Next.js web pages and API route handlers.
  - `src/app/api/`: REST-ish JSON API (`auth`, `dishes`, `plans`, `settings`, `user`, `weight`, `analytics`, `chat`, `nutrients`, `health`).
- `src/expo-app/`: Expo Router screens and layouts.
  - `src/expo-app/dashboard/`: Overview, Bucket/Dishes, Planner, Plans, Analytics, Health Hub, Settings.
  - `src/expo-app/login.tsx`: Authentication entry point.
- `src/lib/`: Shared logic used by both clients.
  - `src/lib/jwt.ts`: sign/verify access tokens.
  - `src/lib/auth.ts`: password hashing (scrypt), token issuing, `getCurrentUser()`, `toPublicUser()`.
  - `src/lib/planner.ts`: the meal-plan algorithm.
  - `src/lib/budget.ts`: converts a period budget into a daily allowance.
  - `src/lib/medical.ts`: disclaimer copy, diabetes-level metadata, clinician-banner rules.
  - `src/lib/seed.ts`: shared Kenyan catalogue access + `ensureKenyanCatalogue()`.
  - `src/lib/data/*.json`: the Kenyan dish catalogue and the demo personas.
  - `src/lib/mobile/api-client.ts`: mobile HTTP client (`apiFetch` returns a `Response`, `apiJson` returns parsed JSON).
- `src/db/`: Drizzle schema, connection pool, migrations in `drizzle/`.
- `src/proxy.ts`: Next.js 16 proxy (was `middleware.ts`) that adds CORS headers to `/api/*`.

## Common Commands
### Development
- **Web**: `npm run dev` (http://localhost:3000)
- **Mobile**: `npm run mobile` (Expo Go). Set `EXPO_PUBLIC_API_URL` first — on a physical device use your computer's LAN IP.
- **Type check**: `npm run typecheck`
- **Linting**: `npm run lint`
- **Build**: `npm run build`
- **End-to-end API test**: `npm run smoke` (needs `npm run dev` running)

### Database
- **Local embedded Postgres**: `npm run db:local` (PGlite over the Postgres wire protocol; no install needed). Wipe it with `npm run db:local:reset`.
- **Push schema**: `npm run db:push` (reads `DATABASE_URL`)
- **Generate a migration**: `npm run db:generate`
- **Seed**: `npm run db:seed` (idempotent; `-- --reset-plans` regenerates the sample plans)
- **Studio**: `npm run db:studio`

## Development Guidelines
- **Money is KES, always.** Use `money()` from `@/lib/format`. Never hard-code a currency symbol.
- **Never commit secrets.** `JWT_SECRET` and the M-Pesa credentials live in `.env.local` (git-ignored) and in Render's environment settings. `.env.example` is the only env file that is tracked.
- **UI components**: React Native primitives (`View`, `Text`, `TouchableOpacity`) for Expo screens; HTML + Tailwind for Next.js screens.
- **Styling**: NativeWind classes for mobile, Tailwind for web.
- **API calls**: use `apiFetch` (raw `Response`) when you need the status code, `apiJson` (parsed body) otherwise. Do not mix the two.
- **Safety copy**: never hand-write the disclaimer. Use `PLANNING_AID_NOTICE` and `clinicianBannerFor()` from `@/lib/medical`.
- **Safe areas**: wrap screen roots in `SafeAreaView` on mobile.
- **Route handlers**: resolve the caller with `getCurrentUser()` and return 401 when it is null. Ownership must be enforced in the query, not just in the UI.
