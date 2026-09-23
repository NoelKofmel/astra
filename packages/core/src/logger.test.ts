import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.ts";
import type { LogLevel } from "./logger.ts";

function captureLogger(level: LogLevel = "info") {
  const raw: string[] = [];
  const lines: unknown[] = [];
  const log = createLogger({
    service: "test",
    level,
    destination: {
      write(line: string) {
        const parsed: unknown = JSON.parse(line);
        raw.push(line);
        lines.push(parsed);
      },
    },
  });
  return { log, raw, lines };
}

describe("createLogger", () => {
  it("writes one JSON object per line with service, level label and ISO time", () => {
    const { log, raw, lines } = captureLogger();

    log.info({ items: 3 }, "collected");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ service: "test", level: "info", items: 3, msg: "collected" });
    expect(raw[0]).toMatch(/"time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/);
  });

  it("redacts secrets at the top level and one level down", () => {
    const { log, lines } = captureLogger();

    log.info({ token: "abc", config: { password: "hunter2", host: "db" } }, "connecting");

    expect(lines[0]).toMatchObject({
      token: "[redacted]",
      config: { password: "[redacted]", host: "db" },
    });
  });

  it("binds context through child loggers", () => {
    const { log, lines } = captureLogger();

    log.child({ jobId: "42" }).warn("slow");

    expect(lines[0]).toMatchObject({ service: "test", jobId: "42", level: "warn", msg: "slow" });
  });

  it("drops lines below the configured level", () => {
    const { log, lines } = captureLogger("info");

    log.debug("noise");

    expect(lines).toHaveLength(0);
  });

  it("serialises errors under err, including the stack", () => {
    const { log, raw, lines } = captureLogger();

    log.error({ err: new Error("boom") }, "job failed");

    expect(lines[0]).toMatchObject({ err: { type: "Error", message: "boom" } });
    expect(raw[0]).toContain('"stack":"Error: boom');
  });
});
