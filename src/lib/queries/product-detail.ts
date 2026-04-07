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
    title?: string | null;
    productRelatedParts?: {
      relatedParts?: {
        nodes?: (RelatedProductNode | null)[] | null;
      } | null;
    } | null;
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
        productSpecification?: string | null;
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
      title
      productRelatedParts {
        relatedParts {
          nodes {
            ... on Product {
              databaseId
              title
              uri
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
          productSpecification
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
