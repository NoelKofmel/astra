import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";

/**
 * A request that failed in a way the other side can cause: an error status, a
 * timeout, an unreachable host, a body that does not match its schema. An
 * expected failure (docs/07-conventions.md#errors) — the caller decides what
 * it means for its source.
 */
export class HttpError extends Error {
  override readonly name = "HttpError";
  readonly url: string;
  /** Undefined when no response arrived. */
  readonly status: number | undefined;

  constructor(message: string, details: { url: string; status?: number; cause?: unknown }) {
    super(message, { cause: details.cause });
    this.url = details.url;
    this.status = details.status;
  }
}

export interface HttpClientOptions {
  /** Names Astra and how to reach its operator (docs/02-sources.md#legal). */
  userAgent: string;
  /** Per attempt, body included. */
  timeoutMs?: number;
  /** Attempts after the first, on network errors, timeouts, 429 and 5xx. */
  retries?: number;
  /** The first retry's delay; it doubles with every further one. */
  backoffMs?: number;
  /** The least time between the starts of two requests, for sources that ask for one. */
  minIntervalMs?: number;
  /** Replaced in tests. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Aborts the request and its retries, e.g. when the worker shuts down. */
  signal?: AbortSignal;
}

export interface TextResponse {
  status: number;
  /** After redirects. */
  url: string;
  headers: Headers;
  body: string;
}

export interface HttpClient {
  /** GETs a URL and parses the JSON body with the schema. */
  getJson<T extends z.ZodType>(
    url: string,
    schema: T,
    options?: RequestOptions,
  ): Promise<z.output<T>>;
  /** GETs a URL as text. A 304 is returned too, for conditional requests. */
  getText(url: string, options?: RequestOptions): Promise<TextResponse>;
}

/** A Retry-After beyond this fails the request rather than hold up its job. */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * The one way to call another service (docs/07-conventions.md#outbound-http).
 * One client per source, so that a rate limit stays with its source.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    userAgent,
    timeoutMs = 15_000,
    retries = 2,
    backoffMs = 1_000,
    minIntervalMs = 0,
    fetch: fetchImpl = fetch,
  } = options;
  let nextStart = 0;

  async function get(url: string, { headers, signal }: RequestOptions = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const wait = nextStart - Date.now();
      nextStart = Math.max(nextStart, Date.now()) + minIntervalMs;
      if (wait > 0) {
        await sleep(wait, undefined, { signal });
      }

      const timeout = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { ...headers, "user-agent": userAgent },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (err) {
        if (signal?.aborted) {
          throw err;
        }
        if (attempt < retries) {
          await sleep(backoffMs * 2 ** attempt, undefined, { signal });
          continue;
        }
        throw new HttpError(`GET ${url} failed: ${reason(err)}`, { url, cause: err });
      }

      if (response.ok || response.status === 304) {
        return response;
      }
      await response.body?.cancel();
      const delay = retryDelay(response, backoffMs * 2 ** attempt);
      if (attempt < retries && delay !== undefined) {
        await sleep(delay, undefined, { signal });
        continue;
      }
      throw new HttpError(`GET ${url}: HTTP ${String(response.status)}`, {
        url,
        status: response.status,
      });
    }
  }

  async function read(response: Response, url: string): Promise<string> {
    try {
      return await response.text();
    } catch (err) {
      throw new HttpError(`GET ${url}: reading the body failed: ${reason(err)}`, {
        url,
        status: response.status,
        cause: err,
      });
    }
  }

  return {
    async getJson(url, schema, requestOptions) {
      const response = await get(url, requestOptions);
      const { status } = response;
      if (status === 304) {
        throw new HttpError(`GET ${url}: HTTP 304 without a body to parse`, { url, status });
      }
      const text = await read(response, url);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch (err) {
        throw new HttpError(`GET ${url}: invalid JSON`, { url, status, cause: err });
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new HttpError(`GET ${url}: unexpected body: ${z.prettifyError(parsed.error)}`, {
          url,
          status,
        });
      }
      return parsed.data;
    },

    async getText(url, requestOptions) {
      const response = await get(url, requestOptions);
      return {
        status: response.status,
        url: response.url || url,
        headers: response.headers,
        body: await read(response, url),
      };
    },
  };
}

/** How long to wait before the next attempt, or undefined if retrying cannot help. */
function retryDelay(response: Response, backoff: number): number | undefined {
  if (response.status !== 429 && response.status < 500) {
    return undefined;
  }
  // Seconds; the rarer HTTP-date form falls back to the usual backoff.
  const seconds = Number(response.headers.get("retry-after") ?? Number.NaN);
  if (Number.isNaN(seconds)) {
    return backoff;
  }
  return seconds * 1_000 > MAX_RETRY_AFTER_MS ? undefined : seconds * 1_000;
}

function reason(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  // undici says only "fetch failed" and keeps the actual reason in `cause`.
  return err.cause instanceof Error ? `${err.message} (${err.cause.message})` : err.message;
}
