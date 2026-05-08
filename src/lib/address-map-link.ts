function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function decodeCommonEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstHrefFromHtml(html: string): string | null {
  const m = html.match(/href\s*=\s*["']([^"']+)["']/i);
  return m?.[1]?.trim() || null;
}

function isGoogleMapsUrl(url: string): boolean {
  return /(?:^https?:\/\/)?(?:www\.)?(?:google\.[^/]+\/maps|maps\.app\.goo\.gl\/)/i.test(
    url,
  );
}

export function stripAnchorTags(html: string): string {
  return html.replace(/<\/?a\b[^>]*>/gi, "");
}

export function googleMapsHrefFromAddressHtml(html: string): string | null {
  const raw = html.trim();
  if (!raw) return null;

  const existingHref = firstHrefFromHtml(raw);
  if (existingHref && isGoogleMapsUrl(existingHref)) return existingHref;

  const plain = compactWhitespace(decodeCommonEntities(stripTags(raw)));
  if (!plain) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plain)}`;
}
