export function initHeaderMobile(): void {
  const mobile = document.getElementById("header-mobile");
  const burger = document.querySelector("[data-open-mobile]");
  const header = document.querySelector(".header");
  if (!mobile || !burger) return;

  const syncHeaderOffset = () => {
    if (!(header instanceof HTMLElement)) return;
    const h = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-offset", `${h}px`);
  };

  const closeButtons = mobile.querySelectorAll("[data-close-mobile]");
  const rootEl = mobile.querySelector("[data-mobile-root]");
  const subEl = mobile.querySelector("[data-mobile-sub]");
  const subTitle = mobile.querySelector("[data-mobile-sub-title]");
  const panels = mobile.querySelectorAll("[data-mobile-sub-panel]");
  const openSubButtons = mobile.querySelectorAll("[data-open-sub]");
  const backBtn = mobile.querySelector("[data-mobile-back]");

  const showRoot = () => {
    if (rootEl instanceof HTMLElement) rootEl.hidden = false;
    if (subEl instanceof HTMLElement) subEl.hidden = true;
    panels.forEach((p) => {
      if (p instanceof HTMLElement) p.hidden = true;
    });
  };

  const openSub = (key: string, label: string) => {
    if (rootEl instanceof HTMLElement) rootEl.hidden = true;
    if (subEl instanceof HTMLElement) subEl.hidden = false;
    if (subTitle) subTitle.textContent = label.toUpperCase();

    panels.forEach((p) => {
      if (!(p instanceof HTMLElement)) return;
      p.hidden = p.getAttribute("data-mobile-sub-panel") !== key;
    });
  };

  const openMobile = () => {
    syncHeaderOffset();
    mobile.classList.add("is-open");
    mobile.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");
    document.body.classList.add("header--mobile-open");
    if (header instanceof HTMLElement) header.classList.add("header--nav-open");
    showRoot();
  };

  const closeMobile = () => {
    mobile.classList.remove("is-open");
    mobile.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("header--mobile-open");
    if (header instanceof HTMLElement) header.classList.remove("header--nav-open");
    showRoot();
  };

  window.addEventListener("resize", () => {
    if (mobile.classList.contains("is-open")) syncHeaderOffset();
  });

  syncHeaderOffset();

  burger.addEventListener("click", () => {
    if (mobile.classList.contains("is-open")) {
      closeMobile();
    } else {
      openMobile();
    }
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => closeMobile());
  });

  openSubButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-open-sub");
      const label = btn.getAttribute("data-sub-label") ?? "";
      if (key) openSub(key, label);
    });
  });

  backBtn?.addEventListener("click", () => showRoot());

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !mobile.classList.contains("is-open")) return;
    if (subEl instanceof HTMLElement && !subEl.hidden) {
      showRoot();
      return;
    }
    closeMobile();
  });
}
