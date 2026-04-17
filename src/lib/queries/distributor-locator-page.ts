/** Dealer / distributor locator (WordPress URI: /distributor-locator/) */

export const DISTRIBUTOR_LOCATOR_PAGE_URI = "/distributor-locator/";

export const DISTRIBUTOR_LOCATOR_PAGE_QUERY = /* GraphQL */ `
  query DistributorLocatorPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      content
      distributorLocatorSidebarContent {
        distributorLocatorSidebar {
          distributorLocatorSidebarTitle
          distributorLocatorSidebarInfoSection {
            distributorLocatorSidebarInfoSectionTitle
            distributorLocatorSidebarInfoSubsection {
              distributorLocatorSidebarInfoSubsectionTitle
              distributorLocatorSidebarInfoSubsectionContent
            }
          }
        }
      }
    }
  }
`;

export type LocatorSubsectionRow = {
  distributorLocatorSidebarInfoSubsectionTitle?: string | null;
  distributorLocatorSidebarInfoSubsectionContent?: string | null;
};

export type LocatorSectionRow = {
  distributorLocatorSidebarInfoSectionTitle?: string | null;
  distributorLocatorSidebarInfoSubsection?:
    | LocatorSubsectionRow
    | LocatorSubsectionRow[]
    | null;
};

export type LocatorSidebarColumnRow = {
  distributorLocatorSidebarTitle?: string | null;
  distributorLocatorSidebarInfoSection?:
    | LocatorSectionRow
    | LocatorSectionRow[]
    | null;
};

export type DistributorLocatorSidebarContent = {
  distributorLocatorSidebar?:
    | LocatorSidebarColumnRow
    | LocatorSidebarColumnRow[]
    | null;
};

export type DistributorLocatorPageData = {
  page?: {
    title?: string | null;
    content?: string | null;
    distributorLocatorSidebarContent?: DistributorLocatorSidebarContent | null;
  } | null;
};

export type LocatorSubsection = {
  title: string;
  contentHtml: string;
};

export type LocatorInfoSection = {
  title: string;
  subsections: LocatorSubsection[];
};

export type LocatorSidebarColumn = {
  columnTitle: string;
  sections: LocatorInfoSection[];
};

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function normalizeDistributorLocatorSidebar(
  content: DistributorLocatorSidebarContent | null | undefined,
): LocatorSidebarColumn[] {
  const root = content?.distributorLocatorSidebar;
  const columns = asArray(root);
  const out: LocatorSidebarColumn[] = [];

  for (const col of columns) {
    const columnTitle = (col?.distributorLocatorSidebarTitle ?? "").trim();
    const sectionRows = asArray(col?.distributorLocatorSidebarInfoSection);
    const sections: LocatorInfoSection[] = [];

    for (const sec of sectionRows) {
      const secTitle = (sec?.distributorLocatorSidebarInfoSectionTitle ?? "").trim();
      const subRows = asArray(sec?.distributorLocatorSidebarInfoSubsection);
      const subsections: LocatorSubsection[] = [];
      for (const sub of subRows) {
        const t = (sub?.distributorLocatorSidebarInfoSubsectionTitle ?? "").trim();
        const c = (sub?.distributorLocatorSidebarInfoSubsectionContent ?? "").trim();
        if (!t && !c) continue;
        subsections.push({
          title: t,
          contentHtml: c,
        });
      }
      if (secTitle || subsections.length > 0) {
        sections.push({ title: secTitle, subsections });
      }
    }

    if (columnTitle || sections.length > 0) {
      out.push({ columnTitle, sections });
    }
  }

  return out;
}
