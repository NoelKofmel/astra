import { eq, jobRuns } from "@astra/db";
import type { Db } from "@astra/db";
import type { RunRecorder } from "./runner.ts";

/** Records every job attempt as a row in job_runs. */
export function createJobRunRecorder(db: Db): RunRecorder {
  return {
    async start({ jobName, jobId, attempt }) {
      const [row] = await db
        .insert(jobRuns)
        .values({ jobName, jobId, attempt })
        .returning({ id: jobRuns.id });
      if (!row) throw new Error("insert into job_runs returned no row");
      return row.id;
    },
    async finish(runId, { status, stats, error }) {
      await db
        .update(jobRuns)
        .set({ status, finishedAt: new Date(), ...stats, error })
        .where(eq(jobRuns.id, runId));
    },
  };
}
