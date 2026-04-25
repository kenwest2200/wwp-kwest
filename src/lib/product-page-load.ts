import { ClientError } from "graphql-request";
import { getGraphQLClient, requestGraphql } from "./graphql";
import {
  PRODUCT_PAGE_QUERY_BY_DATABASE_ID,
  PRODUCT_PAGE_QUERY_MINIMAL_BY_DATABASE_ID,
  PRODUCT_PAGE_QUERY_MINIMAL_SLUG,
  PRODUCT_PAGE_QUERY_SLUG,
  PRODUCT_PAGE_QUERY_URI,
  type ProductPageData,
} from "./queries/product-detail";

export async function tryLoadProduct(
  document: string,
  variables: Record<string, unknown>,
): Promise<ProductPageData["product"] | null> {
  try {
    const data = (await requestGraphql(
      document,
      variables,
    )) as ProductPageData;
    return data.product ?? null;
  } catch (e) {
    if (e instanceof ClientError) {
      const resp = e.response as {
        data?: ProductPageData;
        errors?: { message?: string }[];
      };
      const partial = resp.data?.product ?? null;
      if (partial) {
        if (import.meta.env.DEV && resp.errors?.length) {
          console.warn(
            "[product-page] GraphQL returned errors; using partial product data:",
            resp.errors
              .map((x) => x.message)
              .filter(Boolean)
              .join(" | "),
          );
        }
        return partial;
      }
      if (import.meta.env.DEV) {
        console.warn(
          "[product-page] GraphQL error:",
          resp.errors?.[0]?.message ?? e.message,
        );
      }
      return null;
    }
    if (import.meta.env.DEV) {
      console.warn("[product-page] GraphQL request failed:", e);
    }
    return null;
  }
}

/**
 * Same resolution order as `product/[slug].astro` (catalog DB id, slug, URI, minimal → full).
 */
export async function loadProductPageProduct(params: {
  slug: string;
  catalogDatabaseId: number | null;
}): Promise<ProductPageData["product"] | null> {
  const { slug, catalogDatabaseId: databaseIdFromCatalog } = params;
  if (!getGraphQLClient() || !slug) return null;

  let product: ProductPageData["product"] | null = null;
  const databaseIdsAlreadyTried = new Set<number>();

  if (databaseIdFromCatalog != null) {
    databaseIdsAlreadyTried.add(databaseIdFromCatalog);
    product = await tryLoadProduct(PRODUCT_PAGE_QUERY_BY_DATABASE_ID, {
      id: String(databaseIdFromCatalog),
    });
  }
  if (!product) {
    product = await tryLoadProduct(PRODUCT_PAGE_QUERY_SLUG, { id: slug });
  }
  if (!product) {
    for (const uri of [`/product/${slug}/`, `/product/${slug}`]) {
      product = await tryLoadProduct(PRODUCT_PAGE_QUERY_URI, { id: uri });
      if (product) break;
    }
  }
  if (!product) {
    let sparse = await tryLoadProduct(PRODUCT_PAGE_QUERY_MINIMAL_SLUG, {
      id: slug,
    });
    if (!sparse && databaseIdFromCatalog != null) {
      sparse = await tryLoadProduct(PRODUCT_PAGE_QUERY_MINIMAL_BY_DATABASE_ID, {
        id: String(databaseIdFromCatalog),
      });
    }
    const sparseId =
      typeof sparse?.databaseId === "number" && sparse.databaseId > 0
        ? sparse.databaseId
        : null;
    if (sparse && sparseId != null && !databaseIdsAlreadyTried.has(sparseId)) {
      databaseIdsAlreadyTried.add(sparseId);
      const fullByResolvedId = await tryLoadProduct(
        PRODUCT_PAGE_QUERY_BY_DATABASE_ID,
        { id: String(sparseId) },
      );
      product = fullByResolvedId ?? sparse;
    } else if (sparse) {
      product = sparse;
    }
  }

  return product;
}
