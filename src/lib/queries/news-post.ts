import { decodeHtmlEntities } from "../decode-html-entities";
import { getGraphQLClient, requestGraphql } from "../graphql";
import { fetchNewsPage, newsPostHref, newsSlugFromPost, type NewsPost } from "./news-page";

export const NEWS_POST_QUERY = /* GraphQL */ `
  query NewsPost($id: ID!, $idType: PostIdType!) {
    post(id: $id, idType: $idType) {
      databaseId
      title
      excerpt
      content
      date
      uri
      slug
    }
  }
`;

export type NewsPostRaw = {
  databaseId?: number | null;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  date?: string | null;
  uri?: string | null;
  slug?: string | null;
};

export type NewsPostQueryData = {
  post?: NewsPostRaw | null;
};

export type NewsPostSingle = {
  databaseId: number | null;
  titleHtml: string;
  excerptHtml: string;
  contentHtml: string;
  date: string | null;
  uri: string;
  slug: string | null;
  href: string;
};

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

export function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function postHref(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, "");
  return `/${path}`;
}

export { newsPostHref, newsSlugFromPost } from "./news-page";

function normalizeNewsPostSingle(raw: NewsPostRaw | null | undefined): NewsPostSingle | null {
  if (!raw) return null;

  const titleHtml = decodeHtmlEntities(text(raw.title));
  const contentHtml = (raw.content ?? "").trim();
  const excerptHtml = (raw.excerpt ?? "").trim();
  const uri = text(raw.uri);

  if (!visibleText(titleHtml) || !uri) return null;

  const databaseId =
    typeof raw.databaseId === "number" && Number.isFinite(raw.databaseId)
      ? raw.databaseId
      : null;
  const slug = text(raw.slug) || null;
  const wpUri = postHref(uri);
  const href = newsPostHref({ slug, uri: wpUri });
  if (!href) return null;

  return {
    databaseId,
    titleHtml,
    excerptHtml: decodeHtmlEntities(excerptHtml),
    contentHtml,
    date: text(raw.date) || null,
    uri: wpUri,
    slug,
    href,
  };
}

async function requestNewsPost(
  id: string,
  idType: "DATABASE_ID" | "URI" | "SLUG",
): Promise<NewsPostSingle | null> {
  try {
    const data = await requestGraphql<NewsPostQueryData>(NEWS_POST_QUERY, {
      id,
      idType,
    });
    return normalizeNewsPostSingle(data.post);
  } catch {
    return null;
  }
}

export async function fetchNewsPostByListItem(
  item: NewsPost,
): Promise<NewsPostSingle | null> {
  if (!getGraphQLClient()) return null;

  if (item.databaseId != null) {
    const byId = await requestNewsPost(String(item.databaseId), "DATABASE_ID");
    if (byId) return byId;
  }

  const uriCandidates = new Set<string>();
  const rawUri = item.uri.replace(/^\//, "");
  if (rawUri) {
    uriCandidates.add(`/${rawUri}`);
    uriCandidates.add(`/${rawUri.replace(/\/+$/, "")}/`);
    uriCandidates.add(`/${rawUri.replace(/\/+$/, "")}`);
  }
  if (item.slug) {
    uriCandidates.add(`/news/${item.slug}/`);
    uriCandidates.add(`/news/${item.slug}`);
  }

  for (const uri of uriCandidates) {
    const byUri = await requestNewsPost(uri, "URI");
    if (byUri) return byUri;
  }

  if (item.slug) {
    const bySlug = await requestNewsPost(item.slug, "SLUG");
    if (bySlug) return bySlug;
  }

  return null;
}

export async function fetchAllNewsPostsForBuild(): Promise<NewsPostSingle[]> {
  const pageData = await fetchNewsPage();
  if (!pageData) return [];

  const out: NewsPostSingle[] = [];
  const seenSlug = new Set<string>();

  for (const item of pageData.posts) {
    const slug = newsSlugFromPost(item);
    if (!slug || seenSlug.has(slug)) continue;

    const post = await fetchNewsPostByListItem(item);
    if (!post) continue;

    seenSlug.add(slug);
    out.push({ ...post, href: item.href });
  }

  return out;
}
