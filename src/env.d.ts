/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GRAPHQL_URL: string;
  /** Site origin for WP REST (e.g. https://www.waterwayplastics.com) — store-locations plugin */
  readonly PUBLIC_WORDPRESS_ORIGIN?: string;
  /** Maps JavaScript API — browser key (HTTP referrer restrictions). */
  readonly PUBLIC_GOOGLE_MAPS_BROWSER_KEY?: string;
  /** Example ZIP for distributor locator placeholder text only. */
  readonly PUBLIC_DISTRIBUTOR_LOCATOR_DEFAULT_ZIP?: string;
  readonly GRAPHQL_BASIC_USER?: string;
  readonly GRAPHQL_BASIC_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "cloudflare:workers" {
  export const env: {
    PUBLIC_GRAPHQL_URL?: string;
    GRAPHQL_BASIC_USER?: string;
    GRAPHQL_BASIC_PASSWORD?: string;
    [key: string]: string | undefined;
  };
}

declare namespace Cloudflare {
  interface Env {
    WEBHOOK_SECRET: string;
    ZONE_ID: string;
    CF_API_TOKEN: string;
    PUBLIC_WORDPRESS_ORIGIN?: string;
    /** Server-side Geocoding API key (not exposed to the browser). */
    GOOGLE_GEOCODING_KEY?: string;
    /** Maps JS browser key; optional GET /api/maps-browser-key when not embedded at build. */
    GOOGLE_MAPS_BROWSER_KEY?: string;
  }
}
