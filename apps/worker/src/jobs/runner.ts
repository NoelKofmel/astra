import { inspect } from "node:util";
import type { Logger } from "@astra/core/logger";
import type { Db } from "@astra/db";
import { UnrecoverableError } from "bullmq";
import { z } from "zod";
import type { JobDefinition, JobStats } from "./job.ts";

/** Persists job runs. In production, rows in job_runs (job-runs.ts). */
export interface RunRecorder {
  /** Records the start of an attempt and returns its run ID. */
  start(run: { jobName: string; jobId: string | undefined; attempt: number }): Promise<number>;
  finish(
    runId: number,
    outcome: { status: "succeeded" | "failed"; stats: JobStats; error?: string },
  ): Promise<void>;
}

export interface Attempt {
  jobId: string | undefined;
  /** 1 for the first try. */
  number: number;
  /** Job data as it came out of Redis — not yet parsed. */
  data: unknown;
}

export interface RunnerDeps {
  db: Db;
  log: Logger;
  recorder: RunRecorder;
}

/**
 * Runs one attempt of a job and accounts for it: one job_runs row, one summary
 * log line. Stats are recorded on failure too, so money spent before an error
 * is never lost. A failure is logged here — once — and rethrown so BullMQ
 * applies the retry policy.
 */
export async function runJob(
  job: JobDefinition,
  attempt: Attempt,
  { db, log: parentLog, recorder }: RunnerDeps,
): Promise<void> {
  const log = parentLog.child({ job: job.name, jobId: attempt.jobId, attempt: attempt.number });
  const stats: JobStats = { itemsIn: 0, itemsOut: 0, costUsd: 0 };
  const startedAt = performance.now();
  const durationMs = () => Math.round(performance.now() - startedAt);
  let runId: number | undefined;

  try {
    runId = await recorder.start({
      jobName: job.name,
      jobId: attempt.jobId,
      attempt: attempt.number,
    });
    const parsed = job.data.safeParse(attempt.data);
    if (!parsed.success) {
      // Retrying cannot repair malformed data.
      throw new UnrecoverableError(`invalid job data: ${z.prettifyError(parsed.error)}`);
    }
    await job.run(parsed.data, { db, log, stats });
    await recorder.finish(runId, { status: "succeeded", stats });
    log.info({ ...stats, durationMs: durationMs() }, "job succeeded");
  } catch (err) {
    log.error({ err, ...stats, durationMs: durationMs() }, "job failed");
    if (runId !== undefined) {
      await recorder
        .finish(runId, { status: "failed", stats, error: describeError(err) })
        .catch((recordError: unknown) => {
          log.error({ err: recordError }, "could not record the failed run");
        });
    }
    throw err;
  }
}

function describeError(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : inspect(err);
  return text.length > 2_000 ? `${text.slice(0, 2_000)}…` : text;
}
