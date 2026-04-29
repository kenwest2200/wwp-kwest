/** Shown as toast title (English). */
export const PAGE_ERROR_TOAST_TITLE = "Error";

/** Fallback when no specific message is passed (English). */
export const PAGE_ERROR_TOAST_UNKNOWN = "An error occurred.";

export function installPageErrorToast(host: HTMLElement | null): void {
  if (!host || host.dataset.pageErrorToastBound === "1") return;
  host.dataset.pageErrorToastBound = "1";
  const closeBtn = host.querySelector<HTMLButtonElement>(
    ".page-error-toast__close",
  );
  closeBtn?.addEventListener("click", () => {
    hidePageErrorToast(host);
  });
}

export function showPageErrorToast(
  host: HTMLElement | null,
  body: string,
): void {
  if (!host) return;
  const titleEl = host.querySelector<HTMLElement>(".page-error-toast__title");
  const textEl = host.querySelector<HTMLElement>(".page-error-toast__text");
  if (titleEl) titleEl.textContent = PAGE_ERROR_TOAST_TITLE;
  const trimmed = body.trim();
  if (textEl) textEl.textContent = trimmed || PAGE_ERROR_TOAST_UNKNOWN;
  host.hidden = false;
  host.removeAttribute("hidden");
}

export function hidePageErrorToast(host: HTMLElement | null): void {
  if (!host) return;
  host.hidden = true;
  host.setAttribute("hidden", "");
}
