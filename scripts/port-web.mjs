/**
 * One-off porting helper.
 *
 * Rewrites the imports and the Next.js-specific hooks in the screens that
 * were moved from the old Next.js app into the Vite + React app. Run once;
 * it is safe to run again.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const webSrc = join(root, "apps", "web", "src");

const RULES = [
  // --- Next.js router -> react-router --------------------------------------
  [
    'import Link from "next/link";',
    'import { Link } from "react-router-dom";',
  ],
  [
    'import { useRouter } from "next/navigation";',
    'import { useNavigate } from "react-router-dom";',
  ],
  [
    'import { usePathname, useRouter } from "next/navigation";',
    'import { useLocation, useNavigate } from "react-router-dom";',
  ],
  ["useRouter()", "useNavigate()"],
  ["router.push(", "navigate("],
  ["const router = useNavigate();", "const navigate = useNavigate();"],
  ["usePathname()", "location.pathname"],
  [
    'const pathname = location.pathname;',
    'const location = useLocation();\n  const pathname = location.pathname;',
  ],

  // --- Shared packages -----------------------------------------------------
  ['from "@/lib/types"', 'from "@glucoplate/types"'],
  ['from "@/lib/format"', 'from "@glucoplate/domain"'],
  ['from "@/lib/planner"', 'from "@glucoplate/domain"'],
  ['from "@/lib/mock-data"', 'from "@glucoplate/domain"'],
  [
    'import type { CurrentUser } from "@/lib/auth";',
    'import type { PublicUser } from "@glucoplate/types";',
  ],
  ["CurrentUser", "PublicUser"],
  ['from "@/lib/auth"', 'from "@/app/AuthProvider"'],
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
for (const file of walk(webSrc)) {
  const original = readFileSync(file, "utf8");
  let next = original;

  for (const [from, to] of RULES) {
    next = next.split(from).join(to);
  }

  if (next !== original) {
    writeFileSync(file, next, "utf8");
    changed += 1;
    console.log(`  patched ${file.replace(root + "\\", "")}`);
  }
}

console.log(`Patched ${changed} file(s).`);
