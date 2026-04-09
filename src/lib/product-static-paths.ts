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
        /** GraphQL/JSON may ship this as a numeric string. */
        databaseId?: number | string | null;
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
      let databaseId: number | null = null;
      const rawId = p?.databaseId;
      if (typeof rawId === "number" && rawId > 0) {
        databaseId = rawId;
      } else if (typeof rawId === "string" && /^\d+$/.test(rawId.trim())) {
        const n = Number(rawId.trim());
        if (Number.isFinite(n) && n > 0) databaseId = n;
      }
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
