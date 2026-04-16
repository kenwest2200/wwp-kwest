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

  const headerEl = document.querySelector(".header");
  const headerContainerEl = document.querySelector(".header__container");
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => sync());
    if (headerEl instanceof HTMLElement) ro.observe(headerEl);
    if (headerContainerEl instanceof HTMLElement) ro.observe(headerContainerEl);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(sync);
  });
}
