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

/** ACF select on homepage intro: how each hero image fills its frame. */
export type HeroImageObjectFit = "cover" | "contain";

export type HomepageApiSectionsIntroSectionLayout = {
  __typename?: string;
  title?: string | null;
  description?: string | null;
  image1?: HomepageMediaField;
  image2?: HomepageMediaField;
  image3?: HomepageMediaField;
  /** WPGraphQL / ACF select (string or `{ value, label }`). */
  image1Fit?: HeroImageFitField;
  image2Fit?: HeroImageFitField;
  image3Fit?: HeroImageFitField;
  buttonLink?: HomepageButtonLink;
};

type HeroImageFitField =
  | string
  | { value?: string | null; label?: string | null }
  | null
  | undefined;

function heroImageFitToString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw).trim();
  }
  if (Array.isArray(raw)) {
    return heroImageFitToString(raw[0]);
  }
  if (typeof raw === "object") {
    const o = raw as { value?: unknown; label?: unknown };
    if (typeof o.value === "string") return o.value.trim();
    if (typeof o.label === "string") return o.label.trim();
  }
  return "";
}

export function normalizeHeroImageObjectFit(raw: unknown): HeroImageObjectFit {
  const v = heroImageFitToString(raw).toLowerCase();
  if (v === "contain") return "contain";
  return "cover";
}

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
                  image1Fit
                  image2Fit
                  image3Fit
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
