export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook/rebuild") {
      return handleWebhook(request, env);
    }
    if (url.pathname === "/api/search") {
      return handleSearchApi(request, env);
    }

    return handleFrontend(request, env);
  },
};

type PurgeCacheResponse = {
  success: boolean;
  errors?: Array<{ message?: string }>;
};

type GlobalSearchPayload = {
  data?: {
    search?: {
      total?: number | null;
      items?: Array<{
        id?: string | null;
        databaseId?: number | null;
        title?: string | null;
        slug?: string | null;
      }> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const GLOBAL_SEARCH_QUERY = `
  query GlobalSearch($search: String!, $limit: Int!, $offset: Int!) {
    search(search: $search, limit: $limit, offset: $offset) {
      total
      items {
        id
        databaseId
        title
        slug
      }
    }
  }
`;

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = request.headers.get("X-Waterway-Webhook-Secret");

  if (secret !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await purgeCache(env);
    return new Response("Cache cleared");
  } catch (e) {
    console.error("Purge failed:", e);
    return new Response("Purge failed", { status: 500 });
  }
}

function jsonResponse(
  body: unknown,
  init?: { status?: number; origin?: string | null },
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (init?.origin) {
    headers.set("Access-Control-Allow-Origin", init.origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers,
  });
}

async function handleSearchApi(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    const headers = new Headers();
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return jsonResponse({ total: 0, items: [], error: "Method Not Allowed" }, {
      status: 405,
      origin,
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.floor(limitRaw)))
    : 20;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;

  if (!query) {
    return jsonResponse({ total: 0, items: [] }, { origin });
  }

  const endpoint = env.PUBLIC_GRAPHQL_URL;
  if (!endpoint) {
    return jsonResponse(
      { total: 0, items: [], error: "PUBLIC_GRAPHQL_URL is not configured" },
      { status: 500, origin },
    );
  }
  const user = env.GRAPHQL_BASIC_USER || "api";
  const pass = env.GRAPHQL_BASIC_PASSWORD || "apiwaterway";
  const auth = btoa(`${user}:${pass}`);

  try {
    const gqlRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        query: GLOBAL_SEARCH_QUERY,
        variables: { search: query, limit, offset },
      }),
    });
    const payload = (await gqlRes.json()) as GlobalSearchPayload;
    if (!gqlRes.ok || payload.errors?.length) {
      const message =
        payload.errors?.[0]?.message ||
        `GraphQL search failed with status ${gqlRes.status}`;
      return jsonResponse(
        { total: 0, items: [], error: message },
        { status: 502, origin },
      );
    }
    const total = Number(payload.data?.search?.total ?? 0);
    const items = (payload.data?.search?.items ?? [])
      .filter((item) => item?.slug && item?.title)
      .map((item) => ({
        id: item.id ?? null,
        databaseId: item.databaseId ?? null,
        title: String(item.title ?? "").trim(),
        slug: String(item.slug ?? "").trim(),
      }));
    return jsonResponse({ total, items }, { origin });
  } catch (error) {
    return jsonResponse(
      {
        total: 0,
        items: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, origin },
    );
  }
}

async function purgeCache(env: Env): Promise<PurgeCacheResponse> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        purge_everything: true,
      }),
    },
  );

  const data = (await res.json()) as PurgeCacheResponse;

  console.log("Purge response:", data);

  if (!res.ok || !data.success) {
    const message = data.errors?.[0]?.message ?? "Purge failed";
    throw new Error(message);
  }

  return data;
}

async function handleFrontend(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(request);
}
