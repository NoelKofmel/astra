import { describe, expect, it } from "vitest";
import { jobs } from "./registry.ts";

describe("job registry", () => {
  it("has unique job names — they double as scheduler IDs", () => {
    const names = jobs.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every schedule data its own job accepts", () => {
    for (const job of jobs) {
      if (!job.schedule) continue;
      expect(job.data.safeParse(job.schedule.data).success, job.name).toBe(true);
    }
  });
});
