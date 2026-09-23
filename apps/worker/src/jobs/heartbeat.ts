import { z } from "zod";
import { defineJob } from "./job.ts";

/**
 * Proves the whole chain works: scheduler → Redis → worker → database. The
 * job_runs row it leaves every five minutes is the signal; alerting on its
 * absence arrives in phase 8.
 */
export const heartbeat = defineJob({
  name: "heartbeat",
  queue: "system",
  data: z.object({}),
  schedule: { cron: "*/5 * * * *", data: {} },
  run(_data, { log }) {
    log.debug("alive");
    return Promise.resolve();
  },
});
