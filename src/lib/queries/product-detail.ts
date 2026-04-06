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

export type ProductPageData = {
  product?: {
    databaseId?: number | null;
    slug?: string | null;
    /** WooGraphQL: product display name */
    name?: string | null;
    productSettings?: {
      productImagesGroup?: {
        productImagesMain?: ProductPageImageField;
        productImagesBrand?: ProductPageImageField;
      } | null;
      productSpecificationGroup?: {
        productSpecification?: string | null;
      } | null;
    } | null;
  } | null;
};

/**
 * Single product for PDP. Uses slug from the URL (`idType: SLUG`).
 * If your schema only supports `DATABASE_ID`, switch idType and pass id from JSON at build time.
 */
export const PRODUCT_PAGE_QUERY = /* GraphQL */ `
  query ProductPage($id: ID!) {
    product(id: $id, idType: SLUG) {
      databaseId
      slug
      name
      productSettings {
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
        productSpecificationGroup {
          productSpecification
        }
      }
    }
  }
`;
