export type ProductPageMediaNode = {
  sourceUrl?: string | null;
  medium_large?: string | null;
  large?: string | null;
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
    .sort(
      (a, b) =>
        (Number.isFinite(a.w) ? a.w : 1e9) - (Number.isFinite(b.w) ? b.w : 1e9),
    );
  return sorted[0]?.url ?? full;
}

export type GalleryMediaNode = {
  databaseId?: number | null;
  sourceUrl?: string | null;
  medium?: string | null;
  medium_large?: string | null;
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

export type SingleTemplateOptionalCharactJson = {
  title?: string | null;
  content?: string | string[] | null;
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

/** WooCommerce product category term (breadcrumb chain via `parent`). */
export type ProductCategoryBreadcrumbNode = {
  name?: string | null;
  slug?: string | null;
  uri?: string | null;
  parent?: {
    node?: ProductCategoryBreadcrumbNode | null;
  } | null;
};

export type ProductPageData = {
  product?: {
    databaseId?: number | null;
    title?: string | null;
    slug?: string | null;
    uri?: string | null;
    productCategories?: {
      nodes?: (ProductCategoryBreadcrumbNode | null)[] | null;
    } | null;
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
      productCategories(first: 30) {
        nodes {
          name
          slug
          uri
          parent {
            node {
              name
              slug
              uri
              parent {
                node {
                  name
                  slug
                  uri
                  parent {
                    node {
                      name
                      slug
                      uri
                      parent {
                        node {
                          name
                          slug
                          uri
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      productSettings {
        fieldPageNumber
        productImagesGroup {
          productImagesMain {
            node {
              sourceUrl
              medium_large: sourceUrl(size: MEDIUM_LARGE)
              large: sourceUrl(size: LARGE)
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
                medium: sourceUrl(size: MEDIUM)
                medium_large: sourceUrl(size: MEDIUM_LARGE)
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

function charactBulletFromEntry(x: unknown): string | null {
  if (typeof x === "string") {
    const line = x.trim();
    return line || null;
  }
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const t = (x as Record<string, unknown>).text;
    if (typeof t === "string" && t.trim()) return t.trim();
    const l = (x as Record<string, unknown>).line;
    if (typeof l === "string" && l.trim()) return l.trim();
  }
  return null;
}

export function parseSingleTemplateOptionalCharact(
  raw: string | null | undefined,
): { title?: string; bullets: string[] } | null {
  try {
    if (raw == null) return null;

    let obj: unknown = raw;

    if (typeof raw === "string") {
      let t = raw.trim();
      if (!t) return null;
      obj = JSON.parse(t) as unknown;
      if (typeof obj === "string") {
        const inner = obj.trim();
        if (!inner.startsWith("{")) return null;
        obj = JSON.parse(inner) as unknown;
      }
    }

    if (Array.isArray(obj)) {
      const first = obj.find(
        (x) => x && typeof x === "object" && !Array.isArray(x),
      );
      if (!first) return null;
      obj = first;
    }

    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const o = obj as Record<string, unknown>;

    const titleRaw = o.title;
    const title =
      typeof titleRaw === "string"
        ? titleRaw.replace(/\r\n/g, "\n").trim() || undefined
        : undefined;

    const bullets: string[] = [];
    const pushLines = (arr: unknown[]) => {
      for (const x of arr) {
        const line = charactBulletFromEntry(x);
        if (line) bullets.push(line);
      }
    };

    const c = o.content;
    if (Array.isArray(c)) {
      pushLines(c);
    } else if (typeof c === "string") {
      const s = c.trim();
      if (!s) {
        /* empty */
      } else if (s.startsWith("[")) {
        try {
          const arr = JSON.parse(s) as unknown;
          if (Array.isArray(arr)) pushLines(arr);
          else {
            const line = charactBulletFromEntry(arr);
            if (line) bullets.push(line);
          }
        } catch {
          bullets.push(s);
        }
      } else {
        bullets.push(s);
      }
    }

    if (!title && bullets.length === 0) return null;
    return { title, bullets };
  } catch {
    return null;
  }
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
    .map((value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ""),
    )
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
