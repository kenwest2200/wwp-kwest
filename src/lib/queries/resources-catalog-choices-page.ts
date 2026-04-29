export const CATALOG_CHOICES_PAGE_URI = "/resources/catalog-choices/";

export const CATALOG_CHOICES_PAGE_QUERY = /* GraphQL */ `
  query CatalogChoicesPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      catalogsBrochuresSettings {
        catalogsGroup {
          blocks {
            title
            description
            link {
              url
              title
              target
            }
          }
        }
        brochuresGroup {
          title
          blocks {
            title
            partNumber
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

type LinkRow = {
  url?: string | null;
  title?: string | null;
  target?: string | null;
};

type CatalogBlockRow = {
  title?: string | null;
  description?: string | null;
  link?: LinkRow | null;
};

type BrochureBlockRow = {
  title?: string | null;
  partNumber?: string | null;
  link?: LinkRow | null;
};

type CatalogsGroup = {
  blocks?: CatalogBlockRow | CatalogBlockRow[] | null;
};

type BrochuresGroup = {
  title?: string | null;
  blocks?: BrochureBlockRow | BrochureBlockRow[] | null;
};

type CatalogsBrochuresSettings = {
  catalogsGroup?: CatalogsGroup | null;
  brochuresGroup?: BrochuresGroup | null;
};

export type CatalogChoicesPageData = {
  page?: {
    title?: string | null;
    catalogsBrochuresSettings?: CatalogsBrochuresSettings | null;
  } | null;
};

export type CatalogChoiceCard = {
  title: string;
  descriptionHtml: string;
  linkUrl: string;
  linkTitle: string;
  linkTarget: string;
};

export type BrochureChoiceCard = {
  title: string;
  partNumber: string;
  linkUrl: string;
  linkTitle: string;
  linkTarget: string;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function readGraphqlOrigin(): string | undefined {
  try {
    const raw = import.meta.env.PUBLIC_GRAPHQL_URL;
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    return new URL(raw.trim()).origin;
  } catch {
    return undefined;
  }
}

/**
 * WP often returns `/wp-content/...` — on the Astro site that resolves to the frontend host (404).
 * Prefix API origin (same as GraphQL) so PDFs open on the public backend, like direct media URLs.
 */
export function resolveCatalogAssetUrl(href: string): string {
  const h = href.trim();
  if (!h) return "";
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith("//")) return `https:${h}`;
  const origin = readGraphqlOrigin();
  if (!origin) return h;
  const path = h.startsWith("/") ? h : `/${h}`;
  return `${origin}${path}`;
}

export function normalizeCatalogChoices(
  page: CatalogChoicesPageData["page"],
): { catalogs: CatalogChoiceCard[]; brochuresTitle: string; brochures: BrochureChoiceCard[] } {
  const settings = page?.catalogsBrochuresSettings;
  const catalogs: CatalogChoiceCard[] = [];
  const brochures: BrochureChoiceCard[] = [];

  for (const row of asArray(settings?.catalogsGroup?.blocks)) {
    const title = text(row?.title);
    const descriptionHtml = text(row?.description);
    const linkUrl = resolveCatalogAssetUrl(text(row?.link?.url));
    const linkTitle = text(row?.link?.title);
    const linkTarget = text(row?.link?.target);
    if (!title && !descriptionHtml && !linkUrl) continue;
    catalogs.push({
      title,
      descriptionHtml,
      linkUrl,
      linkTitle,
      linkTarget,
    });
  }

  for (const row of asArray(settings?.brochuresGroup?.blocks)) {
    const title = text(row?.title);
    const partNumber = text(row?.partNumber);
    const linkUrl = resolveCatalogAssetUrl(text(row?.link?.url));
    const linkTitle = text(row?.link?.title);
    const linkTarget = text(row?.link?.target);
    if (!title && !partNumber && !linkUrl) continue;
    brochures.push({
      title,
      partNumber,
      linkUrl,
      linkTitle,
      linkTarget,
    });
  }

  return {
    catalogs,
    brochuresTitle: text(settings?.brochuresGroup?.title),
    brochures,
  };
}
