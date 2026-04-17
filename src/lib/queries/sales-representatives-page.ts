/** Sales representatives (WordPress URI: /resources/sales-representatives/) */

export const SALES_REPRESENTATIVES_PAGE_URI = "/resources/sales-representatives/";

export const SALES_REPRESENTATIVES_PAGE_QUERY = /* GraphQL */ `
  query SalesRepresentativesPage($id: ID!) {
    page(id: $id, idType: URI) {
      title
      content
    }
  }
`;

export type SalesRepresentativesPageData = {
  page?: {
    title?: string | null;
    content?: string | null;
  } | null;
};
