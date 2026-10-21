/**
 * End-to-end test for BOTH frontends.
 *
 * The web app and the mobile app are two different clients of the same API.
 * The riskiest thing in a monorepo like this is contract drift: a field gets
 * renamed in a service, one client is updated and the other is not, and the
 * break only shows up on a phone.
 *
 * So this script walks the exact journey each client performs, and asserts
 * every field that client reads. It then checks that both frontends actually
 * build and serve.
 *
 *   npm run test:clients
 *
 * The stack has to be running (npm run dev).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const WEB_BASE = (process.argv[3] ?? "http://localhost:5173").replace(/\/$/, "");

let failures = 0;
let checks = 0;

function check(label, condition, detail = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(
    `  [${condition ? "PASS" : "FAIL"}] ${label}${detail ? ` -> ${detail}` : ""}`,
  );
}

async function call(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
  }
  return { status: response.status, json };
}

/** Every key a client reads must be present, with the right shape. */
function hasFields(label, object, fields) {
  const missing = fields.filter(
    (field) => object === null || object === undefined || !(field in object),
  );
  check(
    label,
    missing.length === 0,
    missing.length > 0 ? `missing ${missing.join(", ")}` : "",
  );
}

// ---------------------------------------------------------------------------
// 1. The web client's journey
// ---------------------------------------------------------------------------
console.log("\nWeb client (apps/web) journey");

const webLogin = await call("/api/auth/login", {
  method: "POST",
  body: { email: "njeri@glucoplate.app", password: "Gluco@2026" },
});
check("POST /api/auth/login -> 200", webLogin.status === 200);
hasFields("the login response carries the fields the web app reads", webLogin.json, [
  "token",
  "user",
  "notice",
  "banner",
]);
const webToken = webLogin.json?.token;

hasFields(
  "the user carries every field the web app reads",
  webLogin.json?.user,
  [
    "id",
    "name",
    "email",
    "dailyBudget",
    "dailyCarbLimit",
    "dailyGiLimit",
    "budgetAmount",
    "budgetPeriod",
    "budgetCurrency",
    "isPremium",
    "sex",
    "activityLevel",
  ],
);

const webMe = await call("/api/auth/me", { token: webToken });
check("GET /api/auth/me -> 200", webMe.status === 200);
hasFields("the me response carries user, notice and banner", webMe.json, [
  "user",
  "notice",
  "banner",
]);

const webDishes = await call("/api/dishes", { token: webToken });
const webDishList = webDishes.json?.dishes ?? [];
check("GET /api/dishes -> 200", webDishes.status === 200);
check("the catalogue is populated", webDishList.length >= 90, `${webDishList.length} dishes`);
hasFields(
  "a dish carries every field the web app reads",
  webDishList[0],
  [
    "id",
    "name",
    "description",
    "mealTime",
    "cost",
    "isPantryItem",
    "calories",
    "carbsG",
    "proteinG",
    "fatG",
    "glycemicIndex",
    "servingLabel",
    "region",
  ],
);

const webStats = await call("/api/dishes/stats", { token: webToken });
hasFields("the dish stats carry total, avgCost and avgGi", webStats.json, [
  "total",
  "avgCost",
  "avgGi",
]);

const webPlan = await call("/api/plans/generate", {
  method: "POST",
  body: { budget: 200, carbTarget: 210 },
  token: webToken,
});
check("POST /api/plans/generate -> 200", webPlan.status === 200);
hasFields(
  "the plan response carries the fields the web app reads",
  webPlan.json,
  ["plan", "budget", "carbTarget", "giLimit", "notice", "banner"],
);
hasFields(
  "the plan carries the fields the web app reads",
  webPlan.json?.plan,
  [
    "slots",
    "reasons",
    "totalCost",
    "totalCarbs",
    "totalCalories",
    "withinBudget",
    "withinCarbs",
    "withinGi",
    "highestGi",
    "message",
  ],
);

const webReasons = webPlan.json?.plan?.reasons ?? {};
check(
  "every slot has its own reasons",
  ["morning", "afternoon", "evening"].every(
    (slot) => Array.isArray(webReasons[slot]) && webReasons[slot].length > 0,
  ),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(webReasons).map(([slot, lines]) => [slot, lines.length]),
    ),
  ),
);
check(
  "the reasons quote the budget that was asked for",
  JSON.stringify(webReasons).includes("KSh 200"),
);

const webSwapDish = webDishList.find((dish) => dish.glycemicIndex > 30);
const webSwap = webSwapDish
  ? await call(`/api/dishes/${webSwapDish.id}/swap?limit=3`, { token: webToken })
  : { status: 0, json: null };
check("GET /api/dishes/:id/swap -> 200", webSwap.status === 200);
hasFields("the swap response carries dish and alternatives", webSwap.json, [
  "dish",
  "alternatives",
]);
hasFields(
  "an alternative carries the fields the web app reads",
  webSwap.json?.alternatives?.[0],
  ["id", "name", "cost", "glycemicIndex", "saving", "giDrop", "reason"],
);

