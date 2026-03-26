export type ProductAttributeNode = {
  name: string;
  slug: string;
};

export type DemoProductAttributesData = {
  productAttributes?: {
    nodes: ProductAttributeNode[];
  } | null;
};

export type ProductByAttributeItem = {
  title: string;
  slug: string;
};

export type ProductCategoryNode = {
  id?: string;
  databaseId?: number;
  name: string;
  slug: string;
  count?: number;
  children?: {
    nodes: ProductCategoryNode[];
  } | null;
};

export type DemoProductCategoriesData = {
  productCategories?: {
    nodes: ProductCategoryNode[];
  } | null;
};

export type DemoProductsByAttributesData = {
  productsByAttributes?: {
    total: number;
    items: ProductByAttributeItem[];
  } | null;
};

export type DemoAllProductsData = {
  products?: {
    nodes: Array<
      ProductByAttributeItem & {
        productCategories?: {
          nodes: Array<{
            slug: string;
          }>;
        } | null;
      }
    >;
  } | null;
};

export type DemoProductsFromCategoriesData = {
  productCategories?: {
    nodes: Array<{
      slug: string;
      products?: {
        nodes: ProductByAttributeItem[];
      } | null;
    }>;
  } | null;
};

export const DEMO_PRODUCT_ATTRIBUTES_QUERY = /* GraphQL */ `
  query DemoProductAttributes {
    productAttributes(first: 100) {
      nodes {
        name
        slug
      }
    }
  }
`;

export const DEMO_PRODUCT_CATEGORIES_QUERY = /* GraphQL */ `
  query DemoProductCategories {
    productCategories(where: { parent: 0, hideEmpty: false }) {
      nodes {
        id
        databaseId
        name
        slug
        count
        children(first: 50, where: { hideEmpty: false }) {
          nodes {
            id
            databaseId
            name
            slug
            count
          }
        }
      }
    }
  }
`;

export const DEMO_PRODUCTS_BY_ATTRIBUTES_QUERY = /* GraphQL */ `
  query DemoProductsByAttributes(
    $filters: [String!]
    $limit: Int!
    $offset: Int!
  ) {
    productsByAttributes(filters: $filters, limit: $limit, offset: $offset) {
      total
      items {
        title
        slug
      }
    }
  }
`;

export const DEMO_ALL_PRODUCTS_QUERY = /* GraphQL */ `
  query DemoAllProducts($first: Int!) {
    products(first: $first) {
      nodes {
        title
        slug
        productCategories {
          nodes {
            slug
          }
        }
      }
    }
  }
`;

export const DEMO_PRODUCTS_FROM_CATEGORIES_QUERY = /* GraphQL */ `
  query DemoProductsFromCategories {
    productCategories(first: 300, where: { hideEmpty: false }) {
      nodes {
        slug
        products(first: 5000) {
          nodes {
            title
            slug
          }
        }
      }
    }
  }
`;


