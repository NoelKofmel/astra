import "server-only";
import { createDb } from "@astra/db";
import type { Db } from "@astra/db";
import { config } from "./config.ts";
import { log } from "./logger.ts";

declare global {
  // Development hot reloading re-evaluates this module; parking the pool on
  // globalThis keeps every reload from leaking another one.
  var astraDb: Db | undefined;
}

/** The web app's database handle — one pool per server process, created on first use. */
export function db(): Db {
  globalThis.astraDb ??= createDb(config().DATABASE_URL, {
    log: log(),
    applicationName: "astra-web",
    maxConnections: 5,
  }).db;
  return globalThis.astraDb;
}
