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
const activeFiltersEl = document.getElementById(
  "product-filters-active-filters",
);
const activeFiltersRowEl = document.getElementById(
  "product-filters-active-filters-row",
);
const activeFiltersToggleEl = document.getElementById(
  "product-filters-active-filters-toggle",
);
function queryPagerButtons(ids: readonly string[]): HTMLButtonElement[] {
  return ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
}

const pagerPrevBtns = queryPagerButtons([
  "product-filters-prev",
  "product-filters-prev-toolbar",
]);
const pagerNextBtns = queryPagerButtons([
  "product-filters-next",
  "product-filters-next-toolbar",
]);
const pagerRangeEl = document.getElementById("product-filters-pager-range");
const pagerPagesEl = document.getElementById("product-filters-pager-pages");
const pagerRootEl = document.getElementById("product-filters-pager");
const toolbarPagerNavEl = document.getElementById(
  "product-filters-toolbar-pager-nav",
);
const clearBtn = document.getElementById("product-filters-clear");
const noFiltersLabelEl = document.getElementById(
  "product-filters-no-filters-label",
);
const errEl = document.getElementById("product-filters-api-error");
const countEl = document.getElementById("product-filters-count");
const searchInput = document.getElementById(
  "product-filters-search",
) as HTMLInputElement | null;
const introTitleEl = document.getElementById(
  "product-filters-intro-title",
) as HTMLHeadingElement | null;
const introDescriptionEl = document.getElementById(
  "product-filters-intro-description",
) as HTMLParagraphElement | null;
const defaultIntroDescription = introDescriptionEl?.textContent?.trim() ?? "";
const perDropdownRoot = document.getElementById("product-filters-per-dropdown");
const perTrigger = document.getElementById("product-filters-per-trigger");
const perValueEl = document.getElementById("product-filters-per-value");
const perMenu = document.getElementById("product-filters-per-menu");
const sortDropdownRoot = document.getElementById(
  "product-filters-sort-dropdown",
);
const sortTrigger = document.getElementById("product-filters-sort-trigger");
const sortValueEl = document.getElementById("product-filters-sort-value");
const sortMenu = document.getElementById("product-filters-sort-menu");
const rootNavSectionEl = document.querySelector<HTMLElement>(
  ".product-filters-root-nav",
);
const headerEl = document.querySelector<HTMLElement>(".header");
const introSectionEl = document.querySelector<HTMLElement>(".product-filters-intro");
const catalogSectionTitleEl = document.querySelector<HTMLElement>(
  ".product-filters-catalog__section-title",
);
const catalogBreadcrumbsEl = document.getElementById(
  "product-filters-breadcrumbs",
) as HTMLElement | null;
const catalogBreadcrumbCategoryItemEl = document.getElementById(
  "product-filters-breadcrumb-category-item",
) as HTMLLIElement | null;
const catalogBreadcrumbCategoryLabelEl = document.getElementById(
  "product-filters-breadcrumb-category-label",
) as HTMLSpanElement | null;

const catalogSectionEl = document.getElementById("product-filters-catalog");
const drawerBackdropEl = document.getElementById(
  "product-filters-drawer-backdrop",
);
const drawerOpenBtn = document.getElementById(
  "product-filters-drawer-open",
) as HTMLButtonElement | null;
const drawerCloseBtn = document.getElementById(
  "product-filters-drawer-close",
) as HTMLButtonElement | null;
const filtersPanelEl = document.getElementById("product-filters-filters-panel");

const DRAWER_OPEN_CLASS = "product-filters-catalog--drawer-open";

const CATALOG_VIEW_STORAGE_KEY = "product-filters-catalog-view";
type CatalogViewMode = "grid" | "rows";

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
  imageAlt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

const PRODUCT_IMAGE_PLACEHOLDER = "/images/no-product-image.svg";

let allProducts: Product[] = [];
const mergedSubcategoryGroupsBySelection = new Map<string, MergedSubGroup[]>();
const attributesByCategoryMap = new Map<string, AttrByCategoryRow[]>();
let knownRootSlugs: string[] = [];

const rootMap = new Map<string, { name: string; slug: string }[]>();
const PAGE_SIZE_OPTIONS = [12, 24] as const;
let pageSize = 24;
let searchQuery = "";
type SortMode = "updated" | "name-asc" | "name-desc";
const SORT_MODE_LABELS: Record<SortMode, string> = {
  updated: "Newest",
  "name-asc": "A–Z",
  "name-desc": "Z–A",
};
let sortMode: SortMode = "updated";
let rootCategoriesList: { name: string; slug: string; description?: string }[] =
  [];
const categorySlugToLabel = new Map<string, string>();
const categorySlugToDescription = new Map<string, string>();
const categorySlugToGroupNames = new Map<string, Set<string>>();
const attrValueSlugToLabel = new Map<string, string>();
const attrValueSlugToAttrName = new Map<string, string>();
let currentOffset = 0;
let currentTotal = 0;
/** On narrow catalog viewport (max-width 767px), products rendered so far (load-more). */
let mobileAccumulatedCount = 0;

