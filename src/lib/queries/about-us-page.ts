import { decodeHtmlEntities } from "../decode-html-entities";

export const ABOUT_US_PAGE_URI = "/about-us/";

export const ABOUT_US_PAGE_QUERY = /* GraphQL */ `
  query AboutUsPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      content
      aboutUsSettings {
        aboutUsStatsGroup {
          yearFounded
          yearsInIndustryText
          productionAreaNumber
          productionAreaText
          productCategoriesNumber
          productCategoriesText
        }
      }
    }
  }
`;

export type AboutUsStatsGroupRaw = {
  yearFounded?: string | number | null;
  yearsInIndustryText?: string | null;
  productionAreaNumber?: string | number | null;
  productionAreaText?: string | null;
  productCategoriesNumber?: string | number | null;
  productCategoriesText?: string | null;
};

export type AboutUsPageData = {
  page?: {
    title?: string | null;
    content?: string | null;
    aboutUsSettings?: {
      aboutUsStatsGroup?: AboutUsStatsGroupRaw | AboutUsStatsGroupRaw[] | null;
    } | null;
  } | null;
};

export type AboutUsStats = {
  yearFounded: number | null;
  years: number | null;
  yearsInIndustryHtml: string;
  productionAreaNumber: string;
  productionAreaTextHtml: string;
  productCategoriesNumber: string;
  productCategoriesTextHtml: string;
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function parseYearFounded(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.floor(raw);
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export function yearsInIndustry(yearFounded: number | null): number | null {
  if (yearFounded == null) return null;
  const y = new Date().getFullYear() - yearFounded;
  return Math.max(0, y);
}

export function replaceYearsPlaceholder(
  html: string,
  years: number | null,
): string {
  const repl = years == null ? "" : String(years);
  return html.split("[years]").join(repl);
}

function displayNumber(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return String(raw).trim();
}

function formatProductionAreaNumber(
  raw: string | number | null | undefined,
): string {
  if (raw == null || raw === "") return "";
  const normalized = String(raw).trim().replace(/,/g, "").replace(/\s/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return String(raw).trim();
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.trunc(n));
}

function fieldHtml(
  raw: string | null | undefined,
  years: number | null,
): string {
  const decoded = decodeHtmlEntities((raw ?? "").trim());
  return replaceYearsPlaceholder(decoded, years);
}

export function prepareAboutUsPage(
  page: AboutUsPageData["page"] | null | undefined,
): { stats: AboutUsStats | null; contentHtml: string } {
  const groups = asArray(page?.aboutUsSettings?.aboutUsStatsGroup);
  const group = groups[0];
  const yearFounded = group ? parseYearFounded(group.yearFounded) : null;
  const years = yearsInIndustry(yearFounded);

  const rawContent = (page?.content ?? "").trim();
  const contentHtml = replaceYearsPlaceholder(
    decodeHtmlEntities(rawContent),
    years,
  );

  if (!group) {
    return { stats: null, contentHtml };
  }

  const stats: AboutUsStats = {
    yearFounded,
    years,
    yearsInIndustryHtml: fieldHtml(group.yearsInIndustryText, years),
    productionAreaNumber: formatProductionAreaNumber(
      group.productionAreaNumber,
    ),
    productionAreaTextHtml: fieldHtml(group.productionAreaText, years),
    productCategoriesNumber: displayNumber(group.productCategoriesNumber),
    productCategoriesTextHtml: fieldHtml(group.productCategoriesText, years),
  };

  const empty =
    stats.years == null &&
    !stats.yearsInIndustryHtml.trim() &&
    !stats.productionAreaNumber &&
    !stats.productionAreaTextHtml.trim() &&
    !stats.productCategoriesNumber &&
    !stats.productCategoriesTextHtml.trim();

  if (empty) {
    return { stats: null, contentHtml };
  }

  return { stats, contentHtml };
}
