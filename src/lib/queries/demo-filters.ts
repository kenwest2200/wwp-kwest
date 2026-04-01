export type ProductAttributeNode = {
  name: string;
  slug: string;
};

export type DemoProductAttributesData = {
  productAttributes?: {
    nodes: ProductAttributeNode[];
  } | null;
};

/** Value option for an attribute (e.g. Woo term) from `attributesByCategory`. */
export type AttributeByCategoryValue = {
  label: string;
  slug: string;
};

/** One attribute row returned per category from custom resolver `attributesByCategory`. */
export type AttributeByCategoryRow = {
  name: string;
  slug: string;
  values: AttributeByCategoryValue[];
};

export type AttributesByCategoryQueryData = {
  attributesByCategory?: AttributeByCategoryRow[] | null;
};

export const ATTRIBUTES_BY_CATEGORY_QUERY = /* GraphQL */ `
  query GetAttributesByCategory($categorySlug: String!) {
    attributesByCategory(categorySlug: $categorySlug) {
      name
      slug
      values {
        label
        slug
      }
    }
  }
`;

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

/** Root product categories from custom resolver `rootProductCategories`. */
export type RootProductCategoryNode = {
  name: string;
  slug: string;
};

export type RootProductCategoriesData = {
  rootProductCategories?: RootProductCategoryNode[] | null;
};

export type MergedSubcategoryItem = {
  databaseId?: number | null;
  slug: string;
  name: string;
  uri?: string | null;
};

export type MergedSubcategoryGroup = {
  groupSlug: string;
  groupName: string;
  subcategories: MergedSubcategoryItem[];
};

export type MergedSubcategoryGroupsData = {
  mergedSubcategoryGroups?: MergedSubcategoryGroup[] | null;
};

export const ROOT_PRODUCT_CATEGORIES_QUERY = /* GraphQL */ `
  query GetRootCategories {
    rootProductCategories {
      name
      slug
    }
  }
`;

export const MERGED_SUBCATEGORY_GROUPS_QUERY = /* GraphQL */ `
  query GetMergedSubcategoryGroups($rootCategorySlugs: [String!]!) {
    mergedSubcategoryGroups(rootCategorySlugs: $rootCategorySlugs) {
      groupSlug
      groupName
      subcategories {
        databaseId
        slug
        name
        uri
      }
    }
  }
`;

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


