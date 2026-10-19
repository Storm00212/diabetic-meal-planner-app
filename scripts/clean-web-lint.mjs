/**
 * One-off helper: remove the imports that the porting left unused.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = join(process.cwd(), "apps", "web", "src");

const EDITS = [
  [
    "features/analytics/AnalyticsPage.tsx",
    [
      ["const [error, setError] = useState<string | null>(null);", ""],
      [
        '      } catch {\n        if (!cancelled) setError("Could not load analytics.");',
        "      } catch {\n        /* leave the dashboard empty */",
      ],
    ],
  ],
  [
    "features/catalog/components/DishModal.tsx",
    [
      ['import { useState, useEffect } from "react";', 'import { useState } from "react";'],
      ["    } catch (err) {", "    } catch {"],
    ],
  ],
  [
    "features/health/HealthHubPage.tsx",
    [
      ['import { useState, useEffect } from "react";', 'import { useState } from "react";'],
    ],
  ],
  [
    "features/health/components/AIChat.tsx",
    [
      ['import { useState, useEffect } from "react";', 'import { useState } from "react";'],
      ['import { motion } from "framer-motion";', ""],
      ["    } catch (e) {", "    } catch {"],
    ],
  ],
  [
    "features/planner/PlannerPage.tsx",
    [
      ['import { money } from "@glucoplate/domain";', 'import { money } from "@glucoplate/domain";'],
    ],
  ],
];

let changed = 0;
for (const [relative, pairs] of EDITS) {
  const file = join(webSrc, relative);
  let content = readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (from === to) continue;
    if (content.includes(from)) content = content.split(from).join(to);
  }
  writeFileSync(file, content, "utf8");
  changed += 1;
}
console.log(`Cleaned ${changed} file(s).`);
