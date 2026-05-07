import type {
  ProductCategoryBreadcrumbNode,
  ProductPageData,
} from "./queries/product-detail";

export type ProductBreadcrumbLink = {
  label: string;
  href: string;
};

const TECHNICAL_BULLETINS_PATH = "/resources/technical-bulletins/";

/** Aligns catalog breadcrumb copy with `/resources/technical-bulletins/` (“Technical guide”). */
function productCategoryBreadcrumbDisplayLabel(
  slug: string,
  nameFromWp: string,
): string {
  const slugKey = slug.trim().toLowerCase();
  if (slugKey === "tech-info") return "Technical guide";
  const name = nameFromWp.trim();
  if (
    name.toLowerCase() === "tech. info" ||
    name.toLowerCase() === "tech info"
  ) {
    return "Technical guide";
  }
  return name || slug.replace(/-/g, " ");
}

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
  const rootName = productCategoryBreadcrumbDisplayLabel(
    rootSlug,
    root.name?.trim() ?? "",
  );
  if (!rootSlug) return [];

  const out: ProductBreadcrumbLink[] = [
    {
      label: rootName,
      href:
        rootSlug.toLowerCase() === "tech-info"
          ? TECHNICAL_BULLETINS_PATH
          : `/products?category=${encodeURIComponent(rootSlug)}`,
    },
  ];

  if (best.length >= 2) {
    const sub = best[1]!;
    const subSlug = sub.slug?.trim() ?? "";
    const subName = productCategoryBreadcrumbDisplayLabel(
      subSlug,
      sub.name?.trim() ?? "",
    );
    if (subSlug) {
      out.push({
        label: subName,
        href: `/products?category=${encodeURIComponent(rootSlug)}&sub=${encodeURIComponent(subSlug)}`,
      });
    }
  }

  return out;
}
