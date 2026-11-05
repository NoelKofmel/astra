import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHttpClient, HttpError } from "./http.ts";

const url = "https://example.com/api";
const schema = z.object({ hits: z.array(z.number()) });

/** Answers each request with the next response, or rejects with the next error. */
function fakeFetch(...answers: (Response | Error)[]) {
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    requests.push(new Request(input, init));
    const answer = answers.shift();
    if (answer === undefined) {
      return Promise.reject(new Error("unexpected request"));
    }
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { fetch, requests };
}

/** Never answers; rejects only when the request is aborted. */
const hangingFetch: typeof globalThis.fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(init.signal?.reason as Error);
    });
  });

function client(fetch: typeof globalThis.fetch, options: { retries?: number } = {}) {
  return createHttpClient({ userAgent: "Astra/test", backoffMs: 0, fetch, ...options });
}

describe("createHttpClient", () => {
  it("sends the user agent and parses the body with the schema", async () => {
    const { fetch, requests } = fakeFetch(Response.json({ hits: [1, 2] }));

    await expect(client(fetch).getJson(url, schema)).resolves.toEqual({ hits: [1, 2] });
    expect(requests[0]?.headers.get("user-agent")).toBe("Astra/test");
  });

  it("rejects a body that does not match the schema", async () => {
    const { fetch } = fakeFetch(Response.json({ hits: "none" }));
    const attempt = client(fetch).getJson(url, schema);

    await expect(attempt).rejects.toMatchObject({ name: "HttpError", status: 200 });
    await expect(attempt).rejects.toThrow(/unexpected body/);
  });

  it("rejects a body that is not JSON", async () => {
    const { fetch } = fakeFetch(new Response("<html>"));

    await expect(client(fetch).getJson(url, schema)).rejects.toThrow(/invalid JSON/);
  });

  it("retries a 5xx and a network error, then succeeds", async () => {
    const { fetch, requests } = fakeFetch(
      new Response("", { status: 503 }),
      new TypeError("fetch failed"),
      Response.json({ hits: [] }),
    );

    await expect(client(fetch).getJson(url, schema)).resolves.toEqual({ hits: [] });
    expect(requests).toHaveLength(3);
  });

  it("gives up after the last retry", async () => {
    const { fetch, requests } = fakeFetch(
      new Response("", { status: 502 }),
      new Response("", { status: 502 }),
    );

    await expect(client(fetch, { retries: 1 }).getJson(url, schema)).rejects.toMatchObject({
      status: 502,
    });
    expect(requests).toHaveLength(2);
  });

  it("does not retry a client error", async () => {
    const { fetch, requests } = fakeFetch(new Response("", { status: 404 }));

    await expect(client(fetch).getJson(url, schema)).rejects.toMatchObject({ status: 404 });
    expect(requests).toHaveLength(1);
  });

  it("waits as long as Retry-After asks", async () => {
    const { fetch, requests } = fakeFetch(
      new Response("", { status: 429, headers: { "retry-after": "0.05" } }),
      Response.json({ hits: [] }),
    );
    const started = performance.now();

    await client(fetch).getJson(url, schema);
    expect(requests).toHaveLength(2);
    expect(performance.now() - started).toBeGreaterThanOrEqual(45);
  });

  it("fails at once when Retry-After asks for too long", async () => {
    const { fetch, requests } = fakeFetch(
      new Response("", { status: 429, headers: { "retry-after": "3600" } }),
    );

    await expect(client(fetch).getJson(url, schema)).rejects.toMatchObject({ status: 429 });
    expect(requests).toHaveLength(1);
  });

  it("times out a request that hangs", async () => {
    const http = createHttpClient({
      userAgent: "Astra/test",
      timeoutMs: 20,
      retries: 0,
      fetch: hangingFetch,
    });

    await expect(http.getJson(url, schema)).rejects.toThrow(HttpError);
  });

  it("stops without retrying when the caller aborts", async () => {
    const controller = new AbortController();
    const request = client(hangingFetch).getJson(url, schema, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns a 304 from getText, for conditional requests", async () => {
    const { fetch, requests } = fakeFetch(new Response(null, { status: 304 }));

    const response = await client(fetch).getText(url, { headers: { "if-none-match": '"v1"' } });
    expect(response).toMatchObject({ status: 304, url, body: "" });
    expect(requests[0]?.headers.get("if-none-match")).toBe('"v1"');
  });

  it("keeps the starts of two requests minIntervalMs apart", async () => {
    const { fetch } = fakeFetch(Response.json({ hits: [] }), Response.json({ hits: [] }));
    const http = createHttpClient({ userAgent: "Astra/test", minIntervalMs: 50, fetch });
    const started = performance.now();

    await http.getJson(url, schema);
    await http.getJson(url, schema);
    expect(performance.now() - started).toBeGreaterThanOrEqual(45);
  });
});
