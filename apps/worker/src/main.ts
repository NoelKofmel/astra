import { createLogger } from "@astra/core/logger";
import { createDb } from "@astra/db";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.ts";
import { QUEUES } from "./jobs/job.ts";
import { createJobRunRecorder } from "./jobs/job-runs.ts";
import { jobs } from "./jobs/registry.ts";
import { runJob } from "./jobs/runner.ts";
import { defaultJobOptions, syncSchedulers } from "./jobs/schedulers.ts";

const log = createLogger({ service: "worker", level: config.LOG_LEVEL });

// Bugs crash loudly — as a structured log line rather than a bare stack trace.
process.on("uncaughtException", (err) => {
  log.fatal({ err }, "uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  log.fatal({ err: reason }, "unhandled rejection");
  process.exit(1);
});

const { db, pool } = createDb(config.DATABASE_URL, { log, applicationName: "astra-worker" });
const recorder = createJobRunRecorder(db);

// Workers block on Redis and must keep retrying while it is away (a BullMQ requirement).
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
redis.on("error", (err) => {
  log.warn({ err }, "redis connection error");
});

const jobsByName = new Map(jobs.map((job) => [job.name, job]));

const queues = QUEUES.map(
  ({ name }) => new Queue<unknown>(name, { connection: redis, defaultJobOptions }),
);

const workers = QUEUES.map(({ name, concurrency }) => {
  const worker = new Worker<unknown>(
    name,
    async (job) => {
      const definition = jobsByName.get(job.name);
      if (!definition) {
        log.error({ queue: name, job: job.name, jobId: job.id }, "job is not in the registry");
        throw new UnrecoverableError(`no job named "${job.name}" in the registry`);
      }
      await runJob(
        definition,
        { jobId: job.id, number: job.attemptsStarted, data: job.data },
        { db, log, recorder },
      );
    },
    { connection: redis, concurrency },
  );
  worker.on("error", (err) => {
    log.error({ err, queue: name }, "worker error");
  });
  return worker;
});

let stopping = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  // Running jobs get to finish; the container's stop grace period must outlast the longest one.
  log.info({ signal }, "shutting down");
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
  await redis.quit();
  await pool.end();
  log.info("stopped");
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((err: unknown) => {
      log.fatal({ err }, "shutdown failed");
      process.exit(1);
    });
  });
}

await Promise.all(queues.map((queue) => syncSchedulers(queue, jobs, log)));
log.info(
  { queues: QUEUES.map(({ name }) => name), jobs: jobs.map(({ name }) => name) },
  "worker started",
);
