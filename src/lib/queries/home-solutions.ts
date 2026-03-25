export type SolutionPostNode = {
  title?: string | null;
  uri?: string | null;
  featuredImage?: {
    node?: {
      sourceUrl?: string | null;
      altText?: string | null;
    } | null;
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
          }
        }
      }
    }
  }
`;
