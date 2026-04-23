export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook/rebuild") {
      return handleWebhook(request, env);
    }
    if (url.pathname === "/api/search") {
      return handleSearchApi(request, env);
    }
    if (url.pathname === "/api/search-autocomplete") {
      return handleSearchAutocompleteApi(request, env);
    }
    if (url.pathname === "/api/store-locations") {
      return handleStoreLocationsApi(request, env);
    }
    if (url.pathname === "/api/product-category-products") {
      return handleProductCategoryProductsApi(request, env);
    }
    if (url.pathname === "/api/sales-reps") {
      return handleSalesRepsApi(request, env);
    }

    return handleFrontend(request, env);
  },
};

type PurgeCacheResponse = {
  success: boolean;
  errors?: Array<{ message?: string }>;
};

type SearchImage = {
  url?: string | null;
  thumbnails?: {
    small?: string | null;
    medium?: string | null;
  } | null;
} | null;

type SearchItemRaw = {
  title?: string | null;
  uri?: string | null;
  image?: SearchImage;
  subcategory?: string | null;
  description?: string | null;
  type?: string | null;
};

type GlobalSearchPayload = {
  data?: {
    search?: {
      total?: number | null;
      items?: SearchItemRaw[] | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type SearchAutocompletePayload = {
  data?: {
    searchAutocomplete?: {
      items?: Array<{
        title?: string | null;
        uri?: string | null;
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
        title
        uri
        image {
          url
          thumbnails {
            small
            medium
          }
        }
        subcategory
        description
        type
      }
    }
  }
`;

const GLOBAL_SEARCH_AUTOCOMPLETE_QUERY = `
  query SearchAutocomplete($search: String!, $limit: Int!) {
    searchAutocomplete(search: $search, limit: $limit) {
      items {
        title
        uri
      }
    }
  }
`;

/** Pool calculator “suitable parts” — same category slugs as in `public/data/product-filters.json`. */
const PRODUCT_CATEGORY_PRODUCTS_ALLOWED_SLUGS = new Set([
  "pool-pumps-in-ground",
  "pool-filters-in-ground-above-ground",
  "pool-skimmers-skim-filters",
  "drains-suctions",
]);

const PRODUCT_CATEGORY_PRODUCTS_QUERY = `
  query ProductCategoryProducts($slug: ID!) {
    productCategory(id: $slug, idType: SLUG) {
      databaseId
      name
      slug
      products(first: 100) {
        nodes {
          databaseId
          title
          slug
          uri
        }
      }
    }
  }
`;

type ProductCategoryProductsPayload = {
  data?: {
    productCategory?: {
      databaseId?: number | null;
      name?: string | null;
      slug?: string | null;
      products?: {
        nodes?: Array<{
          databaseId?: number | null;
          title?: string | null;
          slug?: string | null;
          uri?: string | null;
        } | null> | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

function mapSearchApiItem(item: SearchItemRaw) {
  return {
    title: String(item.title ?? "").trim(),
    uri: String(item.uri ?? "").trim(),
    image: item.image
      ? {
          url: item.image.url ?? null,
          thumbnails: item.image.thumbnails
            ? {
                small: item.image.thumbnails.small ?? null,
                medium: item.image.thumbnails.medium ?? null,
              }
            : null,
        }
      : null,
    subcategory: item.subcategory ? String(item.subcategory).trim() : null,
    description: item.description ? String(item.description).trim() : null,
    type: normalizeSearchItemType(item.type),
  };
}

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
  init?: {
    status?: number;
    origin?: string | null;
    /** When set, replaces default `Cache-Control: no-store`. */
    cacheControl?: string | null;
  },
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": init?.cacheControl ?? "no-store",
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
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 20;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;

  if (!query) {
    return jsonResponse({ total: 0, items: [] }, { origin });
  }

  const typeParam = (url.searchParams.get("type") ?? "").trim().toLowerCase();
  const onlyType: "product" | "page" | null =
    typeParam === "product" || typeParam === "page" ? typeParam : null;

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
    if (!onlyType) {
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
        .filter((item) => item?.uri && item?.title)
        .map((item) => mapSearchApiItem(item));
      return jsonResponse({ total, items }, { origin });
    }

    const SEARCH_TYPE_FILTER_MAX_SCAN = 600;
    const rawAccum: SearchItemRaw[] = [];
    let gqlOffset = 0;
    while (rawAccum.length < SEARCH_TYPE_FILTER_MAX_SCAN) {
      const batchLimit = Math.min(
        100,
        SEARCH_TYPE_FILTER_MAX_SCAN - rawAccum.length,
      );
      const gqlRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          query: GLOBAL_SEARCH_QUERY,
          variables: {
            search: query,
            limit: batchLimit,
            offset: gqlOffset,
          },
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
      const batch = payload.data?.search?.items ?? [];
      if (!batch.length) break;
      rawAccum.push(...batch);
      gqlOffset += batch.length;
      if (batch.length < batchLimit) break;
    }

    const mapped = rawAccum
      .filter((item) => item?.uri && item?.title)
      .map((item) => mapSearchApiItem(item));
    const filtered = mapped.filter((item) => {
      const kind = item.type === "page" ? "page" : "product";
      return kind === onlyType;
    });
    const total = filtered.length;
    const sliced = filtered.slice(offset, offset + limit);
    return jsonResponse({ total, items: sliced }, { origin });
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

function normalizeSearchItemType(
  raw: string | null | undefined,
): "product" | "page" | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "product" || t === "page") return t;
  return null;
}

async function handleProductCategoryProductsApi(
  request: Request,
  env: Env,
): Promise<Response> {
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
    return jsonResponse({ items: [], error: "Method Not Allowed" }, {
      status: 405,
      origin,
    });
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  if (!slug || !PRODUCT_CATEGORY_PRODUCTS_ALLOWED_SLUGS.has(slug)) {
    return jsonResponse(
      { items: [], error: "Unknown or missing category slug" },
      { status: 400, origin },
    );
  }

  const endpoint = env.PUBLIC_GRAPHQL_URL;
  if (!endpoint) {
    return jsonResponse(
      { items: [], error: "PUBLIC_GRAPHQL_URL is not configured" },
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
        query: PRODUCT_CATEGORY_PRODUCTS_QUERY,
        variables: { slug },
      }),
    });
    const payload = (await gqlRes.json()) as ProductCategoryProductsPayload;
    if (!gqlRes.ok || payload.errors?.length) {
      const message =
        payload.errors?.[0]?.message ||
        `GraphQL productCategory failed with status ${gqlRes.status}`;
      return jsonResponse(
        { items: [], error: message },
        { status: 502, origin },
      );
    }
    const cat = payload.data?.productCategory;
    const nodes = cat?.products?.nodes ?? [];
    const items = nodes
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .filter((n) => n.uri && n.title)
      .map((n) => ({
        databaseId: n.databaseId ?? null,
        title: String(n.title ?? "").trim(),
        slug: n.slug ? String(n.slug).trim() : null,
        uri: String(n.uri ?? "").trim(),
      }));
    return jsonResponse(
      {
        items,
        category: cat
          ? {
              databaseId: cat.databaseId ?? null,
              name: cat.name ? String(cat.name).trim() : null,
              slug: cat.slug ? String(cat.slug).trim() : null,
            }
          : null,
      },
      { origin, cacheControl: "public, max-age=120" },
    );
  } catch (error) {
    return jsonResponse(
      {
        items: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, origin },
    );
  }
}

const DEFAULT_SALES_REPS_API_ROOT =
  "https://wwoperations.waterwayplastics.com/WaterwayAPI/locations";

function normalizeSalesRepsZipParam(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function isValidSalesRepsZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

type SalesRepUpstreamRow = {
  Name?: string;
  Phone?: string;
  Email?: string | null;
  Location?: string | null;
  Territory?: string | null;
};

function mapSalesRepRow(raw: unknown): {
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { name: "", phone: "", email: null, location: null };
  }
  const o = raw as SalesRepUpstreamRow & Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v).trim());
  const name = str(o.Name);
  const phone = str(o.Phone);
  const emailRaw = o.Email;
  const email =
    emailRaw == null || String(emailRaw).trim() === ""
      ? null
      : String(emailRaw).trim();
  const loc = o.Location ?? o.Territory;
  const location =
    loc == null || String(loc).trim() === "" ? null : String(loc).trim();
  return { name, phone, email, location };
}

async function handleSalesRepsApi(
  request: Request,
  env: Env,
): Promise<Response> {
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
    return jsonResponse({ reps: [], error: "Method Not Allowed" }, {
      status: 405,
      origin,
    });
  }

  const url = new URL(request.url);
  const zip = normalizeSalesRepsZipParam(url.searchParams.get("zip") ?? "");
  if (!zip) {
    return jsonResponse(
      { reps: [], error: "ZIP code is required." },
      { status: 400, origin },
    );
  }
  if (!isValidSalesRepsZip(zip)) {
    return jsonResponse(
      {
        reps: [],
        error: "Enter a valid U.S. ZIP code (5 digits or ZIP+4).",
      },
      { status: 400, origin },
    );
  }

  const token = env.SALES_REPS_ACCESS_TOKEN?.trim();
  if (!token) {
    return jsonResponse(
      {
        reps: [],
        error: "Sales representatives lookup is not configured.",
      },
      { status: 503, origin },
    );
  }

  const root = (env.SALES_REPS_API_ROOT ?? DEFAULT_SALES_REPS_API_ROOT).replace(
    /\/+$/,
    "",
  );
  const upstreamUrl = `${root}/sales-reps?zip=${encodeURIComponent(zip)}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      let detail = text.slice(0, 200);
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j?.message) detail = String(j.message);
      } catch {
        /* keep text slice */
      }
      return jsonResponse(
        {
          reps: [],
          error:
            upstream.status === 401
              ? "Sales representatives service rejected credentials."
              : `Sales representatives service error (${upstream.status}). ${detail}`.trim(),
        },
        { status: upstream.status === 401 ? 502 : 502, origin },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse(
        { reps: [], error: "Invalid response from sales representatives service." },
        { status: 502, origin },
      );
    }

    if (!Array.isArray(parsed)) {
      return jsonResponse(
        { reps: [], error: "Unexpected response from sales representatives service." },
        { status: 502, origin },
      );
    }

    const reps = parsed.map(mapSalesRepRow).filter((r) => r.name || r.phone || r.email);
    return jsonResponse({ reps }, { origin });
  } catch (error) {
    return jsonResponse(
      {
        reps: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, origin },
    );
  }
}

