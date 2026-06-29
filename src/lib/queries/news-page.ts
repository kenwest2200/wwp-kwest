import { decodeHtmlEntities } from "../decode-html-entities";
import { getGraphQLClient, requestGraphql } from "../graphql";

export const NEWS_PAGE_URI = "/news/";

export const NEWS_PAGE_LINKS_QUERY = /* GraphQL */ `
  query NewsPageLinks($id: ID!) {
    page(id: $id, idType: URI) {
      databaseId
      title
      catlistPosts {
        databaseId
        title
        slug
        uri
        date
      }
    }
  }
`;

export type NewsPostRaw = {
  databaseId?: number | null;
  title?: string | null;
  slug?: string | null;
  uri?: string | null;
  date?: string | null;
};

export type NewsPageData = {
  page?: {
    databaseId?: number | null;
    title?: string | null;
    catlistPosts?: NewsPostRaw[] | NewsPostRaw | null;
  } | null;
};

export type NewsPost = {
  databaseId: number | null;
  titleHtml: string;
  slug: string | null;
  /** WordPress canonical URI from API (may be /YYYY/MM/slug/). */
  uri: string;
  /** Astro route used in the static site. */
  href: string;
  date: string | null;
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

export function postHref(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, "");
  return `/${path}`;
}

export function newsSlugFromPost(post: {
  slug?: string | null;
  uri?: string | null;
}): string | null {
  const slug = text(post.slug);
  if (slug) return slug;

  const href = text(post.uri).replace(/^\/+/, "").replace(/\/+$/, "");
  const newsMatch = href.match(/^news\/(.+)$/i);
  if (newsMatch?.[1]?.trim()) return newsMatch[1].trim();

  const segments = href.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last || null;
}

export function newsPostHref(post: {
  slug?: string | null;
  uri?: string | null;
}): string | null {
  const slug = newsSlugFromPost(post);
  return slug ? `/news/${slug}/` : null;
}

function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeNewsPosts(
  input: NewsPostRaw[] | NewsPostRaw | null | undefined,
): NewsPost[] {
  const out: NewsPost[] = [];
  for (const row of asArray(input)) {
    const titleHtml = decodeHtmlEntities(text(row?.title));
    const uri = text(row?.uri);
    if (!visibleText(titleHtml) || !uri) continue;
    const databaseId =
      typeof row?.databaseId === "number" && Number.isFinite(row.databaseId)
        ? row.databaseId
        : null;
    const slug = text(row?.slug) || null;
    const wpUri = postHref(uri);
    const href = newsPostHref({ slug, uri: wpUri });
    if (!href) continue;
    const dateRaw = text(row?.date);
    out.push({
      databaseId,
      titleHtml,
      slug,
      uri: wpUri,
      href,
      date: dateRaw || null,
    });
  }
  return out;
}

export async function fetchNewsPage(): Promise<{
  title: string;
  posts: NewsPost[];
} | null> {
  if (!getGraphQLClient()) return null;

  const uris = [NEWS_PAGE_URI, NEWS_PAGE_URI.replace(/\/$/, "")];
  for (const id of uris) {
    try {
      const data = await requestGraphql<NewsPageData>(NEWS_PAGE_LINKS_QUERY, {
        id,
      });
      const page = data.page;
      if (!page?.title?.trim()) continue;
      return {
        title: decodeHtmlEntities(page.title.trim()),
        posts: normalizeNewsPosts(page.catlistPosts),
      };
    } catch {
      /* try next */
    }
  }
  return null;
}
