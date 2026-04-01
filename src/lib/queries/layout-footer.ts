import type { MenuNode } from "./layout-header";

export type FooterColumnNode = {
  label: string;
  url: string;
  childItems?: {
    nodes: MenuNode[];
  };
};

export type FooterLayoutData = {
  footerColumns?: {
    nodes: FooterColumnNode[];
  };

  footerLegal?: {
    nodes: MenuNode[];
  };
};

export const FOOTER_LAYOUT_QUERY = /* GraphQL */ `
  query FooterLayout {
    footerColumns: menuItems(where: { location: FOOTER }) {
      nodes {
        label
        url
        childItems {
          nodes {
            label
            url
          }
        }
      }
    }
    footerLegal: menuItems(where: { location: FOOTER_LEGAL }) {
      nodes {
        label
        url
      }
    }
  }
`;
