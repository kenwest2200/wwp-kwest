export type ResourcePostNode = {
  title?: string | null;
  excerpt?: string | null;
  uri?: string | null;
  featuredImage?: {
    node?: {
      sourceUrl?: string | null;
      altText?: string | null;
    } | null;
  } | null;
};

export type HomeResourcesData = {
  posts?: {
    nodes: ResourcePostNode[];
  } | null;
};

export const HOME_RESOURCES_QUERY = /* GraphQL */ `
  query HomeResources {
    posts(first: 8, where: { categoryName: "resources" }) {
      nodes {
        title
        excerpt
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
