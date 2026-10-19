/**
 * @glucoplate/data
 *
 * The seed fixtures for GlucoPlate: the shared Kenyan dish catalogue and the
 * demo personas. Both are the single source of truth for the seed scripts and
 * the tests.
 *
 * The JSON is read from disk at runtime rather than imported, so the same
 * package works in every Node version without JSON import attributes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src");
function readJson(fileName) {
    return JSON.parse(readFileSync(join(dataDir, fileName), "utf8"));
}
/** The 42 shared Kenyan dishes every account can plan with. */
export const KENYAN_DISHES = readJson("kenyan-dishes.json");
/** The five demo personas plus the generic demo account. */
export const PERSONAS = readJson("personas.json");
export const DEMO_CREDENTIALS = {
    email: "demo@glucoplate.app",
    password: "demo123",
};
export const PERSONA_PASSWORD = "Gluco@2026";
//# sourceMappingURL=index.js.map