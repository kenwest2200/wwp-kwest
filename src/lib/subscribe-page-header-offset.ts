import { readHeaderPageInsetPx } from "./header-page-inset";

const OFFSET_HOST_SELECTOR = "[data-page-header-offset]";

const afterSyncListeners: Array<() => void> = [];

let headerInsetObserversBound = false;

function syncAll(cssVarName: string): void {
  const px = readHeaderPageInsetPx();
  document.documentElement.style.setProperty(cssVarName, `${px}px`);
  for (const el of document.querySelectorAll<HTMLElement>(
    OFFSET_HOST_SELECTOR,
  )) {
    el.style.removeProperty(cssVarName);
  }
  for (const fn of afterSyncListeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribePageHeaderOffset(
  _host: HTMLElement,
  cssVarName: string,
  afterSync?: () => void,
): void {
  if (afterSync) afterSyncListeners.push(afterSync);

  if (!headerInsetObserversBound) {
    headerInsetObserversBound = true;
    const run = () => syncAll(cssVarName);
    window.addEventListener("resize", run);

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    mqReduce.addEventListener("change", run);

    const topEl = document.querySelector("[data-header-top]");
    const containerEl = document.querySelector(".js-header-container");
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => run());
      if (topEl instanceof HTMLElement) ro.observe(topEl);
      if (containerEl instanceof HTMLElement) ro.observe(containerEl);
    }
  }

  syncAll(cssVarName);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncAll(cssVarName));
  });
}
