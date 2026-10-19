import { readFileSync } from "node:fs";

const CP1252_HIGH = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86,
  "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
  "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  const seen = new Map();
  text.split("\n").forEach((line, index) => {
    for (const char of line) {
      const code = char.codePointAt(0);
      if (code <= 0x7f) continue;
      if (code >= 0xa0 && code <= 0xff) continue;
      if (CP1252_HIGH[char] !== undefined) continue;
      const key = `${char} U+${code.toString(16).toUpperCase()}`;
      if (!seen.has(key)) seen.set(key, `${index + 1}`);
    }
  });
  console.log(`--- ${file}`);
  for (const [key, line] of seen) console.log(`   ${key}  first at line ${line}`);
}
