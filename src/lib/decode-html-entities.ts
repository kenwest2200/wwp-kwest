function decodeHtmlEntitiesServer(text: string): string {
  let s = text;
  s = s.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex: string) => {
    const cp = Number.parseInt(hex, 16);
    return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff
      ? String.fromCodePoint(cp)
      : `&#x${hex};`;
  });
  s = s.replace(/&#(\d{1,7});/g, (_, dec: string) => {
    const cp = Number.parseInt(dec, 10);
    return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff
      ? String.fromCodePoint(cp)
      : `&#${dec};`;
  });

  for (let i = 0; i < 12; i++) {
    const prev = s;
    s = s
      .replace(/&nbsp;/gi, "\u00a0")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&ndash;/g, "\u2013")
      .replace(/&mdash;/g, "\u2014")
      .replace(/&hellip;/g, "\u2026")
      .replace(/&amp;/g, "&");
    if (s === prev) break;
  }

  return s;
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const doc =
    typeof globalThis !== "undefined" ? globalThis.document : undefined;
  if (doc && typeof doc.createElement === "function") {
    try {
      const el = doc.createElement("textarea");
      el.innerHTML = text;
      return el.value;
    } catch {
      return decodeHtmlEntitiesServer(text);
    }
  }
  return decodeHtmlEntitiesServer(text);
}
