export {};

import { readHeaderPageInsetPx } from "../lib/header-page-inset";
import { subscribePageHeaderInset } from "../lib/page-header-offset";

const SCROLL_GAP_PX = 16;
const SEARCH_HIGHLIGHT_CLASS = "faq-page__search-highlight";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function findInnerScrollParent(from: HTMLElement): HTMLElement | null {
  for (let n: HTMLElement | null = from; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if (
      n.scrollHeight > n.clientHeight + 1 &&
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay")
    ) {
      return n;
    }
  }
  return null;
}

function resolveFaqScrollRoot(
  target: HTMLElement,
  faqPage: HTMLElement,
): HTMLElement | Window {
  const inner = findInnerScrollParent(target);
  if (inner) return inner;

  if (faqPage.scrollHeight > faqPage.clientHeight + 1) return faqPage;

  return window;
}

function scrollChromeTargets(faqPage: HTMLElement): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const add = (el: Element | null | undefined) => {
    if (el instanceof HTMLElement) seen.add(el);
  };
  add(document.documentElement);
  add(document.body);
  add(document.scrollingElement);
  add(faqPage);
  const probe = faqPage.querySelector("[data-faq-section]");
  if (probe instanceof HTMLElement) {
    add(findInnerScrollParent(probe));
  }
  return [...seen];
}

function applyFaqAnchorScrollChrome(faqPage: HTMLElement): void {
  const pad = `${readHeaderPageInsetPx() + SCROLL_GAP_PX}px`;
  const reduce = prefersReducedMotion();
  const behavior = reduce ? "auto" : "smooth";
  for (const el of scrollChromeTargets(faqPage)) {
    el.style.scrollPaddingTop = pad;
    el.style.scrollBehavior = behavior;
  }
}

function scrollToRevealBelowHeader(
  scrollRoot: HTMLElement | Window,
  target: HTMLElement,
  offsetPx: number,
  behavior: ScrollBehavior,
): void {
  const currentTop = target.getBoundingClientRect().top;
  const delta = currentTop - offsetPx;

  if (scrollRoot instanceof Window) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + delta),
      left: window.scrollX,
      behavior,
    });
    return;
  }

  scrollRoot.scrollTo({
    top: Math.max(0, scrollRoot.scrollTop + delta),
    left: scrollRoot.scrollLeft,
    behavior,
  });
}

function scrollToFaqSection(target: HTMLElement, faqPage: HTMLElement): void {
  const reduce = prefersReducedMotion();
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const offset = readHeaderPageInsetPx() + SCROLL_GAP_PX;
  const scrollRoot = resolveFaqScrollRoot(target, faqPage);
  scrollToRevealBelowHeader(scrollRoot, target, offset, behavior);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchRegex(query: string): RegExp | null {
  const words = query
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => escapeRegExp(w));
  if (words.length === 0) return null;
  return new RegExp(`(${words.join("|")})`, "gi");
}

function highlightTextNodes(root: HTMLElement, regex: RegExp): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text) {
      const parent = node.parentElement;
      if (parent && !parent.closest(`.${SEARCH_HIGHLIGHT_CLASS}`)) {
        textNodes.push(node);
      }
    }
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    if (!text.trim() || !regex.test(text)) {
      regex.lastIndex = 0;
      continue;
    }
    regex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }
      const mark = document.createElement("mark");
      mark.className = SEARCH_HIGHLIGHT_CLASS;
      mark.textContent = text.slice(start, end);
      frag.appendChild(mark);
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.replaceWith(frag);
    regex.lastIndex = 0;
  }
}

const faqPageHost = document.querySelector<HTMLElement>("[data-faq-page]");
const faqRoot = document.querySelector<HTMLElement>("[data-faq-root]");

