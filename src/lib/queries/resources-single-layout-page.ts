/**
 * Shared GraphQL shape for WordPress “resources” pages that use the
 * Product resource — single layout block (product manuals, bulletins,
 * product support, etc.). Each route imports this query and passes its own URI.
 *
 * @example
 * ```graphql
 * query {
 *   page(id: "/resources/product-support/", idType: URI) {
 *     resources {
 *       sidebarSectionDescription
 *       productResources {
 *         ... on ResourcesProductResourcesProductResourceSingleLayout {
 *           resourceName
 *           resourceCharacteristics
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */

export const RESOURCES_SINGLE_LAYOUT_PAGE_QUERY = /* GraphQL */ `
  query ResourcesSingleLayoutPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      resources {
        sidebarSectionDescription
        productResources {
          ... on ResourcesProductResourcesProductResourceSingleLayout {
            resourceName
            resourceCharacteristics
          }
        }
      }
    }
  }
`;

export type ResourcesProductResourceSingleLayout = {
  __typename?: string | null;
  resourceName?: string | null;
  resourceCharacteristics?: string | null;
};

export type PageResourcesBlock = {
  sidebarSectionDescription?: string | null;
  productResources?:
    | ResourcesProductResourceSingleLayout
    | ResourcesProductResourceSingleLayout[]
    | null;
};

export type ResourcesSingleLayoutPageData = {
  page?: {
    title?: string | null;
    resources?: PageResourcesBlock | null;
  } | null;
};

export type ResourceSingleLayoutItem = {
  name: string;
  characteristicsHtml: string;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Normalizes `page.resources.productResources` into renderable rows. */
export function normalizeResourceSingleLayouts(
  resources: PageResourcesBlock | null | undefined,
): ResourceSingleLayoutItem[] {
  const raw = asArray(resources?.productResources);
  const out: ResourceSingleLayoutItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = (row.resourceName ?? "").trim();
    const characteristicsHtml = (row.resourceCharacteristics ?? "").trim();
    if (!name && !characteristicsHtml) continue;
    out.push({
      name: name || "Resource",
      characteristicsHtml,
    });
  }
  return out;
}

export function sidebarDescriptionHtml(
  resources: PageResourcesBlock | null | undefined,
): string {
  return (resources?.sidebarSectionDescription ?? "").trim();
}
