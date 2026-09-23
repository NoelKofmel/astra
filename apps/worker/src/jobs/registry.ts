import { heartbeat } from "./heartbeat.ts";
import type { JobDefinition } from "./job.ts";

/** Every job the worker knows. A job missing here is neither scheduled nor processed. */
export const jobs: readonly JobDefinition[] = [heartbeat];
