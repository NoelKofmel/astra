import type { Logger } from "@astra/core/logger";
import type { DefaultJobOptions, Queue } from "bullmq";
import type { JobDefinition } from "./job.ts";

/**
 * Set on every queue, so they apply to enqueued and scheduled jobs alike.
 * job_runs keeps the long-term history; Redis only needs recent jobs.
 */
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

/**
 * Makes a queue's job schedulers match the registry: upserts every scheduled
 * job and removes schedulers whose job is gone — they would keep firing
 * otherwise. Idempotent; runs at every worker start.
 */
export async function syncSchedulers(
  queue: Queue<unknown>,
  jobs: readonly JobDefinition[],
  log: Logger,
): Promise<void> {
  const scheduled = jobs.flatMap((job) =>
    job.queue === queue.name && job.schedule ? [{ name: job.name, ...job.schedule }] : [],
  );

  for (const { name, cron, data } of scheduled) {
    await queue.upsertJobScheduler(name, { pattern: cron, tz: "UTC" }, { name, data });
  }

  for (const existing of await queue.getJobSchedulers()) {
    if (!scheduled.some(({ name }) => name === existing.key)) {
      await queue.removeJobScheduler(existing.key);
      log.info({ queue: queue.name, scheduler: existing.key }, "removed orphaned job scheduler");
    }
  }
}
