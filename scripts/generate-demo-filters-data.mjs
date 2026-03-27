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

const PRODUCT_ATTRIBUTES_QUERY = `
  query DemoProductAttributes {
    productAttributes(first: 100) {
      nodes {
        name
        slug
      }
    }
  }
`;

const PRODUCT_CATEGORIES_QUERY = `
  query DemoProductCategories {
    productCategories(where: { parent: 0, hideEmpty: false }) {
      nodes {
        name
        slug
        children(first: 100, where: { hideEmpty: false }) {
          nodes {
            name
            slug
          }
        }
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

  const basicUser = env.GRAPHQL_BASIC_USER ?? "api";
  const basicPass = env.GRAPHQL_BASIC_PASSWORD ?? "apiwaterway";
  const auth = `Basic ${toBase64Utf8(`${basicUser}:${basicPass}`)}`;

  const client = new GraphQLClient(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
  });

  const [attributesData, categoriesData] = await Promise.all([
    client.request(PRODUCT_ATTRIBUTES_QUERY),
    client.request(PRODUCT_CATEGORIES_QUERY),
  ]);

  let productsNodes = [];
  try {
    productsNodes = await fetchAllProducts(client, true);
  } catch {
    productsNodes = await fetchAllProducts(client, false);
  }

  const attributes = (attributesData.productAttributes?.nodes ?? []).filter(
    (item) => item?.name && item?.slug,
  );
  const rootCategories = (categoriesData.productCategories?.nodes ?? [])
    .filter((cat) => cat?.name && cat?.slug)
    .map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      subcategories: (cat.children?.nodes ?? [])
        .filter((sub) => sub?.name && sub?.slug)
        .map((sub) => ({ name: sub.name, slug: sub.slug })),
    }));

  const products = productsNodes
    .filter((item) => item?.title && item?.slug)
    .map((item) => ({
      title: item.title,
      slug: item.slug,
      categorySlugs: (item.productCategories?.nodes ?? [])
        .map((node) => node?.slug)
        .filter(Boolean),
      attributeSlugs: (item.productAttributes?.nodes ?? [])
        .map((node) => node?.slug)
        .filter(Boolean),
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    attributes,
    rootCategories,
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

main().catch((error) => {
  console.error("[demo-filters] failed to generate data", error);
  process.exitCode = 1;
});
