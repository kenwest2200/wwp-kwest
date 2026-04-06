// Product filters page client script (DOM ids from ProductFiltersPanel.astro)

const rootEl = document.getElementById("product-filters-root");
const subEl = document.getElementById("product-filters-sub");
const attrsEl = document.getElementById("product-filters-attrs");
const attrsSectionEl = document.getElementById("product-filters-attrs-section");
const productsEl = document.getElementById("product-filters-products");
const productsEmptyEl = document.getElementById("product-filters-empty");
const productsTotalEl = document.getElementById(
  "product-filters-products-total",
);
const activeFiltersEl = document.getElementById("product-filters-active-filters");
const activeFiltersRowEl = document.getElementById(
  "product-filters-active-filters-row",
);
const activeFiltersToggleEl = document.getElementById(
  "product-filters-active-filters-toggle",
);
const prevBtn = document.getElementById("product-filters-prev");
const nextBtn = document.getElementById("product-filters-next");
const pageEl = document.getElementById("product-filters-page");
const clearBtn = document.getElementById("product-filters-clear");
const errEl = document.getElementById("product-filters-api-error");
const countEl = document.getElementById("product-filters-count");
const searchInput = document.getElementById(
  "product-filters-search",
) as HTMLInputElement | null;
const perSelect = document.getElementById(
  "product-filters-per",
) as HTMLSelectElement | null;
const sortSelect = document.getElementById(
  "product-filters-sort",
) as HTMLSelectElement | null;

const selectedRoot = new Set<string>();
const selectedSub = new Set<string>();
const selectedAttrs = new Set<string>();
type AttrValue = { label: string; slug: string };
type AttrByCategoryRow = { name: string; slug: string; values: AttrValue[] };

type MergedSubItem = {
  databaseId?: number | null;
  slug: string;
  name: string;
  uri?: string | null;
};
type MergedSubGroup = {
  groupSlug: string;
  groupName: string;
  subcategories: MergedSubItem[];
};

type Product = {
  title: string;
  slug: string;
  categorySlugs: string[];
  attributeSlugs: string[];
  databaseId?: number | null;
  date?: string | null;
  modified?: string | null;
  imageUrl?: string | null;
};

const PRODUCT_IMAGE_PLACEHOLDER = "/images/no-product-image.svg";

let allProducts: Product[] = [];
const mergedSubcategoryGroupsBySelection = new Map<string, MergedSubGroup[]>();
const attributesByCategoryMap = new Map<string, AttrByCategoryRow[]>();
/** Slug list from `rootCategories` (used to refresh legacy `rootMap` shim). */
let knownRootSlugs: string[] = [];
/**
 * Legacy: flat subs per root (key = single root slug). Kept so cached/old snippets
 * or HMR that still reference `rootMap` do not throw — not used by current UI.
 */
const rootMap = new Map<string, { name: string; slug: string }[]>();
const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
let pageSize = 24;
let searchQuery = "";
type SortMode = "updated" | "name-asc" | "name-desc";
let sortMode: SortMode = "updated";
let rootCategoriesList: { name: string; slug: string }[] = [];
/** Category slug → display name (roots + every merged sub from all API keys). */
const categorySlugToLabel = new Map<string, string>();
/** Subcategory slug → merged product-type group names (e.g. Pumps). */
const categorySlugToGroupNames = new Map<string, Set<string>>();
/** Product attribute value slug → label (all categories in JSON). */
const attrValueSlugToLabel = new Map<string, string>();
let currentOffset = 0;
let currentTotal = 0;
/** When product-type groups exceed the visible limit, user can expand the rest. */
let subTypesExtraExpanded = false;
const SUBTYPE_GROUPS_VISIBLE_LIMIT = 10;
/** Max active-filter chips before Show / Hide toggles the rest. */
const ACTIVE_FILTER_CHIPS_VISIBLE = 5;
let activeFilterChipsExpanded = false;

type ActiveFilterChip = {
  kind: "root" | "subgroup" | "attr" | "search";
  label: string;
  rootSlug?: string;
  attrSlug?: string;
  memberSlugs?: string[];
};

function parseListParam(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function applyStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const roots = parseListParam(params, "root");
  const sub = parseListParam(params, "sub");
  const attr = parseListParam(params, "attr");
  const page = Number(params.get("page") ?? "1");
  const q = params.get("q") ?? "";
  const perRaw = Number(params.get("per"));
  const sortRaw = params.get("sort");

  selectedRoot.clear();
  selectedSub.clear();
  selectedAttrs.clear();

  roots.forEach((s) => selectedRoot.add(s));
  sub.forEach((s) => selectedSub.add(s));
  attr.forEach((s) => selectedAttrs.add(s));

  searchQuery = q;
  if (
    PAGE_SIZE_OPTIONS.includes(perRaw as (typeof PAGE_SIZE_OPTIONS)[number])
  ) {
    pageSize = perRaw;
  } else {
    pageSize = 24;
  }
  if (sortRaw === "name-asc" || sortRaw === "name-desc") {
    sortMode = sortRaw;
  } else if (sortRaw === "title") {
    sortMode = "name-asc";
  } else if (
    sortRaw === "newest" ||
    sortRaw === "updated" ||
    sortRaw === "oldest"
  ) {
    sortMode = "updated";
  } else {
    sortMode = "updated";
  }

  if (searchInput) searchInput.value = searchQuery;
  if (perSelect) perSelect.value = String(pageSize);
  if (sortSelect) sortSelect.value = sortMode;

  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  currentOffset = (safePage - 1) * pageSize;
}

