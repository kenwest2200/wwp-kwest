import type { APIRoute } from "astro";
import { getGraphQLClient, requestGraphql } from "../../lib/graphql";
import {
  DEMO_ALL_PRODUCTS_QUERY,
  DEMO_PRODUCT_CATEGORIES_QUERY,
  DEMO_PRODUCT_ATTRIBUTES_QUERY,
  DEMO_PRODUCTS_FROM_CATEGORIES_QUERY,
  DEMO_PRODUCTS_BY_ATTRIBUTES_QUERY,
  type DemoAllProductsData,
  type DemoProductCategoriesData,
  type DemoProductAttributesData,
  type DemoProductsFromCategoriesData,
  type DemoProductsByAttributesData,
  type ProductCategoryNode,
} from "../../lib/queries/demo-filters";

export const prerender = false;

type DemoSubcategory = { name: string; slug: string };
type DemoRootCategory = {
  name: string;
  slug: string;
  subcategories: DemoSubcategory[];
};

type DemoProductType = { name: string; slug: string };

function splitAttributesForDemo(attributes: { name: string; slug: string }[]): {
  productTypes: DemoProductType[];
} {
  const safe = attributes.filter((a) => a.slug && a.name);
  const typesRaw = safe.slice(9, 12);

  const productTypes = typesRaw.map((t) => ({
    name: t.name,
    slug: `type-${t.slug}`,
  }));

  return { productTypes };
}

function categoriesToDemoRoots(
  categories: ProductCategoryNode[],
): DemoRootCategory[] {
  const dedup = new Map<string, ProductCategoryNode>();
  categories.forEach((cat) => {
    if (!cat.slug) return;
    if (!dedup.has(cat.slug)) dedup.set(cat.slug, cat);
  });
  return Array.from(dedup.values()).map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    subcategories: (cat.children?.nodes ?? [])
      .filter((sub) => Boolean(sub.slug && sub.name))
      .map((sub) => ({
        name: sub.name,
        slug: sub.slug,
      })),
  }));
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function fallbackAllProducts(
  limit: number,
  offset: number,
  categorySlugs: string[] = [],
) {
  const normalizedCategorySlugs = Array.from(
    new Set(categorySlugs.filter((slug) => Boolean(slug))),
  );

  if (normalizedCategorySlugs.length > 0) {
    try {
      const byCategories = await requestGraphql<DemoProductsFromCategoriesData>(
        DEMO_PRODUCTS_FROM_CATEGORIES_QUERY,
      );
      const categories = byCategories.productCategories?.nodes ?? [];
      const wanted = new Set(normalizedCategorySlugs);
      const matched = categories.filter((cat) => wanted.has(cat.slug));

      const dedup = new Map<string, { title: string; slug: string }>();
      matched.forEach((cat) => {
        (cat.products?.nodes ?? []).forEach((item) => {
          if (!item.slug) return;
          if (!dedup.has(item.slug)) {
            dedup.set(item.slug, { title: item.title, slug: item.slug });
          }
        });
      });

      const items = Array.from(dedup.values());
      const paged = items.slice(offset, offset + limit);
      return {
        total: items.length,
        items: paged,
      };
    } catch {
      // fallback to product-based filtering below
    }
  }

  const first = 5000;
  const allData = await requestGraphql<DemoAllProductsData>(DEMO_ALL_PRODUCTS_QUERY, {
    first,
  });
  const allItems = allData.products?.nodes ?? [];

  const filteredItems =
    normalizedCategorySlugs.length === 0
      ? allItems
      : allItems.filter((item) => {
          const itemCategorySlugs = new Set(
            (item.productCategories?.nodes ?? [])
              .map((node) => node.slug)
              .filter((slug) => Boolean(slug)),
          );
          return normalizedCategorySlugs.some((slug) => itemCategorySlugs.has(slug));
        });

  const paged = filteredItems.slice(offset, offset + limit);
  return {
    total: filteredItems.length,
    items: paged.map((item) => ({ title: item.title, slug: item.slug })),
  };
}

