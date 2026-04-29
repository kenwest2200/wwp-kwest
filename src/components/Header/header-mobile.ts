import { decodeHtmlEntities } from "../../lib/decode-html-entities";
import {
  readHeaderDataTopHeightPx,
  readHeaderTopPlusContainerHeightPx,
} from "../../lib/header-page-inset";

const SEARCH_MQ = "(min-width: 768px)";
const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_DEBOUNCE_MS = 150;

let mobileMenuForcesHeaderTopZero = false;

function sumHeaderTopHeightsPx(): number {
  return readHeaderTopPlusContainerHeightPx();
}

function applyHeaderTopHeight(): void {
  const header = document.querySelector(".header");
  if (!(header instanceof HTMLElement)) {
    return;
  }
  if (mobileMenuForcesHeaderTopZero) {
    header.style.setProperty("--header-top-height", "0px");
    header.style.setProperty("--header-data-top-height", "0px");
    return;
  }
  header.style.setProperty(
    "--header-top-height",
    `${sumHeaderTopHeightsPx()}px`,
  );
  header.style.setProperty(
    "--header-data-top-height",
    `${readHeaderDataTopHeightPx()}px`,
  );
}

function getDocumentScrollY(): number {
  if (typeof window === "undefined") return 0;
  const d = document.documentElement;
  const b = document.body;
  let y = Math.max(
    window.scrollY ?? 0,
    window.pageYOffset ?? 0,
    d.scrollTop ?? 0,
    b.scrollTop ?? 0,
  );
  const main = document.querySelector("main");
  if (main instanceof HTMLElement) {
    y = Math.max(y, main.scrollTop);
  }
  return y;
}

function bindHeaderStickyScroll(): void {
  const header = document.querySelector(".header");
  const topEl = document.querySelector("[data-header-top]");
  const containerEl = document.querySelector(".js-header-container");
  if (!(header instanceof HTMLElement)) {
    return;
  }
  if (
    !(topEl instanceof HTMLElement) &&
    !(containerEl instanceof HTMLElement)
  ) {
    return;
  }

  const onScroll = () => {
    const y = getDocumentScrollY();
    if (mobileMenuForcesHeaderTopZero) {
      header.classList.toggle("is-scrolling", y > 0);
      return;
    }
    const dataTopH = readHeaderDataTopHeightPx();
    header.classList.toggle("is-scrolling", y >= dataTopH);
  };

  const passive: AddEventListenerOptions = { passive: true };

  applyHeaderTopHeight();
  onScroll();

  window.addEventListener("scroll", onScroll, passive);
  document.addEventListener("scroll", onScroll, { ...passive, capture: true });

  const scrollRoot = document.scrollingElement;
  if (scrollRoot instanceof HTMLElement) {
    scrollRoot.addEventListener("scroll", onScroll, passive);
  }

  const mainEl = document.querySelector("main");
  if (mainEl instanceof HTMLElement) {
    mainEl.addEventListener("scroll", onScroll, passive);
  }

  const onResize = () => {
    applyHeaderTopHeight();
    onScroll();
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("load", applyHeaderTopHeight);

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      applyHeaderTopHeight();
      onScroll();
    });
    if (topEl instanceof HTMLElement) ro.observe(topEl);
    if (containerEl instanceof HTMLElement) ro.observe(containerEl);
  }

  requestAnimationFrame(() => {
    applyHeaderTopHeight();
    onScroll();
    requestAnimationFrame(() => {
      applyHeaderTopHeight();
      onScroll();
    });
  });
}

export function initHeaderStickyScroll(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindHeaderStickyScroll, {
      once: true,
    });
  } else {
    bindHeaderStickyScroll();
  }
}

function normalizeSearchHref(uri: string): string {
  const u = uri.trim();
  if (!u) return "#";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

function searchResultsPageHref(query: string): string {
  const q = query.trim();
  if (!q) return "/search";
  return `/search?q=${encodeURIComponent(q)}`;
}

function bindHeaderSearchAutocomplete(
  panel: HTMLElement,
  input: HTMLInputElement,
): void {
  const box = panel.querySelector("#header-search-suggest");
  if (!(box instanceof HTMLElement)) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestSeq = 0;
  let abort: AbortController | null = null;

  const hideSuggest = () => {
    box.hidden = true;
    box.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const showSuggest = (
    items: { title: string; uri: string }[],
    query: string,
  ) => {
    box.innerHTML = "";
    const q = query.trim();
    if (q.length < AUTOCOMPLETE_MIN_CHARS) {
      hideSuggest();
      return;
    }
    if (items.length === 0) {
      hideSuggest();
      return;
    }
    items.forEach((item, i) => {
      const a = document.createElement("a");
      a.className = "header__search-suggest-item";
      a.role = "option";
      a.id = `header-search-suggest-${i}`;
      a.href = normalizeSearchHref(item.uri);
      a.textContent = item.title;
      box.appendChild(a);
    });
    const all = document.createElement("a");
    all.className =
      "header__search-suggest-item header__search-suggest-item--all-results";
    all.role = "option";
    all.id = "header-search-suggest-all";
    all.href = searchResultsPageHref(q);
    all.textContent = "Show all results";
    box.appendChild(all);
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const scheduleFetch = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    abort?.abort();

    const q = input.value.trim();
    if (q.length < AUTOCOMPLETE_MIN_CHARS) {
      hideSuggest();
      return;
    }

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const seq = ++requestSeq;
      abort = new AbortController();
      try {
        const res = await fetch(
          `/api/search-autocomplete?q=${encodeURIComponent(q)}&limit=5`,
          { signal: abort.signal },
        );
        let data: {
          items?: { title?: string; uri?: string }[];
          error?: string;
        };
        try {
          data = (await res.json()) as typeof data;
        } catch {
          if (seq !== requestSeq) return;
          hideSuggest();
          return;
        }
        if (seq !== requestSeq) return;
        const qNow = input.value.trim();
        if (!res.ok) {
          hideSuggest();
          return;
        }
        const raw = Array.isArray(data.items) ? data.items : [];
        const items = raw
          .filter((x) => x?.title && x?.uri)
          .map((x) => ({
            title: decodeHtmlEntities(String(x.title).trim()),
            uri: String(x.uri).trim(),
          }));
        showSuggest(items, qNow);
      } catch {
        if (seq !== requestSeq) return;
        hideSuggest();
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  };

  input.addEventListener("input", scheduleFetch);

  input.addEventListener("focus", () => {
    if (
      input.value.trim().length >= AUTOCOMPLETE_MIN_CHARS &&
      box.childNodes.length > 0
    ) {
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      const ae = document.activeElement;
      if (box.contains(ae) || ae === input) return;
      hideSuggest();
    }, 150);
  });

  box.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("a")) {
      e.preventDefault();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!box.hidden) {
      hideSuggest();
    }
  });
}

