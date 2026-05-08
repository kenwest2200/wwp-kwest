const GRID_SELECTOR = ".featured__grid";
const CARD_SELECTOR = ".featured__item";
const TITLE_SELECTOR = ".featured__item-title";
const CARD_LINK_SELECTOR = ".featured__item-link";

let tooltipEl: HTMLDivElement | null = null;
let activeCard: HTMLElement | null = null;

function ensureTooltipEl(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  const el = document.createElement("div");
  el.className = "featured__item-title-tooltip";
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

function hideTooltip(): void {
  activeCard = null;
  if (tooltipEl) {
    tooltipEl.hidden = true;
    tooltipEl.textContent = "";
  }
}

function positionTooltip(clientX: number, clientY: number): void {
  const el = ensureTooltipEl();
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
  if (y + rect.height > vh - 8) y = Math.max(8, clientY - rect.height - pad);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function titleIsClamped(titleEl: HTMLElement): boolean {
  return titleEl.scrollHeight > titleEl.clientHeight + 1;
}

function isInteractiveTarget(target: Element | null): boolean {
  if (!target) return false;
  return Boolean(
    target.closest(
      'a, button, input, select, textarea, summary, label, [role="button"]',
    ),
  );
}

function setupFeaturedCardNavigation(): void {
  const grid = document.querySelector<HTMLElement>(GRID_SELECTOR);
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (isInteractiveTarget(target)) return;

    const card = target.closest<HTMLElement>(CARD_SELECTOR);
    if (!card || !grid.contains(card)) return;

    const link = card.querySelector<HTMLAnchorElement>(CARD_LINK_SELECTOR);
    const href = link?.getAttribute("href")?.trim() ?? "";
    if (!href || href === "#") return;
    link?.click();
  });
}

function setupFeaturedTitleTooltips(): void {
  const grid = document.querySelector<HTMLElement>(GRID_SELECTOR);
  if (!grid) return;

  grid.addEventListener(
    "mouseover",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        CARD_SELECTOR,
      );
      if (!card || !grid.contains(card)) return;
      const titleEl = card.querySelector<HTMLElement>(TITLE_SELECTOR);
      if (!titleEl || !titleIsClamped(titleEl)) {
        hideTooltip();
        return;
      }
      const full = card.getAttribute("data-full-title");
      if (!full?.trim()) return;
      activeCard = card;
      const tip = ensureTooltipEl();
      tip.textContent = full.trim();
      tip.hidden = false;
      positionTooltip(e.clientX, e.clientY);
    },
    true,
  );

  grid.addEventListener(
    "mousemove",
    (e) => {
      if (!activeCard || tooltipEl?.hidden) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        CARD_SELECTOR,
      );
      if (card !== activeCard) return;
      positionTooltip(e.clientX, e.clientY);
    },
    true,
  );

  grid.addEventListener(
    "mouseout",
    (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        CARD_SELECTOR,
      );
      if (!card || !grid.contains(card)) return;
      const related = e.relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      hideTooltip();
    },
    true,
  );

  window.addEventListener("scroll", hideTooltip, { passive: true });

  let resizeHideTimer: number | null = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeHideTimer != null) window.clearTimeout(resizeHideTimer);
      resizeHideTimer = window.setTimeout(() => {
        resizeHideTimer = null;
        hideTooltip();
      }, 120);
    },
    { passive: true },
  );
}

setupFeaturedCardNavigation();
setupFeaturedTitleTooltips();