function syncUrlState() {
  const params = new URLSearchParams(window.location.search);
  const roots = [...selectedRoot];
  const sub = [...selectedSub];
  const attr = [...selectedAttrs];
  const page = Math.floor(currentOffset / pageSize) + 1;

  if (roots.length > 0) params.set("root", roots.join(","));
  else params.delete("root");

  if (sub.length > 0) params.set("sub", sub.join(","));
  else params.delete("sub");

  if (attr.length > 0) params.set("attr", attr.join(","));
  else params.delete("attr");

  const qTrim = searchQuery.trim();
  if (qTrim) params.set("q", qTrim);
  else params.delete("q");

  if (pageSize !== 24) params.set("per", String(pageSize));
  else params.delete("per");

  if (sortMode !== "updated") params.set("sort", sortMode);
  else params.delete("sort");

  if (page > 1) params.set("page", String(page));
  else params.delete("page");

  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState(null, "", url);
}

function setError(text: string | null) {
  if (!errEl) return;
  if (text) {
    errEl.textContent = text;
    errEl.hidden = false;
  } else {
    errEl.textContent = "";
    errEl.hidden = true;
  }
}

function setLoading(on: boolean) {
  if (clearBtn instanceof HTMLButtonElement) clearBtn.disabled = on;
  if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = on;
  if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = on;
  // Do not disable search / per-page / sort: data is local; disabling drops focus from the search field on every keystroke.
  [rootEl, subEl, attrsEl].forEach((el) => {
    if (!el) return;
    el.querySelectorAll<HTMLInputElement>("input[type='checkbox']").forEach(
      (input) => {
        input.disabled = on;
      },
    );
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** WP / JSON may ship labels as HTML entities (e.g. &amp;). Decode, then escape for safe HTML. */
function decodeHtmlEntities(s: string): string {
  if (!s) return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

function safeDisplayText(s: string): string {
  return escapeHtml(decodeHtmlEntities(s));
}

function syncRootMapLegacyShim() {
  rootMap.clear();
  for (const slug of knownRootSlugs) {
    const groups = mergedSubcategoryGroupsBySelection.get(slug) ?? [];
    rootMap.set(
      slug,
      groups.flatMap((g) =>
        (g.subcategories ?? []).map((s) => ({
          name: s.name,
          slug: s.slug,
        })),
      ),
    );
  }
}

function refreshAllSet() {
  syncRootMapLegacyShim();
}

/**
 * Key into `mergedSubcategoryGroupsBySelection` — must match build script keys.
 * If no root is checked, use all known roots so subcategory groups match the wireframe
 * ("all unique product types across all categories").
 */
function getMergedDataKey(): string {
  if (selectedRoot.size > 0) {
    return [...selectedRoot].sort().join(",");
  }
  if (knownRootSlugs.length > 0) {
    return [...knownRootSlugs].sort().join(",");
  }
  return "";
}

/** Subcategory slugs currently shown in the Product type panel. */
function getSubSlugsAllowedInPanel(): Set<string> {
  const key = getMergedDataKey();
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  return new Set(
    groups.flatMap((g) =>
      (g.subcategories ?? []).map((s) => s.slug).filter(Boolean),
    ),
  );
}

/** Roots + all sub slugs from merged groups for the active data key (used when roots are selected). */
function getRootScopeForSelection(): Set<string> {
  const key = getMergedDataKey();
  const scope = new Set<string>();
  if (!key) return scope;

  if (selectedRoot.size > 0) {
    for (const r of selectedRoot) scope.add(r);
  }
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  for (const g of groups) {
    for (const s of g.subcategories ?? []) {
      if (s.slug) scope.add(s.slug);
    }
  }
  if (selectedRoot.size === 0) {
    for (const r of knownRootSlugs) scope.add(r);
  }
  return scope;
}

/**
 * Wireframe step 2+: attribute filters only after at least one product type (sub) is selected,
 * not when only root categories are checked.
 */
function getActiveCategorySlugsForAttributes(): string[] {
  const selectedSubSlugs = [...selectedSub];
  const allowedSubs = getSubSlugsAllowedInPanel();
  const scopedSub = selectedSubSlugs.filter((slug) => allowedSubs.has(slug));
  if (scopedSub.length > 0) return [...new Set(scopedSub)];
  return [];
}

function mergeAttributesForSelection(
  slugs: string[],
  map: Map<string, AttrByCategoryRow[]>,
): AttrByCategoryRow[] {
  const byAttrSlug = new Map<
    string,
    { name: string; slug: string; valuesMap: Map<string, AttrValue> }
  >();
  for (const catSlug of slugs) {
    const list = map.get(catSlug) ?? [];
    for (const attr of list) {
      let entry = byAttrSlug.get(attr.slug);
      if (!entry) {
        entry = {
          name: attr.name,
          slug: attr.slug,
          valuesMap: new Map(),
        };
        byAttrSlug.set(attr.slug, entry);
      }
      for (const v of attr.values ?? []) {
        if (v.slug)
          entry.valuesMap.set(v.slug, {
            label: v.label ?? v.slug,
            slug: v.slug,
          });
      }
    }
  }
  return [...byAttrSlug.values()].map((e) => ({
    name: e.name,
    slug: e.slug,
    values: [...e.valuesMap.values()],
  }));
}

function renderAttributesPanel() {
  if (!attrsEl) return;
  const slugs = getActiveCategorySlugsForAttributes();
  const merged = mergeAttributesForSelection(slugs, attributesByCategoryMap);
  const allowedSlugs = new Set(
    merged.flatMap((a) => a.values.map((v) => v.slug)),
  );
  for (const s of [...selectedAttrs]) {
    if (!allowedSlugs.has(s)) selectedAttrs.delete(s);
  }
  const hasAttrsContent =
    slugs.length > 0 && merged.some((a) => a.values.length > 0);
  if (!hasAttrsContent) {
    if (attrsSectionEl) attrsSectionEl.hidden = true;
    attrsEl.innerHTML = "";
    return;
  }
  if (attrsSectionEl) {
    const wasHidden = attrsSectionEl.hidden;
    attrsSectionEl.hidden = false;
    if (wasHidden) {
      document
        .getElementById("product-filters-attrs-trigger")
        ?.setAttribute("aria-expanded", "false");
      const attrsPanel = document.getElementById("product-filters-attrs-panel");
      if (attrsPanel) attrsPanel.hidden = true;
    }
  }
  attrsEl.innerHTML = merged
    .filter((attr) => attr.values.length > 0)
    .map(
      (attr) => `
      <div class="product-filters__attr-block">
        <h4 class="product-filters__attr-name">${escapeHtml(attr.name)}</h4>
        <div class="product-filters__chips product-filters__chips--row">
          ${attr.values
            .map((v) => {
              const n = countAttrFacet(v.slug);
              return `<label class="product-filters__chip"><input class="product-filters__chip-input" type="checkbox" data-group="attr" data-slug="${escapeHtml(v.slug)}" />${escapeHtml(v.label)} <span class="product-filters__count">${n}</span></label>`;
            })
            .join("")}
        </div>
      </div>`,
    )
    .join("");
}

function encodeMemberSlugsForAttr(slugs: string[]): string {
  return slugs
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("|");
}

function parseMemberSlugsFromAttr(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => {
      try {
        return decodeURIComponent(s.trim());
      } catch {
        return s.trim();
      }
    })
    .filter(Boolean);
}

/**
 * One merged "product type" chip can map to several WP category slugs (one per root).
 * After only Pool + Pumps was selected, `selectedSub` holds one slug; adding Spa adds
 * another slug to the group → checkbox becomes indeterminate and Spa products drop
 * out of matches. If any member of the group is selected, select all members so the
 * meaning stays "Pumps under every selected root" (union Pool/Pumps and Spa/Pumps).
 */
function expandPartialSubgroupSelectionsForMergedKey() {
  const key = getMergedDataKey();
  if (!key) return;
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  for (const g of groups) {
    const slugs = (g.subcategories ?? []).map((s) => s.slug).filter(Boolean);
    if (slugs.length < 2) continue;
    const allOn = slugs.every((s) => selectedSub.has(s));
    const someOn = slugs.some((s) => selectedSub.has(s));
    if (someOn && !allOn) {
      for (const s of slugs) selectedSub.add(s);
    }
  }
}

function renderSubgroupBlock(g: MergedSubGroup): string {
  const subs = (g.subcategories ?? []).filter((s) => s?.slug && s?.name);
  if (subs.length === 0) return "";
  const memberSlugs = subs.map((s) => s.slug).filter(Boolean);
  const memberEnc = encodeMemberSlugsForAttr(memberSlugs);
  const facetCount = countSubgroupFacet(memberSlugs);
  return `
      <div class="product-filters__subgroup" data-group-slug="${escapeHtml(g.groupSlug)}">
        <div class="product-filters__chips product-filters__chips--row">
          <label class="product-filters__chip">
            <input class="product-filters__chip-input" type="checkbox" data-group="subgroup" data-group-key="${escapeHtml(g.groupSlug)}" data-member-slugs="${escapeHtml(memberEnc)}" />
            ${safeDisplayText(g.groupName)} <span class="product-filters__count">${facetCount}</span>
          </label>
        </div>
      </div>`;
}

function bindSubShowMoreControls(hasExtra: boolean) {
  const more = document.getElementById("product-filters-sub-more");
  const less = document.getElementById("product-filters-sub-less");
  const extra = document.getElementById("product-filters-sub-extra");
  if (!more || !less) return;
  if (!hasExtra) {
    more.hidden = true;
    less.hidden = true;
    more.onclick = null;
    less.onclick = null;
    return;
  }
  const expanded = subTypesExtraExpanded;
  if (extra) {
    if (expanded) extra.removeAttribute("hidden");
    else extra.hidden = true;
  }
  more.hidden = expanded;
  less.hidden = !expanded;
  more.onclick = () => {
    subTypesExtraExpanded = true;
    if (extra) extra.removeAttribute("hidden");
    more.hidden = true;
    less.hidden = false;
    syncCheckboxes();
  };
  less.onclick = () => {
    subTypesExtraExpanded = false;
    if (extra) extra.hidden = true;
    less.hidden = true;
    more.hidden = false;
    syncCheckboxes();
  };
}

function renderSubcategories() {
  if (!subEl) return;
  const key = getMergedDataKey();
  if (!key) {
    subTypesExtraExpanded = false;
    subEl.innerHTML =
      '<p class="product-filters__hint">Subcategory groups are not available yet.</p>';
    bindSubShowMoreControls(false);
    syncCheckboxes();
    return;
  }
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  const allowed = new Set(
    groups.flatMap((g) =>
      (g.subcategories ?? []).map((s) => s.slug).filter(Boolean),
    ),
  );
  for (const s of [...selectedSub]) {
    if (!allowed.has(s)) selectedSub.delete(s);
  }
  if (groups.length === 0) {
    subTypesExtraExpanded = false;
    subEl.innerHTML =
      '<p class="product-filters__hint">No subcategory groups for this combination.</p>';
    bindSubShowMoreControls(false);
    syncCheckboxes();
    return;
  }
  const blocks = groups
    .map((g) => renderSubgroupBlock(g))
    .filter((html) => html.length > 0);
  const limit = SUBTYPE_GROUPS_VISIBLE_LIMIT;
  if (blocks.length <= limit) {
    subTypesExtraExpanded = false;
    subEl.innerHTML = `<div class="product-filters__sub-visible">${blocks.join("")}</div>`;
    bindSubShowMoreControls(false);
  } else {
    const visible = blocks.slice(0, limit);
    const extraBlocks = blocks.slice(limit);
    const extraHidden = !subTypesExtraExpanded;
    subEl.innerHTML = `<div class="product-filters__sub-visible">${visible.join("")}</div><div id="product-filters-sub-extra" class="product-filters__sub-extra"${extraHidden ? " hidden" : ""}>${extraBlocks.join("")}</div>`;
    bindSubShowMoreControls(true);
  }
  expandPartialSubgroupSelectionsForMergedKey();
  syncCheckboxes();
}

function syncPager() {
  if (currentTotal === 0) {
    if (pageEl) pageEl.textContent = "—";
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = true;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = true;
    return;
  }
  const page = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));
  if (pageEl) {
    pageEl.textContent = `Page ${page} of ${totalPages}`;
  }
  if (prevBtn instanceof HTMLButtonElement) {
    prevBtn.disabled = currentOffset <= 0;
  }
  if (nextBtn instanceof HTMLButtonElement) {
    nextBtn.disabled = currentOffset + pageSize >= currentTotal;
  }
}

async function readJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) {
    throw new Error(`Empty response body (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
}

/**
 * Indexes human-readable names for every product type / root / attribute value
 * in `product-filters.json`, so search matches "Pumps" etc. even when the title does not.
 */
function rebuildSearchLabelMaps() {
  categorySlugToLabel.clear();
  categorySlugToGroupNames.clear();
  attrValueSlugToLabel.clear();

  for (const r of rootCategoriesList) {
    categorySlugToLabel.set(r.slug, r.name);
  }

  for (const groups of mergedSubcategoryGroupsBySelection.values()) {
    for (const g of groups) {
      const gname = (g.groupName ?? "").trim();
      for (const s of g.subcategories ?? []) {
        if (!s.slug) continue;
        categorySlugToLabel.set(s.slug, s.name);
        if (gname) {
          let set = categorySlugToGroupNames.get(s.slug);
          if (!set) {
            set = new Set();
            categorySlugToGroupNames.set(s.slug, set);
          }
          set.add(gname);
        }
      }
    }
  }

  for (const rows of attributesByCategoryMap.values()) {
    for (const row of rows) {
      for (const v of row.values ?? []) {
        if (v.slug) attrValueSlugToLabel.set(v.slug, v.label);
      }
    }
  }
}

function productSearchHaystack(p: Product): string {
  const parts: string[] = [p.title, p.slug];
  for (const c of p.categorySlugs ?? []) {
    parts.push(c);
    const label = categorySlugToLabel.get(c);
    if (label) parts.push(label);
    const groups = categorySlugToGroupNames.get(c);
    if (groups) parts.push(...groups);
  }
  for (const a of p.attributeSlugs ?? []) {
    parts.push(a);
    const lab = attrValueSlugToLabel.get(a);
    if (lab) parts.push(lab);
  }
  return parts.join(" ").toLowerCase();
}

function productMatchesSearch(p: Product): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = productSearchHaystack(p);
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function passesCategoryFilters(
  product: Product,
  opts: { skipRoot?: boolean; skipSub?: boolean; skipAttr?: boolean },
): boolean {
  const categories = new Set(product.categorySlugs ?? []);
  const attrs = new Set(product.attributeSlugs ?? []);

  const selectedRootSlugs = [...selectedRoot];
  const selectedSubSlugs = [...selectedSub];
  const selectedAttrSlugs = [...selectedAttrs];

  const hasNoFilters =
    selectedRootSlugs.length === 0 &&
    selectedSubSlugs.length === 0 &&
    selectedAttrSlugs.length === 0;

  if (hasNoFilters) {
    return true;
  }

  const noRootSelected = selectedRootSlugs.length === 0;
  const rootScope = getRootScopeForSelection();
  const allowedSubs = getSubSlugsAllowedInPanel();
  const scopedSelectedSubSlugs = selectedSubSlugs.filter((slug) =>
    allowedSubs.has(slug),
  );

  if (!opts.skipRoot) {
    const rootMatch = noRootSelected
      ? true
      : [...rootScope].some((slug) => categories.has(slug));
    if (!rootMatch) return false;
  }

  if (!opts.skipSub) {
    const subMatch =
      scopedSelectedSubSlugs.length === 0 ||
      scopedSelectedSubSlugs.some((slug) => categories.has(slug));
    if (!subMatch) return false;
  }

  if (!opts.skipAttr) {
    const attrMatch =
      selectedAttrSlugs.length === 0 ||
      selectedAttrSlugs.some((slug) => attrs.has(slug));
    if (!attrMatch) return false;
  }

  return true;
}

function filterProducts(): Product[] {
  const selectedRootSlugs = [...selectedRoot];
  const selectedSubSlugs = [...selectedSub];
  const selectedAttrSlugs = [...selectedAttrs];
  const hasNoFilters =
    selectedRootSlugs.length === 0 &&
    selectedSubSlugs.length === 0 &&
    selectedAttrSlugs.length === 0;

  if (hasNoFilters) {
    return allProducts.filter(productMatchesSearch);
  }

  return allProducts
    .filter((p) => passesCategoryFilters(p, {}))
    .filter(productMatchesSearch);
}

/** DB last_update equivalent: prefer `modified`, then publish `date`, then id. */
function parseLastUpdatedTime(p: Product): number {
  const raw = p.modified ?? p.date;
  if (raw && typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof p.databaseId === "number") return p.databaseId;
  return 0;
}

function sortProductsList(list: Product[]): Product[] {
  const out = [...list];
  if (sortMode === "updated") {
    out.sort((a, b) => parseLastUpdatedTime(b) - parseLastUpdatedTime(a));
  } else if (sortMode === "name-desc") {
    out.sort((a, b) =>
      b.title.localeCompare(a.title, undefined, { sensitivity: "base" }),
    );
  } else {
    out.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }
  return out;
}

function getFilteredSortedProducts(): Product[] {
  return sortProductsList(filterProducts());
}

/**
 * All product-type (leaf) category slugs under one root — same key as merged panel for
 * that root alone (`"pool"` etc.), so counts match “товары в подкатегориях этого root”.
 */
function getProductTypeSlugsUnderRoot(rootSlug: string): Set<string> {
  const key = [rootSlug].sort().join(",");
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  const out = new Set<string>();
  for (const g of groups) {
    for (const s of g.subcategories ?? []) {
      if (s.slug) out.add(s.slug);
    }
  }
  return out;
}

function countRootFacet(rootSlug: string): number {
  const typeSlugs = getProductTypeSlugsUnderRoot(rootSlug);
  const base = allProducts
    .filter((p) => passesCategoryFilters(p, { skipRoot: true }))
    .filter(productMatchesSearch);

  if (typeSlugs.size === 0) {
    return base.filter((p) => (p.categorySlugs ?? []).includes(rootSlug))
      .length;
  }

  return base.filter((p) =>
    (p.categorySlugs ?? []).some((c) => typeSlugs.has(c)),
  ).length;
}

function countSubgroupFacet(memberSlugs: string[]): number {
  if (memberSlugs.length === 0) return 0;
  return allProducts
    .filter((p) => passesCategoryFilters(p, { skipSub: true }))
    .filter(productMatchesSearch)
    .filter((p) => memberSlugs.some((m) => (p.categorySlugs ?? []).includes(m)))
    .length;
}

function countAttrFacet(valueSlug: string): number {
  return allProducts
    .filter((p) => passesCategoryFilters(p, { skipAttr: true }))
    .filter(productMatchesSearch)
    .filter((p) => (p.attributeSlugs ?? []).includes(valueSlug)).length;
}

/** Subcategory label: prefer leaf category, not root slug. */
function getProductSubcategoryLabel(p: Product): string {
  const slugs = p.categorySlugs ?? [];
  const roots = new Set(knownRootSlugs);
  const candidates = slugs.filter((s) => !roots.has(s));
  const order = candidates.length > 0 ? candidates : slugs;
  for (const slug of order) {
    const label = categorySlugToLabel.get(slug);
    if (label?.trim()) return label.trim();
  }
  if (order.length > 0) {
    return order[0].replace(/-/g, " ");
  }
  return "Product";
}

function renderProductCard(p: Product): string {
  const href = `/product/${p.slug}/`;
  const subLabel = getProductSubcategoryLabel(p);
  const rawImg = p.imageUrl?.trim();
  const imgSrc = rawImg ? escapeHtml(rawImg) : PRODUCT_IMAGE_PLACEHOLDER;
  const imgAlt = escapeHtml(p.title);
  const onErrorAttr = ` onerror="this.onerror=null;this.src='${PRODUCT_IMAGE_PLACEHOLDER}'"`;

  return `<li class="product-filters__product-card">
  <a class="product-filters__product-link" href="${escapeHtml(href)}">
    <span class="product-filters__product-label">${safeDisplayText(subLabel)}</span>
    <span class="product-filters__product-thumb">
      <img src="${imgSrc}" alt="${imgAlt}" width="268" height="176" loading="lazy" decoding="async"${rawImg ? onErrorAttr : ""} />
    </span>
    <h3 class="product-filters__product-title">${safeDisplayText(p.title)}</h3>
    <span class="product-filters__product-cta btn btn--single-outline">View details</span>
  </a>
</li>`;
}

async function fetchProducts() {
  setLoading(true);
  setError(null);
  refreshAllSet();
  try {
    renderRootChips();
    renderSubcategories();
    renderAttributesPanel();
    syncCheckboxes();
    syncUrlState();

    const filtered = getFilteredSortedProducts();
    const total = filtered.length;
    if (total === 0) {
      currentOffset = 0;
    } else if (currentOffset >= total) {
      currentOffset = Math.floor((total - 1) / pageSize) * pageSize;
    }
    const items = filtered.slice(currentOffset, currentOffset + pageSize);
    currentTotal = total;
    const start = total === 0 ? 0 : currentOffset + 1;
    const end = Math.min(currentOffset + pageSize, total);
    if (productsTotalEl) {
      productsTotalEl.textContent = `Showing ${start}-${end} of ${total}`;
    }
    // if (countEl) {
    //   const selectedCount =
    //     selectedRoot.size + selectedSub.size + selectedAttrs.size;
    //   const qHint = searchQuery.trim()
    //     ? ` Search: "${searchQuery.trim()}".`
    //     : "";
    //   countEl.textContent =
    //     selectedCount === 0 && !searchQuery.trim()
    //       ? `Total: ${total} (no filters selected)`
    //       : `Filters selected: ${selectedCount}.${qHint} Found: ${total}`;
    // }
    if (productsEl) {
      if (total === 0) {
        productsEl.innerHTML = "";
        if (productsEmptyEl) productsEmptyEl.hidden = false;
      } else {
        productsEl.innerHTML = items.map((p) => renderProductCard(p)).join("");
        if (productsEmptyEl) productsEmptyEl.hidden = true;
      }
    }
    renderActiveFilterChips();
    syncPager();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
  }
}

function setupProductFiltersAccordions() {
  const catalog = document.getElementById("product-filters-catalog");
  if (!catalog) return;
  catalog.addEventListener("click", (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".product-filters__accordion-trigger",
    );
    if (!trigger) return;
    const id = trigger.getAttribute("aria-controls");
    const region = id ? document.getElementById(id) : null;
    if (!region) return;
    const wasExpanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!wasExpanded));
    region.hidden = wasExpanded;
  });
}

function syncCheckboxes() {
  [rootEl, subEl, attrsEl].forEach((el) => {
    if (!el) return;
    el.querySelectorAll<HTMLInputElement>("input[type='checkbox']").forEach(
      (input) => {
        const group = input.dataset.group;
        if (!group) return;
        if (group === "subgroup") {
          const slugs = parseMemberSlugsFromAttr(input.dataset.memberSlugs);
          if (slugs.length === 0) return;
          const allOn = slugs.every((s) => selectedSub.has(s));
          const someOn = slugs.some((s) => selectedSub.has(s));
          input.checked = allOn;
          input.indeterminate = someOn && !allOn;
          return;
        }
        const slug = input.dataset.slug;
        if (!slug) return;
        if (group === "root") input.checked = selectedRoot.has(slug);
        if (group === "sub") input.checked = selectedSub.has(slug);
        if (group === "attr") input.checked = selectedAttrs.has(slug);
      },
    );
  });
}

function buildActiveFilterChips(): ActiveFilterChip[] {
  const out: ActiveFilterChip[] = [];
  const sortedRoots = [...selectedRoot].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  for (const slug of sortedRoots) {
    const label =
      categorySlugToLabel.get(slug)?.trim() || slug.replace(/-/g, " ");
    out.push({ kind: "root", label, rootSlug: slug });
  }

  const key = getMergedDataKey();
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  const coveredSubs = new Set<string>();

  for (const g of groups) {
    const memberSlugs = (g.subcategories ?? [])
      .map((s) => s.slug)
      .filter(Boolean);
    if (memberSlugs.length === 0) continue;
    if (!memberSlugs.every((s) => selectedSub.has(s))) continue;
    for (const s of memberSlugs) coveredSubs.add(s);
    const label =
      (g.groupName ?? "").trim() || memberSlugs[0].replace(/-/g, " ");
    out.push({ kind: "subgroup", label, memberSlugs: [...memberSlugs] });
  }

  const leftover = [...selectedSub]
    .filter((s) => !coveredSubs.has(s))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  for (const slug of leftover) {
    const label =
      categorySlugToLabel.get(slug)?.trim() || slug.replace(/-/g, " ");
    out.push({ kind: "subgroup", label, memberSlugs: [slug] });
  }

  const sortedAttrs = [...selectedAttrs].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  for (const slug of sortedAttrs) {
    const label =
      attrValueSlugToLabel.get(slug)?.trim() || slug.replace(/-/g, " ");
    out.push({ kind: "attr", label, attrSlug: slug });
  }

  const q = searchQuery.trim();
  if (q) {
    out.push({ kind: "search", label: `Search: ${q}` });
  }
  return out;
}

function renderActiveFilterChipButton(chip: ActiveFilterChip): string {
  let extra = ` type="button" class="product-filters__active-chip" data-active-chip="1"`;
  if (chip.kind === "root" && chip.rootSlug) {
    extra += ` data-filter-kind="root" data-root-slug="${escapeHtml(chip.rootSlug)}"`;
  } else if (chip.kind === "subgroup" && chip.memberSlugs?.length) {
    extra += ` data-filter-kind="subgroup" data-member-slugs="${escapeHtml(encodeMemberSlugsForAttr(chip.memberSlugs))}"`;
  } else if (chip.kind === "attr" && chip.attrSlug) {
    extra += ` data-filter-kind="attr" data-attr-slug="${escapeHtml(chip.attrSlug)}"`;
  } else if (chip.kind === "search") {
    extra += ` data-filter-kind="search"`;
  }
  return `<button${extra}>
  <span class="product-filters__active-chip-label">${safeDisplayText(chip.label)}</span>
  <span class="product-filters__active-chip-remove" aria-hidden="true">×</span>
  <span class="visually-hidden">Remove ${safeDisplayText(chip.label)} filter</span>
</button>`;
}

function renderActiveFilterChips() {
  if (!activeFiltersEl || !activeFiltersRowEl) return;
  const chips = buildActiveFilterChips();
  if (chips.length <= ACTIVE_FILTER_CHIPS_VISIBLE) {
    activeFilterChipsExpanded = false;
  }
  if (chips.length === 0) {
    activeFiltersEl.hidden = true;
    activeFiltersRowEl.innerHTML = "";
    activeFiltersRowEl.classList.remove(
      "product-filters__active-filters-row--collapsed",
    );
    if (activeFiltersToggleEl) activeFiltersToggleEl.hidden = true;
    return;
  }
  activeFiltersEl.hidden = false;
  const collapsed =
    chips.length > ACTIVE_FILTER_CHIPS_VISIBLE && !activeFilterChipsExpanded;
  activeFiltersRowEl.classList.toggle(
    "product-filters__active-filters-row--collapsed",
    collapsed,
  );
  activeFiltersRowEl.innerHTML = chips
    .map((c) => renderActiveFilterChipButton(c))
    .join("");
  if (activeFiltersToggleEl) {
    const showToggle = chips.length > ACTIVE_FILTER_CHIPS_VISIBLE;
    activeFiltersToggleEl.hidden = !showToggle;
    const showBtn = document.getElementById(
      "product-filters-active-filters-show",
    );
    const hideBtn = document.getElementById(
      "product-filters-active-filters-hide",
    );
    if (showBtn && hideBtn) {
      showBtn.hidden = !showToggle || activeFilterChipsExpanded;
      hideBtn.hidden = !showToggle || !activeFilterChipsExpanded;
    }
  }
}

function applyActiveFilterRemoval(button: HTMLButtonElement) {
  const kind = button.dataset.filterKind;
  if (kind === "root" && button.dataset.rootSlug) {
    selectedRoot.delete(button.dataset.rootSlug);
  } else if (kind === "subgroup" && button.dataset.memberSlugs) {
    for (const s of parseMemberSlugsFromAttr(button.dataset.memberSlugs)) {
      selectedSub.delete(s);
    }
  } else if (kind === "attr" && button.dataset.attrSlug) {
    selectedAttrs.delete(button.dataset.attrSlug);
  } else if (kind === "search") {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
  } else {
    return;
  }
  currentOffset = 0;
  void fetchProducts();
}

function clearAllFilters() {
  selectedRoot.clear();
  selectedSub.clear();
  selectedAttrs.clear();
  searchQuery = "";
  if (searchInput) searchInput.value = "";
  activeFilterChipsExpanded = false;
  pageSize = 24;
  sortMode = "updated";
  if (perSelect) perSelect.value = "24";
  if (sortSelect) sortSelect.value = "updated";
  currentOffset = 0;
  void fetchProducts();
}

function renderRootChips() {
  if (!rootEl) return;
  rootEl.innerHTML = rootCategoriesList
    .map(
      (a) =>
        `<label class="product-filters__chip"><input class="product-filters__chip-input" type="checkbox" data-group="root" data-slug="${escapeHtml(a.slug)}" />${safeDisplayText(a.name)} <span class="product-filters__count">${countRootFacet(a.slug)}</span></label>`,
    )
    .join("");
}

async function init() {
  try {
    const res = await fetch("/data/product-filters.json");
    const data = (await readJsonSafe(res)) as {
      generatedAt?: string;
      attributesByCategory?: Record<string, AttrByCategoryRow[]>;
      rootCategories?: {
        name: string;
        slug: string;
        subcategories?: { name: string; slug: string }[];
      }[];
      mergedSubcategoryGroupsBySelection?: Record<string, MergedSubGroup[]>;
      products?: {
        title: string;
        slug: string;
        categorySlugs?: string[];
        attributeSlugs?: string[];
        databaseId?: number | null;
        date?: string | null;
        modified?: string | null;
        imageUrl?: string | null;
      }[];
    };
    console.log("[product-filters] GET /data/product-filters.json response", {
      status: res.status,
      ok: res.ok,
      body: data,
    });

    if (!rootEl || !subEl || !attrsEl) {
      console.error("[product-filters] Static data load failed", {
        response: data,
        rootElExists: Boolean(rootEl),
        subElExists: Boolean(subEl),
        attrsElExists: Boolean(attrsEl),
      });
      setError("Failed to load static filter data");
      await fetchProducts();
      return;
    }

    const roots = data.rootCategories ?? [];
    rootCategoriesList = roots.map((r) => ({
      name: r.name,
      slug: r.slug,
    }));
    knownRootSlugs = roots.map((r) => r.slug);
    attributesByCategoryMap.clear();
    for (const [slug, rows] of Object.entries(
      data.attributesByCategory ?? {},
    )) {
      attributesByCategoryMap.set(slug, Array.isArray(rows) ? rows : []);
    }
    allProducts = (data.products ?? []).map((item) => ({
      title: item.title,
      slug: item.slug,
      categorySlugs: item.categorySlugs ?? [],
      attributeSlugs: item.attributeSlugs ?? [],
      databaseId: item.databaseId ?? null,
      date: item.date ?? null,
      modified: item.modified ?? null,
      imageUrl: item.imageUrl ?? null,
    }));
    mergedSubcategoryGroupsBySelection.clear();
    const mergedRaw = data.mergedSubcategoryGroupsBySelection ?? {};
    for (const [k, groups] of Object.entries(mergedRaw)) {
      mergedSubcategoryGroupsBySelection.set(
        k,
        Array.isArray(groups) ? groups : [],
      );
    }
    if (
      mergedSubcategoryGroupsBySelection.size === 0 &&
      roots.some((r) => (r.subcategories?.length ?? 0) > 0)
    ) {
      for (const r of roots) {
        const subs = r.subcategories ?? [];
        if (subs.length === 0) continue;
        mergedSubcategoryGroupsBySelection.set(r.slug, [
          {
            groupSlug: "legacy",
            groupName: "Subcategories",
            subcategories: subs.map((s) => ({
              slug: s.slug,
              name: s.name,
            })),
          },
        ]);
      }
    }
    syncRootMapLegacyShim();
    rebuildSearchLabelMaps();
    applyStateFromUrl();

    const onChange = (e: Event) => {
      const input = (e.target as HTMLElement).closest<HTMLInputElement>(
        "input[type='checkbox'][data-group]",
      );
      if (!input) return;
      const group = input.dataset.group;
      if (!group) return;

      if (group === "root") {
        const slug = input.dataset.slug;
        if (!slug) return;
        if (input.checked) selectedRoot.add(slug);
        else selectedRoot.delete(slug);
      } else if (group === "subgroup") {
        input.indeterminate = false;
        const slugs = parseMemberSlugsFromAttr(input.dataset.memberSlugs);
        if (slugs.length === 0) return;
        if (input.checked) {
          for (const s of slugs) selectedSub.add(s);
        } else {
          for (const s of slugs) selectedSub.delete(s);
        }
      } else if (group === "sub") {
        const slug = input.dataset.slug;
        if (!slug) return;
        if (input.checked) selectedSub.add(slug);
        else selectedSub.delete(slug);
      } else if (group === "attr") {
        const slug = input.dataset.slug;
        if (!slug) return;
        if (input.checked) selectedAttrs.add(slug);
        else selectedAttrs.delete(slug);
      }

      currentOffset = 0;
      void fetchProducts();
    };

    rootEl.addEventListener("change", onChange);
    subEl.addEventListener("change", onChange);
    attrsEl.addEventListener("change", onChange);

    clearBtn?.addEventListener("click", () => {
      clearAllFilters();
    });

    searchInput?.addEventListener("input", () => {
      searchQuery = searchInput?.value ?? "";
      currentOffset = 0;
      void fetchProducts();
    });

    perSelect?.addEventListener("change", () => {
      const v = Number(perSelect.value);
      if (PAGE_SIZE_OPTIONS.includes(v as (typeof PAGE_SIZE_OPTIONS)[number])) {
        pageSize = v;
        currentOffset = 0;
        void fetchProducts();
      }
    });

    sortSelect?.addEventListener("change", () => {
      const v = sortSelect.value;
      if (v === "updated" || v === "name-asc" || v === "name-desc") {
        sortMode = v;
        currentOffset = 0;
        void fetchProducts();
      }
    });

    prevBtn?.addEventListener("click", () => {
      if (currentOffset <= 0) return;
      currentOffset = Math.max(0, currentOffset - pageSize);
      void fetchProducts();
    });

    nextBtn?.addEventListener("click", () => {
      if (currentOffset + pageSize >= currentTotal) return;
      currentOffset += pageSize;
      void fetchProducts();
    });

    window.addEventListener("popstate", () => {
      applyStateFromUrl();
      void fetchProducts();
    });

    setupProductFiltersAccordions();

    activeFiltersEl?.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("#product-filters-active-filters-show")) {
        e.preventDefault();
        activeFilterChipsExpanded = true;
        renderActiveFilterChips();
        return;
      }
      if (t.closest("#product-filters-active-filters-hide")) {
        e.preventDefault();
        activeFilterChipsExpanded = false;
        renderActiveFilterChips();
        return;
      }
      const chip = t.closest<HTMLButtonElement>("[data-active-chip]");
      if (chip && activeFiltersRowEl?.contains(chip)) {
        e.preventDefault();
        applyActiveFilterRemoval(chip);
      }
    });

    await fetchProducts();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  }
}

void init();
