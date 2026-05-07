/** Instructional videos (WordPress URI: /resources/instructional-videos/) */
import type { WpResponsiveMediaNode } from "../picture-wp-media";

export const INSTRUCTIONAL_VIDEOS_PAGE_URI = "/resources/instructional-videos/";

export const INSTRUCTIONAL_VIDEOS_PAGE_QUERY = /* GraphQL */ `
  query InstructionalVideosPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      instructionalVideos {
        instructionalVideo {
          instructionalVideoTitle
          instructionalVideoImage {
            node {
              sourceUrl
              medium: sourceUrl(size: MEDIUM)
              medium_large: sourceUrl(size: MEDIUM_LARGE)
              altText
              mediaDetails {
                width
                height
              }
            }
          }
          instructionalVideoLink
          textOnHover
        }
      }
    }
  }
`;

export type InstructionalVideoImageNode = WpResponsiveMediaNode;

export type InstructionalVideoRow = {
  instructionalVideoTitle?: string | null;
  instructionalVideoImage?: {
    node?: InstructionalVideoImageNode | null;
  } | null;
  instructionalVideoLink?: string | null;
  textOnHover?: string | null;
};

export type InstructionalVideosBlock = {
  instructionalVideo?: InstructionalVideoRow | InstructionalVideoRow[] | null;
};

export type InstructionalVideosPageData = {
  page?: {
    title?: string | null;
    instructionalVideos?: InstructionalVideosBlock | null;
  } | null;
};

export type InstructionalVideoCard = {
  title: string;
  link: string;
  imageNode: InstructionalVideoImageNode | null;
  imageUrl: string | null;
  imageAlt: string;
  textOnHover: string;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function normalizeInstructionalVideos(
  block: InstructionalVideosBlock | null | undefined,
): InstructionalVideoCard[] {
  const rows = asArray(block?.instructionalVideo);
  const out: InstructionalVideoCard[] = [];
  for (const row of rows) {
    const title = (row?.instructionalVideoTitle ?? "").trim();
    const link = (row?.instructionalVideoLink ?? "").trim();
    if (!title && !link) continue;
    const node = row?.instructionalVideoImage?.node;
    const imageUrl =
      typeof node?.sourceUrl === "string" && node.sourceUrl.trim()
        ? node.sourceUrl.trim()
        : null;
    const imageAlt = (node?.altText ?? "").trim() || title || "Video";
    const textOnHover = (row?.textOnHover ?? "").trim();
    out.push({
      title: title || link || "Video",
      link: link || "#",
      imageNode: node ?? null,
      imageUrl,
      imageAlt,
      textOnHover,
    });
  }
  return out;
}
