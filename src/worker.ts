import {
  getSalesRepsOAuthBearer,
  invalidateSalesRepsOpsOAuth,
} from "./sales-reps-ops-oauth";

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
    if (url.pathname === "/api/distributor-locations") {
      return handleDistributorLocationsInRadiusApi(request, env);
    }
    if (url.pathname === "/api/geocode-zip") {
      return handleGeocodeZipApi(request, env);
    }
    if (url.pathname === "/api/maps-browser-key") {
      return handleMapsBrowserKeyApi(request, env);
    }
    if (url.pathname === "/api/product-category-products") {
      return handleProductCategoryProductsApi(request, env);
    }
    if (url.pathname === "/api/sales-reps") {
      return handleSalesRepsApi(request, env);
    }
    if (url.pathname === "/api/cross-ref-find") {
      return handleCrossRefFindApi(request, env);
    }
    if (url.pathname === "/api/cross-ref-filters") {
      return handleCrossRefFiltersApi(request, env);
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
    return jsonResponse(
      { total: 0, items: [], error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
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
    return jsonResponse(
      { items: [], error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
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

/** Base URL for `…/in-radius` (same host as ERP; optional env override). */
const DEFAULT_DISTRIBUTOR_LOCATIONS_ROOT =
  "https://wwoperations.waterwayplastics.com/WaterwayAPI/locations";

const DEFAULT_CROSS_REF_API_ROOT = "https://api.waterwayplastics.com";
const CROSS_REF_FIND_PATH = "/wp-json/waterway-cross-ref/v1/find";
const CROSS_REF_FILTERS_PATH = "/wp-json/waterway-cross-ref/v1/filters";

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
};

function mapSalesRepRow(raw: unknown): {
  name: string;
  phone: string;
  email: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { name: "", phone: "", email: null };
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
  return { name, phone, email };
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
    return jsonResponse(
      { reps: [], error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
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

  let bearer = await getSalesRepsOAuthBearer(env);
  if (!bearer) {
    return jsonResponse(
      {
        reps: [],
        error:
          "Sales representatives: set worker secret SALES_REPS_OAUTH_PASSWORD (ERP API user password for /connect). Short-lived access_token is issued inside the worker, not stored in secrets.",
      },
      { status: 503, origin },
    );
  }

  const root = (env.SALES_REPS_API_ROOT ?? DEFAULT_SALES_REPS_API_ROOT).replace(
    /\/+$/,
    "",
  );
  /** Production: default root → direct to Waterway Operations. Local (Belarus etc.): set `SALES_REPS_API_ROOT` to a U.S. relay that forwards to the same path. */
  const upstreamUrl = `${root}/sales-reps?zip=${encodeURIComponent(zip)}`;

  try {
    const runFetch = (auth: string) =>
      fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth}`,
        },
      });

    let upstream = await runFetch(bearer);
    if (upstream.status === 401) {
      invalidateSalesRepsOpsOAuth();
      const again = await getSalesRepsOAuthBearer(env);
      if (again) {
        bearer = again;
        upstream = await runFetch(bearer);
      }
    }

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
        { status: 502, origin },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse(
        {
          reps: [],
          error: "Invalid response from sales representatives service.",
        },
        { status: 502, origin },
      );
    }

    if (!Array.isArray(parsed)) {
      return jsonResponse(
        {
          reps: [],
          error: "Unexpected response from sales representatives service.",
        },
        { status: 502, origin },
      );
    }

    const reps = parsed
      .map(mapSalesRepRow)
      .filter((r) => r.name || r.phone || r.email);
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

function readDistributorLocationsRoot(env: Env): string {
  const custom = (env as Env & { DISTRIBUTOR_LOCATOR_LOCATIONS_ROOT?: string })
    .DISTRIBUTOR_LOCATOR_LOCATIONS_ROOT;
  const raw = (custom ?? DEFAULT_DISTRIBUTOR_LOCATIONS_ROOT).trim();
  return raw.replace(/\/+$/, "");
}

async function handleDistributorLocationsInRadiusApi(
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
    return jsonResponse(
      { locations: [], error: "Method Not Allowed" },
      { status: 405, origin },
    );
  }

  const url = new URL(request.url);
  const zip = normalizeSalesRepsZipParam(url.searchParams.get("zip") ?? "");
  if (!zip || !isValidSalesRepsZip(zip)) {
    return jsonResponse(
      { locations: [], error: "A valid U.S. ZIP code is required." },
      { status: 400, origin },
    );
  }

  const country =
    (url.searchParams.get("country") ?? "US")
      .trim()
      .slice(0, 2)
      .toUpperCase() || "US";
  const distRaw = url.searchParams.get("distance");
  let distance = 20;
  if (distRaw != null && distRaw !== "") {
    const n = Number(distRaw);
    if (Number.isFinite(n))
      distance = Math.min(5000, Math.max(1, Math.floor(n)));
  }
  const unitRaw = (url.searchParams.get("unit") ?? "mi").toLowerCase();
  const unit = ["m", "km", "mi", "ft"].includes(unitRaw) ? unitRaw : "mi";
  const btRaw = (url.searchParams.get("businessType") ?? "All").trim();
  const businessType = ["Pool", "Spa", "All"].includes(btRaw) ? btRaw : "All";

  let bearer = await getSalesRepsOAuthBearer(env);
  if (!bearer) {
    return jsonResponse(
      {
        locations: [],
        error:
          "Distributor locator: set worker secret SALES_REPS_OAUTH_PASSWORD (ERP token, same as sales reps).",
      },
      { status: 503, origin },
    );
  }

  const root = readDistributorLocationsRoot(env);
  const params = new URLSearchParams({
    zip,
    country,
    distance: String(distance),
    unit,
    businessType,
  });
  const upstreamUrl = `${root}/in-radius?${params.toString()}`;

  try {
    const runFetch = (auth: string) =>
      fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth}`,
        },
      });

    let upstream = await runFetch(bearer);
    if (upstream.status === 401) {
      invalidateSalesRepsOpsOAuth();
      const again = await getSalesRepsOAuthBearer(env);
      if (again) {
        bearer = again;
        upstream = await runFetch(bearer);
      }
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      let detail = text.slice(0, 200);
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j?.message) detail = String(j.message);
      } catch {
        /* keep slice */
      }
      return jsonResponse(
        {
          locations: [],
          error: `Locator service error (${upstream.status}). ${detail}`.trim(),
        },
        { status: 502, origin },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse(
        { locations: [], error: "Invalid JSON from locator service." },
        { status: 502, origin },
      );
    }

    if (!Array.isArray(parsed)) {
      return jsonResponse(
        { locations: [], error: "Unexpected locator response." },
        { status: 502, origin },
      );
    }

    return jsonResponse({ locations: parsed }, { origin });
  } catch (error) {
    return jsonResponse(
      {
        locations: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, origin },
    );
  }
}

type GeocodeZipJson = {
  results?: Array<{
    geometry?: { location?: { lat: number; lng: number } };
  }>;
  status?: string;
};

async function handleGeocodeZipApi(
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
    return jsonResponse(
      { lat: null, lng: null, error: "Method Not Allowed" },
      { status: 405, origin },
    );
  }

  const url = new URL(request.url);
  const zip = normalizeSalesRepsZipParam(url.searchParams.get("zip") ?? "");
  if (!zip || !isValidSalesRepsZip(zip)) {
    return jsonResponse(
      { lat: null, lng: null, error: "A valid U.S. ZIP code is required." },
      { status: 400, origin },
    );
  }

  const key = (
    env as Env & { GOOGLE_GEOCODING_KEY?: string }
  ).GOOGLE_GEOCODING_KEY?.trim();
  if (!key) {
    return jsonResponse(
      { lat: null, lng: null, configured: false },
      { origin },
    );
  }

  const zip5 = zip.replace(/\D/g, "").slice(0, 5);
  const gUrl =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({
      components: `country:US|postal_code:${zip5}`,
      key,
    }).toString();

  try {
    const res = await fetch(gUrl);
    const data = (await res.json()) as GeocodeZipJson;
    const loc = data.results?.[0]?.geometry?.location;
    if (
      !loc ||
      typeof loc.lat !== "number" ||
      typeof loc.lng !== "number" ||
      !Number.isFinite(loc.lat) ||
      !Number.isFinite(loc.lng)
    ) {
      return jsonResponse(
        { lat: null, lng: null, status: data.status ?? "UNKNOWN" },
        { origin },
      );
    }
    return jsonResponse(
      { lat: loc.lat, lng: loc.lng, configured: true },
      { origin },
    );
  } catch (error) {
    return jsonResponse(
      {
        lat: null,
        lng: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, origin },
    );
  }
}

