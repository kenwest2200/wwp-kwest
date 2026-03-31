/** Named refs commonly returned by WP / JSON as literals (e.g. `&amp;` for `&`). */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
};

/**
 * Decodes minimal HTML character references. Safe for SSR (no DOM).
 */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes("&")) {
    return text;
  }

  return text.replace(
    /&(#(?:x[\da-fA-F]+|\d+)|[a-zA-Z][a-zA-Z0-9]*);/g,
    (full, ref: string) => {
      if (ref[0] === "#") {
        const cp =
          ref[1] === "x" || ref[1] === "X"
            ? parseInt(ref.slice(2), 16)
            : parseInt(ref.slice(1), 10);
        if (Number.isNaN(cp)) {
          return full;
        }
        try {
          return String.fromCodePoint(cp);
        } catch {
          return full;
        }
      }
      const named = NAMED_ENTITIES[ref.toLowerCase()];
      return named ?? full;
    },
  );
}
