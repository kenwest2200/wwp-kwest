import { GraphQLClient } from "graphql-request";

type RuntimeEnvLike = {
  PUBLIC_GRAPHQL_URL?: string;
  GRAPHQL_BASIC_USER?: string;
  GRAPHQL_BASIC_PASSWORD?: string;
};

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function basicAuthHeader(user: string, password: string): string {
  const credentials = toBase64Utf8(`${user}:${password}`);
  return `Basic ${credentials}`;
}

/**
 * GraphQL client for one-off requests; reads env at dev/build time.
 * Basic Auth: GRAPHQL_BASIC_USER / GRAPHQL_BASIC_PASSWORD (see .env.example), else api / apiwaterway.
 */
export function getGraphQLClient(runtimeEnv?: RuntimeEnvLike): GraphQLClient | null {
  const url = runtimeEnv?.PUBLIC_GRAPHQL_URL ?? import.meta.env.PUBLIC_GRAPHQL_URL;
  if (!url) {
    return null;
  }

  const basicUser = runtimeEnv?.GRAPHQL_BASIC_USER ?? import.meta.env.GRAPHQL_BASIC_USER ?? "api";
  const basicPass =
    runtimeEnv?.GRAPHQL_BASIC_PASSWORD ??
    import.meta.env.GRAPHQL_BASIC_PASSWORD ??
    "apiwaterway";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: basicAuthHeader(basicUser, basicPass),
  };

  return new GraphQLClient(url, { headers });
}

export type GraphQLResponseError = {
  message: string;
  extensions?: Record<string, unknown>;
};

export type GraphQLPayload<T> = {
  data?: T;
  errors?: GraphQLResponseError[];
};

/**
 * Runs a GraphQL request. Throws if the URL is missing or the request fails.
 */
export async function requestGraphql<T>(
  document: string,
  variables?: Record<string, unknown>,
  runtimeEnv?: RuntimeEnvLike,
): Promise<T> {
  const client = getGraphQLClient(runtimeEnv);
  if (!client) {
    throw new Error(
      "PUBLIC_GRAPHQL_URL is not set. Copy .env.example to .env and set the API URL.",
    );
  }

  return client.request<T>(document, variables);
}
