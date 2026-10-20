/**
 * Endpoint audit.
 *
 * Exercises EVERY route in the monorepo — directly on its own service and
 * again through the gateway — and checks three things for each:
 *
 *   1. the route exists (a 404 means it is not registered)
 *   2. auth is enforced (401 without a token, on a protected route)
 *   3. it works with a token and returns the documented shape
 *
 *   node scripts/audit-endpoints.mjs
 */

const GATEWAY = (process.argv[2] ?? "http://127.0.0.1:4000").replace(/\/$/, "");

const SERVICES = {
  gateway: GATEWAY,
  auth: "http://127.0.0.1:4001",
  catalog: "http://127.0.0.1:4002",
  planner: "http://127.0.0.1:4003",
  health: "http://127.0.0.1:4004",
};

let failures = 0;
let checks = 0;

function check(label, condition, detail = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(
    `  [${condition ? "PASS" : "FAIL"}] ${label}${detail ? ` -> ${detail}` : ""}`,
  );
}

async function call(path, { method = "GET", body, token, base = GATEWAY } = {}) {
  const response = await fetch(`${base}${path}`, {
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
  return { status: response.status, json, headers: response.headers };
}

/** A tiny unique dish so the create/update/delete test is isolated. */
const stamp = Date.now();
const testDish = {
  name: `Audit Test Dish ${stamp}`,
  description: "Created by the endpoint audit.",
  mealTime: "any",
  cost: 42,
  calories: 210,
  carbsG: 30,
  proteinG: 8,
  fatG: 5,
  fiberG: 4,
  glycemicIndex: 45,
};

console.log(`\nGlucoPlate endpoint audit against ${GATEWAY}\n`);

// ---------------------------------------------------------------------------
// 1. Health and discovery on every service
// ---------------------------------------------------------------------------
console.log("Health and discovery");
for (const [name, base] of Object.entries(SERVICES)) {
  const health = await call("/api/health", { base });
  check(
    `${name.padEnd(8)} GET /api/health`,
    health.status === 200 && health.json?.ok === true,
    JSON.stringify(health.json),
  );

  const root = await call("/", { base });
  check(
    `${name.padEnd(8)} GET /`,
    root.status === 200 && root.json?.service !== undefined,
    JSON.stringify(root.json).slice(0, 90),
  );
}

// ---------------------------------------------------------------------------
// 2. Authentication
// ---------------------------------------------------------------------------
console.log("\nAuthentication");
const email = `audit-${stamp}@glucoplate.app`;
const registered = await call("/api/auth/register", {
  method: "POST",
  body: {
    name: "Audit User",
    email,
    password: "AuditPass@2026",
    setting: "working_class",
    diabetesLevel: "type2_controlled",
  },
});
check(
  "POST /api/auth/register -> 201",
  registered.status === 201 && typeof registered.json?.token === "string",
  `status=${registered.status}`,
);
const token = registered.json?.token;

const login = await call("/api/auth/login", {
  method: "POST",
  body: { email, password: "AuditPass@2026" },
});
check("POST /api/auth/login -> 200", login.status === 200);

const wrongPassword = await call("/api/auth/login", {
  method: "POST",
  body: { email, password: "nope" },
});
check("POST /api/auth/login with a wrong password -> 401", wrongPassword.status === 401);

const noToken = await call("/api/auth/me");
check("GET /api/auth/me without a token -> 401", noToken.status === 401);

const badToken = await call("/api/auth/me", { token: "garbage.token.value" });
check("GET /api/auth/me with a bad token -> 401", badToken.status === 401);

const me = await call("/api/auth/me", { token });
check(
  "GET /api/auth/me -> 200 with the user",
  me.status === 200 && me.json?.user?.email === email,
);
check("GET /api/auth/me carries the notice", typeof me.json?.notice === "string");

const logout = await call("/api/auth/logout", { method: "POST", token });
check("POST /api/auth/logout -> 200", logout.status === 200);

// ---------------------------------------------------------------------------
// 3. Every protected route rejects an anonymous caller
// ---------------------------------------------------------------------------
console.log("\nAuth is enforced on every protected route");
const PROTECTED = [
  ["GET", "/api/dishes"],
  ["GET", "/api/dishes/stats"],
  ["POST", "/api/dishes"],
  ["GET", "/api/plans"],
  ["POST", "/api/plans"],
  ["POST", "/api/plans/generate"],
  ["PATCH", "/api/plans/update-item"],
  ["GET", "/api/weight"],
  ["POST", "/api/weight"],
  ["GET", "/api/user/weight-targets"],
  ["PATCH", "/api/user/weight-targets"],
  ["GET", "/api/analytics"],
  ["GET", "/api/chat"],
  ["POST", "/api/chat"],
  ["GET", "/api/nutrients?query=ugali"],
  ["GET", "/api/user/profile"],
  ["PATCH", "/api/user/profile"],
  ["GET", "/api/user/budget"],
  ["PATCH", "/api/user/budget"],
  ["GET", "/api/settings"],
  ["PATCH", "/api/settings"],
];

for (const [method, path] of PROTECTED) {
  const res = await call(path, { method });
  check(
    `${method.padEnd(5)} ${path.padEnd(32)} -> 401`,
    res.status === 401,
    `status=${res.status}`,
  );
}

// ---------------------------------------------------------------------------
// 4. svc-auth
// ---------------------------------------------------------------------------
console.log("\nsvc-auth");
const profile = await call("/api/user/profile", { token, base: SERVICES.auth });
check(
  "GET /api/user/profile -> 200",
  profile.status === 200 && profile.json?.email === email,
  JSON.stringify(profile.json).slice(0, 80),
);

const patchedProfile = await call("/api/user/profile", {
  method: "PATCH",
  token,
  base: SERVICES.auth,
  body: { allergies: "peanuts", dislikes: "liver" },
});
check("PATCH /api/user/profile -> 200", patchedProfile.status === 200);

const budget = await call("/api/user/budget", { token, base: SERVICES.auth });
check(
  "GET /api/user/budget -> 200",
  budget.status === 200 && typeof budget.json?.budgetAmount === "number",
  JSON.stringify(budget.json).slice(0, 90),
);

const patchedBudget = await call("/api/user/budget", {
  method: "PATCH",
  token,
  base: SERVICES.auth,
  body: { budgetAmount: 1400, budgetPeriod: "weekly" },
});
check("PATCH /api/user/budget -> 200", patchedBudget.status === 200);

const settings = await call("/api/settings", { token, base: SERVICES.auth });
check("GET /api/settings -> 200", settings.status === 200);
check(
  "the user carries a portion profile",
  settings.json?.sex !== undefined && settings.json?.activityLevel !== undefined,
  `sex=${settings.json?.sex} activity=${settings.json?.activityLevel}`,
);

const portionTargets = await call("/api/user/portion-targets", {
  token,
  base: SERVICES.auth,
});
check(
  "GET /api/user/portion-targets -> 200 with the targets",
  portionTargets.status === 200 &&
    typeof portionTargets.json?.calories === "number" &&
    typeof portionTargets.json?.carbsG === "number" &&
    typeof portionTargets.json?.basis === "string",
  JSON.stringify(portionTargets.json).slice(0, 120),
);
check(
  "the portion targets say how they were worked out",
  typeof portionTargets.json?.personalised === "boolean",
);

const patchedSettings = await call("/api/settings", {
  method: "PATCH",
  token,
  base: SERVICES.auth,
  body: { name: "Audit User", dailyBudget: 250 },
});
check("PATCH /api/settings -> 200", patchedSettings.status === 200);

// ---------------------------------------------------------------------------
// 5. svc-catalog
// ---------------------------------------------------------------------------
console.log("\nsvc-catalog");
const dishes = await call("/api/dishes", { token, base: SERVICES.catalog });
const list = dishes.json?.dishes ?? [];
check("GET /api/dishes -> 200", dishes.status === 200);
check("the catalogue is populated", list.length >= 90, `count=${list.length}`);
check(
  "every dish has a serving label",
  list.every((dish) => typeof dish.servingLabel === "string" && dish.servingLabel.length > 0),
);
check(
  "every dish has a county",
  list.every((dish) => typeof dish.region === "string" && dish.region.length > 0),
);

const stats = await call("/api/dishes/stats", { token, base: SERVICES.catalog });
check(
  "GET /api/dishes/stats -> 200",
  stats.status === 200 && typeof stats.json?.total === "number",
  JSON.stringify(stats.json),
);

// --- Session 2: the swap endpoint -----------------------------------------
const highGiDish = list.find((dish) => dish.glycemicIndex > 30);
const swap = await call(`/api/dishes/${highGiDish.id}/swap?limit=3`, {
  token,
  base: SERVICES.catalog,
});
check("GET /api/dishes/:id/swap -> 200", swap.status === 200);
check(
  "every alternative is no dearer and has a lower glycemic index",
  (swap.json?.alternatives ?? []).every(
    (alternative) =>
      alternative.cost <= highGiDish.cost &&
      alternative.glycemicIndex < highGiDish.glycemicIndex,
  ),
  `${(swap.json?.alternatives ?? []).length} alternatives`,
);
check(
  "each alternative explains the swap",
  (swap.json?.alternatives ?? []).every(
    (alternative) =>
      typeof alternative.saving === "number" &&
      typeof alternative.giDrop === "number" &&
      typeof alternative.reason === "string" &&
      alternative.reason.length > 0,
  ),
);
const swapMissing = await call("/api/dishes/999999/swap", {
  token,
  base: SERVICES.catalog,
});
check("GET /api/dishes/:id/swap for a missing dish -> 404", swapMissing.status === 404);

const created = await call("/api/dishes", {
  method: "POST",
  token,
  base: SERVICES.catalog,
  body: testDish,
});
check(
  "POST /api/dishes -> 201",
  created.status === 201 && created.json?.dish?.id > 0,
  `status=${created.status}`,
);
const dishId = created.json?.dish?.id;

const updated = await call(`/api/dishes/${dishId}`, {
  method: "PATCH",
  token,
  base: SERVICES.catalog,
  body: { cost: 55, glycemicIndex: 40 },
});
check(
  "PATCH /api/dishes/:id -> 200",
  updated.status === 200 && updated.json?.dish?.cost === 55,
  JSON.stringify(updated.json).slice(0, 80),
);

const deleted = await call(`/api/dishes/${dishId}`, {
  method: "DELETE",
  token,
  base: SERVICES.catalog,
});
check("DELETE /api/dishes/:id -> 200", deleted.status === 200);

const deletedTwice = await call(`/api/dishes/${dishId}`, {
  method: "DELETE",
  token,
  base: SERVICES.catalog,
});
check("DELETE /api/dishes/:id twice -> 404", deletedTwice.status === 404);

// A catalogue dish must not be editable by a user.
const catalogueDish = list.find((d) => d.userId === null);
const patchCatalogue = await call(`/api/dishes/${catalogueDish.id}`, {
  method: "PATCH",
  token,
  base: SERVICES.catalog,
  body: { cost: 1 },
});
check(
  "PATCH a shared catalogue dish -> 404",
  patchCatalogue.status === 404,
  `status=${patchCatalogue.status}`,
);

// ---------------------------------------------------------------------------
// 6. svc-planner
// ---------------------------------------------------------------------------
console.log("\nsvc-planner");
const generated = await call("/api/plans/generate", {
  method: "POST",
  token,
  base: SERVICES.planner,
  body: {},
});
check("POST /api/plans/generate -> 200", generated.status === 200);
check(
  "the plan fills three slots",
  Object.values(generated.json?.plan?.slots ?? {}).filter(Boolean).length === 3,
);
check(
  "the plan explains every slot",
  ["morning", "afternoon", "evening"].every(
    (slot) => (generated.json?.plan?.reasons?.[slot] ?? []).length > 0,
  ),
);
check(
  "the reasons quote the caller's own budget",
  JSON.stringify(generated.json?.plan?.reasons ?? {}).includes("KSh"),
);

const saved = await call("/api/plans", {
  method: "POST",
  token,
  base: SERVICES.planner,
  body: {},
});
check(
  "POST /api/plans -> 200/201",
  saved.status === 200 || saved.status === 201,
  `status=${saved.status}`,
);
const planId = saved.json?.plan?.id;

const plans = await call("/api/plans", { token, base: SERVICES.planner });
check(
  "GET /api/plans -> 200 with items",
  plans.status === 200 && (plans.json?.plans ?? []).some((p) => p.items?.length),
);
check(
  "saved plan items carry a reason",
  (plans.json?.plans ?? [])
    .flatMap((plan) => plan.items ?? [])
    .every((item) => typeof item.reason === "string"),
);

const itemId = plans.json?.plans?.[0]?.items?.[0]?.id;
const updateItem = await call("/api/plans/update-item", {
  method: "PATCH",
  token,
  base: SERVICES.planner,
  body: { itemId, status: "eaten" },
});
check(
  "PATCH /api/plans/update-item -> 200",
  updateItem.status === 200,
  JSON.stringify(updateItem.json).slice(0, 80),
);

const badStatus = await call("/api/plans/update-item", {
  method: "PATCH",
  token,
  base: SERVICES.planner,
  body: { itemId, status: "invented" },
});
check("PATCH /api/plans/update-item with a bad status -> 400", badStatus.status === 400);

const removePlan = await call(`/api/plans/${planId}`, {
  method: "DELETE",
  token,
  base: SERVICES.planner,
});
check("DELETE /api/plans/:id -> 200", removePlan.status === 200);

const removeTwice = await call(`/api/plans/${planId}`, {
  method: "DELETE",
  token,
  base: SERVICES.planner,
});
check("DELETE /api/plans/:id twice -> 404", removeTwice.status === 404);

// ---------------------------------------------------------------------------
// 7. svc-health
// ---------------------------------------------------------------------------
console.log("\nsvc-health");
const logged = await call("/api/weight", {
  method: "POST",
  token,
  base: SERVICES.health,
  body: { weight: 70.5, note: "audit" },
});
check(
  "POST /api/weight -> 200/201",
  logged.status === 200 || logged.status === 201,
  `status=${logged.status}`,
);

const weightLogs = await call("/api/weight", { token, base: SERVICES.health });
check(
  "GET /api/weight -> 200 with logs",
  weightLogs.status === 200 && (weightLogs.json?.logs ?? []).length > 0,
);

const badWeight = await call("/api/weight", {
  method: "POST",
  token,
  base: SERVICES.health,
  body: { weight: -3 },
});
check("POST /api/weight with a negative weight -> 400", badWeight.status === 400);

const targets = await call("/api/user/weight-targets", {
  token,
  base: SERVICES.health,
});
check("GET /api/user/weight-targets -> 200", targets.status === 200);

const patchedTargets = await call("/api/user/weight-targets", {
  method: "PATCH",
  token,
  base: SERVICES.health,
  body: { currentWeight: 70.5, targetWeight: 68 },
});
check("PATCH /api/user/weight-targets -> 200", patchedTargets.status === 200);

const analytics = await call("/api/analytics", { token, base: SERVICES.health });
check(
  "GET /api/analytics -> 200 with a summary",
  analytics.status === 200 && typeof analytics.json?.summary?.totalPlans === "number",
  JSON.stringify(analytics.json?.summary),
);

const chat = await call("/api/chat", {
  method: "POST",
  token,
  base: SERVICES.health,
  body: { query: "what is the glycemic index?" },
});
check(
  "POST /api/chat -> 200 with an answer",
  chat.status === 200 && typeof chat.json?.answer === "string",
);
check("the chat answer carries a disclaimer", Boolean(chat.json?.disclaimer));

const chatHistory = await call("/api/chat", { token, base: SERVICES.health });
check("GET /api/chat -> 200", chatHistory.status === 200);

const nutrients = await call("/api/nutrients?query=ugali", {
  token,
  base: SERVICES.health,
});
check(
  "GET /api/nutrients -> 200 with numbers",
  nutrients.status === 200 && typeof nutrients.json?.calories === "number",
  JSON.stringify(nutrients.json),
);

// ---------------------------------------------------------------------------
// 8. The gateway routes everything
// ---------------------------------------------------------------------------
console.log("\nThe gateway routes every path to the right service");
const ROUTING = [
  ["GET", "/api/auth/me", "auth"],
  ["GET", "/api/user/profile", "auth"],
  ["GET", "/api/user/budget", "auth"],
  ["GET", "/api/user/portion-targets", "auth"],
  ["GET", "/api/settings", "auth"],
  ["GET", "/api/dishes", "catalog"],
  ["GET", "/api/dishes/stats", "catalog"],
  ["GET", "/api/plans", "planner"],
  ["GET", "/api/weight", "health"],
  ["GET", "/api/user/weight-targets", "health"],
  ["GET", "/api/analytics", "health"],
  ["GET", "/api/chat", "health"],
  ["GET", "/api/nutrients?query=ugali", "health"],
];

for (const [method, path, expected] of ROUTING) {
  const res = await call(path, { method, token });
  check(
    `${method.padEnd(5)} ${path.padEnd(32)} -> ${expected}`,
    res.status === 200 && res.headers.get("x-upstream") === expected,
    `status=${res.status} upstream=${res.headers.get("x-upstream")}`,
  );
}

const unknown = await call("/api/not-a-real-path");
check(
  "an unknown path -> 404 with the standard shape",
  unknown.status === 404 &&
    typeof unknown.json?.error === "string" &&
    typeof unknown.json?.requestId === "string",
  JSON.stringify(unknown.json),
);

console.log(
  failures === 0
    ? `\nAll ${checks} checks passed.\n`
    : `\n${failures} of ${checks} checks FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
