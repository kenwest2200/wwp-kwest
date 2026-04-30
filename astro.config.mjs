// @ts-check
import { defineConfig } from "astro/config";
import { Buffer } from "node:buffer";

// During `npm run dev`, forward worker-backed routes to Wrangler (`npm run dev:worker`).
// If Wrangler is not running, the app still loads; search autocomplete falls back to
// “Show all results” only (see header-mobile.ts).
const wranglerDev = "http://127.0.0.1:8787";

// https://astro.build/config
const isAstroDev =
  process.env.npm_lifecycle_event === "dev" || process.argv.includes("dev");

function graphqlDevProxy() {
  const raw = process.env.PUBLIC_GRAPHQL_URL?.trim();
  if (!raw) return {};

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return {};
  }

  const user = process.env.GRAPHQL_BASIC_USER ?? "api";
  const pass = process.env.GRAPHQL_BASIC_PASSWORD ?? "apiwaterway";
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const pathWithQuery = `${parsed.pathname}${parsed.search}`;
  const upstreamPath =
    pathWithQuery === "/" || pathWithQuery === "" ? "/graphql" : pathWithQuery;

  return {
    "/graphql": {
      target: `${parsed.protocol}//${parsed.host}`,
      changeOrigin: true,
      rewrite: () => upstreamPath,
      headers: {
        Authorization: `Basic ${auth}`,
      },
    },
  };
}

export default defineConfig({
  output: "static",
  vite: {
    ...(isAstroDev ? { optimizeDeps: { force: true } } : {}),
    server: {
      proxy: {
        "/api/search-autocomplete": wranglerDev,
        "/api/search": wranglerDev,
        "/api/store-locations": wranglerDev,
        "/api/distributor-locations": wranglerDev,
        "/api/geocode-zip": wranglerDev,
        "/api/maps-browser-key": wranglerDev,
        "/api/product-category-products": wranglerDev,
        "/api/sales-reps": wranglerDev,
        "/api/cross-ref-find": wranglerDev,
        "/api/cross-ref-filters": wranglerDev,
        ...(isAstroDev ? graphqlDevProxy() : {}),
      },
    },
  },
});
