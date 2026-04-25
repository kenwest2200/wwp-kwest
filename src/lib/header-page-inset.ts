export function readHeaderHeightPx(): number {
  const el = document.querySelector(".header");
  if (el instanceof HTMLElement) {
    return Math.round(el.getBoundingClientRect().height);
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--header-offset")
    .trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n) : 112;
}

export function readHeaderContainerPaddingBottomPx(): number {
  const el = document.querySelector(".header__container");
  if (!(el instanceof HTMLElement)) return 0;
  const pb = getComputedStyle(el).paddingBottom;
  const n = Number.parseFloat(pb);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function readHeaderDataTopHeightPx(): number {
  const topEl = document.querySelector("[data-header-top]");
  if (topEl instanceof HTMLElement) {
    return Math.max(0, Math.round(topEl.getBoundingClientRect().height));
  }
  return 0;
}

export function readHeaderTopPlusContainerHeightPx(): number {
  const topEl = document.querySelector("[data-header-top]");
  const containerEl = document.querySelector(".js-header-container");
  let sum = 0;
  if (topEl instanceof HTMLElement) {
    sum += Math.round(topEl.getBoundingClientRect().height);
  }
  if (containerEl instanceof HTMLElement) {
    sum += Math.round(containerEl.getBoundingClientRect().height);
  }
  return Math.max(0, sum);
}

export function readHeaderPageInsetPx(): number {
  return readHeaderTopPlusContainerHeightPx();
}