async function handleSearchAutocompleteApi(
  request: Request,
  env: Env,
): Promise<Response> {
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
    return jsonResponse({ items: [], error: "Method Not Allowed" }, {
      status: 405,
      origin,
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(10, Math.floor(limitRaw)))
    : 5;

  if (query.length < 2) {
    return jsonResponse({ items: [] }, { origin });
  }

  const endpoint = env.PUBLIC_GRAPHQL_URL;
  if (!endpoint) {
    return jsonResponse(
      { items: [], error: "PUBLIC_GRAPHQL_URL is not configured" },
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
        query: GLOBAL_SEARCH_AUTOCOMPLETE_QUERY,
        variables: { search: query, limit },
      }),
    });
    const payload = (await gqlRes.json()) as SearchAutocompletePayload;
    if (!gqlRes.ok || payload.errors?.length) {
      const message =
        payload.errors?.[0]?.message ||
        `GraphQL searchAutocomplete failed with status ${gqlRes.status}`;
      return jsonResponse(
        { items: [], error: message },
        { status: 502, origin },
      );
    }
    const items = (payload.data?.searchAutocomplete?.items ?? [])
      .filter((item) => item?.uri && item?.title)
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        uri: String(item.uri ?? "").trim(),
      }));
    return jsonResponse({ items }, { origin });
  } catch (error) {
    return jsonResponse(
      {
        items: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, origin },
    );
  }
}

async function handleStoreLocationsApi(
  request: Request,
  env: Env,
): Promise<Response> {
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
    return jsonResponse({ error: "Method Not Allowed" }, {
      status: 405,
      origin,
    });
  }

  const wpOrigin = env.PUBLIC_WORDPRESS_ORIGIN;
  if (!wpOrigin?.trim()) {
    return jsonResponse(
      { error: "PUBLIC_WORDPRESS_ORIGIN is not configured" },
      { status: 500, origin },
    );
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 10;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

  const base = wpOrigin.replace(/\/+$/, "");
  const upstream = `${base}/wp-json/restapi/v2/store-locations?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`;

  try {
    const res = await fetch(upstream);
    const text = await res.text();
    const headers = new Headers({
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "public, max-age=60",
    });
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    return new Response(text, { status: res.status, headers });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, origin },
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
