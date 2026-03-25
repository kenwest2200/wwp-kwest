export type FeaturedProductNode = {
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  uri?: string | null;
  featuredImage?: {
    node?: {
      sourceUrl?: string | null;
      altText?: string | null;
    } | null;
  } | null;
};

export type HomeFeaturedData = {
  products?: {
    nodes: FeaturedProductNode[];
  } | null;
};

export const HOME_FEATURED_QUERY = /* GraphQL */ `
  query HomeFeaturedProducts {
    products(first: 6) {
      nodes {
        name
        slug
        uri
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
  }
`;
