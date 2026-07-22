import { writable } from "svelte/store";

function currentHash(): string {
  return window.location.hash.replace(/^#/, "") || "/login";
}

export const currentPath = writable<string>(currentHash());

window.addEventListener("hashchange", () => currentPath.set(currentHash()));

export function navigate(path: string): void {
  window.location.hash = path;
}

/** Matches "/decks/:id/study" style patterns against a concrete path, returning params or null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const [pathOnly, query] = path.split("?");
  const pathParts = pathOnly.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (p !== pathParts[i]) {
      return null;
    }
  }
  if (query) {
    for (const pair of query.split("&")) {
      const [k, v] = pair.split("=");
      if (k) params[k] = decodeURIComponent(v ?? "");
    }
  }
  return params;
}
