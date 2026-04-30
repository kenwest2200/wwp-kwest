// @ts-check
import { defineConfig } from "astro/config";

// During `npm run dev`, forward worker-backed routes to Wrangler (`npm run dev:worker`).
// If Wrangler is not running, the app still loads; search autocomplete falls back to
// “Show all results” only (see header-mobile.ts).
const wranglerDev = "http://127.0.0.1:8787";

// https://astro.build/config
const isAstroDev =
  process.env.npm_lifecycle_event === "dev" || process.argv.includes("dev");

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
      },
    },
  },
});
