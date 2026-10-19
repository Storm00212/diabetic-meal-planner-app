import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "package.json") out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let raw = readFileSync(file, "utf8");
  const hadBom = raw.charCodeAt(0) === 0xfeff;
  if (hadBom) raw = raw.slice(1);

  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.log(`  skip (unparseable) ${file}: ${error.message}`);
    continue;
  }

  let touched = hadBom;
  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    if (json[key] === null) {
      delete json[key];
      touched = true;
    } else if (json[key] && Object.keys(json[key]).length === 0) {
      delete json[key];
      touched = true;
    }
  }

  if (touched) {
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
    changed += 1;
    console.log(`  fixed ${file.replace(root + "\\", "")}`);
  }
}

console.log(`Fixed ${changed} package.json file(s).`);
