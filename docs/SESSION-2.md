# Session 2 — The Kenyan catalogue, the portion calculator, and "why this dish"

Session 2 took the backend from "it works" to "it explains itself". Four
things changed:

1. **The catalogue grew from 42 to 95 dishes** across 14 Kenyan counties.
2. **A portion calculator** turns a person's height, weight, age and activity
   into daily nutrition targets.
3. **Every plan line now says why it was chosen**, in that person's own
   numbers.
4. **A swap action** finds a cheaper, lower-glycemic-index alternative for any
   dish in a plan.

---

## 1. The catalogue: 95 Kenyan dishes

`packages/data/src/kenyan-dishes.json` now holds 95 dishes, each with a cost
in KSh, calories, carbohydrate, protein, fat, fibre, a glycemic index, a
**serving label** ("1 chapati (60 g)"), and the county or community it comes
from.

| County | Dishes | County | Dishes |
|---|---|---|---|
| Kikuyu | 12 | Meru | 4 |
| Modern | 13 | Embu | 3 |
| Swahili | 10 | Nyeri | 3 |
| Luo | 9 | Turkana | 3 |
| Luhya | 9 | Kisii | 3 |
| Coastal | 9 | Western | 3 |
| Kalenjin | 8 | Maasai | 6 |

The original 42 dishes are untouched — same names, same numbers, same order.
The 53 new ones are recognisable regional staples: omena and managu greens
(Luo), iri and imbuga (Kikuyu), oluwere and wimbi (Luhya), mishkaki and
ndumbo (Swahili), kimemai and muto (Kalenjin), oxtail and enkima (Maasai),
isakawusa and njukaka (Meru).

**The rules the data follows**
- No duplicate dish names, and no two dishes that are really the same meal.
- Macros are consistent with the Atwater factors (4/4/9) to within 3 kcal.
- Glycemic index 0 for pure protein and fat dishes, 15-40 for legumes and
  non-starchy vegetables, 45-55 for oats and whole wheat, 70+ for refined
  starches.
- A single family meal never costs more than KSh 350.
- Only five dishes are free (homegrown greens and farm produce).

### Why the planner had to be retuned

With 42 dishes the planner filled the carbohydrate allowance and stopped. That
meant the working-class persona — who has KSh 350 a day and does physical
work — got the same plate as the student with KSh 200. The scoring function now
also rewards **spending the budget you actually have**, so a bigger budget buys
a more substantial meal.

The result: **all five personas now get a different plan**, and every plan is
inside all three of their limits. These are the live numbers, from
`npm run smoke`:

| Persona | Plan | Cost | Carbs |
|---|---|---|---|
| Njeri (student, healthy) | Oats & peanut butter · Omena · Luom | KSh 200 / 200 | 96 g / 210 g |
| Brian (child, prediabetes) | Namasake beans · Luom · Enkima | KSh 130 / 150 | 118 g / 150 g |
| Peter (working class, controlled) | Oats & peanut butter · Omena · Mishkaki | KSh 330 / 350 | 56 g / 180 g |
| Grace (elderly, high risk) | Luom · Omena · Enkima | KSh 180 / 250 | 86 g / 120 g |
| Josephine (rural farmer, critical) | Namasake beans · Bhajia · Enkima | KSh 110 / 120 | 100 g / 100 g |

Peter's plan now costs KSh 330 of his KSh 350, and Josephine's exactly fills
her KSh 120 — a bigger budget buys a more substantial meal, and a tighter
carbohydrate ceiling keeps the rest small.

---

## 2. The portion calculator

`packages/domain/src/portion.ts` turns a physical profile into daily targets.

- **Basal metabolic rate** — the Mifflin-St Jeor equation:
  `10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5` (male) / `− 161` (female).
- **Daily energy** — BMR × a physical activity factor (1.2 sedentary to
  1.725 very active).
- **Macro split** — carbohydrate 45%, protein 25%, fat 30%. Carbohydrate is
  held below the usual 50-55% because the plan has to fit a carbohydrate
  ceiling, and protein gets a slightly larger share so the meals stay filling.

An incomplete profile falls back to a general adult profile (2,000 kcal) and
says so, rather than pretending to be personalised.

**New API:** `GET /api/user/portion-targets`

```json
{
  "calories": 2078, "carbsG": 234, "proteinG": 130, "fatG": 69,
  "bmr": 1340, "tdee": 2078,
  "basis": "Mifflin-St Jeor from your height, weight and age, times a moderate activity factor. Carbohydrate is held at 45% of your energy.",
  "personalised": true,
  "profile": { "age": 22, "sex": "female", "heightCm": 165, "weightKg": 58, "activityLevel": "moderate" }
}
```

The user's `sex` and `activityLevel` live on the account, so the targets
follow the person across every device.

---

## 3. "Why this dish"

Every slot of a plan now carries its own reasons, generated in
`packages/domain/src/explain.ts` and returned in `plan.reasons`:

