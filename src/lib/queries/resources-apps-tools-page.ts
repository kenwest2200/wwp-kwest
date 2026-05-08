import { decodeHtmlEntities } from "../decode-html-entities";
import type { WpResponsiveMediaNode } from "../picture-wp-media";

export const APPS_TOOLS_PAGE_URI = "/resources/apps-tools/";

export const APPS_TOOLS_PAGE_QUERY = /* GraphQL */ `
  query AppsToolsPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      appsToolsSettings {
        appsGroup {
          title
          apps {
            title
            image {
              node {
                sourceUrl
                medium_large: sourceUrl(size: MEDIUM_LARGE)
                large: sourceUrl(size: PRODUCT_THUMBNAIL)
                altText
                mediaDetails {
                  width
                  height
                }
              }
            }
            app_store_link
            google_play_link
          }
        }
        toolsGroup {
          title
          tools {
            title
            description
            image {
              node {
                sourceUrl
                large: sourceUrl(size: PRODUCT_THUMBNAIL)
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

type MediaNode = WpResponsiveMediaNode;

type AppsToolsAppRaw = {
  title?: string | number | boolean | null;
  image?: { node?: MediaNode | null } | null;
  app_store_link?: string | number | boolean | null;
  google_play_link?: string | number | boolean | null;
};

type AppsToolsToolRaw = {
  title?: string | number | boolean | null;
  description?: string | number | boolean | null;
  image?: { node?: MediaNode | null } | null;
  link?: {
    url?: string | number | boolean | null;
    title?: string | number | boolean | null;
    target?: string | number | boolean | null;
  } | null;
};

type AppsGroupRaw = {
  title?: string | number | boolean | null;
  apps?: AppsToolsAppRaw[] | AppsToolsAppRaw | null;
};

type ToolsGroupRaw = {
  title?: string | number | boolean | null;
  tools?: AppsToolsToolRaw[] | AppsToolsToolRaw | null;
};

export type AppsToolsPageData = {
  page?: {
    title?: string | null;
    appsToolsSettings?: {
      appsGroup?: AppsGroupRaw | AppsGroupRaw[] | null;
      toolsGroup?: ToolsGroupRaw | ToolsGroupRaw[] | null;
    } | null;
  } | null;
};

export type AppsToolsApp = {
  title: string;
  imageNode: WpResponsiveMediaNode | null;
  imageUrl: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  appStoreLink: string;
  googlePlayLink: string;
};

export type AppsToolsTool = {
  title: string;
  descriptionHtml: string;
  imageNode: WpResponsiveMediaNode | null;
  imageUrl: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  linkUrl: string;
  linkLabel: string;
  linkTarget: "_blank" | undefined;
};

export type AppsToolsNormalized = {
  appsGroupTitle: string;
  toolsGroupTitle: string;
  apps: AppsToolsApp[];
  tools: AppsToolsTool[];
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

function normalizeMediaNode(
  node: MediaNode | null | undefined,
  fallbackAlt: string,
): WpResponsiveMediaNode | null {
  if (!node || typeof node !== "object") return null;
  const sourceUrl = asTrimmedString(node.sourceUrl);
  const thumb = asTrimmedString(node.thumb);
  const medium = asTrimmedString(node.medium);
  const mediumLarge = asTrimmedString(node.medium_large);
  const large = asTrimmedString(node.large);
  const altText = decodeHtmlEntities(
    asTrimmedString(node.altText) || fallbackAlt,
  );
  const width = Number(node.mediaDetails?.width);
  const height = Number(node.mediaDetails?.height);
  if (!sourceUrl && !thumb && !medium && !mediumLarge && !large) return null;
  return {
    sourceUrl: sourceUrl || null,
    thumb: thumb || null,
    medium: medium || null,
    medium_large: mediumLarge || null,
    large: large || null,
    altText,
    mediaDetails: {
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
    },
  };
}

function readFirstObject<T>(value: T | T[] | null | undefined): T | null {
  const arr = asArray(value);
  for (const item of arr) {
    if (item && typeof item === "object") return item;
  }
  return null;
}

export function normalizeAppsToolsPage(
  page: AppsToolsPageData["page"] | null | undefined,
): AppsToolsNormalized {
  const settings = page?.appsToolsSettings;
  const appsGroup = readFirstObject(settings?.appsGroup);
  const toolsGroup = readFirstObject(settings?.toolsGroup);

  const apps: AppsToolsApp[] = [];
  for (const row of asArray(appsGroup?.apps)) {
    if (!row || typeof row !== "object") continue;
    const title = decodeHtmlEntities(asTrimmedString(row.title));
    const node = row.image?.node;
    const imageNode = normalizeMediaNode(node, title || "App");
    const imageUrl =
      asTrimmedString(imageNode?.sourceUrl) ||
      asTrimmedString(imageNode?.thumb) ||
      asTrimmedString(imageNode?.medium) ||
      asTrimmedString(imageNode?.medium_large) ||
      asTrimmedString(imageNode?.large);
    const imageAlt = decodeHtmlEntities(
      asTrimmedString(imageNode?.altText) || title,
    );
    const w = node?.mediaDetails?.width;
    const h = node?.mediaDetails?.height;
    const appStoreLink = asTrimmedString(row.app_store_link);
    const googlePlayLink = asTrimmedString(row.google_play_link);
    if (!title && !appStoreLink && !googlePlayLink && !imageUrl) continue;
    apps.push({
      title: title || "App",
      imageNode,
      imageUrl,
      imageAlt,
      imageWidth: typeof w === "number" && w > 0 ? w : undefined,
      imageHeight: typeof h === "number" && h > 0 ? h : undefined,
      appStoreLink,
      googlePlayLink,
    });
  }

  const tools: AppsToolsTool[] = [];
  for (const row of asArray(toolsGroup?.tools)) {
    if (!row || typeof row !== "object") continue;
    const title = decodeHtmlEntities(asTrimmedString(row.title));
    const descriptionHtml = stripOuterPTags(
      decodeHtmlEntities(asTrimmedString(row.description)),
    );
    const node = row.image?.node;
    const imageNode = normalizeMediaNode(node, title || "Tool");
    const imageUrl =
      asTrimmedString(imageNode?.sourceUrl) ||
      asTrimmedString(imageNode?.thumb) ||
      asTrimmedString(imageNode?.medium) ||
      asTrimmedString(imageNode?.medium_large) ||
      asTrimmedString(imageNode?.large);
    const imageAlt = decodeHtmlEntities(
      asTrimmedString(imageNode?.altText) || title,
    );
    const w = node?.mediaDetails?.width;
    const h = node?.mediaDetails?.height;
    const linkUrl = asTrimmedString(row.link?.url);
    const linkLabel = decodeHtmlEntities(
      asTrimmedString(row.link?.title) || "View tool",
    );
    const tgt = asTrimmedString(row.link?.target).toLowerCase();
    const linkTarget: "_blank" | undefined =
      tgt === "_blank" ? "_blank" : undefined;
    if (!title && !descriptionHtml && !imageUrl && !linkUrl) continue;
    tools.push({
      title: title || "Tool",
      descriptionHtml,
      imageNode,
      imageUrl,
      imageAlt,
      imageWidth: typeof w === "number" && w > 0 ? w : undefined,
      imageHeight: typeof h === "number" && h > 0 ? h : undefined,
      linkUrl: linkUrl || "#",
      linkLabel,
      linkTarget,
    });
  }

  return {
    appsGroupTitle: decodeHtmlEntities(asTrimmedString(appsGroup?.title)),
    toolsGroupTitle: decodeHtmlEntities(asTrimmedString(toolsGroup?.title)),
    apps,
    tools,
  };
}