/** Google Maps JS browser key at runtime (Worker secret). Used when GitHub build did not embed PUBLIC_GOOGLE_MAPS_BROWSER_KEY. */
async function handleMapsBrowserKeyApi(
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
    return jsonResponse({ key: "", error: "Method Not Allowed" }, { status: 405, origin });
  }
  const key =
    (env as Env & { GOOGLE_MAPS_BROWSER_KEY?: string }).GOOGLE_MAPS_BROWSER_KEY?.trim() ??
    "";
  return jsonResponse({ key }, { origin });
}

type CrossRefApiMode = "find" | "filters";

function readCrossRefApiRoot(env: Env): string {
  const custom = (
    env as Env & {
      CROSS_REF_API_ROOT?: string;
    }
  ).CROSS_REF_API_ROOT;
  const root = (custom ?? DEFAULT_CROSS_REF_API_ROOT).trim();
  return root.replace(/\/+$/, "");
}

function readCrossRefApiKey(env: Env): string {
  return (
    (
      env as Env & {
        CROSS_REF_API_KEY?: string;
      }
    ).CROSS_REF_API_KEY ?? ""
  ).trim();
}

function readCrossRefBasicAuth(env: Env): string {
  const customUser = (
    env as Env & {
      CROSS_REF_BASIC_USER?: string;
    }
  ).CROSS_REF_BASIC_USER;
  const customPass = (
    env as Env & {
      CROSS_REF_BASIC_PASSWORD?: string;
    }
  ).CROSS_REF_BASIC_PASSWORD;

  const user = (customUser ?? env.GRAPHQL_BASIC_USER ?? "api").trim();
  const pass = (
    customPass ??
    env.GRAPHQL_BASIC_PASSWORD ??
    "apiwaterway"
  ).trim();
  return btoa(`${user}:${pass}`);
}

