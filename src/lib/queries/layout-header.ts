export type MenuNode = {
  id: string;
  label: string;
  url: string;
  parentId: string | null;
  path: string;
};

export type HeaderLayoutData = {
  menuItems: {
    nodes: MenuNode[];
  };
  topBarMenuItems?: {
    nodes?: MenuNode[] | null;
  };
};

/**
 * Main nav (`MAIN_MENU`) + top strip (`TOP_BAR_MENU`), same node shape.
 */
export const HEADER_LAYOUT_QUERY = /* GraphQL */ `
  query HeaderLayout {
    menuItems(where: { location: MAIN_MENU }, first: 200) {
      nodes {
        id
        label
        url
        parentId
        path
      }
    }
    topBarMenuItems: menuItems(where: { location: TOP_BAR_MENU }, first: 80) {
      nodes {
        id
        label
        url
        parentId
        path
      }
    }
  }
`;
