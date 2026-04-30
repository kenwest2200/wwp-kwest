/** Shown as toast title (English). */
export const PAGE_ERROR_TOAST_TITLE = "Error";

export const PAGE_SUCCESS_TOAST_TITLE = "Success";

/** Fallback when no specific message is passed (English). */
export const PAGE_ERROR_TOAST_UNKNOWN = "An error occurred.";

export type PageToastVariant = "error" | "success";

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

export function showPageToast(
  host: HTMLElement | null,
  body: string,
  variant: PageToastVariant = "error",
): void {
  if (!host) return;
  host.classList.toggle("page-error-toast--success", variant === "success");
  const titleEl = host.querySelector<HTMLElement>(".page-error-toast__title");
  const textEl = host.querySelector<HTMLElement>(".page-error-toast__text");
  if (titleEl) {
    titleEl.textContent =
      variant === "success" ? PAGE_SUCCESS_TOAST_TITLE : PAGE_ERROR_TOAST_TITLE;
  }
  const trimmed = body.trim();
  if (textEl) {
    textEl.textContent =
      variant === "success"
        ? trimmed || "Completed successfully."
        : trimmed || PAGE_ERROR_TOAST_UNKNOWN;
  }
  host.hidden = false;
  host.removeAttribute("hidden");
}

export function showPageErrorToast(
  host: HTMLElement | null,
  body: string,
): void {
  showPageToast(host, body, "error");
}

export function hidePageErrorToast(host: HTMLElement | null): void {
  if (!host) return;
  host.classList.remove("page-error-toast--success");
  host.hidden = true;
  host.setAttribute("hidden", "");
}