export function initHeaderSearch(): void {
  const root = document.querySelector("[data-header-search]");
  const toggle = document.querySelector("[data-search-toggle]");
  const panel = document.getElementById("header-search-panel");
  const input = panel?.querySelector<HTMLInputElement>(
    "[data-header-search-input]",
  );

  if (panel instanceof HTMLElement && input) {
    bindHeaderSearchAutocomplete(panel, input);
  }

  if (!(root instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
    return;
  }

  const mq = window.matchMedia(SEARCH_MQ);

  const setOpen = (open: boolean) => {
    root.classList.toggle("header__search--open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && input) {
      requestAnimationFrame(() => input.focus());
    }
  };

  const close = () => setOpen(false);

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mq.matches) return;
    setOpen(!root.classList.contains("header__search--open"));
  });

  document.addEventListener("click", (e) => {
    if (mq.matches || !root.classList.contains("header__search--open")) return;
    if (e.target instanceof Node && root.contains(e.target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (mq.matches || !root.classList.contains("header__search--open")) return;
    close();
    toggle.focus();
  });

  mq.addEventListener("change", () => {
    if (mq.matches) {
      root.classList.remove("header__search--open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

export function initHeaderMobile(): void {
  const mobile = document.getElementById("header-mobile");
  const burger = document.querySelector("[data-open-mobile]");
  const header = document.querySelector(".header");
  if (!mobile || !burger) return;

  const syncHeaderOffset = () => {
    if (!(header instanceof HTMLElement)) return;
    const h = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-offset", `${h}px`);
  };

  const closeButtons = mobile.querySelectorAll("[data-close-mobile]");
  const rootEl = mobile.querySelector("[data-mobile-root]");
  const subEl = mobile.querySelector("[data-mobile-sub]");
  const subTitle = mobile.querySelector("[data-mobile-sub-title]");
  const panels = mobile.querySelectorAll("[data-mobile-sub-panel]");
  const openSubButtons = mobile.querySelectorAll("[data-open-sub]");
  const backBtn = mobile.querySelector("[data-mobile-back]");

  const showRoot = () => {
    if (rootEl instanceof HTMLElement) rootEl.hidden = false;
    if (subEl instanceof HTMLElement) subEl.hidden = true;
    panels.forEach((p) => {
      if (p instanceof HTMLElement) p.hidden = true;
    });
  };

  const openSub = (key: string, label: string) => {
    if (rootEl instanceof HTMLElement) rootEl.hidden = true;
    if (subEl instanceof HTMLElement) subEl.hidden = false;
    if (subTitle) subTitle.textContent = label.toUpperCase();

    panels.forEach((p) => {
      if (!(p instanceof HTMLElement)) return;
      p.hidden = p.getAttribute("data-mobile-sub-panel") !== key;
    });
  };

  const openMobile = () => {
    mobileMenuForcesHeaderTopZero = true;
    applyHeaderTopHeight();
    syncHeaderOffset();
    mobile.classList.add("is-open");
    mobile.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");
    document.body.classList.add("header--mobile-open");
    if (header instanceof HTMLElement) header.classList.add("header--nav-open");
    showRoot();
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("scroll"));
    });
  };

  const closeMobile = () => {
    mobile.classList.remove("is-open");
    mobile.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("header--mobile-open");
    if (header instanceof HTMLElement)
      header.classList.remove("header--nav-open");
    mobileMenuForcesHeaderTopZero = false;
    applyHeaderTopHeight();
    syncHeaderOffset();
    showRoot();
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("scroll"));
    });
  };

  window.addEventListener("resize", () => {
    if (mobile.classList.contains("is-open")) syncHeaderOffset();
  });

  syncHeaderOffset();

  burger.addEventListener("click", () => {
    if (mobile.classList.contains("is-open")) {
      closeMobile();
    } else {
      openMobile();
    }
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => closeMobile());
  });

  openSubButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-open-sub");
      const label = btn.getAttribute("data-sub-label") ?? "";
      if (key) openSub(key, label);
    });
  });

  backBtn?.addEventListener("click", () => showRoot());

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const searchRoot = document.querySelector("[data-header-search]");
    if (
      searchRoot instanceof HTMLElement &&
      searchRoot.classList.contains("header__search--open") &&
      !window.matchMedia(SEARCH_MQ).matches
    ) {
      return;
    }
    if (!mobile.classList.contains("is-open")) return;
    if (subEl instanceof HTMLElement && !subEl.hidden) {
      showRoot();
      return;
    }
    closeMobile();
  });
}
