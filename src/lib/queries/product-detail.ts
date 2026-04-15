export type ProductPageMediaNode = {
  sourceUrl?: string | null;
  altText?: string | null;
  /** Media library title (WP attachment title), shown as caption when needed */
  title?: string | null;
  mediaDetails?: {
    width?: number | null;
    height?: number | null;
  } | null;
} | null;

export type ProductPageImageField = {
  node?: ProductPageMediaNode;
} | null;

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

const WP_THUMB_SIZE_ORDER = [
  "thumbnail",
  "woocommerce_thumbnail",
  "shop_thumbnail",
  "medium",
  "medium_large",
  "large",
] as const;

export type WPMediaSizeRow = {
  name?: string | null;
  sourceUrl?: string | null;
  width?: number | null;
};

export type WPMediaNodeWithSizes = {
  sourceUrl?: string | null;
  mediaDetails?: {
    sizes?: (WPMediaSizeRow | null)[] | null;
  } | null;
};


export function wpPreferredThumbSrc(
  node: WPMediaNodeWithSizes | null | undefined,
): string {
  const full = node?.sourceUrl?.trim() ?? "";
  if (!full) return "";
  const sizes = node?.mediaDetails?.sizes;
  if (!Array.isArray(sizes) || sizes.length === 0) return full;

  const byName = new Map<string, string>();
  for (const s of sizes) {
    const name = String(s?.name ?? "").toLowerCase();
    const url = s?.sourceUrl?.trim();
    if (name && url) byName.set(name, url);
  }
  for (const key of WP_THUMB_SIZE_ORDER) {
    const hit = byName.get(key);
    if (hit) return hit;
  }

  const sorted = sizes
    .filter((s): s is WPMediaSizeRow & { sourceUrl: string } =>
      Boolean(s?.sourceUrl?.trim()),
    )
    .map((s) => ({
      url: s.sourceUrl!.trim(),
      w: Number(s.width),
    }))
    .sort((a, b) => (Number.isFinite(a.w) ? a.w : 1e9) - (Number.isFinite(b.w) ? b.w : 1e9));
  return sorted[0]?.url ?? full;
}

export type GalleryMediaNode = {
  databaseId?: number | null;
  sourceUrl?: string | null;
  altText?: string | null;
  title?: string | null;
  mediaDetails?: {
    sizes?: (WPMediaSizeRow | null)[] | null;
  } | null;
};

export type ProductListContentRow = {
  singleTemplateOptionalProductListItemImage?: {
    node?: {
      databaseId?: number | null;
      sourceUrl?: string | null;
      title?: string | null;
      mediaDetails?: {
        width?: number | null;
        height?: number | null;
        sizes?: (WPMediaSizeRow | null)[] | null;
      } | null;
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
        productSupportLinks?: ProductSupportLinksField;
      } | null;
      productSpecificationGroup?: {
        productSpecification?: string | null;
      } | null;
      productRelatedPartsGroup?: {
        /** ACF / WYSIWYG HTML */
        relatedParts?: string | null;
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
              title
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
              title
              mediaDetails {
                width
                height
              }
            }
          }
        }
        productSupportGroup {
          productSupportLinks {
            productSupportLink {
              title
              url
              target
            }
          }
        }
        productSpecificationGroup {
          productSpecification
        }
        productRelatedPartsGroup {
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
                title
                mediaDetails {
                  sizes {
                    name
                    sourceUrl
                    width
                  }
                }
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
                  title
                  mediaDetails {
                    sizes {
                      name
                      sourceUrl
                      width
                    }
                  }
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

export const PRODUCT_PAGE_QUERY_URI = /* GraphQL */ `
  query ProductPageByUri($id: ID!) {
    product(id: $id, idType: URI) {
${PRODUCT_PAGE_FIELDS}
    }
  }
`;

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

export function relatedPartsHtmlFromApi(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
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

/** Same normalization as optional template blocks (e.g. `gallery` select). */
export function singleTemplateOptionalNormalizedSelectValues(
  item: SingleTemplateOptionalItem,
): string[] {
  const selectRaw = item.singleTemplateOptionalSelect;
  return (Array.isArray(selectRaw) ? selectRaw : [selectRaw])
    .filter((v): v is string => typeof v === "string")
    .map((value) => value.trim().toLowerCase().replace(/[\s_-]+/g, ""))
    .filter(Boolean);
}

export function singleTemplateOptionalShowsGallery(
  item: SingleTemplateOptionalItem,
): boolean {
  return singleTemplateOptionalNormalizedSelectValues(item).includes("gallery");
}

export function singleTemplateOptionalGalleryUrlCount(
  item: SingleTemplateOptionalItem,
): number {
  const nodes = item.singleTemplateOptionalGallery?.nodes ?? [];
  return nodes.filter((n) => Boolean(n?.sourceUrl?.trim())).length;
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
