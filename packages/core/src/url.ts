/** Query parameters that only record where a click came from. Matched case-insensitively. */
const TRACKING_PARAMS = new Set([
  // Ad and analytics click IDs
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "yclid",
  "igshid",
  "igsh",
  "_ga",
  "_gl",
  // Newsletter and marketing tools
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "_hsenc",
  "_hsmi",
  "__hstc",
  "__hssc",
  "__hsfp",
  "oly_anon_id",
  "oly_enc_id",
  "vero_id",
  // Referrer tags
  "ref",
  "ref_src",
  "ref_url",
  "source",
]);

/** Google Analytics, Matomo and Piwik campaign parameters: utm_source, mtm_campaign, … */
const TRACKING_PREFIXES = ["utm_", "mtm_", "pk_"];

function isTracking(param: string): boolean {
  const name = param.toLowerCase();
  return TRACKING_PARAMS.has(name) || TRACKING_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** "/a//" → "/a", while the root stays "/". A loop, since /\/+$/ backtracks on long runs. */
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") {
    end--;
  }
  return path.slice(0, end);
}

/**
 * The key for stage-1 clustering (docs/03-ranking-and-ai.md#clustering): every
 * way a source may format a link to the same article yields the same string.
 *
 * Upgrades http to https, drops credentials, `www.`, the fragment, trailing
 * slashes and tracking parameters, and sorts the remaining parameters. It does
 * not resolve redirects — that needs the network and happens elsewhere.
 *
 * Returns null for anything that is not an absolute http(s) URL.
 */
export function canonicalUrl(input: string): string | null {
  const url = URL.parse(input);
  if (url === null || (url.protocol !== "https:" && url.protocol !== "http:")) {
    return null;
  }

  // An explicit port may serve plain http only, so the scheme stays.
  if (url.protocol === "http:" && url.port === "") {
    url.protocol = "https:";
  }
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.replace(/^www\./, "");
  url.pathname = trimTrailingSlashes(url.pathname);
  url.hash = "";

  const params = new URLSearchParams(url.search);
  for (const name of new Set(params.keys())) {
    if (isTracking(name)) {
      params.delete(name);
    }
  }
  // Stable: repeated parameters keep their order, which may carry meaning.
  params.sort();
  url.search = params.toString();

  return url.href;
}
