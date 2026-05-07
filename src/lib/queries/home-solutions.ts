import type { WpResponsiveMediaNode } from "../picture-wp-media";

export type SolutionPostNode = {
  title?: string | null;
  uri?: string | null;
  featuredImage?: {
    node?: WpResponsiveMediaNode | null;
  } | null;
};

export type HomeSolutionsData = {
  posts?: {
    nodes: SolutionPostNode[];
  } | null;
};

export const HOME_SOLUTIONS_QUERY = /* GraphQL */ `
  query HomeSolutions {
    posts(first: 6, where: { categoryName: "solutions" }) {
      nodes {
        title
        uri
        featuredImage {
          node {
            sourceUrl
            altText
            thumb: sourceUrl(size: THUMBNAIL)
            medium: sourceUrl(size: MEDIUM)
            medium_large: sourceUrl(size: MEDIUM_LARGE)
            large: sourceUrl(size: LARGE)
          }
        }
      }
    }
  }
`;
