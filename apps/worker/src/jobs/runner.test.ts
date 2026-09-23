import { createLogger } from "@astra/core/logger";
import { createDb } from "@astra/db";
import { UnrecoverableError } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineJob } from "./job.ts";
import type { JobStats } from "./job.ts";
import { runJob } from "./runner.ts";
import type { RunRecorder } from "./runner.ts";

const log = createLogger({ service: "test", level: "silent" });
// A pool that never connects: the jobs under test do not touch the database.
const { db, pool } = createDb("postgres://unused@localhost/unused", {
  log,
  applicationName: "test",
});
afterAll(async () => {
  await pool.end();
});

interface RecordedRun {
  jobName: string;
  attempt: number;
  status?: string;
  stats?: JobStats;
  error?: string;
}

function recordRuns() {
  const runs: RecordedRun[] = [];
  const recorder: RunRecorder = {
    start({ jobName, attempt }) {
      runs.push({ jobName, attempt });
      return Promise.resolve(runs.length);
    },
    finish(runId, outcome) {
      const run = runs[runId - 1];
      if (!run) throw new Error(`unknown run ${String(runId)}`);
      Object.assign(run, { ...outcome, stats: { ...outcome.stats } });
      return Promise.resolve();
    },
  };
  return { runs, deps: { db, log, recorder } };
}

const counting = defineJob({
  name: "counting",
  queue: "system",
  data: z.object({ items: z.number() }),
  run({ items }, { stats }) {
    stats.itemsIn = items;
    stats.itemsOut = items - 1;
    stats.costUsd = 0.25;
    return Promise.resolve();
  },
});

describe("runJob", () => {
  it("records a successful run with the job's stats", async () => {
    const { runs, deps } = recordRuns();

    await runJob(counting, { jobId: "1", number: 1, data: { items: 3 } }, deps);

    expect(runs).toEqual([
      {
        jobName: "counting",
        attempt: 1,
        status: "succeeded",
        stats: { itemsIn: 3, itemsOut: 2, costUsd: 0.25 },
      },
    ]);
  });

  it("records a failure with its error and the cost incurred so far, then rethrows", async () => {
    const { runs, deps } = recordRuns();
    const failing = defineJob({
      name: "failing",
      queue: "system",
      data: z.object({}),
      run(_data, { stats }) {
        stats.costUsd = 0.1;
        return Promise.reject(new Error("source down"));
      },
    });

    await expect(runJob(failing, { jobId: "2", number: 2, data: {} }, deps)).rejects.toThrow(
      "source down",
    );

    expect(runs).toEqual([
      {
        jobName: "failing",
        attempt: 2,
        status: "failed",
        stats: { itemsIn: 0, itemsOut: 0, costUsd: 0.1 },
        error: "Error: source down",
      },
    ]);
  });

  it("fails malformed job data without retrying", async () => {
    const { runs, deps } = recordRuns();

    await expect(
      runJob(counting, { jobId: "3", number: 1, data: { items: "three" } }, deps),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(runs[0]?.status).toBe("failed");
    expect(runs[0]?.error).toMatch(/invalid job data[\s\S]*items/);
  });
});
