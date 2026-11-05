import { describe, expect, it } from "vitest";
import { collectors } from "./registry.ts";

describe("collectors", () => {
  it("have unique IDs — sources.collector refers to them", () => {
    const ids = collectors.map((collector) => collector.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
