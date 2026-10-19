/**
 * One-off helper: move the Expo screens into `src/features/<domain>/` and
 * leave thin route files behind in `app/`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const mobile = join(process.cwd(), "apps", "mobile");

/** [from, to] relative to apps/mobile */
const MOVES = [
  ["app/dashboard/dishes/index.tsx", "src/features/catalog/DishesScreen.tsx"],
  ["app/dashboard/dishes/_components/DishModal.tsx", "src/features/catalog/DishModal.tsx"],
  ["app/dashboard/planner/index.tsx", "src/features/planner/PlannerScreen.tsx"],
  ["app/dashboard/plans/index.tsx", "src/features/plans/PlansScreen.tsx"],
  ["app/dashboard/analytics/index.tsx", "src/features/analytics/AnalyticsScreen.tsx"],
  ["app/dashboard/health-hub/index.tsx", "src/features/health/HealthHubScreen.tsx"],
  ["app/dashboard/health-hub/_components/AIChat.tsx", "src/features/health/AIChat.tsx"],
  ["app/dashboard/health-hub/_components/WeightTracker.tsx", "src/features/health/WeightTracker.tsx"],
  ["app/dashboard/settings/index.tsx", "src/features/settings/SettingsScreen.tsx"],
  ["app/dashboard/index.tsx", "src/features/overview/OverviewScreen.tsx"],
  ["app/login.tsx", "src/features/auth/LoginScreen.tsx"],
];

/** Route files that stay in app/ and re-export the feature screen. */
const ROUTES = [
  ["app/dashboard/dishes/index.tsx", "src/features/catalog/DishesScreen"],
  ["app/dashboard/planner/index.tsx", "src/features/planner/PlannerScreen"],
  ["app/dashboard/plans/index.tsx", "src/features/plans/PlansScreen"],
  ["app/dashboard/analytics/index.tsx", "src/features/analytics/AnalyticsScreen"],
  ["app/dashboard/health-hub/index.tsx", "src/features/health/HealthHubScreen"],
  ["app/dashboard/settings/index.tsx", "src/features/settings/SettingsScreen"],
  ["app/dashboard/index.tsx", "src/features/overview/OverviewScreen"],
  ["app/login.tsx", "src/features/auth/LoginScreen"],
];

/** Import rewrites that apply to every moved file. */
const IMPORT_RULES = [
  ['from "@/lib/format"', 'from "@glucoplate/domain"'],
  ['from "@/lib/planner"', 'from "@glucoplate/domain"'],
  ['from "@/lib/types"', 'from "@glucoplate/types"'],
  ['from "@/lib/mobile/api-client"', 'from "@/lib/api-client"'],
  ['from "@/components/Logo"', 'from "@/shared/components/Logo"'],
  [
    'from "@/components/MedicalDisclaimer"',
    'from "@/shared/components/MedicalDisclaimer"',
  ],
];

for (const [from, to] of MOVES) {
  const source = join(mobile, from);
  const target = join(mobile, to);

  if (!existsSync(source)) {
    console.log(`  MISS ${from}`);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });

  let content = readFileSync(source, "utf8");
  for (const [pattern, replacement] of IMPORT_RULES) {
    content = content.split(pattern).join(replacement);
  }

  writeFileSync(target, content, "utf8");
  console.log(`  moved  ${from} -> ${to}`);
}

// The route files become thin re-exports.
for (const [route, feature] of ROUTES) {
  const routePath = join(mobile, route);
  mkdirSync(dirname(routePath), { recursive: true });

  const depth = route.split("/").length - 2; // app/ is one level
  const up = "../".repeat(depth + 1);

  writeFileSync(
    routePath,
    `export { ${feature.split("/").pop()} as default } from "${up}${feature}";\n`,
    "utf8",
  );
  console.log(`  route  ${route}`);
}
