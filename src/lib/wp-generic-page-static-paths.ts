import { ClientError } from "graphql-request";
import { getGraphQLClient, requestGraphql } from "./graphql";
import {
  WP_GENERIC_PAGES_QUERY,
  WP_GENERIC_PAGES_QUERY_NO_WHERE,
  type WpGenericPagePathProps,
  type WpGenericPagesBatch,
} from "./queries/wp-generic-page";

const PAGE_BATCH = 80;

/** Paths already implemented as dedicated Astro routes — do not catch-all these. */
const RESERVED_PATHS = new Set([
  "/",
  "/products",
  "/search",
  "/404",
  "/resources/faq",
  "/resources",
  "/resources/instructional-videos",
  "/resources/product-support",
  "/resources/sales-representatives",
  "/resources/catalog-choices",
  "/distributor-locator",
  "/help",
  "/support",
  "/company",
  "/for-homeowners",
  "/contact",
  "/news",
]);

function normalizeMatchPath(uri: string): string {
  const t = uri.trim();
  if (!t) return "/";
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  const noTrail = withSlash.replace(/\/+$/, "");
  return noTrail === "" ? "/" : noTrail;
}

function uriToSlugParam(uri: string): string | null {
  const norm = normalizeMatchPath(uri);
  if (norm === "/") return null;
  return norm.replace(/^\/+/, "");
}

function isReservedWpUri(uri: string): boolean {
  const key = normalizeMatchPath(uri);
  if (key === "/") return true;
  if (RESERVED_PATHS.has(key)) return true;
  if (key === "/news" || key.startsWith("/news/")) return true;
  if (key === "/product" || key.startsWith("/product/")) return true;
  return false;
}

async function fetchAllGenericPageNodes(): Promise<
  NonNullable<NonNullable<WpGenericPagesBatch["pages"]>["nodes"]>
> {
  const client = getGraphQLClient();
  if (!client) return [];

  let document: string = WP_GENERIC_PAGES_QUERY;
  try {
    await requestGraphql<WpGenericPagesBatch>(WP_GENERIC_PAGES_QUERY, {
      first: 1,
      after: null,
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(
        "[wp-generic-pages] publish filter not supported; listing all pages:",
        e instanceof ClientError ? e.message : e,
      );
    }
    document = WP_GENERIC_PAGES_QUERY_NO_WHERE;
  }

  const out: NonNullable<WpGenericPagesBatch["pages"]>["nodes"] = [];
  let after: string | null = null;
  let guard = 0;

  while (guard++ < 500) {
    let batch: WpGenericPagesBatch;
    try {
      batch = await requestGraphql<WpGenericPagesBatch>(document, {
        first: PAGE_BATCH,
        after,
      });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[wp-generic-pages] list query failed:", e);
      }
      break;
    }

    const conn = batch.pages;
    const nodes = conn?.nodes ?? [];
    for (const n of nodes) {
      if (n) out.push(n);
    }
    if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }

  return out.filter(Boolean) as NonNullable<
    NonNullable<WpGenericPagesBatch["pages"]>["nodes"]
  >;
}

export async function getStaticPaths(): Promise<
  { params: { slug: string }; props: WpGenericPagePathProps }[]
> {
  const nodes = await fetchAllGenericPageNodes();
  const seenSlug = new Set<string>();
  const paths: { params: { slug: string }; props: WpGenericPagePathProps }[] =
    [];

  for (const node of nodes) {
    if (!node) continue;
    const uri = typeof node.uri === "string" ? node.uri.trim() : "";
    if (!uri || isReservedWpUri(uri)) continue;
    const slug = uriToSlugParam(uri);
    if (!slug || seenSlug.has(slug)) continue;
    const title = typeof node.title === "string" ? node.title.trim() : "";
    if (!title) continue;
    seenSlug.add(slug);
    paths.push({
      params: { slug },
      props: {
        wpUri: uri,
        pageTitle: title,
        contentHtml: typeof node.content === "string" ? node.content : "",
      },
    });
  }

  return paths;
}
