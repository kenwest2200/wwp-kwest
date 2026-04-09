function initProductAccordion(container: HTMLElement) {
  container.addEventListener("click", (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".product-page__accordion-trigger",
    );
    if (!trigger || !container.contains(trigger)) return;
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    trigger.setAttribute("aria-expanded", String(next));
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    panel.classList.toggle("product-page__accordion-panel--collapsed", !next);
    const inner = panel.querySelector<HTMLElement>(
      ".product-page__accordion-panel-inner",
    );
    if (inner) {
      if (next) inner.removeAttribute("inert");
      else inner.setAttribute("inert", "");
    }
  });
}

document
  .querySelectorAll<HTMLElement>("[data-product-accordion]")
  .forEach((root) => {
    initProductAccordion(root);
  });