if (!faqPageHost) {
} else {
  const faqPage = faqPageHost;

  subscribePageHeaderInset(faqPage, () => {
    if (faqRoot) applyFaqAnchorScrollChrome(faqPage);
  });

  if (faqRoot) {
    const faqRootInner = faqRoot;

    const searchInput =
      faqRootInner.querySelector<HTMLInputElement>("[data-faq-search]");
    const searchClearBtn = faqRootInner.querySelector<HTMLButtonElement>(
      "[data-faq-search-clear]",
    );
    const items = [
      ...faqRootInner.querySelectorAll<HTMLElement>("[data-faq-item]"),
    ];
    const sections = [
      ...faqRootInner.querySelectorAll<HTMLElement>("[data-faq-section]"),
    ];
    const navLinks = [
      ...faqRootInner.querySelectorAll<HTMLAnchorElement>(
        "[data-faq-nav-link]",
      ),
    ];
    const highlightTargets = [
      ...faqRootInner.querySelectorAll<HTMLElement>(
        ".faq-page__question, .faq-page__answer",
      ),
    ];
    const originalHtmlMap = new WeakMap<HTMLElement, string>();
    for (const el of highlightTargets) {
      originalHtmlMap.set(el, el.innerHTML);
    }

    function syncFaqAccordionFilter(): void {
      for (const el of items) {
        if (!el.hidden) continue;
        el.classList.remove("is-open");
        el.querySelector<HTMLButtonElement>(".faq-page__summary")?.setAttribute(
          "aria-expanded",
          "false",
        );
      }
    }

    function setupFaqAccordion(): void {
      for (const item of items) {
        const btn = item.querySelector<HTMLButtonElement>(".faq-page__summary");
        if (!btn) continue;

        btn.addEventListener("click", () => {
          if (item.hidden) return;
          const willOpen = !item.classList.contains("is-open");

          if (willOpen) {
            for (const other of items) {
              if (other === item || other.hidden) continue;
              other.classList.remove("is-open");
              other
                .querySelector<HTMLButtonElement>(".faq-page__summary")
                ?.setAttribute("aria-expanded", "false");
            }
          }

          item.classList.toggle("is-open", willOpen);
          btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
      }
    }

    const applySearchHighlights = (query: string) => {
      for (const el of highlightTargets) {
        const original = originalHtmlMap.get(el);
        if (typeof original === "string") el.innerHTML = original;
      }
      const regex = buildSearchRegex(query);
      if (!regex) return;
      for (const el of highlightTargets) {
        highlightTextNodes(el, regex);
      }
    };

    const filter = () => {
      const qRaw = (searchInput?.value ?? "").trim();
      const q = qRaw.toLowerCase();
      for (const el of items) {
        const hay = (el.textContent ?? "").toLowerCase();
        el.hidden = Boolean(q) && !hay.includes(q);
      }
      for (const sec of sections) {
        const any = [
          ...sec.querySelectorAll<HTMLElement>("[data-faq-item]"),
        ].some((d) => !d.hidden);
        sec.hidden = !any;
      }
      syncNavActive();
      syncFaqAccordionFilter();
      applySearchHighlights(qRaw);
    };

    const syncSearchClearButton = () => {
      if (!searchInput || !searchClearBtn) return;
      searchClearBtn.hidden = searchInput.value.length === 0;
    };

    setupFaqAccordion();

    function syncNavActive() {
      const hash = window.location.hash.slice(1);
      if (hash) {
        for (const a of navLinks) {
          const id = (a.getAttribute("href") ?? "").slice(1);
          a.classList.toggle("is-active", Boolean(id && id === hash));
        }
        return;
      }
      let set = false;
      for (const a of navLinks) {
        const id = (a.getAttribute("href") ?? "").slice(1);
        const sec = id ? document.getElementById(id) : null;
        const visible = sec instanceof HTMLElement && !sec.hidden;
        if (visible && !set) {
          a.classList.add("is-active");
          set = true;
        } else {
          a.classList.remove("is-active");
        }
      }
      if (!set && navLinks[0]) {
        navLinks[0].classList.add("is-active");
      }
    }

    function scrollToHashFromLocation(): void {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (
        !(target instanceof HTMLElement) ||
        !faqRootInner.contains(target) ||
        target.hidden
      )
        return;
      scrollToFaqSection(target, faqPage);
    }

    searchInput?.addEventListener("input", () => {
      syncSearchClearButton();
      filter();
    });
    searchClearBtn?.addEventListener("click", () => {
      if (!searchInput) return;
      searchInput.value = "";
      syncSearchClearButton();
      filter();
      searchInput.focus();
    });

    window.addEventListener("hashchange", () => {
      scrollToHashFromLocation();
      syncNavActive();
    });

    window.addEventListener("popstate", () => {
      scrollToHashFromLocation();
      syncNavActive();
    });

    navLinks.forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") ?? "";
        if (!href.startsWith("#")) return;
        const id = href.slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (
          !(target instanceof HTMLElement) ||
          !faqRootInner.contains(target) ||
          target.hidden
        )
          return;

        e.preventDefault();
        if (window.location.hash === href) {
          history.replaceState(null, "", href);
        } else {
          history.pushState(null, "", href);
        }
        scrollToFaqSection(target, faqPage);
        window.setTimeout(syncNavActive, 0);
      });
    });

    filter();
    syncSearchClearButton();

    if (window.location.hash) {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToHashFromLocation);
      });
    }
  }
}
