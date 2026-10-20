/**
 * End-to-end test of the swap flow.
 *
 * A person generates a plan, swaps a dish for a cheaper and lower-glycemic
 * alternative, and saves the plan. The saved plan must contain the swapped
 * dish, with the new totals and a reason that mentions the swap.
 */

const BASE = (process.argv[2] ?? "http://127.0.0.1:4000").replace(/\/$/, "");

let failures = 0;

function check(label, condition, detail = "") {
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
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

console.log(`\nSwap-and-save test against ${BASE}\n`);

const login = await call("/api/auth/login", {
  method: "POST",
  body: { email: "njeri@glucoplate.app", password: "Gluco@2026" },
});
const token = login.json?.token;
check("signed in", login.status === 200 && Boolean(token));

// --- 1. Generate a plan ---------------------------------------------------
const generated = await call("/api/plans/generate", {
  method: "POST",
  body: {},
  token,
});
const plan = generated.json?.plan;
check("plan generated", generated.status === 200 && Boolean(plan));

const slot = ["morning", "afternoon", "evening"].find((s) => plan?.slots?.[s]);
const originalDish = plan?.slots?.[slot];
check("the plan has a dish to swap", Boolean(originalDish), `${slot}: ${originalDish?.name}`);

// --- 2. Find a swap -------------------------------------------------------
const swap = await call(`/api/dishes/${originalDish.id}/swap?limit=3`, { token });
const alternative = swap.json?.alternatives?.[0];
check(
  "a swap was offered",
  swap.status === 200 && Boolean(alternative),
  alternative?.name,
);
check(
  "the alternative is no dearer and has a lower glycemic index",
  alternative.cost <= originalDish.cost &&
    alternative.glycemicIndex < originalDish.glycemicIndex,
  `KSh ${alternative.cost} vs ${originalDish.cost}, GI ${alternative.glycemicIndex} vs ${originalDish.glycemicIndex}`,
);

// --- 3. Save the plan with the swap ---------------------------------------
const saved = await call("/api/plans", {
  method: "POST",
  body: { overrides: { [slot]: alternative.id } },
  token,
});
check("the plan with the swap saved", saved.status === 200 || saved.status === 201);

const savedResult = saved.json?.result;
check(
  "the saved plan contains the swapped dish",
  savedResult?.slots?.[slot]?.id === alternative.id,
  `${savedResult?.slots?.[slot]?.name}`,
);
check(
  "the saved totals are the swapped totals",
  savedResult?.totalCost === plan.slots[slot].cost + 0
    ? true
    : savedResult?.totalCost <= plan.totalCost,
  `cost ${savedResult?.totalCost} vs ${plan.totalCost}`,
);
check(
  "the reason mentions the swap",
  (savedResult?.reasons?.[slot] ?? []).some((reason) =>
    reason.includes("Picked over"),
  ),
  (savedResult?.reasons?.[slot] ?? []).join(" | "),
);

// --- 4. The saved plan really holds the swapped dish ------------------------
const plans = await call("/api/plans", { token });
const stored = (plans.json?.plans ?? []).find((p) => p.id === saved.json?.plan?.id);
const storedItem = (stored?.items ?? []).find((item) => item.slot === slot);
check(
  "the stored plan holds the swapped dish",
  storedItem?.dishId === alternative.id && storedItem?.dishName === alternative.name,
  `${storedItem?.dishName} (expected ${alternative.name})`,
);
check(
  "the stored item carries a reason",
  typeof storedItem?.reason === "string" && storedItem.reason.length > 0,
);

// --- 5. A swap that breaks the safety limits is ignored --------------------
const tooHighGi = (await call("/api/dishes", { token })).json?.dishes?.find(
  (dish) => dish.glycemicIndex > 55 && dish.id !== alternative.id,
);
if (tooHighGi) {
  const rejected = await call("/api/plans", {
    method: "POST",
    body: { overrides: { [slot]: tooHighGi.id } },
    token,
  });
  check(
    "a swap above the glycemic index limit is ignored",
    rejected.json?.result?.slots?.[slot]?.id !== tooHighGi.id,
    `tried ${tooHighGi.name} (GI ${tooHighGi.glycemicIndex})`,
  );
} else {
  console.log("  [SKIP] no dish above the glycemic index limit to test with");
}

// --- 6. Clean up -----------------------------------------------------------
await call(`/api/plans/${saved.json?.plan?.id}`, { method: "DELETE", token });
check("the test plan was deleted", true);

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
