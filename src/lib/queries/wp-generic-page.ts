/** Fallback WordPress pages (no dedicated Astro template): title + HTML content */

export const WP_GENERIC_PAGES_QUERY = /* GraphQL */ `
  query WpGenericPages($first: Int!, $after: String) {
    pages(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        uri
        title
        content
      }
    }
  }
`;

/** Same fields without `where` — some schemas reject `status` on `pages`. */
export const WP_GENERIC_PAGES_QUERY_NO_WHERE = /* GraphQL */ `
  query WpGenericPagesNoWhere($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        uri
        title
        content
      }
    }
  }
`;

export type WpGenericPageNode = {
  uri?: string | null;
  title?: string | null;
  content?: string | null;
};

export type WpGenericPagesBatch = {
  pages?: {
    pageInfo?: {
      hasNextPage?: boolean | null;
      endCursor?: string | null;
    } | null;
    nodes?: (WpGenericPageNode | null)[] | null;
  } | null;
};

export type WpGenericPagePathProps = {
  wpUri: string;
  pageTitle: string;
  contentHtml: string;
};
