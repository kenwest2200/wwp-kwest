import { getGraphQLClient, requestGraphql } from "../graphql";

export const INSTAGRAM_POSTS_QUERY = /* GraphQL */ `
  query InstagramPostsForNews {
    instagramPosts {
      mediaUrl
      caption
      permalink
      mediaType
      timestamp
    }
  }
`;

export type InstagramPost = {
  mediaUrl: string;
  caption: string | null;
  permalink: string;
  mediaType: string;
  timestamp: string;
};

export type InstagramPostsQueryData = {
  instagramPosts?: unknown[] | null;
};

function normalizeOne(raw: Record<string, unknown>): InstagramPost | null {
  const mediaUrl = typeof raw.mediaUrl === "string" ? raw.mediaUrl.trim() : "";
  const permalink =
    typeof raw.permalink === "string" ? raw.permalink.trim() : "";
  if (!mediaUrl || !permalink) return null;

  let caption: string | null = null;
  if (raw.caption != null) {
    const s = String(raw.caption).trim();
    caption = s.length > 0 ? s : null;
  }

  const mediaType =
    typeof raw.mediaType === "string" && raw.mediaType.trim()
      ? raw.mediaType.trim()
      : "IMAGE";

  const timestamp =
    typeof raw.timestamp === "string" && raw.timestamp.trim()
      ? raw.timestamp.trim()
      : new Date(0).toISOString();

  return { mediaUrl, caption, permalink, mediaType, timestamp };
}

export function normalizeInstagramPosts(input: unknown): InstagramPost[] {
  if (!Array.isArray(input)) return [];
  const out: InstagramPost[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = normalizeOne(item as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Loads Instagram posts from WP GraphQL. Returns [] if the client is not
 * configured, the request fails, or the list is missing/empty after normalization.
 */
export async function fetchNewsInstagramPosts(): Promise<InstagramPost[]> {
  if (!getGraphQLClient()) return [];
  try {
    const data = await requestGraphql<InstagramPostsQueryData>(
      INSTAGRAM_POSTS_QUERY,
    );
    return normalizeInstagramPosts(data.instagramPosts);
  } catch {
    return [];
  }
}
