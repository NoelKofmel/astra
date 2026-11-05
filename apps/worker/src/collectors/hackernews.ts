import { z } from "zod";
import { type CollectedItem, defineCollector } from "./collector.ts";

const SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date";

/** A story as the Algolia search API returns it. Unchecked fields pass through into `raw`. */
const storyHit = z.looseObject({
  objectID: z.string(),
  title: z.string(),
  url: z.string().nullish(),
  author: z.string(),
  points: z.number().int().nullish(),
  num_comments: z.number().int().nullish(),
  created_at_i: z.number().int(),
});

const searchPage = z.object({
  hits: z.array(storyHit),
  nbPages: z.number().int(),
});

/** Copies of other fields, the IDs of every comment, and the post's full text. */
const LEFT_OUT_OF_RAW = new Set(["_highlightResult", "children", "story_text"]);

/**
 * Hacker News through the Algolia search API (docs/02-sources.md#hacker-news).
 * Every run asks for the whole window rather than for what is new since the
 * last one: a story that crosses the points threshold late is still found,
 * and the engagement of known stories stays current.
 */
export const hackerNews = defineCollector({
  id: "hackernews",
  schedule: "*/15 * * * *",
  config: z.object({
    minPoints: z.number().int().nonnegative().default(20),
    windowHours: z.number().int().positive().default(24),
  }),
  async *collect({ minPoints, windowHours }, { http, signal }) {
    const after = Math.floor(Date.now() / 1_000) - windowHours * 3_600;
    for (let page = 0; ; page++) {
      const query = new URLSearchParams({
        tags: "story",
        numericFilters: `created_at_i>${String(after)},points>=${String(minPoints)}`,
        hitsPerPage: "100",
        page: String(page),
      });
      const result = await http.getJson(`${SEARCH_URL}?${query.toString()}`, searchPage, {
        signal,
      });
      yield* result.hits.map(toItem);
      if (page + 1 >= result.nbPages) {
        return;
      }
    }
  },
});

function toItem(hit: z.output<typeof storyHit>): CollectedItem {
  return {
    externalId: hit.objectID,
    // Ask HN and the like link nowhere else; their discussion is the story.
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title,
    author: hit.author,
    publishedAt: new Date(hit.created_at_i * 1_000),
    engagement: { points: hit.points ?? 0, comments: hit.num_comments ?? 0 },
    raw: Object.fromEntries(Object.entries(hit).filter(([key]) => !LEFT_OUT_OF_RAW.has(key))),
  };
}
