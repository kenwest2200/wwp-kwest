/** Help page (WordPress URI: /help/) */

export const HELP_PAGE_URI = "/help/";

export const HELP_PAGE_QUERY = /* GraphQL */ `
  query HelpPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      helpSettings {
        helpSupportGroup {
          title
          blocks {
            title
            contacts {
              icon
              text
            }
          }
        }
        helpCenterGroup {
          title
          blocks {
            title
            description
            image {
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

export type HelpContactRow = {
  icon?: string | string[] | null;
  text?: string | null;
};

export type HelpSupportBlockRow = {
  title?: string | null;
  contacts?: HelpContactRow | HelpContactRow[] | null;
};

export type HelpSupportGroup = {
  title?: string | null;
  blocks?: HelpSupportBlockRow | HelpSupportBlockRow[] | null;
};

export type HelpCenterImageNode = {
  sourceUrl?: string | null;
  altText?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
};

export type HelpCenterBlockRow = {
  title?: string | null;
  description?: string | null;
  image?: {
    node?: HelpCenterImageNode | null;
  } | null;
  link?: {
    url?: string | null;
    title?: string | null;
    target?: string | null;
  } | null;
};

export type HelpCenterGroup = {
  title?: string | null;
  blocks?: HelpCenterBlockRow | HelpCenterBlockRow[] | null;
};

export type HelpSettings = {
  helpSupportGroup?: HelpSupportGroup | null;
  helpCenterGroup?: HelpCenterGroup | null;
};

export type HelpPageData = {
  page?: {
    title?: string | null;
    helpSettings?: HelpSettings | null;
  } | null;
};

export type HelpSupportContact = {
  icon: string;
  text: string;
};

export type HelpSupportBlock = {
  title: string;
  contacts: HelpSupportContact[];
};

export type HelpCenterBlock = {
  title: string;
  descriptionHtml: string;
  imageUrl: string;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
  linkUrl: string;
  linkTitle: string;
  linkTarget: string;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function iconText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = text(item);
      if (s) return s;
    }
  }
  return "";
}

export function normalizeHelpSupportBlocks(
  group: HelpSupportGroup | null | undefined,
): HelpSupportBlock[] {
  const out: HelpSupportBlock[] = [];
  for (const row of asArray(group?.blocks)) {
    const title = text(row?.title);
    const contacts: HelpSupportContact[] = [];
    for (const c of asArray(row?.contacts)) {
      const contactText = text(c?.text);
      if (!contactText) continue;
      contacts.push({
        icon: iconText(c?.icon),
        text: contactText,
      });
    }
    if (!title && contacts.length === 0) continue;
    out.push({
      title: title || "Support",
      contacts,
    });
  }
  return out;
}

export function normalizeHelpCenterBlocks(
  group: HelpCenterGroup | null | undefined,
): HelpCenterBlock[] {
  const out: HelpCenterBlock[] = [];
  for (const row of asArray(group?.blocks)) {
    const title = text(row?.title);
    const descriptionHtml = text(row?.description);
    const imageNode = row?.image?.node ?? null;
    const imageUrl = text(imageNode?.sourceUrl);
    const imageAlt = text(imageNode?.altText);
    const imageWidth = numberOrNull(imageNode?.mediaDetails?.width);
    const imageHeight = numberOrNull(imageNode?.mediaDetails?.height);
    const linkUrl = text(row?.link?.url);
    const linkTitle = text(row?.link?.title);
    const linkTarget = text(row?.link?.target);
    if (!title && !descriptionHtml && !imageUrl && !linkUrl) continue;
    out.push({
      title: title || "Help center",
      descriptionHtml,
      imageUrl,
      imageAlt,
      imageWidth,
      imageHeight,
      linkUrl,
      linkTitle,
      linkTarget,
    });
  }
  return out;
}