function isNarrowCatalog(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

function updateProductsTotalEl() {
  if (!productsTotalEl) return;
  const total = currentTotal;
  const span = `<span class="product-filters__products-total--total-count">${total}</span>`;
  if (total === 0) {
    productsTotalEl.innerHTML = `0-0 of ${span}`;
    return;
  }
  if (isNarrowCatalog()) {
    productsTotalEl.innerHTML = `${mobileAccumulatedCount} of ${span}`;
    return;
  }
  const start = currentOffset + 1;
  const end = Math.min(currentOffset + pageSize, total);
  productsTotalEl.innerHTML = `${start}-${end} of ${span}`;
}

function syncLoadMoreButton() {
  const btn = document.getElementById(
    "product-filters-load-more",
  ) as HTMLButtonElement | null;
  if (!btn) return;
  const narrow = isNarrowCatalog();
  btn.hidden =
    !narrow || currentTotal === 0 || mobileAccumulatedCount >= currentTotal;
}
let scrollProductListAfterFetch = false;
let rootCategoriesExtraExpanded = false;
const ROOT_CATEGORIES_VISIBLE_LIMIT = 10;
const ATTR_VALUES_VISIBLE_LIMIT = 5;
const ACTIVE_FILTER_CHIPS_VISIBLE = 5;
let activeFilterChipsExpanded = false;
const expandedAttrAccordionSlugs = new Set<string>();

const ATTR_VALUES_MORE_ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="product-filters__link-btn-icon" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

type OverflowModalKind = "attribute-values";
type OverflowModalState = {
  kind: OverflowModalKind;
  title: string;
  itemsHtml: string;
  attrSlug?: string;
};
const overflowModalRootEl = document.getElementById(
  "product-filters-overflow-modal",
) as HTMLDivElement | null;
const overflowModalTitleEl = document.getElementById(
  "product-filters-overflow-modal-title",
) as HTMLHeadingElement | null;
const overflowModalSearchEl = document.getElementById(
  "product-filters-overflow-modal-search",
) as HTMLInputElement | null;
const overflowModalListEl = document.getElementById(
  "product-filters-overflow-modal-list",
) as HTMLDivElement | null;
let overflowModalState: OverflowModalState | null = null;
let overflowModalCloseTimer: number | null = null;
let overflowModalBodyScrollLocked = false;
let overflowModalPrevBodyOverflow = "";

function lockBodyScrollForOverflowModal() {
  if (overflowModalBodyScrollLocked) return;
  overflowModalPrevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  overflowModalBodyScrollLocked = true;
}

function unlockBodyScrollForOverflowModal() {
  if (!overflowModalBodyScrollLocked) return;
  const drawerIsOpen = Boolean(
    catalogSectionEl?.classList.contains(DRAWER_OPEN_CLASS),
  );
  if (drawerIsOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = overflowModalPrevBodyOverflow;
  }
  overflowModalPrevBodyOverflow = "";
  overflowModalBodyScrollLocked = false;
}

function isCatalogTabletUp(): boolean {
  return window.matchMedia("(min-width: 768px)").matches;
}

function setupOverflowModal() {
  if (!overflowModalRootEl) return;
  if (overflowModalRootEl.dataset.bound === "1") return;
  overflowModalRootEl.dataset.bound = "1";
  overflowModalListEl?.addEventListener("change", handleFilterCheckboxChange);
  overflowModalRootEl.addEventListener("click", (e) => {
    const closeEl = (e.target as HTMLElement).closest(
      "[data-overflow-modal-close], [data-overflow-modal-back]",
    );
    if (!closeEl) return;
    e.preventDefault();
    closeOverflowModal();
  });
  overflowModalSearchEl?.addEventListener("input", () => {
    filterOverflowModalItems();
  });
}

function closeOverflowModal() {
  if (!overflowModalRootEl) return;
  overflowModalRootEl.setAttribute("aria-hidden", "true");
  overflowModalRootEl.classList.remove("product-filters__overflow-modal--open");
  overflowModalState = null;
  unlockBodyScrollForOverflowModal();
  if (overflowModalCloseTimer != null) {
    window.clearTimeout(overflowModalCloseTimer);
  }
  overflowModalCloseTimer = window.setTimeout(() => {
    overflowModalCloseTimer = null;
    if (!overflowModalRootEl) return;
    if (
      overflowModalRootEl.classList.contains(
        "product-filters__overflow-modal--open",
      )
    ) {
      return;
    }
    overflowModalRootEl.hidden = true;
    if (overflowModalSearchEl) overflowModalSearchEl.value = "";
    if (overflowModalListEl) overflowModalListEl.innerHTML = "";
  }, 260);
}

function filterOverflowModalItems() {
  if (!overflowModalListEl || !overflowModalSearchEl) return;
  const q = overflowModalSearchEl.value.trim().toLowerCase();
  overflowModalListEl
    .querySelectorAll<HTMLElement>(".product-filters__overflow-modal-item")
    .forEach((item) => {
      const text = (item.dataset.searchText ?? "").toLowerCase();
      item.hidden = q.length > 0 && !text.includes(q);
    });
}

function openOverflowModal(
  state: OverflowModalState,
  options?: { preserveSearch?: boolean },
) {
  setupOverflowModal();
  if (
    !overflowModalRootEl ||
    !overflowModalTitleEl ||
    !overflowModalSearchEl ||
    !overflowModalListEl
  ) {
    return;
  }
  if (overflowModalCloseTimer != null) {
    window.clearTimeout(overflowModalCloseTimer);
    overflowModalCloseTimer = null;
  }
  overflowModalState = state;
  const prevQuery = options?.preserveSearch ? overflowModalSearchEl.value : "";
  overflowModalTitleEl.textContent = state.title;
  overflowModalListEl.innerHTML = state.itemsHtml;
  overflowModalSearchEl.value = prevQuery;
  overflowModalRootEl.hidden = false;
  overflowModalRootEl.setAttribute("aria-hidden", "false");
  overflowModalRootEl.classList.add("product-filters__overflow-modal--open");
  lockBodyScrollForOverflowModal();
  syncCheckboxes();
  filterOverflowModalItems();
  if (!options?.preserveSearch) overflowModalSearchEl.focus();
}

function renderOverflowModalAttributeValues(
  attrSlug: string,
): OverflowModalState | null {
  const slugs = getActiveCategorySlugsForAttributes();
  const merged = mergeAttributesForSelection(slugs, attributesByCategoryMap);
  const attr = merged.find((item) => item.slug === attrSlug);
  if (!attr || attr.values.length === 0) return null;
  const itemsHtml = attr.values
    .map((v) => {
      const n = countAttrFacet(v.slug);
      return `<div class="product-filters__overflow-modal-item" data-search-text="${escapeHtmlAttr(v.label)}">
        <label class="product-filters__chip">
          <input class="product-filters__chip-input" type="checkbox" data-group="attr" data-slug="${escapeHtml(v.slug)}" />
          ${escapeHtml(v.label)} <span class="product-filters__count">${n}</span>
        </label>
      </div>`;
    })
    .join("");
  return {
    kind: "attribute-values",
    title: attr.name,
    itemsHtml,
    attrSlug: attr.slug,
  };
}

function refreshOverflowModalIfOpen() {
  if (!overflowModalState) return;
  if (!overflowModalState.attrSlug) return;
  const next = renderOverflowModalAttributeValues(overflowModalState.attrSlug);
  if (next) openOverflowModal(next, { preserveSearch: true });
  else closeOverflowModal();
}

type ActiveFilterChip = {
  kind: "root" | "subgroup" | "attr" | "search";
  label: string;
  rootSlug?: string;
  attrSlug?: string;
  /** Accordion / attribute name for attr chips (shown before value label). */
  attrGroupName?: string;
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

function closeToolbarCustomDropdowns() {
  if (perMenu) perMenu.hidden = true;
  if (sortMenu) sortMenu.hidden = true;
  perTrigger?.setAttribute("aria-expanded", "false");
  sortTrigger?.setAttribute("aria-expanded", "false");
  perDropdownRoot?.classList.remove("product-filters__custom-select--open");
  sortDropdownRoot?.classList.remove("product-filters__custom-select--open");
}

function syncToolbarCustomSelectUi() {
  if (perValueEl) perValueEl.textContent = String(pageSize);
  if (sortValueEl) sortValueEl.textContent = SORT_MODE_LABELS[sortMode];
  perMenu
    ?.querySelectorAll<HTMLButtonElement>("[data-per-value]")
    .forEach((btn) => {
      const v = Number(btn.dataset.perValue);
      btn.setAttribute("aria-selected", String(v === pageSize));
    });
  sortMenu
    ?.querySelectorAll<HTMLButtonElement>("[data-sort-value]")
    .forEach((btn) => {
      const v = btn.dataset.sortValue;
      btn.setAttribute("aria-selected", String(v === sortMode));
    });
}

function syncIntroTitle() {
  if (!introTitleEl) return;
  const effectiveRoots = getEffectiveSelectedRootSlugs();
  if (effectiveRoots.length !== 1) {
    introTitleEl.textContent = "Catalog";
    if (introDescriptionEl) {
      introDescriptionEl.textContent = defaultIntroDescription;
    }
    return;
  }
  const [slug] = effectiveRoots;
  const label = categorySlugToLabel.get(slug)?.trim();
  introTitleEl.textContent = label || "Catalog";
  if (!introDescriptionEl) return;
  const description = categorySlugToDescription.get(slug)?.trim();
  introDescriptionEl.textContent = description || defaultIntroDescription;
}

function getEffectiveSelectedRootSlugs(): string[] {
  if (selectedRoot.size > 0) {
    // For breadcrumb/category title we prioritize explicit category filters.
    return [...selectedRoot];
  }
  const out = new Set<string>();
  if (selectedSub.size > 0) {
    for (const [rootSlug, members] of rootMap.entries()) {
      if (members.some((m) => selectedSub.has(m.slug))) {
        out.add(rootSlug);
      }
    }
  }
  return [...out];
}

function syncRootNavAndHeaderState() {
  const hasActiveFilter =
    selectedRoot.size > 0 ||
    selectedSub.size > 0 ||
    selectedAttrs.size > 0 ||
    searchQuery.trim().length > 0;
  if (rootNavSectionEl) rootNavSectionEl.hidden = hasActiveFilter;
  if (introSectionEl) {
    introSectionEl.classList.toggle(
      "product-filters-intro--with-root-nav",
      Boolean(rootNavSectionEl) && !hasActiveFilter,
    );
  }
  if (headerEl) headerEl.classList.toggle("header--white", hasActiveFilter);
  if (catalogSectionTitleEl) catalogSectionTitleEl.hidden = hasActiveFilter;
  if (catalogBreadcrumbsEl) catalogBreadcrumbsEl.hidden = !hasActiveFilter;
  if (!hasActiveFilter) return;
  const effectiveRoots = getEffectiveSelectedRootSlugs();
  if (
    effectiveRoots.length === 1 &&
    catalogBreadcrumbCategoryItemEl &&
    catalogBreadcrumbCategoryLabelEl
  ) {
    const [slug] = effectiveRoots;
    const label =
      categorySlugToLabel.get(slug)?.trim() || slug.replace(/-/g, " ");
    catalogBreadcrumbCategoryLabelEl.textContent = label;
    catalogBreadcrumbCategoryItemEl.hidden = false;
    return;
  }
  if (catalogBreadcrumbCategoryItemEl) catalogBreadcrumbCategoryItemEl.hidden = true;
}

function applyStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const roots = parseListParam(params, "category");
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
  syncToolbarCustomSelectUi();

  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  currentOffset = (safePage - 1) * pageSize;
  if (isNarrowCatalog()) {
    currentOffset = 0;
  }
  syncRootNavAndHeaderState();
}

function syncUrlState() {
  const params = new URLSearchParams(window.location.search);
  const roots = [...selectedRoot];
  const sub = [...selectedSub];
  const attr = [...selectedAttrs];
  const page = isNarrowCatalog() ? 1 : Math.floor(currentOffset / pageSize) + 1;

  if (roots.length > 0) params.set("category", roots.join(","));
  else params.delete("category");

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

function hasAnyFilterSelected(): boolean {
  return (
    selectedRoot.size > 0 ||
    selectedSub.size > 0 ||
    selectedAttrs.size > 0 ||
    searchQuery.trim().length > 0
  );
}

function syncFilterActionsRow() {
  const has = hasAnyFilterSelected();
  if (noFiltersLabelEl) noFiltersLabelEl.hidden = has;
  if (clearBtn instanceof HTMLButtonElement) clearBtn.hidden = !has;
}

function setLoading(on: boolean) {
  if (clearBtn instanceof HTMLButtonElement) {
    clearBtn.disabled = on && hasAnyFilterSelected();
  }
  // Prev/Next: only disable while loading; `syncPager()` sets first/last page rules after.
  if (on) {
    for (const b of pagerPrevBtns) b.disabled = true;
    for (const b of pagerNextBtns) b.disabled = true;
  }
  const loadMoreBtn = document.getElementById(
    "product-filters-load-more",
  ) as HTMLButtonElement | null;
  if (loadMoreBtn) {
    if (on) {
      if (!loadMoreBtn.hidden) loadMoreBtn.disabled = true;
    } else {
      loadMoreBtn.disabled = false;
    }
  }
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

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

/**
 * WooCommerce / GraphQL often expose attribute value labels slugified ("1.0" → "1-0").
 * Pure digit segments separated by hyphens → join with "." for display (1-0 → 1.0, 1-65 → 1.65).
 */
function formatAttributeValueLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^\d+(-\d+)+$/.test(t)) {
    return t.split("-").join(".");
  }
  return t;
}

function attributeValueDisplayLabel(
  attrSlug: string,
  apiLabel: string | undefined,
  valueSlug: string,
): string {
  let s = (apiLabel ?? "").trim();
  if (!s) {
    s = valueSlug.startsWith(`${attrSlug}-`)
      ? valueSlug.slice(attrSlug.length + 1)
      : valueSlug;
  }
  s = decodeHtmlEntities(s);
  return formatAttributeValueLabel(s);
}

/** Active-filter chip when slug is missing from map: recover numeric suffix (hp-1-0 → 1.0). */
function fallbackLabelFromValueSlug(slug: string): string {
  const m = slug.match(/((?:\d+-)+\d+)$/);
  if (m) return formatAttributeValueLabel(m[1]);
  return slug.replace(/-/g, " ");
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

function getAllKnownSubSlugsInMergedData(): Set<string> {
  const out = new Set<string>();
  for (const groups of mergedSubcategoryGroupsBySelection.values()) {
    for (const g of groups) {
      for (const s of g.subcategories ?? []) {
        if (s.slug) out.add(s.slug);
      }
    }
  }
  return out;
}

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

/** Root slugs + leaf subs for a hypothetical multi-root selection (facet count scoping). */
function getRootScopeForVirtualRoots(virtualRoots: Set<string>): Set<string> {
  if (virtualRoots.size === 0) return new Set();
  const key = [...virtualRoots].sort().join(",");
  const scope = new Set<string>();
  for (const r of virtualRoots) scope.add(r);
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];
  for (const g of groups) {
    for (const s of g.subcategories ?? []) {
      if (s.slug) scope.add(s.slug);
    }
  }
  return scope;
}

function getImpliedRootsFromScopedSelectedSubs(): Set<string> {
  const allowed = getSubSlugsAllowedInPanel();
  const implied = new Set<string>();
  for (const subSlug of selectedSub) {
    if (!allowed.has(subSlug)) continue;
    for (const rootSlug of knownRootSlugs) {
      if (getProductTypeSlugsUnderRoot(rootSlug).has(subSlug)) {
        implied.add(rootSlug);
      }
    }
  }
  return implied;
}

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
            label: attributeValueDisplayLabel(attr.slug, v.label, v.slug),
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

function attrAccordionDomIds(
  attrSlug: string,
  index: number,
): { triggerId: string; panelId: string } {
  const safe =
    attrSlug.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "attr";
  return {
    triggerId: `product-filters-attr-tr-${index}-${safe}`,
    panelId: `product-filters-attr-pn-${index}-${safe}`,
  };
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
  if (attrsSectionEl) attrsSectionEl.hidden = false;
  const blocks = merged.filter((attr) => attr.values.length > 0);
  const visibleAttrSlugs = new Set(blocks.map((a) => a.slug));
  for (const s of [...expandedAttrAccordionSlugs]) {
    if (!visibleAttrSlugs.has(s)) expandedAttrAccordionSlugs.delete(s);
  }
  attrsEl.innerHTML = blocks
    .map((attr, index) => {
      const { triggerId, panelId } = attrAccordionDomIds(attr.slug, index);
      const isExpanded = expandedAttrAccordionSlugs.has(attr.slug);
      const slugAttr = escapeHtmlAttr(attr.slug);
      const renderValueChip = (v: { label: string; slug: string }) => {
        const n = countAttrFacet(v.slug);
        return `<label class="product-filters__chip"><input class="product-filters__chip-input" type="checkbox" data-group="attr" data-slug="${escapeHtml(v.slug)}" />${escapeHtml(v.label)} <span class="product-filters__count">${n}</span></label>`;
      };
      const values = attr.values;
      const limit = ATTR_VALUES_VISIBLE_LIMIT;
      let valuesBody: string;
      if (values.length <= limit) {
        valuesBody = `<div class="product-filters__attr-values product-filters__chips product-filters__chips--row">${values.map(renderValueChip).join("")}</div>`;
      } else {
        const vis = values.slice(0, limit);
        valuesBody = `<div class="product-filters__attr-values product-filters__chips product-filters__chips--row">
      ${vis.map(renderValueChip).join("")}
    <div class="product-filters__sub-more-row product-filters__attr-more-row">
      <button type="button" class="product-filters__link-btn product-filters__attr-values-more" data-attr-values-slug="${slugAttr}">
        Show all
        ${ATTR_VALUES_MORE_ARROW_SVG}
      </button>
    </div>
  </div>`;
      }
      const collapsedClass = isExpanded
        ? ""
        : " product-filters__accordion-panel--collapsed";
      const inertAttr = isExpanded ? "" : " inert";
      return `<div class="product-filters__group product-filters__accordion">
  <button type="button" class="product-filters__accordion-trigger" id="${escapeHtml(triggerId)}" aria-expanded="${isExpanded ? "true" : "false"}" aria-controls="${escapeHtml(panelId)}" data-attr-accordion-slug="${slugAttr}">
    <span class="product-filters__accordion-title">${escapeHtml(attr.name)}</span>
    <span class="product-filters__accordion-chevron" aria-hidden="true">
      <span class="product-filters__accordion-chevron-icon"></span>
    </span>
  </button>
  <div id="${escapeHtml(panelId)}" class="product-filters__accordion-panel${collapsedClass}" role="region" aria-labelledby="${escapeHtml(triggerId)}">
    <div class="product-filters__accordion-panel-inner"${inertAttr}>
    ${valuesBody}
    </div>
  </div>
</div>`;
    })
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
        <label class="product-filters__chip">
          <input class="product-filters__chip-input" type="checkbox" data-group="subgroup" data-group-key="${escapeHtml(g.groupSlug)}" data-member-slugs="${escapeHtml(memberEnc)}" />
          ${safeDisplayText(g.groupName)} <span class="product-filters__count">${facetCount}</span>
        </label>
      </div>`;
}

function renderSubcategories() {
  if (!subEl) return;
  const key = getMergedDataKey();
  if (!key) {
    subEl.innerHTML =
      '<p class="product-filters__hint">Subcategory groups are not available yet.</p>';
    syncCheckboxes();
    return;
  }
  const groups = mergedSubcategoryGroupsBySelection.get(key) ?? [];

  const globallyKnownSubs = getAllKnownSubSlugsInMergedData();
  for (const s of [...selectedSub]) {
    if (!globallyKnownSubs.has(s)) selectedSub.delete(s);
  }
  if (groups.length === 0) {
    subEl.innerHTML =
      '<p class="product-filters__hint">No subcategory groups for this combination.</p>';
    syncCheckboxes();
    return;
  }
  subEl.innerHTML = groups
    .map((g) => renderSubgroupBlock(g))
    .filter((html) => html.length > 0)
    .join("");
  expandPartialSubgroupSelectionsForMergedKey();
  syncCheckboxes();
}

/** Page numbers and ellipses for the bottom pager (matches compact “1 2 3 … N” UX). */
function buildPaginationItems(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 0) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "ellipsis"> = [];
  const pushEllipsis = () => {
    if (out.length && out[out.length - 1] !== "ellipsis") out.push("ellipsis");
  };
  const pushPage = (n: number) => out.push(n);

  if (current <= 4) {
    for (let i = 1; i <= Math.min(5, total); i++) pushPage(i);
    if (total > 5) {
      pushEllipsis();
      pushPage(total);
    }
  } else if (current >= total - 3) {
    pushPage(1);
    pushEllipsis();
    for (let i = Math.max(1, total - 4); i <= total; i++) pushPage(i);
  } else {
    pushPage(1);
    pushEllipsis();
    for (let i = current - 1; i <= current + 1; i++) pushPage(i);
    pushEllipsis();
    pushPage(total);
  }
  return out;
}

function renderPaginationPagesHtml(
  current: number,
  totalPages: number,
): string {
  if (totalPages <= 0) return "";
  const items = buildPaginationItems(current, totalPages);
  return items
    .map((item) => {
      if (item === "ellipsis") {
        return `<span class="product-filters__pager-ellipsis" aria-hidden="true">…</span>`;
      }
      if (item === current) {
        return `<span class="product-filters__pager-page product-filters__pager-page--current" aria-current="page">${item}</span>`;
      }
      return `<button type="button" class="product-filters__pager-page" data-page="${item}" aria-label="Go to page ${item}">${item}</button>`;
    })
    .join("");
}

function syncPager() {
  if (currentTotal === 0) {
    if (pagerRootEl) pagerRootEl.hidden = true;
    if (toolbarPagerNavEl) toolbarPagerNavEl.hidden = true;
    if (pagerRangeEl) pagerRangeEl.textContent = "—";
    if (pagerPagesEl) pagerPagesEl.innerHTML = "";
    for (const b of pagerPrevBtns) b.disabled = true;
    for (const b of pagerNextBtns) b.disabled = true;
    return;
  }
  if (pagerRootEl) pagerRootEl.hidden = false;
  if (toolbarPagerNavEl) toolbarPagerNavEl.hidden = false;

  const page = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));
  const start = currentOffset + 1;
  const end = Math.min(currentOffset + pageSize, currentTotal);

  if (pagerRangeEl) {
    pagerRangeEl.innerHTML = `<span class="product-filters__pager-range-of">${start}–${end} of</span> ${currentTotal}`;
  }
  if (pagerPagesEl) {
    pagerPagesEl.innerHTML = renderPaginationPagesHtml(page, totalPages);
  }

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;
  for (const b of pagerPrevBtns) {
    b.disabled = isFirstPage;
  }
  for (const b of pagerNextBtns) {
    b.disabled = isLastPage;
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

function rebuildSearchLabelMaps() {
  categorySlugToLabel.clear();
  categorySlugToDescription.clear();
  categorySlugToGroupNames.clear();
  attrValueSlugToLabel.clear();
  attrValueSlugToAttrName.clear();

  for (const r of rootCategoriesList) {
    categorySlugToLabel.set(r.slug, r.name);
    if (r.description?.trim()) {
      categorySlugToDescription.set(r.slug, r.description.trim());
    }
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
      const attrSlug = row.slug;
      const attrName = (row.name ?? "").trim();
      for (const v of row.values ?? []) {
        if (v.slug) {
          attrValueSlugToLabel.set(
            v.slug,
            attributeValueDisplayLabel(attrSlug, v.label, v.slug),
          );
          if (attrName) {
            attrValueSlugToAttrName.set(v.slug, attrName);
          }
        }
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
  opts: {
    skipRoot?: boolean;
    skipSub?: boolean;
    skipAttr?: boolean;
    impliedRootsForFacet?: Set<string>;
  },
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
    let rootMatch: boolean;
    if (!noRootSelected) {
      rootMatch = [...rootScope].some((slug) => categories.has(slug));
    } else if (
      opts.impliedRootsForFacet &&
      opts.impliedRootsForFacet.size > 0
    ) {
      const vScope = getRootScopeForVirtualRoots(opts.impliedRootsForFacet);
      rootMatch = [...vScope].some((slug) => categories.has(slug));
    } else {
      rootMatch = true;
    }
    if (!rootMatch) return false;
  }

  if (!opts.skipSub) {
    if (
      selectedRootSlugs.length > 0 &&
      selectedSubSlugs.length > 0 &&
      scopedSelectedSubSlugs.length === 0
    ) {
      return false;
    }
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
  const impliedRootsForFacet =
    selectedRoot.size === 0 && selectedSub.size > 0
      ? getImpliedRootsFromScopedSelectedSubs()
      : undefined;
  const facetOpts: {
    skipSub: true;
    impliedRootsForFacet?: Set<string>;
  } = { skipSub: true };
  if (impliedRootsForFacet && impliedRootsForFacet.size > 0) {
    facetOpts.impliedRootsForFacet = impliedRootsForFacet;
  }
  return allProducts
    .filter((p) => passesCategoryFilters(p, facetOpts))
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
  const altSource =
    p.imageAlt && p.imageAlt.trim() ? p.imageAlt.trim() : p.title;
  const imgAlt = safeDisplayText(altSource);
  const imgW =
    typeof p.imageWidth === "number" && p.imageWidth > 0 ? p.imageWidth : 268;
  const imgH =
    typeof p.imageHeight === "number" && p.imageHeight > 0
      ? p.imageHeight
      : 176;
  const onErrorAttr = ` onerror="this.onerror=null;this.src='${PRODUCT_IMAGE_PLACEHOLDER}'"`;

  return `<li class="product-filters__product-card" data-full-title="${escapeHtmlAttr(decodeHtmlEntities(p.title))}">
  <a class="product-filters__product-link" href="${escapeHtml(href)}">
    <span class="product-filters__product-label">${safeDisplayText(subLabel)}</span>
    <span class="product-filters__product-thumb">
      <img src="${imgSrc}" alt="${imgAlt}" width="${imgW}" height="${imgH}" loading="lazy" decoding="async"${rawImg ? onErrorAttr : ""} />
    </span>
    <h3 class="product-filters__product-title">${safeDisplayText(p.title)}</h3>
    <span class="product-filters__product-cta btn btn--single-outline">View details</span>
  </a>
</li>`;
}

let productTitleTooltipEl: HTMLDivElement | null = null;
let productTitleTooltipActiveCard: HTMLElement | null = null;

function ensureProductTitleTooltipEl(): HTMLDivElement {
  if (productTitleTooltipEl) return productTitleTooltipEl;
  const el = document.createElement("div");
  el.className = "product-filters__product-title-tooltip";
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  document.body.appendChild(el);
  productTitleTooltipEl = el;
  return el;
}

function hideProductTitleTooltip() {
  productTitleTooltipActiveCard = null;
  if (productTitleTooltipEl) {
    productTitleTooltipEl.hidden = true;
    productTitleTooltipEl.textContent = "";
  }
}

function positionProductTitleTooltip(clientX: number, clientY: number) {
  const el = ensureProductTitleTooltipEl();
  if (el.hidden) return;
  const pad = 14;
  el.style.left = "0px";
  el.style.top = "0px";
  void el.offsetHeight;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + rect.width > vw - 8) x = Math.max(8, clientX - rect.width - pad);
  if (y + rect.height > vh - 8) y = Math.max(8, clientY - rect.height - pad);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function productTitleIsClamped(titleEl: HTMLElement): boolean {
  return titleEl.scrollHeight > titleEl.clientHeight + 1;
}

function setupProductCardTitleTooltips() {
  if (!productsEl) return;
  productsEl.addEventListener(
    "mouseover",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        ".product-filters__product-card",
      );
      if (!card || !productsEl.contains(card)) return;
      const titleEl = card.querySelector<HTMLElement>(
        ".product-filters__product-title",
      );
      if (!titleEl || !productTitleIsClamped(titleEl)) {
        hideProductTitleTooltip();
        return;
      }
      const full = card.getAttribute("data-full-title");
      if (!full?.trim()) return;
      productTitleTooltipActiveCard = card;
      const tip = ensureProductTitleTooltipEl();
      tip.textContent = full;
      tip.hidden = false;
      positionProductTitleTooltip(e.clientX, e.clientY);
    },
    true,
  );
  productsEl.addEventListener(
    "mousemove",
    (e) => {
      if (!productTitleTooltipActiveCard || productTitleTooltipEl?.hidden)
        return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        ".product-filters__product-card",
      );
      if (card !== productTitleTooltipActiveCard) return;
      positionProductTitleTooltip(e.clientX, e.clientY);
    },
    true,
  );
  productsEl.addEventListener(
    "mouseout",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        ".product-filters__product-card",
      );
      if (!card || !productsEl.contains(card)) return;
      const related = e.relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      hideProductTitleTooltip();
    },
    true,
  );
  window.addEventListener("scroll", hideProductTitleTooltip, {
    passive: true,
  });
  let resizeHideTooltipTimer: number | null = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeHideTooltipTimer != null) {
        window.clearTimeout(resizeHideTooltipTimer);
      }
      resizeHideTooltipTimer = window.setTimeout(() => {
        resizeHideTooltipTimer = null;
        hideProductTitleTooltip();
      }, 120);
    },
    { passive: true },
  );
}

function requestScrollProductListAfterPagination() {
  scrollProductListAfterFetch = true;
}

function scrollProductListIntoView() {
  const anchor =
    productsEl ?? document.getElementById("product-filters-catalog");
  if (!anchor) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  anchor.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start",
  });
}

async function fetchProducts(options?: { append?: boolean }) {
  const append = Boolean(options?.append);
  const narrow = isNarrowCatalog();

  if (append) {
    if (!narrow) return;
    setLoading(true);
    setError(null);
    try {
      const filtered = getFilteredSortedProducts();
      const total = filtered.length;
      currentTotal = total;
      const start = mobileAccumulatedCount;
      if (start >= total) {
        updateProductsTotalEl();
        syncLoadMoreButton();
        return;
      }
      const nextEnd = Math.min(start + pageSize, total);
      const slice = filtered.slice(start, nextEnd);
      mobileAccumulatedCount = nextEnd;
      if (productsEl) {
        hideProductTitleTooltip();
        if (slice.length > 0) {
          productsEl.insertAdjacentHTML(
            "beforeend",
            slice.map((p) => renderProductCard(p)).join(""),
          );
        }
        if (productsEmptyEl) productsEmptyEl.hidden = total !== 0;
      }
      updateProductsTotalEl();
    } catch (e) {
      scrollProductListAfterFetch = false;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      syncPager();
      syncFilterActionsRow();
      syncLoadMoreButton();
    }
    return;
  }

  setLoading(true);
  setError(null);
  refreshAllSet();
  try {
    renderRootChips();
    renderSubcategories();
    renderAttributesPanel();
    syncCheckboxes();
    syncIntroTitle();
    syncRootNavAndHeaderState();
    refreshOverflowModalIfOpen();
    syncUrlState();

    const filtered = getFilteredSortedProducts();
    const total = filtered.length;
    currentTotal = total;

    if (total === 0) {
      currentOffset = 0;
      mobileAccumulatedCount = 0;
    } else if (narrow) {
      currentOffset = 0;
      mobileAccumulatedCount = Math.min(pageSize, total);
    } else {
      if (currentOffset >= total) {
        currentOffset = Math.floor((total - 1) / pageSize) * pageSize;
      }
      mobileAccumulatedCount = 0;
    }

    const items = narrow
      ? filtered.slice(0, mobileAccumulatedCount)
      : filtered.slice(currentOffset, currentOffset + pageSize);

    updateProductsTotalEl();

    if (productsEl) {
      hideProductTitleTooltip();
      if (total === 0) {
        productsEl.innerHTML = "";
        if (productsEmptyEl) productsEmptyEl.hidden = false;
      } else {
        productsEl.innerHTML = items.map((p) => renderProductCard(p)).join("");
        if (productsEmptyEl) productsEmptyEl.hidden = true;
      }
    }
    renderActiveFilterChips();
  } catch (e) {
    scrollProductListAfterFetch = false;
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
    syncPager();
    syncFilterActionsRow();
    syncLoadMoreButton();
    if (scrollProductListAfterFetch) {
      scrollProductListAfterFetch = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollProductListIntoView());
      });
    }
  }
}

function setupAttrValuesOverflowToggle() {
  if (!attrsEl || attrsEl.dataset.attrOverflowBound === "1") return;
  attrsEl.dataset.attrOverflowBound = "1";
  attrsEl.addEventListener("click", (e) => {
    const more = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".product-filters__attr-values-more",
    );
    if (!more) return;
    const slug = more.dataset.attrValuesSlug;
    if (!slug) return;
    e.preventDefault();
    const modalState = renderOverflowModalAttributeValues(slug);
    if (modalState) openOverflowModal(modalState);
  });
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
    const nowExpanded = !wasExpanded;
    trigger.setAttribute("aria-expanded", String(nowExpanded));
    region.classList.toggle(
      "product-filters__accordion-panel--collapsed",
      !nowExpanded,
    );
    const panelInner = region.querySelector<HTMLElement>(
      ".product-filters__accordion-panel-inner",
    );
    if (panelInner) {
      if (nowExpanded) panelInner.removeAttribute("inert");
      else panelInner.setAttribute("inert", "");
    }
    const attrSlug = trigger.dataset.attrAccordionSlug;
    if (attrSlug) {
      if (wasExpanded) expandedAttrAccordionSlugs.delete(attrSlug);
      else expandedAttrAccordionSlugs.add(attrSlug);
    }
  });
}

function syncCheckboxes() {
  [rootEl, subEl, attrsEl, overflowModalListEl].forEach((el) => {
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

function handleFilterCheckboxChange(e: Event) {
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
      attrValueSlugToLabel.get(slug)?.trim() ||
      fallbackLabelFromValueSlug(slug);
    const attrGroupName = attrValueSlugToAttrName.get(slug)?.trim() ?? "";
    out.push({
      kind: "attr",
      label,
      attrSlug: slug,
      attrGroupName,
    });
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
  const attrTitle =
    chip.kind === "attr" && chip.attrGroupName
      ? `<span class="product-filters__active-chip-attr-name">${safeDisplayText(chip.attrGroupName)}</span>`
      : "";
  const removePhrase =
    chip.kind === "attr" && chip.attrGroupName
      ? `${safeDisplayText(chip.attrGroupName)}: ${safeDisplayText(chip.label)}`
      : safeDisplayText(chip.label);
  return `<button${extra}>
  ${attrTitle}
  <span class="product-filters__active-chip-label">${safeDisplayText(chip.label)}</span>
  <span class="product-filters__active-chip-remove" aria-hidden="true">×</span>
  <span class="visually-hidden">Remove ${removePhrase} filter</span>
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
  syncToolbarCustomSelectUi();
  currentOffset = 0;
  void fetchProducts();
}

function readStoredCatalogViewMode(): CatalogViewMode {
  if (typeof localStorage === "undefined") return "grid";
  try {
    return localStorage.getItem(CATALOG_VIEW_STORAGE_KEY) === "rows"
      ? "rows"
      : "grid";
  } catch {
    return "grid";
  }
}

function setCatalogViewMode(mode: CatalogViewMode, persist: boolean) {
  if (!productsEl) return;
  /** Rows layout toggle is hidden below `md` in SCSS — never apply `--rows` there. */
  const showRows = mode === "rows" && isCatalogTabletUp();
  productsEl.classList.toggle("product-filters__list--rows", showRows);
  const gridBtn = document.getElementById("product-filters-view-grid");
  const rowsBtn = document.getElementById("product-filters-view-rows");
  const ariaMode: CatalogViewMode = showRows ? "rows" : "grid";
  if (gridBtn) {
    gridBtn.setAttribute("aria-pressed", String(ariaMode === "grid"));
  }
  if (rowsBtn) {
    rowsBtn.setAttribute("aria-pressed", String(ariaMode === "rows"));
  }
  if (persist) {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }
}

function bindRootShowMoreControls(hasExtra: boolean) {
  const more = document.getElementById("product-filters-root-more");
  const less = document.getElementById("product-filters-root-less");
  if (!more || !less) {
    if (more) {
      more.hidden = true;
      more.onclick = null;
    }
    if (less) {
      less.hidden = true;
      less.onclick = null;
    }
    return;
  }
  if (!hasExtra) {
    more.hidden = true;
    less.hidden = true;
    more.onclick = null;
    less.onclick = null;
    return;
  }
  const expanded = rootCategoriesExtraExpanded;
  const extraWrap = rootEl?.querySelector<HTMLElement>(
    ".product-filters__chips-overflow",
  );
  if (extraWrap) {
    if (expanded) extraWrap.removeAttribute("hidden");
    else extraWrap.hidden = true;
  }
  more.hidden = expanded;
  less.hidden = !expanded;
  more.onclick = () => {
    rootCategoriesExtraExpanded = true;
    renderRootChips();
    syncCheckboxes();
  };
  less.onclick = () => {
    rootCategoriesExtraExpanded = false;
    renderRootChips();
    syncCheckboxes();
  };
}

function renderRootChips() {
  if (!rootEl) return;
  const list = rootCategoriesList;
  const renderChip = (a: { name: string; slug: string }) =>
    `<label class="product-filters__chip"><input class="product-filters__chip-input" type="checkbox" data-group="root" data-slug="${escapeHtml(a.slug)}" />${safeDisplayText(a.name)} <span class="product-filters__count">${countRootFacet(a.slug)}</span></label>`;

  if (list.length === 0) {
    rootCategoriesExtraExpanded = false;
    rootEl.innerHTML = "";
    bindRootShowMoreControls(false);
    return;
  }

  const limit = ROOT_CATEGORIES_VISIBLE_LIMIT;
  if (list.length <= limit) {
    rootCategoriesExtraExpanded = false;
    rootEl.innerHTML = list.map(renderChip).join("");
    bindRootShowMoreControls(false);
    return;
  }

  const overflowOn = rootCategoriesExtraExpanded;
  const vis = list.slice(0, limit);
  const extra = list.slice(limit);
  rootEl.innerHTML = `<div class="product-filters__root-values">
    ${vis.map(renderChip).join("")}
    <div class="product-filters__chips-overflow"${overflowOn ? "" : " hidden"}>
      ${extra.map(renderChip).join("")}
    </div>
  <div class="product-filters__sub-more-row product-filters__root-more-row">
    <button type="button" id="product-filters-root-more" class="product-filters__link-btn product-filters__root-values-more"${overflowOn ? " hidden" : ""}>
      Show all
      ${ATTR_VALUES_MORE_ARROW_SVG}
    </button>
    <button type="button" id="product-filters-root-less" class="product-filters__link-btn product-filters__root-values-less"${overflowOn ? "" : " hidden"}>
      Hide
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="product-filters__link-btn-icon product-filters__link-btn-icon--rotate" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</div>`;
  bindRootShowMoreControls(true);
}

function setupMobileFiltersDrawer() {
  const cat = catalogSectionEl;
  const backdrop = drawerBackdropEl;
  const openBtn = drawerOpenBtn;
  const closeBtn = drawerCloseBtn;
  const panel = filtersPanelEl;
  if (!cat || !backdrop || !openBtn || !closeBtn || !panel) {
    return;
  }

  const mqLgg = window.matchMedia("(min-width: 1200px)");
  let lastFocus: HTMLElement | null = null;

  const isDesktop = () => mqLgg.matches;

  const syncDrawerAria = () => {
    if (isDesktop()) {
      cat.classList.remove(DRAWER_OPEN_CLASS);
      document.body.style.overflow = "";
      panel.removeAttribute("aria-hidden");
      backdrop.setAttribute("aria-hidden", "true");
      openBtn.setAttribute("aria-expanded", "false");
      return;
    }

    const open = cat.classList.contains(DRAWER_OPEN_CLASS);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    backdrop.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const closeDrawer = () => {
    if (!cat.classList.contains(DRAWER_OPEN_CLASS)) return;
    cat.classList.remove(DRAWER_OPEN_CLASS);
    document.body.style.overflow = "";
    syncDrawerAria();
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  };

  const openDrawer = () => {
    if (isDesktop()) return;
    lastFocus = document.activeElement as HTMLElement;
    cat.classList.add(DRAWER_OPEN_CLASS);
    document.body.style.overflow = "hidden";
    syncDrawerAria();
    closeBtn.focus();
  };

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openDrawer();
  });
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeDrawer();
  });
  backdrop.addEventListener("click", () => {
    closeDrawer();
  });

  mqLgg.addEventListener("change", () => {
    closeDrawer();
    syncDrawerAria();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isDesktop()) return;
    if (!cat.classList.contains(DRAWER_OPEN_CLASS)) return;
    e.preventDefault();
    closeDrawer();
  });

  syncDrawerAria();
}

