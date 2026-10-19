/**
 * Cross-service smoke test.
 *
 * Exercises the whole GlucoPlate system through the gateway, exactly the way
 * the web and mobile clients do.
 *
 *   npm run smoke                 # against http://127.0.0.1:4000
 *   npm run smoke -- https://…    # against a deployed gateway
 *
 * It also talks to every service directly, to prove that each one is
 * independently reachable and healthy.
 */

const BASE = (process.argv[2] ?? "http://127.0.0.1:4000").replace(/\/$/, "");

const SERVICES = {
  auth: "http://127.0.0.1:4001",
  catalog: "http://127.0.0.1:4002",
  planner: "http://127.0.0.1:4003",
  health: "http://127.0.0.1:4004",
};

let failures = 0;

function check(label, condition, detail = "") {
  if (!condition) failures += 1;
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}${detail ? ` -> ${detail}` : ""}`);
}

async function call(path, { method = "GET", body, token, base = BASE } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json, headers: response.headers };
}

console.log(`\nGlucoPlate cross-service smoke test against ${BASE}\n`);

// --- 1. Every service is healthy -----------------------------------------
console.log("Service health (direct, not through the gateway)");
for (const [name, base] of Object.entries(SERVICES)) {
  const health = await call("/api/health", { base });
  check(
    `svc-${name} is healthy on port ${new URL(base).port}`,
    health.status === 200 && health.json?.ok === true,
    JSON.stringify(health.json),
  );
}

// --- 2. The gateway sees them all -----------------------------------------
console.log("\nGateway");
const gatewayHealth = await call("/api/health");
check(
  "GET /api/health aggregates every upstream",
  gatewayHealth.status === 200 &&
    gatewayHealth.json?.upstream?.auth === true &&
    gatewayHealth.json?.upstream?.catalog === true &&
    gatewayHealth.json?.upstream?.planner === true &&
    gatewayHealth.json?.upstream?.health === true,
  JSON.stringify(gatewayHealth.json?.upstream),
);
check(
  "the gateway sets x-service",
  gatewayHealth.headers.get("x-service") === "gateway",
);
check(
  "the gateway sets x-request-id",
  Boolean(gatewayHealth.headers.get("x-request-id")),
  gatewayHealth.headers.get("x-request-id") ?? "",
);

const unknown = await call("/api/does-not-exist");
check("an unknown path returns 404", unknown.status === 404, JSON.stringify(unknown.json));

// --- 3. Auth ---------------------------------------------------------------
console.log("\nAuthentication");
const noAuth = await call("/api/auth/me");
check("GET /api/auth/me without a token is 401", noAuth.status === 401);

const email = `smoke-${Date.now()}@glucoplate.app`;
const registered = await call("/api/auth/register", {
  method: "POST",
  body: {
    name: "Smoke Tester",
    email,
    password: "SmokeTest@2026",
    setting: "student",
    diabetesLevel: "prediabetes",
  },
});
check("register returns 201", registered.status === 201, `status=${registered.status}`);
check("register returns a token", typeof registered.json?.token === "string");
check(
  "the new account gets the prediabetes limits",
  registered.json?.user?.dailyCarbLimit === 150 &&
    registered.json?.user?.dailyGiLimit === 50,
  `carb=${registered.json?.user?.dailyCarbLimit} gi=${registered.json?.user?.dailyGiLimit}`,
);
check(
  "the password hash is never returned",
  registered.json?.user?.passwordHash === undefined,
);

const duplicate = await call("/api/auth/register", {
  method: "POST",
  body: { name: "Dup", email, password: "SmokeTest@2026" },
});
check("a duplicate email is 409", duplicate.status === 409);

const login = await call("/api/auth/login", {
  method: "POST",
  body: { email, password: "SmokeTest@2026" },
});
check("login returns 200", login.status === 200);
check("login returns a token", typeof login.json?.token === "string");

const badLogin = await call("/api/auth/login", {
  method: "POST",
  body: { email, password: "wrong" },
});
check("a wrong password is 401", badLogin.status === 401);

const token = login.json?.token;

const me = await call("/api/auth/me", { token });
check("GET /api/auth/me with a token returns 200", me.status === 200);
check("me returns the right email", me.json?.user?.email === email);

const badToken = await call("/api/auth/me", { token: "not.a.real.token" });
check("a bogus token is 401", badToken.status === 401);

// --- 4. The catalogue ------------------------------------------------------
console.log("\nKenyan dish catalogue (svc-catalog)");
const dishes = await call("/api/dishes", { token });
const list = dishes.json?.dishes ?? [];
check("GET /api/dishes returns 200", dishes.status === 200);
check("the catalogue has at least 40 dishes", list.length >= 40, `count=${list.length}`);
check(
  "every dish has a KES price, carbs, calories and a GI",
  list.every(
    (d) =>
      typeof d.cost === "number" &&
      d.cost >= 0 &&
      typeof d.carbsG === "number" &&
      typeof d.calories === "number" &&
      typeof d.glycemicIndex === "number",
  ),
);
check(
  "the Kenyan staples are all there",
  ["Ugali", "Sukuma Wiki", "Chapati", "Githeri", "Matoke", "Nyama Choma"].every(
    (name) => list.some((d) => d.name === name),
  ),
);
check(
  "the shared catalogue has no owner",
  list.filter((d) => d.userId === null).length >= 42,
);

const stats = await call("/api/dishes/stats", { token });
check(
  "GET /api/dishes/stats returns the totals",
  stats.status === 200 && typeof stats.json?.total === "number",
  JSON.stringify(stats.json),
);

// --- 5. The planner (svc-planner, which calls svc-catalog and svc-auth) ----
console.log("\nMeal planner (svc-planner -> svc-catalog + svc-auth)");
const generated = await call("/api/plans/generate", {
  method: "POST",
  body: {},
  token,
});
check("POST /api/plans/generate returns 200", generated.status === 200);
check(
  "the plan has three slots",
  Object.values(generated.json?.plan?.slots ?? {}).filter(Boolean).length === 3,
);
check(
  "the plan is within budget and carbs",
  generated.json?.plan?.withinBudget === true &&
    generated.json?.plan?.withinCarbs === true,
  `cost=${generated.json?.plan?.totalCost} carbs=${generated.json?.plan?.totalCarbs}`,
);
check(
  "the plan is within the glycemic index limit",
  generated.json?.plan?.withinGi === true,
  `highestGI=${generated.json?.plan?.highestGi} limit=${generated.json?.giLimit}`,
);
check("the response carries the safety notice", typeof generated.json?.notice === "string");

const saved = await call("/api/plans", { method: "POST", body: {}, token });
check("POST /api/plans saves a plan", saved.status === 201 || saved.status === 200);

const plans = await call("/api/plans", { token });
check("GET /api/plans returns 200", plans.status === 200);
check(
  "the saved plan comes back with its items",
  (plans.json?.plans ?? []).some((p) => (p.items ?? []).length > 0),
);

// --- 6. Health service -----------------------------------------------------
console.log("\nHealth service (svc-health -> svc-planner)");
const weightTargets = await call("/api/user/weight-targets", { token });
check(
  "GET /api/user/weight-targets returns 200",
  weightTargets.status === 200,
  JSON.stringify(weightTargets.json),
);

const logged = await call("/api/weight", {
  method: "POST",
  body: { weight: 71.4 },
  token,
});
check("POST /api/weight logs a weight", logged.status === 201 || logged.status === 200);

const badWeight = await call("/api/weight", {
  method: "POST",
  body: { weight: -5 },
  token,
});
check("a negative weight is 400", badWeight.status === 400);

const analytics = await call("/api/analytics", { token });
check("GET /api/analytics returns 200", analytics.status === 200);
check(
  "analytics has a summary",
  typeof analytics.json?.summary?.totalPlans === "number",
  JSON.stringify(analytics.json?.summary),
);

const chat = await call("/api/chat", {
  method: "POST",
  body: { query: "what is the glycemic index?" },
  token,
});
check("POST /api/chat answers", chat.status === 200 && Boolean(chat.json?.answer));
check("the chat answer carries a disclaimer", Boolean(chat.json?.disclaimer));

// --- 7. The personas really do differ --------------------------------------
console.log("\nThe five personas get different plans");
const personas = [
  { email: "njeri@glucoplate.app", label: "student / healthy" },
  { email: "brian@glucoplate.app", label: "child / prediabetes" },
  { email: "peter@glucoplate.app", label: "working class / controlled" },
  { email: "grace@glucoplate.app", label: "elderly / high risk" },
  { email: "josephine@glucoplate.app", label: "rural farmer / critical" },
];

const results = [];
for (const persona of personas) {
  const auth = await call("/api/auth/login", {
    method: "POST",
    body: { email: persona.email, password: "Gluco@2026" },
  });
  const personaToken = auth.json?.token;
  const plan = await call("/api/plans/generate", {
    method: "POST",
    body: {},
    token: personaToken,
  });

  const result = plan.json?.plan;
  results.push({
    label: persona.label,
    giLimit: plan.json?.giLimit,
    highestGi: result?.highestGi ?? 0,
    cost: result?.totalCost ?? 0,
    carbs: result?.totalCarbs ?? 0,
    names: Object.values(result?.slots ?? {})
      .filter(Boolean)
      .map((d) => d.name)
      .join(", "),
  });

  check(
    `${persona.label}: plan generated and within limits`,
    plan.status === 200 &&
      result?.withinBudget === true &&
      result?.withinCarbs === true &&
      result?.withinGi === true,
    `cost=${result?.totalCost} carbs=${result?.totalCarbs} maxGI=${result?.highestGi}`,
  );
}

console.log("\n  Persona comparison");
for (const plan of results) {
  console.log(
    `   ${plan.label.padEnd(30)} GI<=${String(plan.giLimit).padStart(3)} (used ${String(plan.highestGi).padStart(2)})  KSh ${String(plan.cost).padStart(6)}  ${String(plan.carbs).padStart(3)}g  ${plan.names}`,
  );
}

const distinct = new Set(results.map((p) => p.names)).size;
check(
  "the five personas get at least four distinct plans",
  distinct >= 4,
  `${distinct} distinct plans`,
);
check(
  "the critical persona has the tightest glycemic index ceiling",
  results[4].giLimit < results[0].giLimit,
  `${results[4].giLimit} < ${results[0].giLimit}`,
);
check(
  "the critical persona spends less than the working-class persona",
  results[4].cost < results[2].cost,
  `${results[4].cost} < ${results[2].cost}`,
);

// --- 8. Clinician banner ---------------------------------------------------
console.log("\nSafety notices");
const criticalAuth = await call("/api/auth/login", {
  method: "POST",
  body: { email: "josephine@glucoplate.app", password: "Gluco@2026" },
});
const criticalMe = await call("/api/auth/me", { token: criticalAuth.json?.token });
check(
  "the critical persona gets a clinician banner",
  typeof criticalMe.json?.banner === "string" && criticalMe.json.banner.length > 20,
);
check(
  "the critical persona is flagged for clinical review",
  criticalMe.json?.user?.needsClinicianReview === true,
);

const healthyAuth = await call("/api/auth/login", {
  method: "POST",
  body: { email: "njeri@glucoplate.app", password: "Gluco@2026" },
});
const healthyMe = await call("/api/auth/me", { token: healthyAuth.json?.token });
check("the healthy persona gets no clinician banner", !healthyMe.json?.banner);

// --- 9. Tracing ------------------------------------------------------------
console.log("\nRequest tracing");
const traced = await call("/api/auth/login", {
  method: "POST",
  body: { email, password: "SmokeTest@2026" },
  token,
});
check(
  "the response carries x-request-id",
  Boolean(traced.headers.get("x-request-id")),
  traced.headers.get("x-request-id") ?? "",
);
check(
  "the response says which upstream answered",
  traced.headers.get("x-upstream") === "auth",
  traced.headers.get("x-upstream") ?? "",
);

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
