# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview
The project `diabetic-meal-planner-app` is a budget-aware, sugar-safe meal planning application. It has transitioned from a monolithic Next.js app to a **Headless Architecture** where the frontend is an **Expo (React Native)** application and the backend is a Next.js API.

## High-Level Architecture
- **Frontend**: Expo (Expo Router) using NativeWind for styling.
- **Backend**: Next.js API serving as a headless backend.
- **Database**: PostgreSQL with Drizzle ORM.
- **Auth**: Token-based authentication using `expo-secure-store` for persistence on mobile.
- **Key Logic**: A greedy allocation algorithm in `src/lib/planner.ts` that prioritizes dishes by Lowest GI $\rightarrow$ Lowest Cost $\rightarrow$ Lowest Carbs to fit within user budgets and health targets.

## Directory Structure
- `app/`: Expo Router pages and layouts.
  - `app/dashboard/`: Core application features (Overview, Bucket/Dishes, Planner, Health Hub).
  - `app/login.tsx`: Authentication entry point.
- `src/lib/`: Shared utility logic.
  - `src/lib/mobile/api-client.ts`: Centralized mobile API client with JWT handling.
  - `src/lib/types.ts`: Shared TypeScript interfaces for Dishes, Plans, and User data.
  - `src/lib/planner.ts`: The core meal generation algorithm.
- `src/db/`: Database schema and Drizzle configuration.

## Common Commands
### Development
- **Start Expo Server**: `npx expo start` (Use `--tunnel` for physical device testing via Expo Go).
- **Type Check**: `npm run typecheck`
- **Linting**: `npm run lint`

### Database
- **Push Schema**: `npx drizzle-kit push` (Updates database schema based on `src/db/schema.ts`).
- **Studio**: `npx drizzle-kit studio` (GUI for database management).

## Development Guidelines
- **UI Components**: Use Native React Native components (`View`, `Text`, `TouchableOpacity`, `ScrollView`) instead of HTML elements.
- **Styling**: Use NativeWind classes (Tailwind) for styling.
- **API Calls**: Always use `apiFetch` from `@/lib/mobile/api-client` to ensure auth tokens are attached and absolute URLs are used.
- **Safe Areas**: Wrap screen roots in `SafeAreaView` to prevent content from overlapping with device notches/status bars.
