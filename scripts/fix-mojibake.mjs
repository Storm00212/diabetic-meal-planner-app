/**
 * One-off helper: repair mojibake.
 *
 * Some files in this repository were written with the wrong encoding, so
 * their UTF-8 bytes were decoded as Windows-1252 and then saved as UTF-8
 * again. "…" became "â€¦" and "🌅" became "ðŸŒ…".
 *
 * The repair reverses that: every character is mapped back to the byte it
 * came from, and the resulting bytes are decoded as UTF-8.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Windows-1252 characters that differ from Latin-1, and the byte each
 * one came from.
 */
const CP1252_HIGH = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

/**
 * Maps a character back to the byte it was decoded from.
 * Returns `null` for characters that cannot have come from a mis-decode.
 */
function byteFor(char) {
  const code = char.codePointAt(0);

  if (code <= 0x7f) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  if (CP1252_HIGH[char] !== undefined) return CP1252_HIGH[char];

  // Windows-1252 leaves a few slots in 0x80-0x9f undefined; decoders keep
  // the raw C1 control character there.
  if (code >= 0x80 && code <= 0x9f) return code;

  return null;
}

/**
 * Reverses one round of "UTF-8 decoded as Windows-1252".
 * Returns `null` when the text cannot be repaired.
 */
function repair(text) {
  const bytes = [];

  for (const char of text) {
    const byte = byteFor(char);
    if (byte === null) return null;
    bytes.push(byte);
  }

  const decoded = Buffer.from(bytes).toString("utf8");
  // A successful repair never produces the replacement character.
  return decoded.includes("\uFFFD") ? null : decoded;
}

/** Repairs what it can, line by line, when the whole file cannot be repaired. */
function repairPerLine(text) {
  const lines = text.split("\n");
  let changed = false;
  const failed = [];

  const repairedLines = lines.map((line, index) => {
    if (line === "") return line;
    const fixed = repair(line);
    if (fixed === null) {
      failed.push(index + 1);
      return line;
    }
    if (fixed !== line) changed = true;
    return fixed;
  });

  return { text: repairedLines.join("\n"), changed, failed };
}

const webSrc = join(process.cwd(), "apps", "web", "src");

const files = [
  "features/catalog/DishesPage.tsx",
  "features/planner/PlannerPage.tsx",
  "features/plans/PlansPage.tsx",
];

for (const relative of files) {
  const file = join(webSrc, relative);
  const original = readFileSync(file, "utf8");

  const whole = repair(original);
  if (whole && whole !== original) {
    writeFileSync(file, whole, "utf8");
    console.log(`  repaired ${relative}`);
    continue;
  }

  const perLine = repairPerLine(original);
  if (perLine.changed) {
    writeFileSync(file, perLine.text, "utf8");
    console.log(
      `  repaired ${relative} (${perLine.failed.length} line(s) left alone: ${perLine.failed.join(", ")})`,
    );
  } else {
    console.log(`  skipped  ${relative}`);
  }
}
