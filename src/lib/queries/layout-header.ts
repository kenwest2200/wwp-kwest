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
};

/**
 * Header navigation from WPGraphQL-style `menuItems`.
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
  }
`;
