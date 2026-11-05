import { describe, expect, it } from "vitest";
import { canonicalUrl } from "./url.ts";

describe("canonicalUrl", () => {
  it("reduces the architecture document's example to the article", () => {
    expect(
      canonicalUrl(
        "https://techcrunch.com/2026/09/08/nvidia-hf/?utm_source=hn&utm_medium=social#top",
      ),
    ).toBe("https://techcrunch.com/2026/09/08/nvidia-hf");
  });

  it("lowercases the host and drops www., but keeps the path's case", () => {
    expect(canonicalUrl("https://WWW.Example.COM/Path")).toBe("https://example.com/Path");
  });

  it("upgrades http to https and drops default ports", () => {
    expect(canonicalUrl("http://example.com/a")).toBe("https://example.com/a");
    expect(canonicalUrl("http://example.com:80/a")).toBe("https://example.com/a");
    expect(canonicalUrl("https://example.com:443/a")).toBe("https://example.com/a");
  });

  it("keeps http on an explicit port, which may serve nothing else", () => {
    expect(canonicalUrl("http://example.com:8080/a")).toBe("http://example.com:8080/a");
  });

  it("drops credentials", () => {
    expect(canonicalUrl("https://user:secret@example.com/a")).toBe("https://example.com/a");
  });

  it("drops trailing slashes but keeps the root", () => {
    expect(canonicalUrl("https://example.com/a//")).toBe("https://example.com/a");
    expect(canonicalUrl("https://www.example.com")).toBe("https://example.com/");
  });

  it("drops an empty query and an empty fragment", () => {
    expect(canonicalUrl("https://example.com/a?#")).toBe("https://example.com/a");
  });

  it.each([
    "utm_source=hn&utm_medium=social&utm_campaign=launch",
    "UTM_Source=newsletter",
    "fbclid=IwAR0",
    "gclid=abc&msclkid=def",
    "mc_cid=1&mc_eid=2",
    "_hsenc=p2&_hsmi=3",
    "mtm_campaign=x&pk_kwd=y",
    "ref=producthunt",
    "source=rss",
  ])("strips the tracking parameters in ?%s", (query) => {
    expect(canonicalUrl(`https://example.com/a?${query}`)).toBe("https://example.com/a");
  });

  it("keeps the parameters that identify the content", () => {
    expect(canonicalUrl("https://news.ycombinator.com/item?id=41234567&utm_source=x")).toBe(
      "https://news.ycombinator.com/item?id=41234567",
    );
  });

  it("keeps parameters that merely resemble tracking ones", () => {
    expect(canonicalUrl("https://example.com/a?sources=2&reference=1")).toBe(
      "https://example.com/a?reference=1&sources=2",
    );
  });

  it("sorts parameters, so their order does not matter", () => {
    expect(canonicalUrl("https://example.com/search?q=astra&page=2")).toBe(
      "https://example.com/search?page=2&q=astra",
    );
  });

  it("keeps the order of a repeated parameter", () => {
    expect(canonicalUrl("https://example.com/a?tag=b&tag=a")).toBe(
      "https://example.com/a?tag=b&tag=a",
    );
  });

  it("encodes the query one way, whichever way the source did", () => {
    expect(canonicalUrl("https://example.com/s?q=open%20source")).toBe(
      canonicalUrl("https://example.com/s?q=open+source"),
    );
  });

  it.each([
    "",
    "not a url",
    "/relative/path",
    "mailto:someone@example.com",
    "ftp://example.com/file",
    "javascript:alert(1)",
  ])("returns null for %j", (input) => {
    expect(canonicalUrl(input)).toBeNull();
  });

  it.each([
    "https://www.example.com/a/?b=2&a=1&utm_source=x#top",
    "http://user@example.com:8080/a?q=open%20source",
    "https://example.com/s?tag=b&tag=a&ref=hn",
  ])("gives the same result when applied twice: %s", (input) => {
    const once = canonicalUrl(input);

    expect(once).not.toBeNull();
    expect(canonicalUrl(once ?? "")).toBe(once);
  });
});
