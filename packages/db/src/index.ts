export * from "./schema.ts";
export { createDb } from "./client.ts";
export type { Db, DbOptions } from "./client.ts";

// Query operators (sql, eq, and, …) come from here as well, so every app uses
// the same drizzle-orm instance as the schema — pnpm would otherwise resolve
// a second copy with different peers, and the types would stop matching.
export * from "drizzle-orm";
