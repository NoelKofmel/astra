import type { Logger } from "@astra/core/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export type Db = NodePgDatabase<typeof schema>;

export interface DbOptions {
  log: Logger;
  /** Shows up in pg_stat_activity, so you can tell which process holds a connection. */
  applicationName: string;
  /**
   * Upper bound for this process. Keep the sum over all processes well below
   * Postgres' max_connections (100 by default).
   */
  maxConnections?: number;
}

/** One pool per process, created at startup and closed on shutdown. */
export function createDb(
  connectionString: string,
  { log, applicationName, maxConnections = 10 }: DbOptions,
): { db: Db; pool: Pool } {
  const pool = new Pool({
    connectionString,
    application_name: applicationName,
    max: maxConnections,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  // An idle connection dropping (Postgres restarted, network blip) is handled —
  // the pool opens a new one on the next query. Unlistened, it would crash the process.
  pool.on("error", (err) => {
    log.warn({ err }, "idle database connection lost");
  });

  return { db: drizzle({ client: pool, schema }), pool };
}