const webPlans = await call("/api/plans", { token: webToken });
check("GET /api/plans -> 200", webPlans.status === 200);
hasFields("a saved plan carries the fields the web app reads", webPlans.json?.plans?.[0], [
  "id",
  "planDate",
  "budget",
  "totalCost",
  "totalCarbs",
  "totalCalories",
  "items",
]);
hasFields(
  "a saved plan item carries the fields the web app reads",
  webPlans.json?.plans?.[0]?.items?.[0],
  ["id", "slot", "dishId", "dishName", "cost", "carbsG", "calories", "glycemicIndex", "status"],
);
check(
  "a saved plan item carries a reason",
  typeof webPlans.json?.plans?.[0]?.items?.[0]?.reason === "string" &&
    (webPlans.json?.plans?.[0]?.items?.[0]?.reason?.length ?? 0) > 0,
);

const webPortions = await call("/api/user/portion-targets", { token: webToken });
check("GET /api/user/portion-targets -> 200", webPortions.status === 200);
hasFields(
  "the portion targets carry the fields the web app reads",
  webPortions.json,
  ["calories", "carbsG", "proteinG", "fatG", "bmr", "tdee", "basis", "personalised", "profile"],
);

const webBudget = await call("/api/user/budget", { token: webToken });
hasFields(
  "the budget response carries the fields the web app reads",
  webBudget.json,
  ["dailyBudget", "budgetAmount", "budgetPeriod", "budgetCurrency", "paydayDate"],
);

const webProfile = await call("/api/user/profile", { token: webToken });
hasFields(
  "the profile response carries the fields the web app reads",
  webProfile.json,
  ["name", "email", "diabetesType", "allergies", "dislikes"],
);

const webSettings = await call("/api/settings", { token: webToken });
check("GET /api/settings -> 200", webSettings.status === 200);

const webChat = await call("/api/chat", {
  method: "POST",
  body: { query: "what is the glycemic index?" },
  token: webToken,
});
hasFields("the chat response carries the fields the web app reads", webChat.json, [
  "answer",
  "disclaimer",
]);

const webAnalytics = await call("/api/analytics", { token: webToken });
hasFields(
  "the analytics response carries the fields the web app reads",
  webAnalytics.json,
  ["summary", "carbTrends", "nutritionDist"],
);
hasFields("the analytics summary carries the fields the web app reads", webAnalytics.json?.summary, [
  "totalPlans",
  "totalSpent",
  "totalBudget",
  "savings",
]);

// ---------------------------------------------------------------------------
// 2. The mobile client's journey
// ---------------------------------------------------------------------------
console.log("\nMobile client (apps/mobile) journey");

// The mobile app signs in the same way and reads the same responses, so the
// contract is the same. What differs is the request the mobile app sends.
const mobileLogin = await call("/api/auth/login", {
  method: "POST",
  body: { email: "brian@glucoplate.app", password: "Gluco@2026" },
});
const mobileToken = mobileLogin.json?.token;
check("the mobile client can sign in", mobileLogin.status === 200 && Boolean(mobileToken));

const mobileProfile = await call("/api/user/profile", { token: mobileToken });
hasFields(
  "the profile carries the fields the mobile app reads",
  mobileProfile.json,
  [
    "name",
    "email",
    "diabetesType",
    "allergies",
    "dislikes",
    "sex",
    "activityLevel",
    "dailyBudget",
    "dailyCarbLimit",
  ],
);

const mobilePortions = await call("/api/user/portion-targets", { token: mobileToken });
hasFields(
  "the portion targets carry the fields the mobile app reads",
  mobilePortions.json,
  ["calories", "carbsG", "proteinG", "fatG", "basis", "personalised", "profile"],
);

// The mobile planner sends { budget, carbTarget, planDate } and reads
// plan.reasons.
const mobilePlan = await call("/api/plans/generate", {
  method: "POST",
  body: { budget: 150, carbTarget: 150 },
  token: mobileToken,
});
check("the mobile planner can generate a plan", mobilePlan.status === 200);
hasFields(
  "the plan carries the fields the mobile app reads",
  mobilePlan.json?.plan,
  ["slots", "reasons", "totalCost", "totalCarbs", "totalCalories", "withinBudget", "withinCarbs", "message"],
);

// The mobile planner saves with { budget, carbTarget, planDate }.
const mobileSaved = await call("/api/plans", {
  method: "POST",
  body: { budget: 150, carbTarget: 150, planDate: new Date().toISOString().slice(0, 10) },
  token: mobileToken,
});
check("the mobile planner can save a plan", mobileSaved.status === 200 || mobileSaved.status === 201);

