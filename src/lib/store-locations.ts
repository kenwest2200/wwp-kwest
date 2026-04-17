/**
 * WordPress plugin REST: /wp-json/restapi/v2/store-locations?limit=&offset=
 * Base URL: PUBLIC_WORDPRESS_ORIGIN (e.g. https://www.waterwayplastics.com)
 */

export type StoreLocationRow = Record<string, unknown>;

export type StoreLocationsPageResult = {
  rows: StoreLocationRow[];
  total: number | null;
  raw: unknown;
};

function num(n: unknown): number | null {
  const x = typeof n === "number" ? n : Number.parseFloat(String(n));
  return Number.isFinite(x) ? x : null;
}

export function normalizeStoreLocationsPayload(json: unknown): StoreLocationsPageResult {
  if (Array.isArray(json)) {
    return { rows: json as StoreLocationRow[], total: json.length, raw: json };
  }
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) {
      return {
        rows: o.data as StoreLocationRow[],
        total: num(o.total) ?? num(o.count) ?? o.data.length,
        raw: json,
      };
    }
    if (Array.isArray(o.locations)) {
      return {
        rows: o.locations as StoreLocationRow[],
        total: num(o.total) ?? o.locations.length,
        raw: json,
      };
    }
    if (Array.isArray(o.results)) {
      return {
        rows: o.results as StoreLocationRow[],
        total: num(o.total) ?? num(o.total_count) ?? o.results.length,
        raw: json,
      };
    }
    if (Array.isArray(o.items)) {
      return {
        rows: o.items as StoreLocationRow[],
        total: num(o.total) ?? o.items.length,
        raw: json,
      };
    }
  }
  return { rows: [], total: null, raw: json };
}

export function getWordPressOrigin(): string | null {
  const fromEnv = import.meta.env.PUBLIC_WORDPRESS_ORIGIN;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, "");
  }
  return null;
}

export async function fetchStoreLocationsPage(options: {
  origin: string;
  limit: number;
  offset: number;
}): Promise<StoreLocationsPageResult> {
  const { origin, limit, offset } = options;
  const base = origin.replace(/\/+$/, "");
  const url = `${base}/wp-json/restapi/v2/store-locations?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`;
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = { parseError: true, text: text.slice(0, 500) };
  }
  if (!res.ok) {
    return { rows: [], total: null, raw: { status: res.status, body: json } };
  }
  return normalizeStoreLocationsPayload(json);
}

/** Human-readable lines from arbitrary plugin payload */
export function storeLocationDisplayLines(row: StoreLocationRow): string[] {
  const preferKeys = [
    "title",
    "name",
    "store_name",
    "post_title",
    "company",
    "address",
    "address_line_1",
    "city",
    "state",
    "zip",
    "phone",
    "email",
  ];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const k of preferKeys) {
    const v = row[k];
    if (v == null || v === "") continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (!s) continue;
    lines.push(s);
    seen.add(k);
  }
  if (lines.length === 0) {
    for (const [k, v] of Object.entries(row)) {
      if (seen.has(k)) continue;
      if (v == null || typeof v === "object") continue;
      const s = String(v).trim();
      if (s) lines.push(`${k}: ${s}`);
    }
  }
  return lines.slice(0, 8);
}
