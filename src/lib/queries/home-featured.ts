/**
 * Featured products block from WPGraphQL page `uri: "/homepage-api"`
 * (ACF Template_HomepageAPI → homepageApi.sections).
 */

export type HomepageFeaturedProduct = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  productUrl?: string | null;
};

export type HomepageApiSectionsFeaturedProductsLayout = {
  __typename?: string | null;
  title?: string | null;
  featuredProducts?: HomepageFeaturedProduct[] | null;
};

export type HomeFeaturedData = {
  nodeByUri?: {
    uri?: string | null;
    template?: {
      homepageApi?: {
        sections?:
          | (
              | HomepageApiSectionsFeaturedProductsLayout
              | { __typename?: string | null }
            )[]
          | null;
      } | null;
    } | null;
  } | null;
};

const FEATURED_SECTION_TYPENAME = "HomepageApiSectionsFeaturedProductsLayout";

export function getFeaturedProductsSection(data: HomeFeaturedData | null): {
  sectionTitle: string | null;
  products: HomepageFeaturedProduct[];
} {
  const sections = data?.nodeByUri?.template?.homepageApi?.sections;
  if (!sections?.length) {
    return { sectionTitle: null, products: [] };
  }

  for (const section of sections) {
    if (
      section &&
      section.__typename === FEATURED_SECTION_TYPENAME &&
      "featuredProducts" in section
    ) {
      const layout = section as HomepageApiSectionsFeaturedProductsLayout;
      return {
        sectionTitle: layout.title ?? null,
        products: layout.featuredProducts?.filter(Boolean) ?? [],
      };
    }
  }

  return { sectionTitle: null, products: [] };
}

export const HOME_FEATURED_QUERY = /* GraphQL */ `
  query HomeFeaturedFromHomepageApi {
    nodeByUri(uri: "/homepage-api") {
      ... on Page {
        uri
        template {
          ... on Template_HomepageAPI {
            homepageApi {
              sections {
                __typename
                ... on HomepageApiSectionsFeaturedProductsLayout {
                  title
                  featuredProducts {
                    title
                    description
                    image
                    productUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
