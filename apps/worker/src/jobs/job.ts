import type { Logger } from "@astra/core/logger";
import type { Db } from "@astra/db";
import type { z } from "zod";

/** Every queue and how many of its jobs run in parallel. */
export const QUEUES = [{ name: "system", concurrency: 1 }] as const;
export type QueueName = (typeof QUEUES)[number]["name"];

/** Counters a job accumulates. Written to job_runs whether the run succeeds or fails. */
export interface JobStats {
  itemsIn: number;
  itemsOut: number;
  costUsd: number;
}

export interface JobContext {
  db: Db;
  /** Already bound to the job name, BullMQ job ID and attempt. */
  log: Logger;
  stats: JobStats;
}

export interface JobDefinition<TData extends z.ZodType = z.ZodType> {
  /** Unique. Doubles as the BullMQ job name, the scheduler ID and job_runs.job_name. */
  name: string;
  queue: QueueName;
  /** Job data crosses a process boundary (Redis), so it is parsed like any external input. */
  data: TData;
  /** Cron pattern, evaluated in UTC, and the data each scheduled run receives. */
  schedule?: { cron: string; data: z.input<TData> };
  /** Must be idempotent: a retry never creates duplicates. */
  run(data: z.output<TData>, ctx: JobContext): Promise<void>;
}

/** The one way to define a background job (docs/07-conventions.md#background-jobs). */
export function defineJob<TData extends z.ZodType>(
  definition: JobDefinition<TData>,
): JobDefinition<TData> {
  return definition;
}