```json
"morning": [
  "KSh 70 — 35% of your KSh 200 daily budget, leaving KSh 130.",
  "Glycemic index 55 sits right at your limit of 55.",
  "50 g of carbohydrate — 24% of your 210 g daily allowance.",
  "13 g of protein.",
  "Chosen for your morning slot."
]
```

Every sentence is a fact about **this** dish against **this** person's own
limits. There is no generic advice. The same sentence changes when the budget
changes — ask for a KSh 300 plan and it says "KSh 70 — 23% of your KSh 300
daily budget".

The reasons are also **persisted** on the saved plan item (`meal_plan_items.reason`),
so a plan you followed three weeks ago still explains itself.

---

## 4. Swapping a dish

`GET /api/dishes/:id/swap?limit=3` returns alternatives that are **never more
expensive** and **always have a lower glycemic index**, preferring a dish
suited to the same meal slot.

```json
{
  "dish": { "id": 12, "name": "White Rice" },
  "alternatives": [
    { "id": 7, "name": "Githeri", "cost": 40, "glycemicIndex": 55,
      "saving": 0, "giDrop": 18,
      "reason": "KSh 0 cheaper and glycemic index 18 points lower." }
  ]
}
```

The swap logic lives in `packages/domain/src/explain.ts`, so the catalogue
service, the planner and the clients all use exactly the same rules.

### A swap survives being saved

The preview shows the swap immediately, and the swap travels with the save
request, so the plan you follow is the plan you chose:

```json
POST /api/plans
{ "overrides": { "morning": 21 } }
```

`overrides` maps a slot to a dish id. The planner only honours a swap that is
**within the person's glycemic index limit** and is **not already in another
slot** — a stale or hand-edited request can never produce a plan that breaks
the safety limits. The reason on a swapped slot says so:

> "Picked over Oats, Banana and Peanut Butter: KSh 40 cheaper and glycemic
> index 55 points lower."

---

## 5. New and changed API endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/dishes/:id/swap?limit=3` | Cheaper, lower-GI alternatives for a dish |
| GET | `/api/user/portion-targets` | Daily calories, carbs, protein and fat for the caller |
| PATCH | `/api/settings` | Now accepts `age`, `heightCm`, `currentWeight`, `targetWeight`, `sex`, `activityLevel` |
| GET | `/api/plans` | Items now carry a `reason` |
| POST | `/api/plans/generate` | The plan now carries `reasons` |
| GET | `/api/dishes` | Every dish now carries a `servingLabel` |

**New contract fields** in `@glucoplate/types`:
`Dish.servingLabel`, `PlanResult.reasons`, `PublicUser.sex`,
`PublicUser.activityLevel`, `PortionProfile`, `PortionTargets`,
`SwapCandidate`, `ACTIVITY_LEVELS`, `SEXES`.

---

## 6. Tests

`packages/domain` has a test suite that checks the numbers rather than the
plumbing:

```bash
npm run test --workspace=@glucoplate/domain
```

17 tests covering the Mifflin-St Jeor calculations, the activity factors, the
macro split, the fallback for an incomplete profile, the wording of the
reasons, and the swap invariants (never dearer, always a lower glycemic index,
never the dish itself).

```bash
npm run build lint typecheck test   # everything
npm run smoke                       # 45 cross-service checks
npm run audit                       # 97 endpoint checks
npm run test:swap                   # the swap-and-save flow
```

> **A trap worth knowing:** `packages/*/dist` is a build artifact. Running
> `npx tsc -p apps/<svc>/tsconfig.json` on its own type-checks against a
> **stale** contract and reports a false green. Always use
> `turbo run typecheck`, which rebuilds the packages first.

> **A second trap:** the planner caches the caller's profile for 60 seconds,
> so a change to a person's budget is not reflected in a plan for up to a
> minute. That is deliberate — it is what stops a sleeping catalogue service
> from making every request wait — but it surprises you the first time you
> edit a persona and wonder why nothing changed.

### Two bugs this session caught

- **The personas' budgets disagreed with themselves.** Peter's `budgetAmount`
  was 3,500 while his `dailyBudget` was 350. The planner derives the daily
  allowance from the period total, so he silently got a KSh 500 budget while
  the dashboard showed KSh 350. Every persona's `budgetAmount` is now
  `dailyBudget × 7`.
- **The gateway did not know about `/api/user/portion-targets`**, so it
  answered 404 even though svc-auth served it correctly. The routing table
  in `apps/gateway/src/routes.ts` is the single place a new path must be
  registered — the endpoint audit catches this class of mistake.

---

## 7. What Session 2 did not do

| Left for later | Why |
|---|---|
| The mobile app does not yet show the reasons, the swap action or the portion profile | The mobile client is a later session; the shared packages and the API are ready for it |
| Nutrition values are estimates from standard composition tables | Replacing them with per-dish values from published Kenyan tables needs a source list, not a guess |
| Serving multiples (a pot of stew feeding four) | The `servingLabel` and `servings` fields are in place; the planner does not yet split a batch across portions |
| M-Pesa | Session 5 |
