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

export function readHeaderPageInsetPx(): number {
  return readHeaderHeightPx() + readHeaderContainerPaddingBottomPx();
}