const mobilePlans = await call("/api/plans", { token: mobileToken });
const mobileSavedPlan = (mobilePlans.json?.plans ?? []).find(
  (plan) => plan.id === mobileSaved.json?.plan?.id,
);
check(
  "the saved plan comes back with its items",
  (mobileSavedPlan?.items ?? []).length > 0,
);
hasFields(
  "a saved plan item carries the fields the mobile app reads",
  mobileSavedPlan?.items?.[0],
  ["id", "slot", "dishId", "dishName", "cost", "carbsG", "proteinG", "calories", "glycemicIndex"],
);

const mobileDishes = await call("/api/dishes", { token: mobileToken });
check(
  "every dish the mobile app shows has a serving label",
  (mobileDishes.json?.dishes ?? []).every((dish) => Boolean(dish.servingLabel)),
);

const mobileWeightTargets = await call("/api/user/weight-targets", { token: mobileToken });
hasFields(
  "the weight targets carry the fields the mobile app reads",
  mobileWeightTargets.json,
  ["currentWeight", "targetWeight"],
);

const mobileChat = await call("/api/chat", {
  method: "POST",
  body: { query: "how much carbohydrate should I eat?" },
  token: mobileToken,
});
check("the mobile chat answers", mobileChat.status === 200 && Boolean(mobileChat.json?.answer));

// ---------------------------------------------------------------------------
// 3. The web app is built and served
// ---------------------------------------------------------------------------
console.log("\nWeb app build and serve");

const webDist = join(process.cwd(), "apps", "web", "dist");
if (existsSync(join(webDist, "index.html"))) {
  check("the web app produced a dist/index.html", true);
  const assets = join(webDist, "assets");
  const built = existsSync(assets) ? readdirSync(assets) : [];
  check(
    "the web app bundled its assets",
    built.some((file) => file.endsWith(".js")),
    `${built.length} files`,
  );

  const html = readFileSync(join(webDist, "index.html"), "utf8");
  check("the built page mounts the app", html.includes('id="root"'));
  check("the built page loads a module bundle", /<script[^>]+type="module"/.test(html));
} else {
  check("the web app produced a dist/index.html", false, "run `npm run build`");
}

try {
  const page = await fetch(`${WEB_BASE}/`);
  const html = await page.text();
  check("the dev server serves the web app", page.ok, `status=${page.status}`);
  check("the served page mounts the app", html.includes('id="root"'));
} catch (error) {
  check("the dev server serves the web app", false, error.message);
}

// ---------------------------------------------------------------------------
// 4. The mobile app is built
// ---------------------------------------------------------------------------
console.log("\nMobile app build");

const mobileDist = join(process.cwd(), "apps", "mobile", "dist");
if (existsSync(mobileDist)) {
  // `expo export --platform android` writes the Hermes bundle under
  // `dist/_expo/static/js/android/`.
  const jsDir = join(mobileDist, "_expo", "static", "js");
  const bundles = existsSync(jsDir)
    ? readdirSync(jsDir, { recursive: true })
        .filter((file) => String(file).endsWith(".js") || String(file).endsWith(".hbc"))
        .map((file) => join(jsDir, String(file)))
    : [];
  check("the mobile app produced a bundle", bundles.length > 0, `${bundles.length} bundle(s)`);

  const bundle = bundles
    .map((file) => readFileSync(file, "utf8"))
    .join("");
  check("the bundle contains the planner screen", bundle.includes("Meal Planner"));
  check("the bundle contains the settings screen", bundle.includes("Settings"));
} else {
  check("the mobile app produced a bundle", false, "run `npm run build --workspace=@glucoplate/mobile`");
}

// The mobile app must not still be calling the old, deleted endpoints.
console.log("\nNo stale references");
const mobileSrc = join(process.cwd(), "apps", "mobile", "src");
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The modules that no longer exist. `@/lib/api-client` is the app's own. */
const DELETED_PATHS = [
  /from ["']@\/lib\/(types|format|planner|auth|seed|data|mobile)\b/,
  /from ["']@\/components\//,
];

let stale = [];
for (const file of walk(mobileSrc)) {
  const content = readFileSync(file, "utf8");
  if (DELETED_PATHS.some((pattern) => pattern.test(content))) {
    stale.push(`${file}: imports a module that no longer exists`);
  }
}
check("the mobile app has no imports from the deleted src/ tree", stale.length === 0, stale.join("; "));

let webStale = [];
const webSrc = join(process.cwd(), "apps", "web", "src");
for (const file of walk(webSrc)) {
  const content = readFileSync(file, "utf8");
  if (DELETED_PATHS.some((pattern) => pattern.test(content))) {
    webStale.push(`${file}: imports a module that no longer exists`);
  }
}
check("the web app has no imports from the deleted src/ tree", webStale.length === 0, webStale.join("; "));

console.log(
  failures === 0
    ? `\nAll ${checks} client checks passed.\n`
    : `\n${failures} of ${checks} client checks FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
