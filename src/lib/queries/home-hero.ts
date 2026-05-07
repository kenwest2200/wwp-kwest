/**
 * Home hero intro block from WPGraphQL page `uri: "/homepage-api"` (ACF Template_HomepageAPI).
 */
import type { WpResponsiveMediaNode } from "../picture-wp-media";

export type HomepageMediaNode = WpResponsiveMediaNode;

export type HomepageMediaField = {
  node?: HomepageMediaNode | null;
} | null;

export type HomepageButtonLink = {
  url?: string | null;
  title?: string | null;
  target?: string | null;
} | null;

export type HomepageApiSectionsIntroSectionLayout = {
  __typename?: string;
  title?: string | null;
  description?: string | null;
  image1?: HomepageMediaField;
  image2?: HomepageMediaField;
  image3?: HomepageMediaField;
  buttonLink?: HomepageButtonLink;
};

export type HomeHeroData = {
  nodeByUri?: {
    uri?: string | null;
    template?: {
      homepageApi?: {
        sections?:
          | (
              | HomepageApiSectionsIntroSectionLayout
              | { __typename?: string | null }
            )[]
          | null;
      } | null;
    } | null;
  } | null;
};

export const HOME_HERO_QUERY = /* GraphQL */ `
  query HomepageApi {
    nodeByUri(uri: "/homepage-api") {
      ... on Page {
        uri
        template {
          ... on Template_HomepageAPI {
            homepageApi {
              sections {
                __typename
                ... on HomepageApiSectionsIntroSectionLayout {
                  title
                  description
                  image1 {
                    node {
                      sourceUrl
                      medium_large: sourceUrl(size: MEDIUM_LARGE)
                      altText
                      mediaDetails {
                        width
                        height
                      }
                    }
                  }
                  image2 {
                    node {
                      sourceUrl
                      medium_large: sourceUrl(size: MEDIUM_LARGE)
                      altText
                      mediaDetails {
                        width
                        height
                      }
                    }
                  }
                  image3 {
                    node {
                      sourceUrl
                      medium_large: sourceUrl(size: MEDIUM_LARGE)
                      altText
                      mediaDetails {
                        width
                        height
                      }
                    }
                  }
                  buttonLink {
                    url
                    title
                    target
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
