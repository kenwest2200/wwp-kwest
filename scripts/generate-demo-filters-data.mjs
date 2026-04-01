import { access, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GraphQLClient } from "graphql-request";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "public", "data", "demo-filters.json");
const envPath = path.join(projectRoot, ".env");

function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }
  return result;
}

async function loadEnv() {
  try {
    const content = await readFile(envPath, "utf8");
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

/** WPGraphQL often returns HTML-entity-encoded labels (&amp;). Normalize to plain text in JSON. */
function decodeHtmlEntities(raw) {
  if (typeof raw !== "string" || raw.length === 0) return raw;
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : m;
    })
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : m;
    });
}

function toBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;

  while (i < bytes.length) {
    const byte1 = bytes[i++] ?? 0;
    const hasByte2 = i < bytes.length;
    const byte2 = hasByte2 ? (bytes[i++] ?? 0) : 0;
    const hasByte3 = i < bytes.length;
    const byte3 = hasByte3 ? (bytes[i++] ?? 0) : 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(chunk >> 18) & 0x3f];
    output += alphabet[(chunk >> 12) & 0x3f];
    output += hasByte2 ? alphabet[(chunk >> 6) & 0x3f] : "=";
    output += hasByte3 ? alphabet[chunk & 0x3f] : "=";
  }
  return output;
}

const ATTRIBUTES_BY_CATEGORY_QUERY = `
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

const ROOT_PRODUCT_CATEGORIES_QUERY = `
  query GetRootCategories {
    rootProductCategories {
      name
      slug
    }
  }
`;

const MERGED_SUBCATEGORY_GROUPS_QUERY = `
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

