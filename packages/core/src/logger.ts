import { pino, stdSerializers, stdTimeFunctions } from "pino";
import type { DestinationStream, Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerOptions {
  /** The process that is logging — "web", "worker", … — bound to every line. */
  service: string;
  level: LogLevel;
  /** Where lines go. Defaults to stdout; tests pass a capturing stream. */
  destination?: DestinationStream;
}

/**
 * Key names whose values never reach the logs, at the top level or one level
 * down. A safety net only: log IDs, counts and sizes, not payloads.
 */
const SECRET_KEYS = [
  "password",
  "token",
  "apiKey",
  "secret",
  "authorization",
  "cookie",
  "databaseUrl",
  "redisUrl",
];

/**
 * The one way to create a logger. Structured JSON to stdout, nothing else —
 * Docker collects it, and pretty-printing in development happens outside the
 * process by piping through pino-pretty.
 *
 * Add context with child loggers (`log.child({ jobId })`), not by building it
 * into the message string.
 */
export function createLogger({ service, level, destination }: LoggerOptions): Logger {
  return pino(
    {
      level,
      base: { service },
      timestamp: stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: { err: stdSerializers.err },
      redact: {
        paths: SECRET_KEYS.flatMap((key) => [key, `*.${key}`]),
        censor: "[redacted]",
      },
    },
    destination,
  );
}
