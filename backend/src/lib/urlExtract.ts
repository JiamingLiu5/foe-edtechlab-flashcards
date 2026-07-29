import dns from "node:dns/promises";
import { env } from "../env.js";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

/** Blocks SSRF against loopback/private/link-local ranges — a server-side URL fetch is an easy target otherwise. */
function isPrivateIp(rawIp: string): boolean {
  if (rawIp.includes(":")) {
    const lower = rawIp.toLowerCase();
    // Unwrap IPv4-mapped IPv6 addresses (e.g. "::ffff:127.0.0.1") so the IPv4 checks below still apply.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  const parts = rawIp.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) throw new Error("Could not resolve this URL's host.");
  if (records.some((r) => isPrivateIp(r.address))) {
    throw new Error("This URL points to a private or internal address, which isn't allowed.");
  }
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  await assertPublicHost(url.hostname);
}

function stripHtmlToText(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");

  // Mark headings as section boundaries before stripping tags, so generation can cite a section.
  text = text.replace(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi, (_m, inner) => {
    const heading = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return heading ? `\n\n=== Section: ${heading} ===\n` : "\n\n";
  });

  text = text
    .replace(/<(p|div|br|li|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Follows redirects one hop at a time, re-validating that each target host is
 * still public — "redirect: follow" would otherwise let a hostile server
 * redirect the request past the SSRF check straight at an internal address.
 */
async function fetchPublicUrl(url: URL, signal: AbortSignal): Promise<{ res: Response; finalUrl: URL }> {
  let current = url;
  for (let hop = 0; ; hop++) {
    if (hop > 0) await assertPublicUrl(current);

    let res: Response;
    try {
      res = await fetch(current, {
        signal,
        redirect: "manual",
        headers: { "User-Agent": "FlashcardsBot/1.0 (+educational card generation)" },
      });
    } catch (err) {
      throw new Error(err instanceof Error && err.name === "AbortError" ? "Fetching that URL timed out." : "Could not fetch that URL.");
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    if (!isRedirect || !location) return { res, finalUrl: current };

    if (hop >= MAX_REDIRECTS) throw new Error("That URL redirected too many times.");
    current = new URL(location, current);
  }
}

/**
 * Fetches a public webpage server-side and reduces it to plain text with
 * "=== Section: ... ===" markers derived from its headings, so the same
 * citation-grounded generation prompt used for PDFs also works for URLs.
 */
export async function extractUrlText(rawUrl: string): Promise<{ text: string; title: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  await assertPublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    ({ res, finalUrl: url } = await fetchPublicUrl(url, controller.signal));
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Fetching that URL failed (HTTP ${res.status}).`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("That URL isn't a webpage (expected text/html).");
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > env.maxUrlFetchBytes) {
    throw new Error(`Page exceeds the ${env.maxUrlFetchBytes / (1024 * 1024)}MB limit.`);
  }

  const html = Buffer.from(buffer).toString("utf-8");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : url.hostname;

  const text = stripHtmlToText(html);
  if (!text || text.length < 40) {
    throw new Error("Couldn't find readable text on that page.");
  }

  return { text, title };
}
