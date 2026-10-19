/**
 * One-off helper: point the moved mobile screens at the shared packages.
 *
 * The mobile screens use single-quoted imports, so both quote styles are
 * rewritten.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mobile = join(process.cwd(), "apps", "mobile");

const IMPORT_RULES = [
  ["@/lib/format", "@glucoplate/domain"],
  ["@/lib/planner", "@glucoplate/domain"],
  ["@/lib/types", "@glucoplate/types"],
  ["@/lib/mobile/api-client", "@/lib/api-client"],
  ["@/components/Logo", "@/shared/components/Logo"],
  ["@/components/MedicalDisclaimer", "@/shared/components/MedicalDisclaimer"],
  ["@/components/ClinicianBanner", "@/shared/components/ClinicianBanner"],
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let changed = 0;

for (const file of walk(mobile)) {
  const original = readFileSync(file, "utf8");
  let content = original;

  for (const [from, to] of IMPORT_RULES) {
    content = content.split(`'${from}'`).join(`'${to}'`);
    content = content.split(`"${from}"`).join(`"${to}"`);
  }

  // `SavedPlan` was the old local type; the shared contract calls it
  // `MealPlanWithItems`.
  content = content.split("SavedPlan").join("MealPlanWithItems");

  if (content !== original) {
    writeFileSync(file, content, "utf8");
    changed += 1;
    console.log(`  patched ${file.replace(mobile, "apps/mobile")}`);
  }
}

// The route files re-export a default export, so they must use `default`.
const ROUTES = [
  "app/dashboard/dishes/index.tsx",
  "app/dashboard/planner/index.tsx",
  "app/dashboard/plans/index.tsx",
  "app/dashboard/analytics/index.tsx",
  "app/dashboard/health-hub/index.tsx",
  "app/dashboard/settings/index.tsx",
  "app/dashboard/index.tsx",
  "app/login.tsx",
];

for (const route of ROUTES) {
  const file = join(mobile, route);
  const original = readFileSync(file, "utf8");
  const fixed = original.replace(
    /export \{ (\w+) as default \} from "([^"]+)";/,
    'export { default } from "$2";',
  );
  if (fixed !== original) {
    writeFileSync(file, fixed, "utf8");
    console.log(`  route   ${route}`);
  }
}

console.log(`Patched ${changed} file(s).`);
