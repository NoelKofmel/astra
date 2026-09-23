import { parseEnv } from "@astra/core/env";
import { LOG_LEVELS } from "@astra/core/logger";
import { z } from "zod";

const schema = z.object({
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** The deployed commit, baked into the image; reported by /api/health. */
  APP_VERSION: z.string().min(1).default("dev"),
});

export type Config = z.output<typeof schema>;

let parsed: Config | undefined;

/**
 * The web app's only reader of process.env
 * (docs/07-conventions.md#configuration-and-secrets).
 *
 * Parsed on first use rather than on import, because `next build` loads route
 * modules without a runtime environment. instrumentation.ts calls it when the
 * server starts, so a misconfigured deploy still fails before serving anything.
 */
export function config(): Config {
  parsed ??= parseEnv(schema, process.env);
  return parsed;
}
