import path from "node:path";
import { parseEnv } from "@astra/core/env";
import { createLogger, LOG_LEVELS } from "@astra/core/logger";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { z } from "zod";
import { createDb } from "./client.ts";

// Applies pending migrations, then exits. Runs as `pnpm db:migrate` locally and
// as its own step before new containers start on every deploy.

const env = parseEnv(
  z.object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  }),
  process.env,
);

const log = createLogger({ service: "migrate", level: env.LOG_LEVEL });
const { db, pool } = createDb(env.DATABASE_URL, {
  log,
  applicationName: "astra-migrate",
  maxConnections: 1,
});

async function countApplied(): Promise<number> {
  const table = await pool.query<{ name: string | null }>(
    "select to_regclass('drizzle.__drizzle_migrations')::text as name",
  );
  if (!table.rows[0]?.name) return 0;
  const { rows } = await pool.query<{ count: number }>(
    "select count(*)::int as count from drizzle.__drizzle_migrations",
  );
  return rows[0]?.count ?? 0;
}

try {
  const before = await countApplied();
  await migrate(db, { migrationsFolder: path.join(import.meta.dirname, "../drizzle") });
  const after = await countApplied();
  log.info({ applied: after - before, total: after }, "database schema up to date");
} catch (err) {
  log.fatal({ err }, "migration failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
