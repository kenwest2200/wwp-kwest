// @ts-check
import { defineConfig } from "astro/config";

// During `npm run dev`, forward worker-backed routes to Wrangler (`npm run dev:worker`).
// If Wrangler is not running, the app still loads; search autocomplete falls back to
// “Show all results” only (see header-mobile.ts).
const wranglerDev = "http://127.0.0.1:8787";

// https://astro.build/config
export default defineConfig({
  output: "static",
  vite: {
    server: {
      proxy: {
        "/api/search-autocomplete": wranglerDev,
        "/api/search": wranglerDev,
        "/api/store-locations": wranglerDev,
        "/api/product-category-products": wranglerDev,
        "/api/sales-reps": wranglerDev,
      },
    },
  },
});