const PRODUCTS_QUERY = `
  query DemoProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        title
        slug
        databaseId
        productCategories {
          nodes {
            slug
          }
        }
        productAttributes {
          nodes {
            slug
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PRODUCTS_NO_ATTRS_QUERY = `
  query DemoProductsNoAttrs($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        title
        slug
        databaseId
        productCategories {
          nodes {
            slug
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchAllProducts(client, withAttributes) {
  const pageSize = 100;
  let after = null;
  let hasNextPage = true;
  const all = [];
  const query = withAttributes ? PRODUCTS_QUERY : PRODUCTS_NO_ATTRS_QUERY;

  while (hasNextPage) {
    const data = await client.request(query, {
      first: pageSize,
      after,
    });
    const block = data.products ?? {};
    const nodes = block.nodes ?? [];
    all.push(...nodes);

    hasNextPage = Boolean(block.pageInfo?.hasNextPage);
    after = block.pageInfo?.endCursor ?? null;
  }

  if (!withAttributes) {
    return all.map((item) => ({
      ...item,
      productAttributes: { nodes: [] },
    }));
  }

  return all;
}

/** Every non-empty subset of `sortedSlugs` (order preserved). */
function nonEmptySubsets(sortedSlugs) {
  const n = sortedSlugs.length;
  const out = [];
  for (let i = 1; i < 1 << n; i++) {
    const subset = [];
    for (let j = 0; j < n; j++) {
      if (i & (1 << j)) subset.push(sortedSlugs[j]);
    }
    out.push(subset);
  }
  return out;
}

async function generateFromGraphql(env) {
  const url = env.PUBLIC_GRAPHQL_URL;
  const basicUser = env.GRAPHQL_BASIC_USER ?? "api";
  const basicPass = env.GRAPHQL_BASIC_PASSWORD ?? "apiwaterway";
  const auth = `Basic ${toBase64Utf8(`${basicUser}:${basicPass}`)}`;

  const client = new GraphQLClient(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
  });

  const rootsData = await client.request(ROOT_PRODUCT_CATEGORIES_QUERY);
  const rootCategories = (rootsData.rootProductCategories ?? [])
    .filter((row) => row?.name && row?.slug)
    .map((row) => ({
      name: decodeHtmlEntities(row.name),
      slug: row.slug,
    }));

  const rootSlugsSorted = rootCategories.map((r) => r.slug).sort(); // stable key for merged map
  const mergedSubcategoryGroupsBySelection = {};

  if (rootSlugsSorted.length > 0) {
    const subsets = nonEmptySubsets(rootSlugsSorted);
    const mergedEntries = await Promise.all(
      subsets.map(async (rootCategorySlugs) => {
        const key = rootCategorySlugs.join(",");
        try {
          const data = await client.request(MERGED_SUBCATEGORY_GROUPS_QUERY, {
            rootCategorySlugs,
          });
          const groups = (data.mergedSubcategoryGroups ?? []).filter(
            (g) => g?.groupSlug && g?.groupName,
          );
          const normalized = groups.map((g) => ({
            groupSlug: g.groupSlug,
            groupName: decodeHtmlEntities(g.groupName),
            subcategories: (g.subcategories ?? [])
              .filter((s) => s?.slug && s?.name)
              .map((s) => ({
                databaseId: s.databaseId ?? null,
                slug: s.slug,
                name: decodeHtmlEntities(s.name),
                uri: s.uri ?? null,
              })),
          }));
          return [key, normalized];
        } catch (err) {
          console.warn(
            `[demo-filters] mergedSubcategoryGroups([${key}]) failed:`,
            err?.message ?? err,
          );
          return [key, []];
        }
      }),
    );
    Object.assign(
      mergedSubcategoryGroupsBySelection,
      Object.fromEntries(mergedEntries),
    );
  }

  const categorySlugsForAttributes = new Set(rootSlugsSorted);
  for (const groups of Object.values(mergedSubcategoryGroupsBySelection)) {
    for (const g of groups) {
      for (const s of g.subcategories ?? []) {
        categorySlugsForAttributes.add(s.slug);
      }
    }
  }
  const categorySlugsList = [...categorySlugsForAttributes];

  let productsNodes = [];
  try {
    productsNodes = await fetchAllProducts(client, true);
  } catch {
    productsNodes = await fetchAllProducts(client, false);
  }

  const attributesByCategoryEntries = await Promise.all(
    categorySlugsList.map(async (categorySlug) => {
      try {
        const data = await client.request(ATTRIBUTES_BY_CATEGORY_QUERY, {
          categorySlug,
        });
        const rows = (data.attributesByCategory ?? []).filter(
          (row) => row?.slug && row?.name,
        );
        const normalized = rows.map((row) => ({
          name: decodeHtmlEntities(row.name),
          slug: row.slug,
          values: (row.values ?? [])
            .filter((v) => v?.slug)
            .map((v) => ({
              label: decodeHtmlEntities(v.label ?? v.slug),
              slug: v.slug,
            })),
        }));
        return [categorySlug, normalized];
      } catch (err) {
        console.warn(
          `[demo-filters] attributesByCategory("${categorySlug}") failed:`,
          err?.message ?? err,
        );
        return [categorySlug, []];
      }
    }),
  );
  const attributesByCategory = Object.fromEntries(attributesByCategoryEntries);

  const products = productsNodes
    .filter((item) => item?.title && item?.slug)
    .map((item) => ({
      title: decodeHtmlEntities(item.title),
      slug: item.slug,
      databaseId:
        typeof item.databaseId === "number" ? item.databaseId : null,
      categorySlugs: (item.productCategories?.nodes ?? [])
        .map((node) => node?.slug)
        .filter(Boolean),
      attributeSlugs: (item.productAttributes?.nodes ?? [])
        .map((node) => node?.slug)
        .filter(Boolean),
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    attributesByCategory,
    rootCategories,
    mergedSubcategoryGroupsBySelection,
    products,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    "[demo-filters] New filter data was fetched from GraphQL and written to disk.",
  );
  console.log(
    `[demo-filters] generated ${outputPath} with ${products.length} products`,
  );
}

async function main() {
  const envFile = await loadEnv();
  const env = { ...envFile, ...process.env };

  const url = env.PUBLIC_GRAPHQL_URL;
  if (!url) {
    try {
      await access(outputPath);
      console.warn(
        "[demo-filters] PUBLIC_GRAPHQL_URL is not set. Reusing existing static data file.",
      );
      return;
    } catch {
      throw new Error(
        "PUBLIC_GRAPHQL_URL is not set for demo filters build data and no existing public/data/demo-filters.json was found.",
      );
    }
  }

  try {
    await generateFromGraphql(env);
  } catch (err) {
    try {
      await access(outputPath);
      console.warn(
        "[demo-filters] GraphQL fetch failed (timeout, network, etc.); reusing existing public/data/demo-filters.json.",
        err?.cause?.message ?? err?.message ?? String(err),
      );
      return;
    } catch {
      throw err;
    }
  }
}

main().catch((error) => {
  console.error("[demo-filters] failed to generate data", error);
  process.exitCode = 1;
});
