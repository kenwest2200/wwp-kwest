import type {
  ProductCategoryBreadcrumbNode,
  ProductPageData,
} from "./queries/product-detail";

export type ProductBreadcrumbLink = {
  label: string;
  href: string;
};

function isUncategorizedSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return s === "uncategorized" || s === "uncategorised" || s === "bez-rubriki";
}

function pathRootToLeaf(
  node: ProductCategoryBreadcrumbNode | null | undefined,
): ProductCategoryBreadcrumbNode[] {
  if (!node?.slug || isUncategorizedSlug(node.slug)) return [];
  const parent = node.parent?.node;
  const prefix = pathRootToLeaf(parent);
  return [...prefix, node];
}

/**
 * Picks the deepest assigned category branch, then returns up to two links:
 * root category → optional second level (`/products?…` matches catalog filters).
 */
export function buildProductBreadcrumbLinks(
  product: ProductPageData["product"] | null,
): ProductBreadcrumbLink[] {
  const nodes = product?.productCategories?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  let best: ProductCategoryBreadcrumbNode[] = [];
  for (const raw of nodes) {
    if (!raw) continue;
    const chain = pathRootToLeaf(raw);
    if (chain.length > best.length) best = chain;
  }
  if (best.length === 0) return [];

  const root = best[0]!;
  const rootSlug = root.slug?.trim() ?? "";
  const rootName = root.name?.trim() || rootSlug.replace(/-/g, " ");
  if (!rootSlug) return [];

  const out: ProductBreadcrumbLink[] = [
    {
      label: rootName,
      href: `/products?category=${encodeURIComponent(rootSlug)}`,
    },
  ];

  if (best.length >= 2) {
    const sub = best[1]!;
    const subSlug = sub.slug?.trim() ?? "";
    const subName = sub.name?.trim() || subSlug.replace(/-/g, " ");
    if (subSlug) {
      out.push({
        label: subName,
        href: `/products?category=${encodeURIComponent(rootSlug)}&sub=${encodeURIComponent(subSlug)}`,
      });
    }
  }

  return out;
}
