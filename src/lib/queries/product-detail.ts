export type ProductPageMediaNode = {
  sourceUrl?: string | null;
  altText?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
} | null;

export type ProductPageImageField = {
  node?: ProductPageMediaNode;
} | null;

export type RelatedProductNode = {
  databaseId?: number | null;
  title?: string | null;
  uri?: string | null;
};

export type ProductSupportLink = {
  title?: string | null;
  url?: string | null;
  target?: string | null;
};

export type ProductSupportLinkRow = {
  productSupportLink?: ProductSupportLink | ProductSupportLink[] | null;
};

export type ProductSupportLinksField =
  | ProductSupportLinkRow
  | ProductSupportLinkRow[]
  | null;

export type GalleryMediaNode = {
  databaseId?: number | null;
  sourceUrl?: string | null;
  altText?: string | null;
};

export type ProductListContentRow = {
  singleTemplateOptionalProductListItemImage?: {
    node?: {
      databaseId?: number | null;
      sourceUrl?: string | null;
    } | null;
  } | null;
  singleTemplateOptionalProductListItemTable?: string | null;
};

export type SingleTemplateOptionalItem = {
  singleTemplateOptionalSelect?: string | string[] | null;
  singleTemplateOptionalDesc?: string | null;
  singleTemplateOptionalDescHtml?: string | null;
  singleTemplateOptionalCharact?: string | null;
  singleTemplateOptionalGallery?: {
    nodes?: (GalleryMediaNode | null)[] | null;
  } | null;
  singleTemplateOptionalTableTitle?: string | null;
  singleTemplateOptionalTable?: string | null;
  singleTemplateOptionalProductListTitle?: string | null;
  singleTemplateOptionalProductListSubtitle?: string | null;
  singleTemplateOptionalProductListRowLabel?: string | null;
  singleTemplateOptionalProductListContent?:
    | ProductListContentRow[]
    | ProductListContentRow
    | null;
};

export type ProductPageData = {
  product?: {
    databaseId?: number | null;
    title?: string | null;
    slug?: string | null;
    uri?: string | null;
    productSettings?: {
      fieldPageNumber?: string | null;
      productImagesGroup?: {
        productImagesMain?: ProductPageImageField;
        productImagesBrand?: ProductPageImageField;
      } | null;
      productSupportGroup?: {
        productSupportTitle?: string | null;
        productSupportLinks?: ProductSupportLinksField;
      } | null;
      productSpecificationGroup?: {
        productSpecificationTitle?: string | null;
        productSpecification?: string | null;
      } | null;
      productRelatedPartsGroup?: {
        relatedPartsTitle?: string | null;
        /** Scalar / JSON / list — shape varies; use `normalizeRelatedParts`. */
        relatedParts?: unknown;
      } | null;
      singleTemplateGroup?: {
        singleTemplateOptional?:
          | SingleTemplateOptionalItem[]
          | SingleTemplateOptionalItem
          | null;
      } | null;
    } | null;
  } | null;
};

const PRODUCT_PAGE_FIELDS = /* GraphQL */ `
      databaseId
      title
      slug
      uri
      productSettings {
        fieldPageNumber
        productImagesGroup {
          productImagesMain {
            node {
              sourceUrl
              altText
              mediaDetails {
                width
                height
              }
            }
          }
          productImagesBrand {
            node {
              sourceUrl
              altText
              mediaDetails {
                width
                height
              }
            }
          }
        }
        productSupportGroup {
          productSupportTitle
          productSupportLinks {
            productSupportLink {
              title
              url
              target
            }
          }
        }
        productSpecificationGroup {
          productSpecificationTitle
          productSpecification
        }
        productRelatedPartsGroup {
          relatedPartsTitle
          relatedParts
        }
        singleTemplateGroup {
          singleTemplateOptional {
            singleTemplateOptionalSelect
            singleTemplateOptionalDesc
            singleTemplateOptionalDescHtml
            singleTemplateOptionalCharact
            singleTemplateOptionalGallery {
              nodes {
                databaseId
                sourceUrl
                altText
              }
            }
            singleTemplateOptionalTableTitle
            singleTemplateOptionalTable
            singleTemplateOptionalProductListTitle
            singleTemplateOptionalProductListSubtitle
            singleTemplateOptionalProductListRowLabel
            singleTemplateOptionalProductListContent {
              singleTemplateOptionalProductListItemImage {
                node {
                  databaseId
                  sourceUrl
                }
              }
              singleTemplateOptionalProductListItemTable
            }
          }
        }
      }
`;

