/**
 * Home hero from WPGraphQL `nodeByUri` (front page as Page).
 * Change `uri` or fields to match your schema (ACF, blocks, etc.).
 */
export type HomeHeroImage = {
  images: {
    nodes: {
      title: string;
      url: string;
    }[];
  };
};

export type HomeHeroPage = {
  title?: string | null;
  excerpt?: string | null;
  uri?: string | null;
  images?: { node: HomeHeroImage | null } | null;
  listImages?: HomeHeroImage | null;
  ctaDownloadUrl?: string | null;
};

export type HomeHeroData = {
  nodeByUri?: HomeHeroPage | null;
};

export const HOME_HERO_QUERY = /* GraphQL */ `
  query HomeHero {
    nodeByUri(uri: "/") {
      ... on Page {
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
