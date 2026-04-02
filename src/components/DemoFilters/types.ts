export type DemoFiltersRootNavLink = {
  name: string;
  href: string;
};

export type DemoFiltersRootNavBlock = {
  rootName: string;
  rootSlug: string;
  subLinks: DemoFiltersRootNavLink[];
  filterHref: string;
};
