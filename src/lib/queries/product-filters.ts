export type ProductAttributeNode = {
  name: string;
  slug: string;
};

export type ProductAttributesQueryData = {
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

export type ProductCategoriesQueryData = {
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

/** On the API, `groupSlug` / `groupName` are built from the subcategory title (merged groups). */
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

/** One item from `productsByMergedSubcategory`. */
export type ProductsByMergedSubcategoryItem = {
  databaseId?: number | null;
  title?: string | null;
};

export type ProductsByMergedSubcategoryResult = {
  total: number;
  items: ProductsByMergedSubcategoryItem[];
};

export type ProductsByMergedSubcategoryData = {
  productsByMergedSubcategory?: ProductsByMergedSubcategoryResult | null;
};

/**
 * Fetch products for a merged product-type group. Pass either `groupSlug` or `subcategoryName`, not both.
 * `groupSlug` matches the slug derived from the subcategory name on the server (e.g. `"air-systems"`).
 */
export const PRODUCTS_BY_MERGED_SUBCATEGORY_QUERY = /* GraphQL */ `
  query ProductsByMergedSubcategory(
    $rootCategorySlugs: [String!]!
    $groupSlug: String
    $subcategoryName: String
    $limit: Int!
    $offset: Int
  ) {
    productsByMergedSubcategory(
      rootCategorySlugs: $rootCategorySlugs
      groupSlug: $groupSlug
      subcategoryName: $subcategoryName
      limit: $limit
      offset: $offset
    ) {
      total
      items {
        databaseId
        title
      }
    }
  }
`;

export type ProductsByAttributesQueryData = {
  productsByAttributes?: {
    total: number;
    items: ProductByAttributeItem[];
  } | null;
};

export type AllProductsQueryData = {
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

export type ProductsFromCategoriesQueryData = {
  productCategories?: {
    nodes: Array<{
      slug: string;
      products?: {
        nodes: ProductByAttributeItem[];
      } | null;
    }>;
  } | null;
};

export const PRODUCT_ATTRIBUTES_EXPLORER_QUERY = /* GraphQL */ `
  query ProductAttributesExplorer {
    productAttributes(first: 100) {
      nodes {
        name
        slug
      }
    }
  }
`;

export const PRODUCT_CATEGORIES_EXPLORER_QUERY = /* GraphQL */ `
  query ProductCategoriesExplorer {
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

export const PRODUCTS_BY_ATTRIBUTES_EXPLORER_QUERY = /* GraphQL */ `
  query ProductsByAttributesExplorer(
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

export const ALL_PRODUCTS_EXPLORER_QUERY = /* GraphQL */ `
  query AllProductsExplorer($first: Int!) {
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

export const PRODUCTS_FROM_CATEGORIES_EXPLORER_QUERY = /* GraphQL */ `
  query ProductsFromCategoriesExplorer {
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


