const SEL = {
  root: "[data-custom-select-root]",
  trigger: "[data-custom-select-trigger]",
  menu: "[data-custom-select-menu]",
  value: "[data-custom-select-value]",
  option: "[data-custom-select-option]",
  native: "[data-custom-select-native]",
} as const;

const OPEN_CLASS = "custom-select--open";

function setCustomSelectOpen(root: HTMLElement, open: boolean): void {
  root.classList.toggle(OPEN_CLASS, open);
  root
    .querySelector<HTMLButtonElement>(SEL.trigger)
    ?.setAttribute("aria-expanded", open ? "true" : "false");
  const menu = root.querySelector<HTMLElement>(SEL.menu);
  if (menu) menu.hidden = !open;
}

export function syncCustomSelectFromNative(root: HTMLElement): void {
  const rawSel = root.querySelector(SEL.native);
  const valueEl = root.querySelector<HTMLElement>(SEL.value);
  if (!(rawSel instanceof HTMLSelectElement) || !valueEl) return;
  const sel = rawSel;
  const ph = root.dataset.customSelectPlaceholder?.trim() || "Select…";
  const opt = sel.selectedOptions[0];
  if (!sel.value) {
    valueEl.textContent = ph;
    valueEl.classList.add("is-placeholder");
  } else {
    valueEl.textContent = (opt?.textContent ?? "").trim() || sel.value;
    valueEl.classList.remove("is-placeholder");
  }
  root.querySelectorAll<HTMLButtonElement>(SEL.option).forEach((btn) => {
    const v = btn.dataset.value ?? "";
    btn.setAttribute("aria-selected", v === sel.value ? "true" : "false");
  });
}

export function syncAllCustomSelectsFromNative(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLElement>(SEL.root).forEach((r) => {
    syncCustomSelectFromNative(r);
  });
}

export function initFormCustomSelects(form: HTMLFormElement): void {
  const roots = form.querySelectorAll<HTMLElement>(SEL.root);
  if (roots.length === 0) return;

  function closeIfOutside(target: EventTarget | null): void {
    if (!(target instanceof Node)) return;
    roots.forEach((root) => {
      if (!root.contains(target)) setCustomSelectOpen(root, false);
    });
  }

  document.addEventListener("click", (e) => closeIfOutside(e.target));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    roots.forEach((root) => setCustomSelectOpen(root, false));
  });

  roots.forEach((root) => {
    syncCustomSelectFromNative(root);

    const trigger = root.querySelector<HTMLButtonElement>(SEL.trigger);
    const menu = root.querySelector<HTMLElement>(SEL.menu);
    const nativeEl = root.querySelector(SEL.native);
    if (!trigger || !menu || !(nativeEl instanceof HTMLSelectElement)) return;
    const native = nativeEl;

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const open = !root.classList.contains(OPEN_CLASS);
      if (open) {
        roots.forEach((r) => {
          if (r !== root) setCustomSelectOpen(r, false);
        });
      }
      setCustomSelectOpen(root, open);
    });

    menu.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        SEL.option,
      );
      if (!btn || !menu.contains(btn)) return;
      e.preventDefault();
      const value = btn.dataset.value ?? "";
      native.value = value;
      native.dispatchEvent(new Event("change", { bubbles: true }));
      syncCustomSelectFromNative(root);
      setCustomSelectOpen(root, false);
    });
  });

  form.addEventListener("reset", () => {
    queueMicrotask(() => syncAllCustomSelectsFromNative(form));
  });
}
