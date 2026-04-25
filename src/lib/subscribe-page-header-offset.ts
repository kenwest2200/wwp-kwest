import { readHeaderPageInsetPx } from "./header-page-inset";

export function subscribePageHeaderOffset(
  host: HTMLElement,
  cssVarName: string,
  afterSync?: () => void,
): void {
  function sync(): void {
    host.style.setProperty(cssVarName, `${readHeaderPageInsetPx()}px`);
    afterSync?.();
  }

  sync();
  window.addEventListener("resize", sync);

  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  mqReduce.addEventListener("change", sync);

  const topEl = document.querySelector("[data-header-top]");
  const containerEl = document.querySelector(".js-header-container");
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => sync());
    if (topEl instanceof HTMLElement) ro.observe(topEl);
    if (containerEl instanceof HTMLElement) ro.observe(containerEl);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(sync);
  });
}
