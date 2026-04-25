import { decodeHtmlEntities } from "../decode-html-entities";

/** WordPress URI for this route (with or without trailing slash in fetch). */
export const RECALL_PAGE_URI = "/resources/recall/";

export const RECALL_PAGE_QUERY = /* GraphQL */ `
  query {
    page(id: "/resources/recall/", idType: URI) {
      title
      cardsSettings {
        cardsGroup {
          mode
          cards {
            title
            description
            icon {
              node {
                sourceUrl
                altText
                mediaDetails {
                  width
                  height
                }
              }
            }
            link {
              url
              title
              target
            }
          }
        }
      }
    }
  }
`;

export type RecallMediaNode = {
  sourceUrl?: string | null;
  altText?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
};

export type RecallCardLink = {
  url?: string | null;
  title?: string | null;
  target?: string | null;
};

export type RecallCardRaw = {
  title?: string | null;
  description?: string | null;
  icon?: {
    node?: RecallMediaNode | null;
  } | null;
  link?: RecallCardLink | null;
};

export type RecallPageData = {
  page?: {
    title?: string | null;
    cardsSettings?: {
      cardsGroup?:
        | {
            mode?: string | number | boolean | null;
            cards?: RecallCardRaw[] | RecallCardRaw | null;
          }
        | {
            mode?: string | number | boolean | null;
            cards?: RecallCardRaw[] | RecallCardRaw | null;
          }[]
        | null;
    } | null;
  } | null;
};

export type RecallCardsGroup = {
  mode?: string | number | boolean | null;
  cards?: RecallCardRaw[] | RecallCardRaw | null;
};

function pickCardsGroup(
  page: RecallPageData["page"] | null | undefined,
): RecallCardsGroup | null {
  const raw = page?.cardsSettings?.cardsGroup;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    for (const g of raw) {
      if (g && typeof g === "object") return g;
    }
    return null;
  }
  if (typeof raw === "object") return raw;
  return null;
}

export type RecallCard = {
  title: string;
  descriptionHtml: string;
  iconUrl: string;
  iconAlt: string;
  iconWidth?: number;
  iconHeight?: number;
  linkUrl: string;
  linkLabel: string;
  linkTarget: "_blank" | undefined;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function stripOuterPTags(html: string): string {
  const t = html.trim();
  const m = /^<p[^>]*>([\s\S]*)<\/p>$/i.exec(t);
  if (m) return m[1].trim();
  return t;
}

export function normalizeRecallCards(
  page: RecallPageData["page"] | null | undefined,
): RecallCard[] {
  const group = pickCardsGroup(page);
  const raw = asArray(group?.cards);
  const out: RecallCard[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const title = decodeHtmlEntities(asTrimmedString(row.title));
    const descRaw = asTrimmedString(row.description);
    const descriptionHtml = stripOuterPTags(decodeHtmlEntities(descRaw));
    const node = row.icon?.node;
    const iconUrl = asTrimmedString(node?.sourceUrl);
    const iconAlt = decodeHtmlEntities(asTrimmedString(node?.altText) || title);
    const w = node?.mediaDetails?.width;
    const h = node?.mediaDetails?.height;
    const linkUrl = asTrimmedString(row.link?.url);
    const linkLabel = decodeHtmlEntities(
      asTrimmedString(row.link?.title) || "View guide",
    );
    const tgt = asTrimmedString(row.link?.target).toLowerCase();
    const linkTarget: "_blank" | undefined =
      tgt === "_blank" ? "_blank" : undefined;
    if (!title && !descriptionHtml && !iconUrl && !linkUrl) continue;
    out.push({
      title: title || "Guide",
      descriptionHtml,
      iconUrl,
      iconAlt,
      iconWidth: typeof w === "number" && w > 0 ? w : undefined,
      iconHeight: typeof h === "number" && h > 0 ? h : undefined,
      linkUrl: linkUrl || "#",
      linkLabel,
      linkTarget,
    });
  }
  return out;
}

export function readRecallCardsMode(
  page: RecallPageData["page"] | null | undefined,
): string {
  const group = pickCardsGroup(page);
  return asTrimmedString(group?.mode).toLowerCase();
}
