export type MenuNode = {
  label: string;
  url: string;
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
    menuItems {
      nodes {
        label
        url
      }
    }
  }
`;
