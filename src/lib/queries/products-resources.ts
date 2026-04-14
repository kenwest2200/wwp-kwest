export type ProductsResourcesItem = {
  title?: string | null;
  description?: string | null;
  icon?: {
    node?: {
      sourceUrl?: string | null;
      altText?: string | null;
    } | null;
  } | null;
  link?: {
    url?: string | null;
    title?: string | null;
    target?: string | null;
  } | null;
};

export type ProductsResourcesData = {
  generalSettings?: {
    siteSettings?: {
      siteSettingsSectionsResources?: {
        title?: string | null;
        repeater?: ProductsResourcesItem[] | null;
      } | null;
    } | null;
  } | null;
};

export const PRODUCTS_RESOURCES_QUERY = /* GraphQL */ `
  query ProductsResources {
    generalSettings {
      siteSettings {
        siteSettingsSectionsResources {
          title
          repeater {
            title
            description
            icon {
              node {
                sourceUrl
                altText
              }
            }
            link {
              url
              title
              target
            }
          }
        }
      }
    }
  }
`;
