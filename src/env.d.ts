/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GRAPHQL_URL: string;
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
  }
}
