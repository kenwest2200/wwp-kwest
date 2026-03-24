import { Buffer } from "node:buffer";
import { GraphQLClient } from "graphql-request";

function basicAuthHeader(user: string, password: string): string {
  const credentials = Buffer.from(`${user}:${password}`, "utf8").toString(
    "base64",
  );
  return `Basic ${credentials}`;
}

/**
 * GraphQL client for one-off requests; reads env at dev/build time.
 * Basic Auth: GRAPHQL_BASIC_USER / GRAPHQL_BASIC_PASSWORD (see .env.example), else api / apiwaterway.
 */
export function getGraphQLClient(): GraphQLClient | null {
  const url = import.meta.env.PUBLIC_GRAPHQL_URL;
  if (!url) {
    return null;
  }

  const basicUser = import.meta.env.GRAPHQL_BASIC_USER ?? "api";
  const basicPass = import.meta.env.GRAPHQL_BASIC_PASSWORD ?? "apiwaterway";

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
): Promise<T> {
  const client = getGraphQLClient();
  if (!client) {
    throw new Error(
      "PUBLIC_GRAPHQL_URL is not set. Copy .env.example to .env and set the API URL.",
    );
  }

  return client.request<T>(document, variables);
}