export const GET: APIRoute = async () => {
  if (!getGraphQLClient()) {
    return json({
      ok: false,
      error: "PUBLIC_GRAPHQL_URL не задан",
      attributes: [],
    });
  }

  try {
    const [attributesData, categoriesData] = await Promise.all([
      requestGraphql<DemoProductAttributesData>(DEMO_PRODUCT_ATTRIBUTES_QUERY),
      requestGraphql<DemoProductCategoriesData>(DEMO_PRODUCT_CATEGORIES_QUERY),
    ]);
    const attributes = attributesData.productAttributes?.nodes ?? [];
    const { productTypes } = splitAttributesForDemo(attributes);
    const rootCategories = categoriesToDemoRoots(
      categoriesData.productCategories?.nodes ?? [],
    );
    return json({
      ok: true,
      attributes,
      rootCategories,
      productTypes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message, attributes: [] }, { status: 502 });
  }
};

type PostBody = {
  filters?: unknown;
  rootCategory?: unknown;
  subcategories?: unknown;
  productTypes?: unknown;
  attributes?: unknown;
  limit?: unknown;
  offset?: unknown;
};

export const POST: APIRoute = async ({ request }) => {
  if (!getGraphQLClient()) {
    return json(
      { ok: false, error: "PUBLIC_GRAPHQL_URL не задан", total: 0, items: [] },
      { status: 503 },
    );
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const baseFilters = Array.isArray(body.filters)
    ? body.filters.filter(
        (f): f is string => typeof f === "string" && f.length > 0,
      )
    : [];

  const rootCategory =
    typeof body.rootCategory === "string" && body.rootCategory.length > 0
      ? body.rootCategory
      : "";
  const subcategories = Array.isArray(body.subcategories)
    ? body.subcategories.filter(
        (f): f is string => typeof f === "string" && f.length > 0,
      )
    : [];
  const productTypes = Array.isArray(body.productTypes)
    ? body.productTypes.filter(
        (f): f is string => typeof f === "string" && f.length > 0,
      )
    : [];
  const attributes = Array.isArray(body.attributes)
    ? body.attributes.filter(
        (f): f is string => typeof f === "string" && f.length > 0,
      )
    : [];

  const filters = Array.from(
    new Set([
      ...baseFilters,
      ...subcategories,
      ...productTypes,
      ...attributes,
    ]),
  );

  const limit = Math.min(100, Math.max(1, Number(body.limit) || 10));
  const offset = Math.max(0, Number(body.offset) || 0);

  try {
    const variables: {
      filters?: string[];
      limit: number;
      offset: number;
    } = { limit, offset };
    if (filters.length > 0) {
      variables.filters = filters;
    }

    const data = await requestGraphql<DemoProductsByAttributesData>(
      DEMO_PRODUCTS_BY_ATTRIBUTES_QUERY,
      variables,
    );
    let block = data.productsByAttributes;

    // Fallback for schemas where resolver does not support current filters.
    if ((block?.total ?? 0) === 0) {
      const fallbackCategorySlugs = [...subcategories, ...(rootCategory ? [rootCategory] : [])];
      const fallback = await fallbackAllProducts(limit, offset, fallbackCategorySlugs);
      return json({
        ok: true,
        total: fallback.total,
        items: fallback.items,
        applied: {
          rootCategory,
          subcategories,
          productTypes,
          attributes,
          mergedFilters: filters,
          mode: "all-products-fallback-by-categories",
        },
        limit,
        offset,
      });
    }

    return json({
      ok: true,
      total: block?.total ?? 0,
      items: block?.items ?? [],
      applied: {
        rootCategory,
        subcategories,
        productTypes,
        attributes,
        mergedFilters: filters,
      },
      limit,
      offset,
    });
  } catch (e) {
    if (filters.length === 0 || subcategories.length > 0 || Boolean(rootCategory)) {
      try {
        const fallbackCategorySlugs = [...subcategories, ...(rootCategory ? [rootCategory] : [])];
        const fallback = await fallbackAllProducts(limit, offset, fallbackCategorySlugs);
        return json({
          ok: true,
          total: fallback.total,
          items: fallback.items,
          applied: {
            rootCategory,
            subcategories,
            productTypes,
            attributes,
            mergedFilters: filters,
            mode: "all-products-fallback-on-error-by-categories",
          },
          limit,
          offset,
        });
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        return json(
          { ok: false, error: message, total: 0, items: [] },
          { status: 502 },
        );
      }
    }

    const message = e instanceof Error ? e.message : String(e);
    return json(
      { ok: false, error: message, total: 0, items: [] },
      { status: 502 },
    );
  }
};
