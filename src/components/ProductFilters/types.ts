export type ProductFiltersRootNavLink = {
  name: string;
  href: string;
};

export type ProductFiltersRootNavBlock = {
  rootName: string;
  rootSlug: string;
  subLinks: ProductFiltersRootNavLink[];
  filterHref: string;
};
