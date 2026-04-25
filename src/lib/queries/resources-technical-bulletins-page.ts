import { decodeHtmlEntities } from "../decode-html-entities";

/** WordPress URI for this route (with or without trailing slash in fetch). */
export const TECHNICAL_BULLETINS_PAGE_URI = "/resources/technical-bulletins/";

export const TECHNICAL_BULLETINS_PAGE_QUERY = /* GraphQL */ `
  query TechnicalBulletinsPage($id: ID!) {
    page(id: $id, idType: URI) {
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

export type TechnicalBulletinsMediaNode = {
  sourceUrl?: string | null;
  altText?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
};

export type TechnicalBulletinsCardLink = {
  url?: string | null;
  title?: string | null;
  target?: string | null;
};

export type TechnicalBulletinsCardRaw = {
  title?: string | null;
  description?: string | null;
  icon?: {
    node?: TechnicalBulletinsMediaNode | null;
  } | null;
  link?: TechnicalBulletinsCardLink | null;
};

export type TechnicalBulletinsPageData = {
  page?: {
    title?: string | null;
    cardsSettings?: {
      cardsGroup?: {
        mode?: string | null;
        cards?: TechnicalBulletinsCardRaw[] | TechnicalBulletinsCardRaw | null;
      } | null;
    } | null;
  } | null;
};

export type TechnicalBulletinsCard = {
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

function stripOuterPTags(html: string): string {
  const t = html.trim();
  const m = /^<p[^>]*>([\s\S]*)<\/p>$/i.exec(t);
  if (m) return m[1].trim();
  return t;
}

export function normalizeTechnicalBulletinsCards(
  page: TechnicalBulletinsPageData["page"] | null | undefined,
): TechnicalBulletinsCard[] {
  const raw = asArray(page?.cardsSettings?.cardsGroup?.cards);
  const out: TechnicalBulletinsCard[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const title = decodeHtmlEntities((row.title ?? "").trim());
    const descRaw = (row.description ?? "").trim();
    const descriptionHtml = stripOuterPTags(decodeHtmlEntities(descRaw));
    const node = row.icon?.node;
    const iconUrl = (node?.sourceUrl ?? "").trim();
    const iconAlt = decodeHtmlEntities((node?.altText ?? "").trim() || title);
    const w = node?.mediaDetails?.width;
    const h = node?.mediaDetails?.height;
    const linkUrl = (row.link?.url ?? "").trim();
    const linkLabel = decodeHtmlEntities(
      (row.link?.title ?? "").trim() || "View guide",
    );
    const tgt = (row.link?.target ?? "").trim().toLowerCase();
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
