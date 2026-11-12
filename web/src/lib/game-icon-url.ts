const ICON_ORIGIN = "https://storage.googleapis.com";
const ICON_PREFIX = "/champion-images/mcoc/";
const ICON_FAMILIES = new Set(["glossary-icons", "game-effect-icons"]);

/** Only the existing public glyph collections can be fetched by the web relay. */
export function gameIconSourceUrl(family: string, file: string): string | null {
  if (!ICON_FAMILIES.has(family) || !/^[a-z0-9][a-z0-9_-]{0,159}\.svg$/i.test(file)) return null;
  return ICON_ORIGIN + ICON_PREFIX + family + "/" + file;
}

/** CSS masks require CORS; retain the bound artwork through a same-origin URL. */
export function gameIconMaskUrl(source: string): string {
  try {
    const url = new URL(source);
    if (url.origin !== ICON_ORIGIN || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(ICON_PREFIX)) return source;
    const parts = url.pathname.slice(ICON_PREFIX.length).split("/");
    if (parts.length !== 2 || !gameIconSourceUrl(parts[0], parts[1])) return source;
    return "/api/game-icons/" + parts.join("/");
  } catch {
    return source;
  }
}
