# Session 3 — The mobile app, and the end-to-end test for both clients

Session 2 gave the backend a voice: every plan line explained itself, and
any dish could be swapped. Session 3 brought the **Expo app** up to the same
standard, and then added a test that proves **both** frontends and the API
agree with each other.

---

## 1. What the mobile app gained

The mobile app was already authenticating and showing plans, but it was
showing a weaker version of the product than the web app. Now both clients
are at parity.

### "Why this dish" on the phone

`apps/mobile/src/features/planner/PlannerScreen.tsx` renders
`plan.reasons[slot]` under each meal, the same five sentences the web app
shows:

> "KSh 70 — 35% of your KSh 200 daily budget, leaving KSh 130."
> "Glycemic index 55 sits right at your limit of 55."

### Swapping a dish on the phone

A "Swap" control on each meal calls `api.catalog.swap(dish.id, 3)` and
lists the alternatives inline — name, price, GI badge and the reason. Tapping
one replaces the dish, the totals recompute, and **the reason is re-written
for the new dish** using `explainDish()` from `@glucoplate/domain`, including
"Picked over Oats, Banana and Peanut Butter: KSh 40 cheaper and glycemic
index 55 points lower."

The swap travels with the save request, so a saved plan holds the meals the
person actually chose. The planner only honours a swap that is within their
glycemic index limit and is not already in another slot.

If a dish has no cheaper, lower-GI alternative, the screen says so rather
than showing an empty list.

### The portion profile

`Settings` gained a **"Your portion profile"** card: age, height, current and
target weight, sex and activity level, saved with `PATCH /api/settings`. Below
it, the computed daily calories, carbohydrate, protein and fat, with the
sentence explaining how they were worked out.

### The Health Profile card was dead code

The mobile Settings screen had a "Health Profile" card whose three inputs —
diabetes type, allergies and dislikes — had **no state, no loading and no
save**. They are now wired to `GET /api/user/profile` and
`PATCH /api/user/profile`.

### Serving labels and the currency

Every dish now shows what one serving actually is ("1 chapati (60 g)"), and
the last `$` labels became `KSh`. The mobile planner's budget default was
**20** — a leftover from when the currency was dollars — and is now **300**.

### One bug the contract test caught

The mobile settings screen read `user.dailyCarbTarget`. The API has returned
`dailyCarbLimit` since the Drizzle schema was replaced, so the field was
`undefined` and the screen silently fell back to 150 — the person never saw
their real target. Fixed.

---

## 2. The end-to-end test for both frontends

`npm run test:clients` walks the journey **each** client performs and asserts
every field that client reads. It is the answer to the question "both
frontends work end to end".

| Section | What it proves |
|---|---|
| **The web client's journey** | Login → me → dishes → stats → generate → swap → plans → portion targets → budget → profile → settings → chat → analytics, asserting each field `apps/web` reads. |
| **The mobile client's journey** | The same journey with the mobile app's request bodies — including the carb ceiling read from `dailyCarbLimit`. |
| **The web app build and serve** | `dist/index.html` exists, the assets are bundled, the page mounts the app, and the dev server serves it. |
| **The mobile app build** | The exported Hermes bundle exists and contains the planner and settings screens. |
| **No stale references** | Neither client imports a module that was deleted with the old `src/` tree. |

That last section is the one that pays for itself: it catches a client still
pointing at an endpoint or a field that no longer exists — exactly the class
of bug that only shows up on a phone.

**51 checks.**

---

## 3. The connection problem this session exposed

Running the two clients against the hosted database made the services slow
and flaky in a way the API tests alone had not shown: a 95-row query took
**sixteen seconds**, and the services logged `Server has closed the
connection` — Neon closing connections the services were still holding.

The cause was the connection configuration, not the code:

- **Neon Free allows only a handful of concurrent connections per branch**,
  and four services share one database. Prisma's default pool is
  `num_cpus * 2 + 1` *per client*, so four services opened far more than the
  branch allows.
- `pgbouncer=true` alongside `connection_limit=2` had turned the branch's
  pooler into a **two-connection** pool for all four services at once.
- The **pooled** endpoint was the wrong choice for a long-running service:
  measured against the live database, the **direct** endpoint was about
  **three times faster** for the same query (0.5 s against 1.8 s).

What the connection string looks like now:

```
?sslmode=verify-full&connection_limit=1&connect_timeout=15&pool_timeout=15
```

- `connection_limit=1` — one connection per service, four in total.
- `connect_timeout=15` — Neon scales to zero and waking the compute takes
  seconds.
- No `pgbouncer=true` on a direct endpoint: it disables prepared statements
  that a direct connection supports perfectly well.

The pooled string is kept as `POOLED_DATABASE_URL` for a serverless
deployment, where many short-lived processes need to share a few connections.

The upstream HTTP timeouts were raised to match: the gateway waits 30 s for
an upstream and 20 s for a health probe, because a timeout on a waking
database looks exactly like a dead service.

> **One lesson worth keeping:** `npm run db:push` and `npm run db:seed` must
> point at the same database. Use the same flag for both —
> `npm run env:sync -- --neon` and `npm run db:push -- --neon` — or the
> schema goes to one place and the data to another.

---

## 4. The whole test suite

```bash
npm run build lint typecheck test   # 45 tasks, all green
npm run smoke                       # 45 cross-service checks
npm run audit                       # 97 endpoint checks
npm run test:swap                   # the swap-and-save flow
npm run test:clients                # 51 both-frontends checks
```

---

## 5. What Session 3 did not do

| Left for later | Why |
|---|---|
| The mobile app was never run on a device or emulator | The bundle builds and every screen compiles, but the React Native layout has not been looked at. **Worth ten minutes with Expo Go before the demo.** |
| The mobile app has no offline handling | Every screen assumes the network. |
| The web app has no end-to-end browser test | `npm run test:clients` checks the contract and that the app builds and serves; it does not click the buttons. |
| M-Pesa | Session 5 |
