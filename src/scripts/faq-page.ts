export {};

import { readHeaderPageInsetPx } from "../lib/header-page-inset";
import { subscribePageHeaderOffset } from "../lib/subscribe-page-header-offset";

const SCROLL_GAP_PX = 16;

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

const faqPageHost = document.querySelector<HTMLElement>("[data-faq-page]");
const faqRoot = document.querySelector<HTMLElement>("[data-faq-root]");

if (!faqPageHost) {
} else {
  const faqPage = faqPageHost;

  subscribePageHeaderOffset(faqPage, "--faq-page-header-offset", () => {
    if (faqRoot) applyFaqAnchorScrollChrome(faqPage);
  });

  if (faqRoot) {
    const faqRootInner = faqRoot;

    const searchInput =
      faqRootInner.querySelector<HTMLInputElement>("[data-faq-search]");
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

    function syncFaqDetailsBodyMaxHeight(): void {
      if (prefersReducedMotion()) return;
      for (const el of items) {
        if (!(el instanceof HTMLDetailsElement)) continue;
        const body = el.querySelector<HTMLElement>(".faq-page__details-body");
        if (!body) continue;
        if (el.hidden) {
          body.style.maxHeight = "";
          continue;
        }
        if (!el.open) body.style.maxHeight = "0px";
        else body.style.maxHeight = `${Math.max(0, body.scrollHeight)}px`;
      }
    }

    function syncOpenFaqDetailsHeightsOnResize(): void {
      if (prefersReducedMotion()) return;
      for (const details of items) {
        if (
          !(details instanceof HTMLDetailsElement) ||
          !details.open ||
          details.hidden
        )
          continue;
        const body = details.querySelector<HTMLElement>(
          ".faq-page__details-body",
        );
        if (!body) continue;
        body.style.maxHeight = `${Math.max(0, body.scrollHeight)}px`;
      }
    }

    function setupFaqDetailsAccordionHeight(): void {
      if (prefersReducedMotion()) return;

      let resizeTimer = 0;
      window.addEventListener(
        "resize",
        () => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(
            syncOpenFaqDetailsHeightsOnResize,
            100,
          );
        },
        { passive: true },
      );

      for (const details of items) {
        if (!(details instanceof HTMLDetailsElement)) continue;
        const body = details.querySelector<HTMLElement>(
          ".faq-page__details-body",
        );
        if (!body) continue;

        body.style.overflow = "hidden";

        let closeHeightPx = 0;

        details.addEventListener("beforetoggle", (ev) => {
          const t = ev as ToggleEvent;
          if (t.newState === "closed") {
            closeHeightPx = body.scrollHeight;
          }
        });

        details.addEventListener("toggle", () => {
          if (details.hidden) return;
          if (details.open) {
            closeHeightPx = 0;
            body.style.maxHeight = "0px";
            void body.offsetHeight;
            body.style.maxHeight = `${Math.max(0, body.scrollHeight)}px`;
          } else {
            let h = closeHeightPx;
            closeHeightPx = 0;
            if (!h) {
              const mh = getComputedStyle(body).maxHeight;
              if (mh.endsWith("px")) {
                const parsed = Number.parseFloat(mh);
                if (Number.isFinite(parsed)) h = Math.round(parsed);
              }
            }
            if (!h) h = Math.max(body.scrollHeight, body.offsetHeight);
            body.style.maxHeight = `${h}px`;
            void body.offsetHeight;
            body.style.maxHeight = "0px";
          }
        });
      }
    }

    const filter = () => {
      const q = (searchInput?.value ?? "").trim().toLowerCase();
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
      syncFaqDetailsBodyMaxHeight();
    };

    setupFaqDetailsAccordionHeight();

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

    searchInput?.addEventListener("input", filter);

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

    if (window.location.hash) {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToHashFromLocation);
      });
    }
  }
}
