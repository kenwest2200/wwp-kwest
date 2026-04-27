export {};

import { decodeHtmlEntities } from "../lib/decode-html-entities";

const PER_PAGE_STORAGE_KEY = "wwp-search-per-page";

const titlePrimaryEl = document.getElementById(
  "search-results-heading-primary",
) as HTMLSpanElement | null;
const titleQueryEl = document.getElementById(
  "search-results-heading-query",
) as HTMLSpanElement | null;
const summaryEl = document.getElementById(
  "search-results-summary",
) as HTMLParagraphElement | null;
const errorEl = document.getElementById(
  "search-results-error",
) as HTMLParagraphElement | null;
const emptyGlobalEl = document.getElementById(
  "search-results-empty",
) as HTMLParagraphElement | null;

const tabProductsBtn = document.getElementById(
  "search-tab-btn-products",
) as HTMLButtonElement | null;
const tabPagesBtn = document.getElementById(
  "search-tab-btn-pages",
) as HTMLButtonElement | null;
const tabProductsPanel = document.getElementById(
  "search-tabpanel-products",
) as HTMLElement | null;
const tabPagesPanel = document.getElementById(
  "search-tabpanel-pages",
) as HTMLElement | null;
const listProductsEl = document.getElementById(
  "search-results-list-products",
) as HTMLUListElement | null;
const listPagesEl = document.getElementById(
  "search-results-list-pages",
) as HTMLUListElement | null;
const emptyProductsEl = document.getElementById(
  "search-results-empty-products",
) as HTMLParagraphElement | null;
const emptyPagesEl = document.getElementById(
  "search-results-empty-pages",
) as HTMLParagraphElement | null;
const tabsWrapEl = document.getElementById("search-results-tabs-wrap");
const tabsLoaderEl = document.getElementById("search-results-tabs-loader");
const cardTemplateEl = document.getElementById(
  "search-card-template",
) as HTMLTemplateElement | null;
const pageHitTemplateEl = document.getElementById(
  "search-page-hit-template",
) as HTMLTemplateElement | null;

const toolbarProductsEl = document.getElementById("search-toolbar-products");
const bottomPagerWrapEl = document.getElementById("search-bottom-pager-wrap");

const pagerRootEl = document.getElementById("search-results-pager");
const pagerPagesEl = document.getElementById("search-pager-pages");

const params = new URLSearchParams(window.location.search);
const query = (params.get("q") ?? "").trim();

type SearchTab = "products" | "pages";

type SearchItemType = "product" | "page";

type SearchApiItem = {
  title?: string;
  uri?: string;
  image?: {
    url?: string | null;
    alt?: string | null;
    thumbnails?: {
      small?: string | null;
      medium?: string | null;
    } | null;
  } | null;
  subcategory?: string | null;
  description?: string | null;
  type?: SearchItemType | null;
};

type SearchApiPayload = {
  total?: number;
  items?: SearchApiItem[];
  error?: string;
};

let activeTab: SearchTab = "products";
let currentPageProducts = 1;
let currentPagePages = 1;
let perPage = readPerPage();
let lastTotalProducts = 0;
let lastTotalPages = 0;
/** On narrow viewport: product cards currently shown (load-more). */
let mobileAccumulatedProducts = 0;

