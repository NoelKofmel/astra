import type { Collector } from "./collector.ts";
import { hackerNews } from "./hackernews.ts";

/** Every collector the worker knows. sources.collector must name one of them. */
export const collectors: readonly Collector[] = [hackerNews];
