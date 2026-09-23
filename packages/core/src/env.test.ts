import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseEnv } from "./env.ts";

const schema = z.object({
  PORT: z.coerce.number().int(),
  DATABASE_URL: z.url({ protocol: /^postgres$/ }),
});

describe("parseEnv", () => {
  it("returns typed, coerced values", () => {
    const env = parseEnv(schema, { PORT: "3000", DATABASE_URL: "postgres://localhost/astra" });

    expect(env).toEqual({ PORT: 3000, DATABASE_URL: "postgres://localhost/astra" });
  });

  it("reports every problem at once", () => {
    expect(() => parseEnv(schema, {})).toThrow(/PORT[\s\S]*DATABASE_URL/);
  });

  it("does not echo the offending values, which may be secrets", () => {
    const attempt = () => parseEnv(schema, { PORT: "3000", DATABASE_URL: "mysql://s3cret@db" });

    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).not.toThrow(/s3cret/);
  });
});
