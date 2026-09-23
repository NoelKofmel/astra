import { createLogger } from "@astra/core/logger";
import { config } from "./config.ts";

// Fail at startup, not on the first request, when the environment is wrong.
try {
  config();
} catch (err) {
  // Next.js would log this and carry on answering every request with a 500.
  // Stop instead: the container restarts visibly and the deploy's health check fails.
  createLogger({ service: "web", level: "fatal" }).fatal({ err }, "invalid environment");
  process.exit(1);
}
