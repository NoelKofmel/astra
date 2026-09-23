import { createLogger } from "@astra/core/logger";
import type { Logger } from "@astra/core/logger";
import { config } from "./config.ts";

let logger: Logger | undefined;

/** The web app's logger, created on first use for the same reason as config(). */
export function log(): Logger {
  logger ??= createLogger({ service: "web", level: config().LOG_LEVEL });
  return logger;
}
