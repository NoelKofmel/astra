import type { HttpClient } from "@astra/core/http";
import { createLogger } from "@astra/core/logger";
import { describe, expect, it } from "vitest";
import type { CollectedItem } from "./collector.ts";
import { hackerNews } from "./hackernews.ts";

// Trimmed from a real response of the search API (2026-11-05).
const linkStory = {
  _highlightResult: { title: { value: "Goodbye from Salon" } },
  _tags: ["story", "author_mkeeter", "story_50383739", "front_page"],
  author: "mkeeter",
  children: [50383899, 50383879],
  created_at: "2026-11-05T20:03:29Z",
  created_at_i: 1793909009,
  num_comments: 4,
  objectID: "50383739",
  points: 42,
  story_id: 50383739,
  title: "Goodbye from Salon",
  updated_at: "2026-11-05T20:18:41Z",
  url: "https://www.salon.com/2026/11/05/goodbye-from-salon/",
};
const askHn = {
  _tags: ["story", "author_princevegeta89", "story_50372381", "ask_hn"],
  author: "princevegeta89",
  created_at_i: 1793869200,
  num_comments: 31,
  objectID: "50372381",
  points: 57,
  story_text: "This was probably already coming. Sad day for many folks …",
  title: "Canva lays off 22% of its workforce; 1,270 people",
  url: null,
};

/** Answers each getJson with the next page, parsed by the collector's own schema. */
function fakeHttp(...pages: unknown[]) {
  const urls: URL[] = [];
  const http: HttpClient = {
    getJson(url, schema) {
      urls.push(new URL(url));
      return Promise.resolve(schema.parse(pages.shift()));
    },
    getText() {
      return Promise.reject(new Error("not used"));
    },
  };
  return { http, urls };
}

async function collect(http: HttpClient, config: unknown = {}): Promise<CollectedItem[]> {
  const ctx = {
    http,
    log: createLogger({ service: "test", level: "silent" }),
    signal: new AbortController().signal,
  };
  const items: CollectedItem[] = [];
  for await (const item of hackerNews.collect(hackerNews.config.parse(config), ctx)) {
    items.push(item);
  }
  return items;
}

describe("hackerNews", () => {
  it("maps a story, leaving copies and comment IDs out of raw", async () => {
    const [item] = await collect(fakeHttp({ hits: [linkStory], nbPages: 1 }).http);

    expect(item).toMatchObject({
      externalId: "50383739",
      url: "https://www.salon.com/2026/11/05/goodbye-from-salon/",
      title: "Goodbye from Salon",
      author: "mkeeter",
      publishedAt: new Date("2026-11-05T20:03:29Z"),
      engagement: { points: 42, comments: 4 },
    });
    expect(item?.raw).toMatchObject({ _tags: linkStory._tags, points: 42 });
    expect(item?.raw).not.toHaveProperty("_highlightResult");
    expect(item?.raw).not.toHaveProperty("children");
  });

  it("links an Ask HN post to its discussion and leaves its text out", async () => {
    const [item] = await collect(fakeHttp({ hits: [askHn], nbPages: 1 }).http);

    expect(item?.url).toBe("https://news.ycombinator.com/item?id=50372381");
    expect(item?.raw).not.toHaveProperty("story_text");
  });

  it("asks for every page of the window above the points threshold", async () => {
    const { http, urls } = fakeHttp(
      { hits: [linkStory], nbPages: 2 },
      { hits: [askHn], nbPages: 2 },
    );
    const windowStart = Math.floor(Date.now() / 1_000) - 6 * 3_600;

    const items = await collect(http, { minPoints: 50, windowHours: 6 });
    expect(items.map((item) => item.externalId)).toEqual(["50383739", "50372381"]);
    expect(urls.map((url) => url.searchParams.get("page"))).toEqual(["0", "1"]);

    const filters = urls[0]?.searchParams.get("numericFilters") ?? "";
    const [, after] = /^created_at_i>(\d+),points>=50$/.exec(filters) ?? [];
    expect(Number(after)).toBeGreaterThanOrEqual(windowStart);
    expect(Number(after)).toBeLessThanOrEqual(windowStart + 5);
  });

  it("defaults to 20 points within 24 hours", () => {
    expect(hackerNews.config.parse({})).toEqual({ minPoints: 20, windowHours: 24 });
  });
});
