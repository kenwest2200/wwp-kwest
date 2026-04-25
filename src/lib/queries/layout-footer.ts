export type FooterColumnNode = {
  id?: string | null;
  label?: string | null;
  url?: string | null;
  path?: string | null;
  parentId?: string | null;
  childItems?: {
    nodes?: FooterMenuChildNode[] | null;
  } | null;
};

export type FooterMenuChildNode = {
  id?: string | null;
  label?: string | null;
  url?: string | null;
  path?: string | null;
};

export type FooterLayoutData = {
  footerColumns?: {
    nodes?: FooterColumnNode[] | null;
  } | null;
};

export type FooterMenuColumn = {
  label: string;
  links: { label: string; href: string }[];
};

export function normalizeFooterMenuHref(path?: string | null): string {
  const p = (path ?? "").trim();
  if (!p || p === "#") return "#";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return p;
  return p.startsWith("/") ? p : `/${p}`;
}

export function footerColumnsFromMenuNodes(
  nodes: FooterColumnNode[] | null | undefined,
): FooterMenuColumn[] {
  const list = Array.isArray(nodes) ? nodes : [];
  const columns: FooterMenuColumn[] = [];

  for (const node of list) {
    const title = (node.label ?? "").trim();
    const rawChildren = node.childItems?.nodes ?? [];
    const links: { label: string; href: string }[] = [];

    for (const c of rawChildren) {
      if (!c) continue;
      const label = (c.label ?? "").trim();
      if (!label) continue;
      const href = normalizeFooterMenuHref(c.path);
      links.push({ label, href });
    }

    if (links.length > 0) {
      columns.push({ label: title || "Menu", links });
    }
  }

  return columns;
}

export const FOOTER_LAYOUT_QUERY = /* GraphQL */ `
  query FooterLayout {
    footerColumns: menuItems(where: { location: FOOTER_MENU }, first: 100) {
      nodes {
        id
        label
        url
        path
        parentId
        childItems {
          nodes {
            id
            label
            url
            path
          }
        }
      }
    }
  }
`;
