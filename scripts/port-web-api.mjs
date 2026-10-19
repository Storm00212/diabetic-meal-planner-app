/**
 * One-off porting helper (second pass): replace the remaining raw
 * `fetch("/api/...")` calls with the typed client, using regexes so the
 * exact import ordering and indentation does not matter.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = join(process.cwd(), "apps", "web", "src");

/** Adds the api import after the first react import. */
const IMPORT_RULES = [
  [/^(import\s+[^\n]*from\s+"react";)/m, `$1\nimport { api } from "@/app/api";`],
];

const REPLACEMENTS = [
  // --- Analytics ------------------------------------------------------------
  [
    "features/analytics/AnalyticsPage.tsx",
    [
      /fetch\("\/api\/analytics"\)[\s\S]*?\.finally\(\(\) => setLoading\(false\)\);/,
      `let cancelled = false;

    async function run() {
      try {
        const result = await api.health.analytics();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError("Could not load analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };`,
    ],
  ],

  // --- Dish modal ------------------------------------------------------------
  [
    "features/catalog/components/DishModal.tsx",
    [
      /const res = await fetch\(`\/api\/nutr[\s\S]*?const data = await res\.json\(\);/,
      `const data = await api.health.nutrients(values.name);`,
    ],
  ],

  // --- Settings --------------------------------------------------------------
  [
    "features/settings/SettingsPage.tsx",
    [
      /const res = await fetch\("\/api\/settings", \{[\s\S]*?\}\);\n(\s*)if \(!res\.ok\) \{/,
      `await api.user.updateSettings({
      name,
      dailyBudget,
      dailyCarbTarget,
    });
$1if (false) {`,
    ],
  ],

  // --- Planner ---------------------------------------------------------------
  [
    "features/planner/PlannerPage.tsx",
    [
      /const res = await fetch\("\/api\/plans\/generate", \{[\s\S]*?setPlan\(data\.plan\);/,
      `try {
      const data = await api.planner.generate({ budget, carbTarget });
      setPlan(data.plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate a plan.",
      );
    } finally {
      setLoading(false);
    }`,
    ],
    [
      /const res = await fetch\("\/api\/plans", \{[\s\S]*?setTimeout\(\(\) => navigate\("\/dashboard\/plans"\), 800\);/,
      `try {
      await api.planner.save({ budget, carbTarget, planDate });
      showToast("Plan saved!");
      setTimeout(() => navigate("/dashboard/plans"), 800);
    } catch {
      showToast("Could not save plan.");
    } finally {
      setSaving(false);
    }`,
    ],
  ],

  // --- Weight tracker ---------------------------------------------------------
  [
    "features/health/components/WeightTracker.tsx",
    [
      /fetch\("\/api\/user\/weight-targets"\)[\s\S]*?\.catch\(\(\) => \{\}\);/,
      `let cancelled = false;

    async function run() {
      try {
        const data = await api.health.weightTargets();
        if (cancelled) return;
        setWeight(data.currentWeight);
        setTarget(data.targetWeight);
      } catch {
        /* leave the fields empty */
      }
    }

    void run();
    return () => {
      cancelled = true;
    };`,
    ],
    [
      /await fetch\("\/api\/weight", \{[\s\S]*?\}\);/,
      `await api.health.logWeight({
      weight: parseFloat(input),
      date: new Date().toISOString().slice(0, 10),
    });`,
    ],
  ],

  // --- AI chat ----------------------------------------------------------------
  [
    "features/health/components/AIChat.tsx",
    [
      /const res = await fetch\("\/api\/chat", \{[\s\S]*?const data = await res\.json\(\);/,
      `const data = await api.health.chat({ query: userMsg.text });`,
    ],
  ],

  // --- Plans -------------------------------------------------------------------
  [
    "features/plans/PlansPage.tsx",
    [
      /fetch\("\/api\/plans"\)[\s\S]*?\.finally\(\(\) => setLoading\(false\)\);/,
      `let cancelled = false;

    async function run() {
      try {
        const data = await api.planner.list();
        if (!cancelled) setPlans(data.plans ?? []);
      } catch {
        if (!cancelled) showToast("Failed to load plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };`,
    ],
    [
      /const res = await fetch\("\/api\/plans\/update-item", \{[\s\S]*?if \(!res\.ok\) \{/,
      `try {
      await api.planner.updateItem({ itemId, status });
    } catch {`,
    ],
    [
      /const res = await fetch\(`\/api\/plans\/\$\{plan\.id\}`, \{ method: "DELETE" \}\);\n(\s*)if \(!res\.ok\) \{/,
      `try {
      await api.planner.remove(plan.id);
    } catch {`,
    ],
  ],

  // --- Budget setup -------------------------------------------------------------
  [
    "features/settings/components/BudgetSetup.tsx",
    [
      /const res = await fetch\("\/api\/user\/budget"\);\n(\s*)if \(res\.ok\) \{[\s\S]*?\n(\s*)\}/,
      `const data = await api.user.budget();
$1setFormData({
$1  ...data,
$1  paydayDate: data.paydayDate
$1    ? new Date(data.paydayDate).toISOString().split("T")[0]
$1    : "",
$1});`,
    ],
    [
      /const res = await fetch\("\/api\/user\/budget", \{[\s\S]*?if \(!res\.ok\) throw new Error\("Failed to update budget"\);/,
      `await api.user.updateBudget(formData);`,
    ],
  ],

  // --- Profile form ---------------------------------------------------------------
  [
    "features/settings/components/ProfileForm.tsx",
    [
      /const res = await fetch\("\/api\/user\/profile"\);\n(\s*)if \(res\.ok\) \{[\s\S]*?\n(\s*)\}/,
      `const data = await api.user.profile();
$1setFormData({
$1  diabetesType: data.diabetesType ?? "none",
$1  allergies: data.allergies ?? "",
$1  dislikes: data.dislikes ?? "",
$1});`,
    ],
    [
      /const res = await fetch\("\/api\/user\/profile", \{[\s\S]*?if \(!res\.ok\) throw new Error\("Failed to update profile"\);/,
      `await api.user.updateProfile(formData);`,
    ],
  ],
];

let missed = 0;

for (const [relative, ...pairs] of REPLACEMENTS) {
  const file = join(webSrc, relative);
  let content = readFileSync(file, "utf8");

  // The api import, unless it is already there.
  if (!content.includes('from "@/app/api"')) {
    for (const [pattern, replacement] of IMPORT_RULES) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        break;
      }
    }
  }

  for (const [pattern, replacement] of pairs) {
    if (!pattern.test(content)) {
      console.log(`  MISS ${relative}: ${String(pattern).slice(0, 60)}`);
      missed += 1;
      continue;
    }
    content = content.replace(pattern, replacement);
  }

  writeFileSync(file, content, "utf8");
  console.log(`  patched ${relative}`);
}

console.log(`Done. ${missed} block(s) missed.`);
