import fs from "node:fs";
import path from "node:path";

export interface ProductPagePathProps {
  databaseId: number | null;
  catalogTitle: string;
}

export async function getStaticPaths(): Promise<
  { params: { slug: string }; props: ProductPagePathProps }[]
> {
  const dataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "product-filters.json",
  );
  if (!fs.existsSync(dataPath)) {
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
      products?: {
        slug?: string;
        title?: string;
        databaseId?: number | null;
      }[];
    };
    const products = raw.products ?? [];
    const seen = new Set<string>();
    const paths: { params: { slug: string }; props: ProductPagePathProps }[] =
      [];
    for (const p of products) {
      const slug = p?.slug?.trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const databaseId =
        typeof p.databaseId === "number" && p.databaseId > 0
          ? p.databaseId
          : null;
      const catalogTitle = (p.title ?? "").trim();
      paths.push({
        params: { slug },
        props: {
          databaseId,
          catalogTitle:
            catalogTitle || slug.replace(/-/g, " ").replace(/\s+/g, " "),
        },
      });
    }
    return paths;
  } catch {
    return [];
  }
}
