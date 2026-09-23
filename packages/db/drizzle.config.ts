import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  // Only `studio` connects; `generate` works from the schema and snapshots alone.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
