export function initNewsPage(): void {
  const root = document.querySelector("[data-news-page]");
  if (!(root instanceof HTMLElement)) return;

  let titleTooltipEl: HTMLDivElement | null = null;
  let titleTooltipActiveCard: HTMLElement | null = null;

  const ensureTitleTooltipEl = (): HTMLDivElement => {
    if (titleTooltipEl) return titleTooltipEl;
    const el = document.createElement("div");
    el.className = "news-page__title-tooltip";
    el.setAttribute("role", "tooltip");
    el.hidden = true;
    document.body.appendChild(el);
    titleTooltipEl = el;
    return el;
  };

  const hideTitleTooltip = () => {
    titleTooltipActiveCard = null;
    if (!titleTooltipEl) return;
    titleTooltipEl.hidden = true;
    titleTooltipEl.textContent = "";
  };

  const positionTitleTooltip = (clientX: number, clientY: number) => {
    const el = ensureTitleTooltipEl();
    if (el.hidden) return;
    const pad = 14;
    el.style.left = "0px";
    el.style.top = "0px";
    void el.offsetHeight;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width > vw - 8) x = Math.max(8, clientX - rect.width - pad);
    if (y + rect.height > vh - 8)
      y = Math.max(8, clientY - rect.height - pad);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  const titleIsClamped = (titleEl: HTMLElement) =>
    titleEl.scrollHeight > titleEl.clientHeight + 1;

  root.addEventListener(
    "mouseover",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-news-card]",
      );
      if (!card || !root.contains(card)) return;
      const titleEl = card.querySelector<HTMLElement>(
        ".news-page__card-caption--truncate",
      );
      if (!titleEl || !titleIsClamped(titleEl)) {
        hideTitleTooltip();
        return;
      }
      const full = (titleEl.textContent || "").trim();
      if (!full) return;
      titleTooltipActiveCard = card;
      const tip = ensureTitleTooltipEl();
      tip.textContent = full;
      tip.hidden = false;
      positionTitleTooltip(e.clientX, e.clientY);
    },
    true,
  );

  root.addEventListener(
    "mousemove",
    (e) => {
      if (!titleTooltipActiveCard || titleTooltipEl?.hidden) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-news-card]",
      );
      if (card !== titleTooltipActiveCard) return;
      positionTitleTooltip(e.clientX, e.clientY);
    },
    true,
  );

  root.addEventListener(
    "mouseout",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-news-card]",
      );
      if (!card || !root.contains(card)) return;
      const related = e.relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      hideTitleTooltip();
    },
    true,
  );

  window.addEventListener("scroll", hideTitleTooltip, { passive: true });
  let resizeHideTooltipTimer: number | null = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeHideTooltipTimer != null)
        window.clearTimeout(resizeHideTooltipTimer);
      resizeHideTooltipTimer = window.setTimeout(() => {
        resizeHideTooltipTimer = null;
        hideTitleTooltip();
      }, 120);
    },
    { passive: true },
  );
}