function isNarrowSearchViewport(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

function readPerPage(): number {
  try {
    const raw = localStorage.getItem(PER_PAGE_STORAGE_KEY);
    const n = Number(raw);
    if (n === 12 || n === 24) return n;
  } catch {
    /* ignore */
  }
  return 12;
}

function writePerPage(n: 12 | 24): void {
  perPage = n;
  try {
    localStorage.setItem(PER_PAGE_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function normalizeSearchHref(uri: string): string {
  const u = uri.trim();
  if (!u) return "#";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

function itemImageSrc(item: SearchApiItem): string | null {
  const full = item.image?.url?.trim();
  if (full) return full;
  const t = item.image?.thumbnails;
  const fromThumb = t?.small || t?.medium;
  if (fromThumb) return fromThumb;
  return null;
}

function itemImageAlt(item: SearchApiItem, titlePlain: string): string {
  const a = item.image?.alt?.trim();
  if (a) return decodeHtmlEntities(a);
  return titlePlain;
}

const PRODUCT_IMAGE_PLACEHOLDER = "/images/no-product-image.svg";

function classifyItem(item: SearchApiItem): SearchItemType {
  const t = (item.type ?? "").toString().trim().toLowerCase();
  if (t === "page") return "page";
  return "product";
}

function cardKindLabel(item: SearchApiItem): string {
  if (classifyItem(item) === "page") return "Page";
  const sub = (item.subcategory ?? "").toString().trim();
  return sub || "Product";
}

function stripHtmlToText(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = doc.body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function perRoots(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>("[data-search-per-root]");
}

function setPerMenuOpenFor(root: HTMLElement | null, open: boolean): void {
  if (!root) return;
  root.classList.toggle("product-filters__custom-select--open", open);
  root
    .querySelector<HTMLElement>("[data-search-per-trigger]")
    ?.setAttribute("aria-expanded", open ? "true" : "false");
  const menu = root.querySelector<HTMLElement>("[data-search-per-menu]");
  if (menu) menu.hidden = !open;
}

function closeAllPerMenus(): void {
  for (const r of perRoots()) setPerMenuOpenFor(r, false);
}

function updatePerValueLabels(): void {
  const el = document.getElementById("search-per-value");
  if (el) el.textContent = String(perPage);
}

function panelLoaderEl(tab: SearchTab): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-search-panel-loader="${tab}"]`,
  );
}

function setPanelLoading(tab: SearchTab, loading: boolean): void {
  const loader = panelLoaderEl(tab);
  const panel = tab === "products" ? tabProductsPanel : tabPagesPanel;
  if (loader) loader.hidden = !loading;
  if (panel) panel.setAttribute("aria-busy", loading ? "true" : "false");
}

function resetListsFull(): void {
  mobileAccumulatedProducts = 0;
  if (listProductsEl) listProductsEl.innerHTML = "";
  if (listPagesEl) listPagesEl.innerHTML = "";
  if (emptyGlobalEl) emptyGlobalEl.hidden = true;
  if (emptyProductsEl) emptyProductsEl.hidden = true;
  if (emptyPagesEl) emptyPagesEl.hidden = true;
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }
}

function clearListFor(tab: SearchTab): void {
  if (tab === "products" && listProductsEl) {
    listProductsEl.innerHTML = "";
    mobileAccumulatedProducts = 0;
  }
  if (tab === "pages" && listPagesEl) listPagesEl.innerHTML = "";
}

function setError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function setSummary(text: string): void {
  if (!summaryEl) return;
  summaryEl.replaceChildren();
  if (text) {
    summaryEl.appendChild(document.createTextNode(text));
    summaryEl.hidden = false;
  } else {
    summaryEl.hidden = true;
  }
}

function setMainSearchLoading(visible: boolean): void {
  if (tabsLoaderEl) tabsLoaderEl.hidden = !visible;
  if (visible && tabsWrapEl) tabsWrapEl.setAttribute("hidden", "");
}

async function fetchRelatedAutocompleteItems(
  q: string,
): Promise<{ title: string; uri: string }[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch(
      `/api/search-autocomplete?q=${encodeURIComponent(trimmed)}&limit=10`,
    );
    const data = (await res.json()) as {
      items?: { title?: string; uri?: string }[];
    };
    if (!res.ok) return [];
    const raw = Array.isArray(data.items) ? data.items : [];
    const qLower = trimmed.toLowerCase();
    return raw
      .filter((x) => x?.title && x?.uri)
      .map((x) => ({
        title: decodeHtmlEntities(String(x.title).trim()),
        uri: String(x.uri).trim(),
      }))
      .filter((x) => x.title.toLowerCase() !== qLower)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/** Hides the summary row (used for “Related search terms” when there is nothing to show). */
function clearRelatedSearchTerms(): void {
  if (!summaryEl || !query) return;
  summaryEl.replaceChildren();
  summaryEl.hidden = true;
}

function showRelatedSearchTerms(
  items: { title: string; uri: string }[],
): void {
  const el = summaryEl;
  if (!el || !query || items.length === 0) return;
  el.replaceChildren();
  const lead = document.createElement("span");
  lead.className = "search-results-page__summary-lead";
  lead.textContent = "Related search terms: ";
  el.appendChild(lead);
  items.forEach((it, i) => {
    if (i > 0) el.appendChild(document.createTextNode(", "));
    const a = document.createElement("a");
    a.href = normalizeSearchHref(it.uri);
    a.textContent = it.title;
    a.className = "search-results-page__summary-link";
    el.appendChild(a);
  });
  el.hidden = false;
}

function setSearchHeading(main: string, queryLine: string | null): void {
  if (titlePrimaryEl) titlePrimaryEl.textContent = main;
  if (titleQueryEl) {
    if (!queryLine) {
      titleQueryEl.textContent = "";
      titleQueryEl.hidden = true;
      titleQueryEl.setAttribute("aria-hidden", "true");
    } else {
      titleQueryEl.textContent = queryLine;
      titleQueryEl.hidden = false;
      titleQueryEl.removeAttribute("aria-hidden");
    }
  }
}

function setActiveTab(which: SearchTab): void {
  activeTab = which;
  const isProducts = which === "products";
  if (tabProductsBtn) {
    tabProductsBtn.classList.toggle("is-active", isProducts);
    tabProductsBtn.setAttribute("aria-selected", isProducts ? "true" : "false");
  }
  if (tabPagesBtn) {
    tabPagesBtn.classList.toggle("is-active", !isProducts);
    tabPagesBtn.setAttribute("aria-selected", isProducts ? "false" : "true");
  }
  if (tabProductsPanel) tabProductsPanel.hidden = !isProducts;
  if (tabPagesPanel) tabPagesPanel.hidden = isProducts;

  syncPagerUi();
}

function cloneSearchResultCard(item: SearchApiItem): HTMLLIElement | null {
  if (!cardTemplateEl) return null;
  const node = cardTemplateEl.content.cloneNode(true) as DocumentFragment;
  const li = node.querySelector(
    "[data-search-card-root]",
  ) as HTMLLIElement | null;
  const link = node.querySelector<HTMLAnchorElement>("[data-search-card-link]");
  const labelEl = node.querySelector<HTMLElement>("[data-search-card-label]");
  const img = node.querySelector<HTMLImageElement>("[data-search-card-img]");
  const titleEl = node.querySelector<HTMLElement>("[data-search-card-title]");

  if (!li || !link || !labelEl || !img || !titleEl) return null;

  const titlePlain =
    decodeHtmlEntities((item.title ?? "").trim()) || "Untitled";
  const href = item.uri ? normalizeSearchHref(item.uri) : "#";
  link.href = href;

  labelEl.textContent = cardKindLabel(item);

  const rawImg = itemImageSrc(item)?.trim();
  img.onerror = () => {
    img.onerror = null;
    img.src = PRODUCT_IMAGE_PLACEHOLDER;
  };
  img.src = rawImg && rawImg.length > 0 ? rawImg : PRODUCT_IMAGE_PLACEHOLDER;
  img.alt = itemImageAlt(item, titlePlain);

  titleEl.textContent = titlePlain;
  li.setAttribute("data-full-title", titlePlain);

  return li;
}

function clonePageHitCard(item: SearchApiItem): HTMLLIElement | null {
  if (!pageHitTemplateEl) return null;
  const node = pageHitTemplateEl.content.cloneNode(true) as DocumentFragment;
  const li = node.querySelector(
    "[data-search-page-hit-root]",
  ) as HTMLLIElement | null;
  const titleEl = node.querySelector<HTMLElement>(
    "[data-search-page-hit-title]",
  );
  const descEl = node.querySelector<HTMLElement>("[data-search-page-hit-desc]");
  const link = node.querySelector<HTMLAnchorElement>(
    "[data-search-page-hit-link]",
  );

  if (!li || !titleEl || !descEl || !link) return null;

  const titlePlain =
    decodeHtmlEntities((item.title ?? "").trim()) || "Untitled";
  const href = item.uri ? normalizeSearchHref(item.uri) : "#";
  link.href = href;
  link.setAttribute("aria-label", `Read more: ${titlePlain}`);

  titleEl.textContent = titlePlain;

  const rawDesc = (item.description ?? "").toString();
  const plain = stripHtmlToText(rawDesc);
  const excerpt = plain
    ? truncateText(plain, 220)
    : "Open this page for more information.";
  descEl.textContent = excerpt;

  return li;
}

function totalPagesFor(tab: SearchTab): number {
  const total = tab === "products" ? lastTotalProducts : lastTotalPages;
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / perPage));
}

function currentPageFor(tab: SearchTab): number {
  return tab === "products" ? currentPageProducts : currentPagePages;
}

function setCurrentPageFor(tab: SearchTab, p: number): void {
  if (tab === "products") currentPageProducts = p;
  else currentPagePages = p;
}

function clampCurrentPageFor(tab: SearchTab): void {
  const tp = totalPagesFor(tab);
  let cur = currentPageFor(tab);
  if (cur > tp) cur = tp;
  if (cur < 1) cur = 1;
  setCurrentPageFor(tab, cur);
}

function buildPaginationItems(
  current: number,
  pages: number,
): Array<number | "ellipsis"> {
  if (pages <= 0) return [];
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const out: Array<number | "ellipsis"> = [];
  const pushEllipsis = () => {
    if (out.length && out[out.length - 1] !== "ellipsis") out.push("ellipsis");
  };
  const pushPage = (n: number) => out.push(n);

  if (current <= 4) {
    for (let i = 1; i <= Math.min(5, pages); i++) pushPage(i);
    if (pages > 5) {
      pushEllipsis();
      pushPage(pages);
    }
  } else if (current >= pages - 3) {
    pushPage(1);
    pushEllipsis();
    for (let i = Math.max(1, pages - 4); i <= pages; i++) pushPage(i);
  } else {
    pushPage(1);
    pushEllipsis();
    for (let i = current - 1; i <= current + 1; i++) pushPage(i);
    pushEllipsis();
    pushPage(pages);
  }
  return out;
}

function renderPaginationPagesHtml(
  current: number,
  pages: number,
): string {
  if (pages <= 0) return "";
  const items = buildPaginationItems(current, pages);
  return items
    .map((item) => {
      if (item === "ellipsis") {
        return `<span class="product-filters__pager-ellipsis" aria-hidden="true">…</span>`;
      }
      if (item === current) {
        return `<span class="product-filters__pager-page product-filters__pager-page--current" aria-current="page">${item}</span>`;
      }
      return `<button type="button" class="product-filters__pager-page" data-search-page="${item}" aria-label="Go to page ${item}">${item}</button>`;
    })
    .join("");
}

function formatRangeHtml(total: number, cur: number): string {
  if (total <= 0) return "";
  const start = (cur - 1) * perPage + 1;
  const end = Math.min(cur * perPage, total);
  return `<span class="product-filters__pager-range-of">${start}–${end} of</span> ${total}`;
}

function syncToolbarRange(): void {
  const tab = activeTab;
  const total = tab === "products" ? lastTotalProducts : lastTotalPages;
  const cur = currentPageFor(tab);
  const el = document.querySelector<HTMLElement>(
    ".search-js-pager-range-toolbar",
  );
  if (!el) return;
  if (
    tab === "products" &&
    isNarrowSearchViewport() &&
    total > 0
  ) {
    el.innerHTML = `<span class="product-filters__pager-range-of">${mobileAccumulatedProducts} of</span> ${total}`;
    return;
  }
  el.innerHTML = formatRangeHtml(total, cur);
}

function syncFooterRange(): void {
  const el = document.querySelector<HTMLElement>(
    ".search-js-pager-range-footer",
  );
  if (el) {
    el.innerHTML = formatRangeHtml(lastTotalProducts, currentPageProducts);
  }
}

function syncTopToolbarNav(): void {
  const tab = activeTab;
  const tp = totalPagesFor(tab);
  const cur = currentPageFor(tab);
  const total = tab === "products" ? lastTotalProducts : lastTotalPages;
  const first = cur <= 1 || total === 0;
  const last = cur >= tp || total === 0;
  const btns = document.querySelectorAll<HTMLButtonElement>(
    "#search-toolbar-products [data-search-nav]",
  );
  for (const b of btns) {
    const dir = b.dataset.searchNav;
    if (dir === "prev") b.disabled = first;
    if (dir === "next") b.disabled = last;
  }
}

function syncFooterPagerNav(): void {
  const tab: SearchTab = "products";
  const tp = totalPagesFor(tab);
  const cur = currentPageFor(tab);
  const total = lastTotalProducts;
  const first = cur <= 1 || total === 0;
  const last = cur >= tp || total === 0;
  const btns = document.querySelectorAll<HTMLButtonElement>(
    "#search-results-pager [data-search-nav]",
  );
  for (const b of btns) {
    const dir = b.dataset.searchNav;
    if (dir === "prev") b.disabled = first;
    if (dir === "next") b.disabled = last;
  }
}

function syncPagerUi(): void {
  clampCurrentPageFor("products");
  clampCurrentPageFor("pages");

  syncToolbarRange();
  syncFooterRange();
  syncTopToolbarNav();
  syncFooterPagerNav();

  const tpProd = totalPagesFor("products");
  if (pagerPagesEl) {
    pagerPagesEl.innerHTML =
      lastTotalProducts === 0
        ? ""
        : renderPaginationPagesHtml(currentPageProducts, tpProd);
  }

  updatePerValueLabels();

  if (pagerRootEl) {
    pagerRootEl.classList.toggle(
      "product-filters__pager--empty",
      lastTotalProducts === 0,
    );
  }

  syncSearchLoadMoreButton();

  const showProductsChrome =
    activeTab === "products" && lastTotalProducts > perPage;
  if (toolbarProductsEl) toolbarProductsEl.hidden = !showProductsChrome;
  if (bottomPagerWrapEl) bottomPagerWrapEl.hidden = !showProductsChrome;
}

const loadMoreProductsBtn = document.getElementById(
  "search-load-more-products",
) as HTMLButtonElement | null;

function syncSearchLoadMoreButton(): void {
  if (!loadMoreProductsBtn) return;
  const narrow = isNarrowSearchViewport();
  loadMoreProductsBtn.hidden =
    !narrow ||
    activeTab !== "products" ||
    lastTotalProducts === 0 ||
    mobileAccumulatedProducts >= lastTotalProducts;
}

function bindTabs() {
  tabProductsBtn?.addEventListener("click", () => {
    if (activeTab === "products") return;
    setActiveTab("products");
    void fetchAndRender("products", { showLoader: true });
  });
  tabPagesBtn?.addEventListener("click", () => {
    if (activeTab === "pages") return;
    setActiveTab("pages");
    void fetchAndRender("pages", { showLoader: true });
  });
}

function bindPagerNav() {
  document.body.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-search-nav]",
    );
    if (!t) return;
    const dir = t.dataset.searchNav;
    if (dir !== "prev" && dir !== "next") return;

    let tab: SearchTab | null = null;
    if (t.closest("#search-toolbar-products")) {
      tab = activeTab;
    } else if (t.closest("#search-results-pager")) {
      tab = "products";
    }
    if (!tab) return;

    const tp = totalPagesFor(tab);
    let cur = currentPageFor(tab);
    if (dir === "prev") {
      if (cur <= 1) return;
      cur -= 1;
    } else {
      if (cur >= tp) return;
      cur += 1;
    }
    setCurrentPageFor(tab, cur);
    void fetchAndRender(tab, { showLoader: true });
  });
}

function bindPerPageSelect() {
  for (const root of perRoots()) {
    root.addEventListener("click", (e) => e.stopPropagation());
    root.querySelector("[data-search-per-trigger]")?.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        const open = !root.classList.contains(
          "product-filters__custom-select--open",
        );
        closeAllPerMenus();
        setPerMenuOpenFor(root, open);
      },
    );
    root.querySelector("[data-search-per-menu]")?.addEventListener(
      "click",
      (e) => {
        const t = (e.target as HTMLElement).closest<HTMLButtonElement>(
          "[data-search-per-value]",
        );
        if (!t) return;
        const v = Number(t.dataset.searchPerValue);
        if (v !== 12 && v !== 24) return;
        writePerPage(v as 12 | 24);
        currentPageProducts = 1;
        currentPagePages = 1;
        closeAllPerMenus();
        void fetchAndRender(activeTab, { showLoader: true });
      },
    );
  }

  document.addEventListener("click", () => closeAllPerMenus());
}

function bindPagerPages() {
  pagerPagesEl?.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-search-page]",
    );
    if (!t) return;
    const p = Number(t.dataset.searchPage);
    if (!Number.isFinite(p) || p < 1) return;
    currentPageProducts = p;
    void fetchAndRender("products", { showLoader: true });
  });
}

async function fetchTabTotal(tab: SearchTab): Promise<number> {
  if (!query) return 0;
  const type = tab === "products" ? "product" : "page";
  const res = await fetch(
    `/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=1&offset=0`,
  );
  const payload = (await res.json()) as SearchApiPayload;
  if (!res.ok) {
    throw new Error(payload.error || "Search request failed.");
  }
  return Number(payload.total ?? 0);
}

async function fetchAndRender(
  tab: SearchTab,
  opts?: { showLoader?: boolean; append?: boolean },
): Promise<boolean> {
  if (!query) return false;

  const showLoader = opts?.showLoader !== false;
  const append =
    Boolean(opts?.append) &&
    tab === "products" &&
    isNarrowSearchViewport();
  const pageBeforeFetch = currentPageFor(tab);
  const type = tab === "products" ? "product" : "page";

  if (!append) {
    clearListFor(tab);
  }
  if (showLoader && !append) setPanelLoading(tab, true);
  if (append && loadMoreProductsBtn) loadMoreProductsBtn.disabled = true;

  clampCurrentPageFor(tab);
  syncPagerUi();

  const offset =
    tab === "products"
      ? append
        ? mobileAccumulatedProducts
        : isNarrowSearchViewport()
          ? 0
          : (currentPageFor(tab) - 1) * perPage
      : (currentPageFor(tab) - 1) * perPage;

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(
        query,
      )}&type=${type}&limit=${perPage}&offset=${offset}`,
    );
    const payload = (await res.json()) as SearchApiPayload;
    if (!res.ok) {
      throw new Error(payload.error || "Search request failed.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    const total = Number(payload.total ?? items.length);
    if (tab === "products") lastTotalProducts = total;
    else lastTotalPages = total;

    clampCurrentPageFor(tab);
    if (!append && currentPageFor(tab) !== pageBeforeFetch) {
      if (showLoader) setPanelLoading(tab, false);
      if (loadMoreProductsBtn) loadMoreProductsBtn.disabled = false;
      return await fetchAndRender(tab, opts);
    }

    const hasAny = lastTotalProducts > 0 || lastTotalPages > 0;
    if (emptyGlobalEl) emptyGlobalEl.hidden = hasAny;

    if (tab === "products" && listProductsEl) {
      for (const item of items) {
        if (!item?.uri || !item.title) continue;
        const row = cloneSearchResultCard(item);
        if (row) listProductsEl.appendChild(row);
      }
      mobileAccumulatedProducts = listProductsEl.children.length;
      if (emptyProductsEl) {
        emptyProductsEl.hidden = mobileAccumulatedProducts > 0;
      }
    }

    if (tab === "pages" && listPagesEl) {
      for (const item of items) {
        if (!item?.uri || !item.title) continue;
        const row = clonePageHitCard(item);
        if (row) listPagesEl.appendChild(row);
      }
      if (emptyPagesEl) {
        emptyPagesEl.hidden = items.length > 0;
      }
    }

    syncPagerUi();
    return true;
  } catch (e) {
    if (append) {
      if (loadMoreProductsBtn) loadMoreProductsBtn.disabled = false;
      syncPagerUi();
      setPanelLoading(tab, false);
      return false;
    }
    lastTotalProducts = 0;
    lastTotalPages = 0;
    mobileAccumulatedProducts = 0;
    setError(e instanceof Error ? e.message : String(e));
    tabsWrapEl?.setAttribute("hidden", "");
    syncPagerUi();
    setPanelLoading("products", false);
    setPanelLoading("pages", false);
    return false;
  } finally {
    if (showLoader && !append) setPanelLoading(tab, false);
    if (append && loadMoreProductsBtn) loadMoreProductsBtn.disabled = false;
  }
}

async function runSearch() {
  resetListsFull();
  currentPageProducts = 1;
  currentPagePages = 1;
  perPage = readPerPage();
  activeTab = "products";
  lastTotalProducts = 0;
  lastTotalPages = 0;

  if (!query) {
    setSearchHeading("Search", null);
    setSummary("Enter a query to search.");
    tabsWrapEl?.setAttribute("hidden", "");
    setMainSearchLoading(false);
    closeAllPerMenus();
    updatePerValueLabels();
    return;
  }

  setSearchHeading("Search results", `For "${decodeHtmlEntities(query)}"`);
  clearRelatedSearchTerms();
  setMainSearchLoading(true);
  syncPagerUi();
  closeAllPerMenus();
  updatePerValueLabels();

  try {
    const [prodTotal, pageTotal, relatedItems] = await Promise.all([
      fetchTabTotal("products"),
      fetchTabTotal("pages"),
      fetchRelatedAutocompleteItems(query),
    ]);
    lastTotalProducts = prodTotal;
    lastTotalPages = pageTotal;
    syncPagerUi();

    const hasAny = lastTotalProducts > 0 || lastTotalPages > 0;
    if (!hasAny) {
      clearRelatedSearchTerms();
    } else if (relatedItems.length > 0) {
      showRelatedSearchTerms(relatedItems);
    } else {
      clearRelatedSearchTerms();
    }

    if (emptyGlobalEl) emptyGlobalEl.hidden = hasAny;
    if (!hasAny) {
      setMainSearchLoading(false);
      return;
    }

    let initialOk = false;
    if (lastTotalProducts === 0 && lastTotalPages > 0) {
      setActiveTab("pages");
      initialOk = await fetchAndRender("pages", { showLoader: false });
    } else {
      setActiveTab("products");
      initialOk = await fetchAndRender("products", { showLoader: false });
    }

    setMainSearchLoading(false);
    if (initialOk) {
      tabsWrapEl?.removeAttribute("hidden");
    }
  } catch (e) {
    setMainSearchLoading(false);
    setSummary("");
    setError(e instanceof Error ? e.message : String(e));
    tabsWrapEl?.setAttribute("hidden", "");
  }
}

loadMoreProductsBtn?.addEventListener("click", () => {
  if (!isNarrowSearchViewport() || activeTab !== "products") return;
  void fetchAndRender("products", { showLoader: false, append: true });
});

const mqSearchDesktop = window.matchMedia("(min-width: 768px)");
mqSearchDesktop.addEventListener("change", () => {
  if (!query || activeTab !== "products") return;
  currentPageProducts = 1;
  mobileAccumulatedProducts = 0;
  void fetchAndRender("products", { showLoader: true });
});

bindTabs();
bindPagerNav();
bindPerPageSelect();
bindPagerPages();
void runSearch();
