function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const VISIBLE_CLASS = "scroll-to-top--visible";

function parseThresholdPx(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readVerticalScrollOffset(): number {
  const se = document.scrollingElement ?? document.documentElement;
  return Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
    se.scrollTop,
  );
}

/** Scroll containers from innermost (near the control) outward, then the window. */
function collectScrollableAncestors(from: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let n: HTMLElement | null = from.parentElement; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    const scrollableY =
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay";
    if (scrollableY && n.scrollHeight > n.clientHeight + 1) {
      out.push(n);
    }
  }
  return out;
}

function scrollPageToTop(origin: HTMLElement): void {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const opts: ScrollToOptions = { top: 0, left: 0, behavior };

  for (const el of collectScrollableAncestors(origin)) {
    el.scrollTo(opts);
  }

  const se = document.scrollingElement ?? document.documentElement;
  se.scrollTo(opts);
  window.scrollTo(opts);
}

function setupScrollToTopButton(btn: HTMLButtonElement): void {
  const thresholdPx = parseThresholdPx(btn.dataset.scrollToTopThreshold, 320);

  function updateVisibility(): void {
    const show = readVerticalScrollOffset() >= thresholdPx;
    btn.classList.toggle(VISIBLE_CLASS, show);
    if (show) {
      btn.removeAttribute("aria-hidden");
      btn.removeAttribute("tabindex");
    } else {
      btn.setAttribute("aria-hidden", "true");
      btn.setAttribute("tabindex", "-1");
    }
  }

  btn.addEventListener("click", () => {
    scrollPageToTop(btn);
  });

  document.addEventListener("scroll", updateVisibility, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", updateVisibility, { passive: true });
  updateVisibility();
}

/** Idempotent if the script runs more than once. */
export function initScrollToTopButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "button[data-scroll-to-top]:not([data-scroll-to-top-initialized])",
  );
  for (const btn of buttons) {
    btn.setAttribute("data-scroll-to-top-initialized", "");
    setupScrollToTopButton(btn);
  }
}