export const PRODUCT_PAGE_QUERY_SLUG = /* GraphQL */ `
  query ProductPage($id: ID!) {
    product(id: $id, idType: SLUG) {
${PRODUCT_PAGE_FIELDS}
    }
  }
`;

export const PRODUCT_PAGE_QUERY_BY_DATABASE_ID = /* GraphQL */ `
  query ProductPageByDatabaseId($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
${PRODUCT_PAGE_FIELDS}
    }
  }
`;

/** Fallback when SLUG resolution differs from permalink path (e.g. `/product/foo/`). */
export const PRODUCT_PAGE_QUERY_URI = /* GraphQL */ `
  query ProductPageByUri($id: ID!) {
    product(id: $id, idType: URI) {
${PRODUCT_PAGE_FIELDS}
    }
  }
`;

/**
 * Few fields — survives when ACF / heavy `productSettings` resolvers error on the full query.
 */
export const PRODUCT_PAGE_QUERY_MINIMAL_SLUG = /* GraphQL */ `
  query ProductPageMinimalSlug($id: ID!) {
    product(id: $id, idType: SLUG) {
      databaseId
      title
      slug
      uri
    }
  }
`;

export const PRODUCT_PAGE_QUERY_MINIMAL_BY_DATABASE_ID = /* GraphQL */ `
  query ProductPageMinimalByDb($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      databaseId
      title
      slug
      uri
    }
  }
`;

function relatedNodeFromRecord(o: Record<string, unknown>): RelatedProductNode | null {
  const title = typeof o.title === "string" ? o.title : null;
  const uri = typeof o.uri === "string" ? o.uri : null;
  let databaseId: number | null = null;
  if (typeof o.databaseId === "number" && o.databaseId > 0) {
    databaseId = o.databaseId;
  } else if (typeof o.databaseId === "string" && /^\d+$/.test(o.databaseId.trim())) {
    const n = Number(o.databaseId.trim());
    if (Number.isFinite(n) && n > 0) databaseId = n;
  }
  if (!title?.trim() && !uri?.trim() && databaseId == null) return null;
  return { databaseId, title, uri };
}

/**
 * `relatedParts` used to be a Product connection (`nodes`); it may now be JSON, a list, or a scalar string.
 */
export function normalizeRelatedParts(raw: unknown): RelatedProductNode[] {
  if (raw == null) return [];

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    if ("nodes" in raw) {
      const nodes = (raw as { nodes?: unknown }).nodes;
      if (Array.isArray(nodes)) {
        return normalizeRelatedParts(nodes);
      }
      return [];
    }
    const single = relatedNodeFromRecord(raw as Record<string, unknown>);
    return single ? [single] : [];
  }

  if (Array.isArray(raw)) {
    const out: RelatedProductNode[] = [];
    for (const item of raw) {
      if (item != null && typeof item === "object") {
        const n = relatedNodeFromRecord(item as Record<string, unknown>);
        if (n) out.push(n);
      }
    }
    return out;
  }

  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      return normalizeRelatedParts(JSON.parse(t) as unknown);
    } catch {
      return [];
    }
  }

  return [];
}

export function normalizeSingleTemplateOptionalItems(
  raw:
    | SingleTemplateOptionalItem[]
    | SingleTemplateOptionalItem
    | null
    | undefined,
): SingleTemplateOptionalItem[] {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function linksFromRow(
  row: ProductSupportLinkRow | null | undefined,
): ProductSupportLink[] {
  const raw = row?.productSupportLink;
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter(Boolean) as ProductSupportLink[];
}

export function normalizeSupportLinks(
  links: ProductSupportLinksField | undefined,
): ProductSupportLink[] {
  if (links == null) return [];
  if (Array.isArray(links)) {
    return links.flatMap((row) => linksFromRow(row));
  }
  return linksFromRow(links);
}

export function normalizeProductListContent(
  raw:
    | SingleTemplateOptionalItem["singleTemplateOptionalProductListContent"]
    | undefined,
): ProductListContentRow[] {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}
