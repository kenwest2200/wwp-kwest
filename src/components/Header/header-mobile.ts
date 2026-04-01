const SEARCH_MQ = "(min-width: 768px)";

export function initHeaderSearch(): void {
  const root = document.querySelector("[data-header-search]");
  const toggle = document.querySelector("[data-search-toggle]");
  const panel = document.getElementById("header-search-panel");
  const input = panel?.querySelector<HTMLInputElement>(".header__search-input");

  if (!(root instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
    return;
  }

  const mq = window.matchMedia(SEARCH_MQ);

  const setOpen = (open: boolean) => {
    root.classList.toggle("header__search--open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && input) {
      requestAnimationFrame(() => input.focus());
    }
  };

  const close = () => setOpen(false);

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mq.matches) return;
    setOpen(!root.classList.contains("header__search--open"));
  });

  document.addEventListener("click", (e) => {
    if (mq.matches || !root.classList.contains("header__search--open")) return;
    if (e.target instanceof Node && root.contains(e.target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (mq.matches || !root.classList.contains("header__search--open")) return;
    close();
    toggle.focus();
  });

  mq.addEventListener("change", () => {
    if (mq.matches) {
      root.classList.remove("header__search--open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

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
    if (header instanceof HTMLElement)
      header.classList.remove("header--nav-open");
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
    if (e.key !== "Escape") return;
    const searchRoot = document.querySelector("[data-header-search]");
    if (
      searchRoot instanceof HTMLElement &&
      searchRoot.classList.contains("header__search--open") &&
      !window.matchMedia(SEARCH_MQ).matches
    ) {
      return;
    }
    if (!mobile.classList.contains("is-open")) return;
    if (subEl instanceof HTMLElement && !subEl.hidden) {
      showRoot();
      return;
    }
    closeMobile();
  });
}
