export {};

function displayLines(row: Record<string, unknown>): string[] {
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

function appendRows(
  list: HTMLUListElement,
  rows: Record<string, unknown>[],
): void {
  for (const row of rows) {
    const li = document.createElement("li");
    li.className = "dl-page__location";
    for (const line of displayLines(row)) {
      const p = document.createElement("p");
      p.className = "dl-page__location-line";
      p.textContent = line;
      li.appendChild(p);
    }
    list.appendChild(li);
  }
}

const root = document.querySelector<HTMLElement>("[data-dl-locator]");
const list = root?.querySelector<HTMLUListElement>("[data-dl-list]");
const btn = root?.querySelector<HTMLButtonElement>("[data-dl-more]");

if (root && list && btn) {
  btn.addEventListener("click", async () => {
    const limit = Number.parseInt(root.dataset.limit ?? "10", 10) || 10;
    let offset = Number.parseInt(root.dataset.nextOffset ?? "0", 10) || 0;
    const hasMore = root.dataset.hasMore === "1";
    if (!hasMore) return;

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Loading…";

    try {
      const res = await fetch(
        `/api/store-locations?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
      );
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error("Invalid JSON from store-locations API");
      }

      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(parsed)) {
        rows = parsed as Record<string, unknown>[];
      } else if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, unknown>;
        if (Array.isArray(o.data)) rows = o.data as Record<string, unknown>[];
        else if (Array.isArray(o.locations))
          rows = o.locations as Record<string, unknown>[];
        else if (Array.isArray(o.results))
          rows = o.results as Record<string, unknown>[];
        else if (Array.isArray(o.items))
          rows = o.items as Record<string, unknown>[];
      }

      appendRows(list, rows);
      offset += rows.length;
      root.dataset.nextOffset = String(offset);

      const totalRaw =
        parsed && typeof parsed === "object" && "total" in parsed
          ? Number((parsed as { total?: unknown }).total)
          : NaN;
      const hasTotal = Number.isFinite(totalRaw) && totalRaw >= 0;
      const more =
        rows.length > 0 &&
        (rows.length >= limit || (hasTotal && offset < totalRaw));
      root.dataset.hasMore = more ? "1" : "0";
      if (!more || rows.length === 0) {
        btn.hidden = true;
        const hint = root.querySelector(".dl-page__hint");
        if (hint instanceof HTMLElement) hint.hidden = true;
      }
    } catch {
      btn.textContent = prev ?? "Load more";
      btn.disabled = false;
      return;
    }

    btn.textContent = prev ?? "Load more";
    btn.disabled = false;
  });
}
