import type { HttpClient } from "@astra/core/http";
import type { Logger } from "@astra/core/logger";
import type { rawItems } from "@astra/db";
import type { z } from "zod";

/** A raw_items row as a collector yields it. The normaliser and the database fill in the rest. */
export type CollectedItem = Omit<
  typeof rawItems.$inferInsert,
  "id" | "sourceId" | "canonicalUrl" | "fetchedAt"
>;

export interface CollectorContext {
  /** The source's own client, so that its rate limit stays its own. */
  http: HttpClient;
  /** Bound to the source. */
  log: Logger;
  /** Aborted when the worker shuts down. */
  signal: AbortSignal;
}

/**
 * One adapter per kind of source (docs/01-architecture.md#1-collector). A
 * source is a row in `sources`: its `collector` names the adapter, its
 * `config` holds the adapter's settings.
 */
export interface Collector<TConfig extends z.ZodType = z.ZodType> {
  /** What sources.collector refers to. */
  id: string;
  /** Cron pattern in UTC: how often each of its sources is collected. */
  schedule: string;
  /** Parses sources.config before collect sees it. */
  config: TConfig;
  /** The least time between two requests to one source. */
  minIntervalMs?: number;
  /**
   * What the source offers right now. Runs on every schedule, so the same find
   * comes back again — always with the same externalId.
   */
  collect(config: z.output<TConfig>, ctx: CollectorContext): AsyncIterable<CollectedItem>;
}

/** The one way to define a collector. */
export function defineCollector<TConfig extends z.ZodType>(
  collector: Collector<TConfig>,
): Collector<TConfig> {
  return collector;
}
