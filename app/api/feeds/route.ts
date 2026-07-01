import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { FEEDS, type Feed, type NewsItem } from "@/lib/feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return String(v);
}

function atomLink(link: unknown): string {
  if (!link) return "";
  const arr = Array.isArray(link) ? link : [link];
  // prefer rel="alternate", else first href
  const alt = arr.find((l) => typeof l === "object" && l["@_rel"] === "alternate");
  const pick = alt ?? arr[0];
  if (typeof pick === "string") return pick;
  if (typeof pick === "object") return String(pick["@_href"] ?? pick["#text"] ?? "");
  return "";
}

function makeId(seed: string): string {
  // stable short id from the link/title
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return "i" + Math.abs(h).toString(36);
}

async function fetchFeed(feed: Feed): Promise<NewsItem[] | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        // some feeds (Cloudflare etc.) reject the default fetch UA
        "User-Agent": "Mozilla/5.0 (compatible; StartupyRadar/1.0; +https://startupy-radar)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("http " + res.status);
    const body = await res.text();
    const xml = parser.parse(body);

    const channel = xml?.rss?.channel ?? xml?.["rdf:RDF"] ?? null;
    let nodes: Record<string, unknown>[] = [];
    let isAtom = false;

    if (channel?.item) {
      nodes = Array.isArray(channel.item) ? channel.item : [channel.item];
    } else if (xml?.feed?.entry) {
      isAtom = true;
      nodes = Array.isArray(xml.feed.entry) ? xml.feed.entry : [xml.feed.entry];
    }

    const limit = feed.cat === "globalne" ? 20 : 12;
    return nodes.slice(0, limit).map((node): NewsItem => {
      const title = stripHtml(text(node.title) || "(bez tytułu)");
      const link = isAtom
        ? atomLink(node.link)
        : text(node.link) || text(node.guid);
      const dateStr =
        text(node.pubDate) ||
        text(node.published) ||
        text(node.updated) ||
        text(node["dc:date"]) ||
        "";
      let snippet = stripHtml(
        text(node.description) || text(node.summary) || text(node.content) || ""
      );
      if (snippet.length > 220) snippet = snippet.slice(0, 220).trim() + "…";
      const ts = new Date(dateStr).getTime() || 0;
      return {
        id: makeId(link || title),
        title,
        link,
        snippet,
        source: feed.name.replace(/^Google News · /, ""),
        cat: feed.cat,
        date: dateStr,
        ts,
      };
    });
  } catch (e) {
    console.warn("Feed failed:", feed.name, (e as Error).message);
    return null;
  }
}

export async function GET() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const failed = results.filter((r) => r === null).length;
  let items = results.filter((r): r is NewsItem[] => r !== null).flat();

  // dedupe by leading title
  const seen = new Set<string>();
  items = items.filter((it) => {
    const key = it.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  items.sort((a, b) => b.ts - a.ts);

  return NextResponse.json({ items, failed });
}