function appendCrossRefQueryParams(
  upstream: URL,
  mode: CrossRefApiMode,
  reqUrl: URL,
  env: Env,
): string | null {
  if (mode === "find") {
    const brand = (reqUrl.searchParams.get("brand") ?? "").trim();
    const model = (reqUrl.searchParams.get("model") ?? "").trim();
    const partNumber = (reqUrl.searchParams.get("part_number") ?? "").trim();
    const motorNumber = (reqUrl.searchParams.get("motor_number") ?? "").trim();
    const hpMin =
      (reqUrl.searchParams.get("hp_min") ?? "").trim() ||
      (reqUrl.searchParams.get("hp") ?? "").trim();
    if (!brand && !model && !partNumber && !motorNumber && !hpMin) {
      return "At least one filter is required for /find.";
    }
    if (brand) upstream.searchParams.set("brand", brand);
    if (model) upstream.searchParams.set("model", model);
    if (partNumber) upstream.searchParams.set("part_number", partNumber);
    if (motorNumber) upstream.searchParams.set("motor_number", motorNumber);
    if (hpMin) upstream.searchParams.set("hp_min", hpMin);
  } else {
    const brand = (reqUrl.searchParams.get("brand") ?? "").trim();
    const model = (reqUrl.searchParams.get("model") ?? "").trim();
    if (brand) upstream.searchParams.set("brand", brand);
    if (model) upstream.searchParams.set("model", model);
  }

  const envKey = readCrossRefApiKey(env);
  if (envKey) upstream.searchParams.set("key", envKey);
  return null;
}

async function handleCrossRefProxyApi(
  request: Request,
  env: Env,
  mode: CrossRefApiMode,
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
    return jsonResponse(
      { error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
  }

  const reqUrl = new URL(request.url);
  const root = readCrossRefApiRoot(env);
  const path = mode === "find" ? CROSS_REF_FIND_PATH : CROSS_REF_FILTERS_PATH;
  const upstream = new URL(`${root}${path}`);
  const validationError = appendCrossRefQueryParams(
    upstream,
    mode,
    reqUrl,
    env,
  );
  if (validationError) {
    return jsonResponse({ error: validationError }, { status: 400, origin });
  }

  try {
    const auth = readCrossRefBasicAuth(env);
    const res = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep raw text */
    }
    if (!res.ok) {
      let message = `Cross Reference API error (${res.status}).`;
      if (
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof (parsed as Record<string, unknown>).error === "string"
      ) {
        message = String((parsed as Record<string, unknown>).error);
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as Record<string, unknown>).message === "string"
      ) {
        message = String((parsed as Record<string, unknown>).message);
      }
      return jsonResponse({ error: message }, { status: 502, origin });
    }
    if (parsed !== null) {
      return jsonResponse(parsed, {
        origin,
        cacheControl: "public, max-age=30",
      });
    }
    return jsonResponse(
      {
        error: "Invalid JSON from Cross Reference API.",
      },
      { status: 502, origin },
    );
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, origin },
    );
  }
}

async function handleCrossRefFindApi(
  request: Request,
  env: Env,
): Promise<Response> {
  return handleCrossRefProxyApi(request, env, "find");
}

async function handleCrossRefFiltersApi(
  request: Request,
  env: Env,
): Promise<Response> {
  return handleCrossRefProxyApi(request, env, "filters");
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
    return jsonResponse(
      { items: [], error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
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
    return jsonResponse(
      { error: "Method Not Allowed" },
      {
        status: 405,
        origin,
      },
    );
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
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;

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
  const response = await env.ASSETS.fetch(request);
  if (response.status === 404) {
    const url = new URL(request.url);
    const errorResponse = await env.ASSETS.fetch(
      new Request(`${url.origin}/404.html`),
    );

    return new Response(errorResponse.body, {
      ...errorResponse,
      status: 404,
    });
  }

  return response;
}
