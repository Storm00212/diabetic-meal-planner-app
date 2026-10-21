import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load environment variables before anything else reads them.
 *
 * This module must be the FIRST import in the entry point: ES module imports
 * are evaluated in order, so `config.ts` sees the values loaded here.
 *
 * Precedence (first wins):
 *   1. `apps/<service>/.env`   — this service's own settings
 *   2. `<repo>/.env.local`      — shared local development values
 *   3. the process environment  — whatever the host injected
 */
const here = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: join(here, "..", ".env") });
loadEnv({ path: join(here, "..", "..", "..", ".env.local") });
