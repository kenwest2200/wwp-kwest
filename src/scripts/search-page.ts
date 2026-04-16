export {};

import { decodeHtmlEntities } from "../lib/decode-html-entities";
import { subscribePageHeaderOffset } from "../lib/subscribe-page-header-offset";

const searchPageHost =
  document.querySelector<HTMLElement>("[data-search-page]");
if (searchPageHost) {
  subscribePageHeaderOffset(searchPageHost, "--search-page-header-offset");
}

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

const params = new URLSearchParams(window.location.search);
const query = (params.get("q") ?? "").trim();

type SearchItemType = "product" | "page";

type SearchApiItem = {
  title?: string;
  uri?: string;
  image?: {
    url?: string | null;
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

function normalizeSearchHref(uri: string): string {
  const u = uri.trim();
  if (!u) return "#";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

function itemImageSrc(item: SearchApiItem): string | null {
  const t = item.image?.thumbnails;
  const fromThumb = t?.small || t?.medium;
  if (fromThumb) return fromThumb;
  const u = item.image?.url;
  return u && u.trim() ? u.trim() : null;
}

function stripHtmlToText(html: string): string {
  if (!html.trim()) return "";
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function classifyItem(item: SearchApiItem): SearchItemType {
  const t = (item.type ?? "").toString().trim().toLowerCase();
  if (t === "page") return "page";
  return "product";
}

function resetLists() {
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

function setError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function setSummary(text: string) {
  if (summaryEl) summaryEl.textContent = text;
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

function setActiveTab(which: "products" | "pages") {
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
}

function renderCard(item: SearchApiItem): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "search-results-page__card";

  const href = item.uri ? normalizeSearchHref(item.uri) : "#";
  const link = document.createElement("a");
  link.className = "search-results-page__card-link";
  link.href = href;

  const imgSrc = itemImageSrc(item);
  if (imgSrc) {
    const figure = document.createElement("div");
    figure.className = "search-results-page__card-media";
    const img = document.createElement("img");
    img.className = "search-results-page__card-img";
    img.src = imgSrc;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    figure.appendChild(img);
    link.appendChild(figure);
  }

  const body = document.createElement("div");
  body.className = "search-results-page__card-body";

  const h = document.createElement("h2");
  h.className = "search-results-page__card-title";
  h.textContent = decodeHtmlEntities((item.title ?? "").trim()) || "Untitled";
  body.appendChild(h);

  const sub = (item.subcategory ?? "").toString().trim();
  if (sub) {
    const meta = document.createElement("p");
    meta.className = "search-results-page__card-meta";
    meta.textContent = sub;
    body.appendChild(meta);
  }

  const descRaw = (item.description ?? "").toString().trim();
  if (descRaw) {
    const plain = stripHtmlToText(descRaw);
    if (plain) {
      const p = document.createElement("p");
      p.className = "search-results-page__card-desc";
      p.textContent = truncate(plain, 220);
      body.appendChild(p);
    }
  }

  link.appendChild(body);
  li.appendChild(link);
  return li;
}

function bindTabs() {
  tabProductsBtn?.addEventListener("click", () => setActiveTab("products"));
  tabPagesBtn?.addEventListener("click", () => setActiveTab("pages"));
}

async function runSearch() {
  resetLists();

  if (!query) {
    setSearchHeading("Search", null);
    setSummary("Enter a query to search.");
    if (tabProductsBtn) tabProductsBtn.textContent = "Products";
    if (tabPagesBtn) tabPagesBtn.textContent = "Pages";
    tabsWrapEl?.setAttribute("hidden", "");
    return;
  }

  tabsWrapEl?.removeAttribute("hidden");

  setSearchHeading("Search results", `For "${decodeHtmlEntities(query)}"`);
  setSummary("Loading…");

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&limit=50&offset=0`,
    );
    const payload = (await res.json()) as SearchApiPayload;
    if (!res.ok) {
      throw new Error(payload.error || "Search request failed.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    const total = Number(payload.total ?? items.length);

    const products = items.filter((i) => classifyItem(i) === "product");
    const pages = items.filter((i) => classifyItem(i) === "page");

    if (tabProductsBtn) {
      tabProductsBtn.innerHTML = `Products <span class="search-results-page__tab-badge" aria-hidden="true">${products.length}</span>`;
    }
    if (tabPagesBtn) {
      tabPagesBtn.innerHTML = `Pages <span class="search-results-page__tab-badge" aria-hidden="true">${pages.length}</span>`;
    }

    const parts: string[] = [];
    parts.push(`${total} result${total === 1 ? "" : "s"}`);
    if (products.length || pages.length) {
      parts.push(`(${products.length} products, ${pages.length} pages)`);
    }
    setSummary(parts.join(" "));

    if (items.length === 0) {
      if (emptyGlobalEl) emptyGlobalEl.hidden = false;
      return;
    }

    if (listProductsEl) {
      for (const item of products) {
        if (!item?.uri || !item.title) continue;
        listProductsEl.appendChild(renderCard(item));
      }
    }
    if (listPagesEl) {
      for (const item of pages) {
        if (!item?.uri || !item.title) continue;
        listPagesEl.appendChild(renderCard(item));
      }
    }

    if (emptyProductsEl) {
      emptyProductsEl.hidden = products.length > 0;
    }
    if (emptyPagesEl) {
      emptyPagesEl.hidden = pages.length > 0;
    }

    if (products.length === 0 && pages.length > 0) {
      setActiveTab("pages");
    } else {
      setActiveTab("products");
    }
  } catch (e) {
    setSummary("");
    setError(e instanceof Error ? e.message : String(e));
    tabsWrapEl?.setAttribute("hidden", "");
  }
}

bindTabs();
void runSearch();
