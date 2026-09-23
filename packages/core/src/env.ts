import { z } from "zod";

/**
 * Parses environment variables against a schema and throws one error listing
 * every problem at once, so a misconfigured deploy fails at startup rather
 * than on first use.
 *
 * Only an app's config module calls this; everything else imports the typed
 * result (docs/07-conventions.md#configuration-and-secrets).
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
): z.output<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
