import { parseEnv } from "@astra/core/env";
import { LOG_LEVELS } from "@astra/core/logger";
import { z } from "zod";

// The worker's only reader of process.env (docs/07-conventions.md#configuration-and-secrets).
// Parsed on import, so a misconfigured deploy fails before anything connects.
export const config = parseEnv(
  z.object({
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  }),
  process.env,
);
