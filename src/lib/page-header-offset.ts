import { subscribePageHeaderOffset } from "./subscribe-page-header-offset";

export const PAGE_HEADER_OFFSET_CSS_VAR = "--page-header-offset";

const ROOT_SELECTOR = "[data-page-header-offset]";

export function subscribePageHeaderInset(
  host: HTMLElement,
  afterSync?: () => void,
): void {
  subscribePageHeaderOffset(host, PAGE_HEADER_OFFSET_CSS_VAR, afterSync);
}

export function initPageHeaderOffsetRoots(root: ParentNode = document): void {
  for (const host of root.querySelectorAll<HTMLElement>(ROOT_SELECTOR)) {
    subscribePageHeaderInset(host);
  }
}