async function init() {
  try {
    setupMobileFiltersDrawer();
    setCatalogViewMode(readStoredCatalogViewMode(), false);

    const res = await fetch("/data/product-filters.json");
    const data = (await readJsonSafe(res)) as {
      generatedAt?: string;
      attributesByCategory?: Record<string, AttrByCategoryRow[]>;
      rootCategories?: {
        name: string;
        slug: string;
        description?: string | null;
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
        imageAlt?: string | null;
        imageWidth?: number | null;
        imageHeight?: number | null;
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
      description:
        typeof r.description === "string" && r.description.trim()
          ? r.description.trim()
          : undefined,
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
      imageAlt: item.imageAlt ?? null,
      imageWidth: typeof item.imageWidth === "number" ? item.imageWidth : null,
      imageHeight:
        typeof item.imageHeight === "number" ? item.imageHeight : null,
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

    rootEl.addEventListener("change", handleFilterCheckboxChange);
    subEl.addEventListener("change", handleFilterCheckboxChange);
    attrsEl.addEventListener("change", handleFilterCheckboxChange);

    clearBtn?.addEventListener("click", () => {
      clearAllFilters();
    });

    searchInput?.addEventListener("input", () => {
      searchQuery = searchInput?.value ?? "";
      currentOffset = 0;
      void fetchProducts();
    });

    perTrigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = perMenu && !perMenu.hidden;
      closeToolbarCustomDropdowns();
      if (!isOpen && perMenu && perTrigger) {
        perMenu.hidden = false;
        perTrigger.setAttribute("aria-expanded", "true");
        perDropdownRoot?.classList.add("product-filters__custom-select--open");
      }
    });

    sortTrigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = sortMenu && !sortMenu.hidden;
      closeToolbarCustomDropdowns();
      if (!isOpen && sortMenu && sortTrigger) {
        sortMenu.hidden = false;
        sortTrigger.setAttribute("aria-expanded", "true");
        sortDropdownRoot?.classList.add("product-filters__custom-select--open");
      }
    });

    perMenu?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-per-value]",
      );
      if (!btn) return;
      const v = Number(btn.dataset.perValue);
      if (
        !PAGE_SIZE_OPTIONS.includes(v as (typeof PAGE_SIZE_OPTIONS)[number])
      ) {
        return;
      }
      pageSize = v;
      currentOffset = 0;
      closeToolbarCustomDropdowns();
      syncToolbarCustomSelectUi();
      void fetchProducts();
    });

    sortMenu?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-sort-value]",
      );
      if (!btn) return;
      const v = btn.dataset.sortValue;
      if (v !== "updated" && v !== "name-asc" && v !== "name-desc") return;
      sortMode = v;
      currentOffset = 0;
      closeToolbarCustomDropdowns();
      syncToolbarCustomSelectUi();
      void fetchProducts();
    });

    document.addEventListener("click", () => {
      closeToolbarCustomDropdowns();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeToolbarCustomDropdowns();
        closeOverflowModal();
      }
    });

    document
      .getElementById("product-filters-view-grid")
      ?.addEventListener("click", () => {
        setCatalogViewMode("grid", true);
      });
    document
      .getElementById("product-filters-view-rows")
      ?.addEventListener("click", () => {
        setCatalogViewMode("rows", true);
      });

    const goPrevPage = () => {
      if (currentOffset <= 0) return;
      currentOffset = Math.max(0, currentOffset - pageSize);
      requestScrollProductListAfterPagination();
      void fetchProducts();
    };
    const goNextPage = () => {
      if (currentOffset + pageSize >= currentTotal) return;
      currentOffset += pageSize;
      requestScrollProductListAfterPagination();
      void fetchProducts();
    };
    for (const b of pagerPrevBtns) b.addEventListener("click", goPrevPage);
    for (const b of pagerNextBtns) b.addEventListener("click", goNextPage);

    pagerRootEl?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-page]",
      );
      if (!btn?.dataset.page) return;
      const p = Number(btn.dataset.page);
      if (!Number.isFinite(p)) return;
      const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));
      if (p < 1 || p > totalPages) return;
      currentOffset = (p - 1) * pageSize;
      requestScrollProductListAfterPagination();
      void fetchProducts();
    });

    document
      .getElementById("product-filters-load-more")
      ?.addEventListener("click", () => {
        if (!isNarrowCatalog()) return;
        void fetchProducts({ append: true });
      });

    const mqCatalogDesktop = window.matchMedia("(min-width: 768px)");
    mqCatalogDesktop.addEventListener("change", () => {
      if (!mqCatalogDesktop.matches) closeOverflowModal();
      scrollProductListAfterFetch = false;
      setCatalogViewMode(readStoredCatalogViewMode(), false);
      void fetchProducts();
    });

    window.addEventListener("popstate", () => {
      applyStateFromUrl();
      void fetchProducts();
    });

    setupProductFiltersAccordions();
    setupAttrValuesOverflowToggle();
    setupProductCardTitleTooltips();

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
