import {
  hidePageErrorToast,
  installPageErrorToast,
  showPageErrorToast,
} from "../lib/page-error-toast";
import {
  initFormCustomSelects,
  syncCustomSelectFromNative,
} from "./custom-select";

type CrossRefFiltersResponse = Record<string, unknown>;
type CrossRefFindResponse = Record<string, unknown> | unknown[];

type CrossRefResult = {
  title: string;
  partId: string;
  hp: string;
  speed: string;
  imageUrl: string;
  href: string;
};

type ReferenceValues = {
  brand: string;
  model: string;
  part_number: string;
  motor_number: string;
  hp: string;
};

type FilterLists = {
  brands: string[];
  models: string[];
  partNumbers: string[];
  motorNumbers: string[];
  hpValues: string[];
};

type AutocompleteControl = {
  input: HTMLInputElement;
  list: HTMLElement;
  getOptions: () => string[];
  onPick?: (value: string) => void;
  isLoading?: () => boolean;
};

const NO_PRODUCT_IMAGE_SRC = "/images/no-product-image.svg";

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function firstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(obj[key]);
    if (value) return value;
  }
  return "";
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
}

function findFirstArray(input: unknown, depth = 0): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object" || depth > 5) return [];
  const obj = input as Record<string, unknown>;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(obj)) {
    const nested = findFirstArray(value, depth + 1);
    if (nested.length > 0) return nested;
  }
  return [];
}

function readStringArray(payload: unknown, keys: string[]): string[] {
  const root = asObject(payload);
  if (!root) return [];

  for (const key of keys) {
    if (key in root) {
      const arr = asArray(root[key]);
      return uniqueStrings(arr.map((x) => text(x)));
    }
  }

  for (const nestedKey of ["data", "filters", "payload", "result"]) {
    const nested = asObject(root[nestedKey]);
    if (!nested) continue;
    for (const key of keys) {
      if (key in nested) {
        const arr = asArray(nested[key]);
        return uniqueStrings(arr.map((x) => text(x)));
      }
    }
  }

  return [];
}

function parseFilterLists(payload: CrossRefFiltersResponse): FilterLists {
  const brands = readStringArray(payload, ["brands", "Brands"]);
  const models = readStringArray(payload, ["models", "Models"]);
  const partNumbers = readStringArray(payload, [
    "part_numbers",
    "PartNumbers",
    "partNumbers",
  ]);
  const motorNumbers = readStringArray(payload, [
    "motor_numbers",
    "MotorNumbers",
    "motorNumbers",
  ]);
  const hpValues = readStringArray(payload, ["hp_values", "HpValues", "hpValues"]);
  return { brands, models, partNumbers, motorNumbers, hpValues };
}

function pickImageUrlFromRow(row: Record<string, unknown>): string {
  const direct = firstString(row, [
    "WaterwayImage",
    "ProductImage",
    "ImageUrl",
    "image_url",
    "thumbnail",
    "image",
  ]);
  if (direct) return direct;

  const candidates = [row.ImageUrls, row.image_urls, row.images, row.ProductImages];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const s = text(item);
      if (s) return s;
      const o = asObject(item);
      if (!o) continue;
      const nested = firstString(o, ["url", "src", "sourceUrl", "ImageUrl"]);
      if (nested) return nested;
    }
  }
  return "";
}

function normalizeFindResults(
  payload: CrossRefFindResponse,
): { items: CrossRefResult[]; count: number | null } {
  const root = asObject(payload);
  const rawCount = root ? Number(root.count) : Number.NaN;
  const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : null;

  const rows = findFirstArray(payload);
  const items: CrossRefResult[] = [];

  for (const raw of rows) {
    const row = asObject(raw);
    if (!row) continue;

    const title = firstString(row, [
      "WaterwayPartDescription",
      "WaterwayModel",
      "ProductName",
      "ProductTitle",
      "title",
      "model",
    ]);
    const partId = firstString(row, [
      "WaterwayPartNumber",
      "WaterwayPartID",
      "PartNumber",
      "PartID",
      "part_number",
      "part_id",
    ]);
    const hp = firstString(row, ["WaterwayHP", "HP", "hp"]);
    const speed = firstString(row, ["WaterwaySpeed", "Speed", "speed"]);
    const imageUrl = pickImageUrlFromRow(row) || NO_PRODUCT_IMAGE_SRC;
    const href = firstString(row, [
      "ProductUrl",
      "ProductURI",
      "waterway_uri",
      "product_uri",
      "url",
      "uri",
      "href",
    ]);

    if (!title && !partId) continue;

    items.push({
      title: title || partId || "Replacement",
      partId: partId || "—",
      hp: hp || "—",
      speed: speed || "—",
      imageUrl,
      href: href.startsWith("http") || href.startsWith("/") ? href : "",
    });
  }

  return { items, count };
}

function renderResults(
  listEl: HTMLElement,
  countEl: HTMLElement,
  emptyEl: HTMLElement,
  results: CrossRefResult[],
  totalCount: number | null,
): void {
  listEl.replaceChildren();
  const visible = results.length;
  const countText = totalCount !== null ? totalCount : visible;
  countEl.textContent = `Found ${countText} replacement${countText === 1 ? "" : "s"}`;

  if (visible === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const item of results) {
    const li = document.createElement("li");
    li.className = "cross-ref-page__result-card";

    const clickable = item.href ? document.createElement("a") : document.createElement("div");
    clickable.className = "cross-ref-page__result-link";
    if (clickable instanceof HTMLAnchorElement) clickable.href = item.href;

    const imgWrap = document.createElement("div");
    imgWrap.className = "cross-ref-page__result-thumb";
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    imgWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "cross-ref-page__result-body";
    const h3 = document.createElement("h3");
    h3.className = "cross-ref-page__result-title";
    h3.textContent = item.title;
    body.appendChild(h3);

    const meta = document.createElement("dl");
    meta.className = "cross-ref-page__result-meta";
    const rows: [string, string][] = [
      ["Part ID", item.partId],
      ["HP", item.hp],
      ["Speed", item.speed],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = `${k}:`;
      const dd = document.createElement("dd");
      dd.textContent = v;
      meta.appendChild(dt);
      meta.appendChild(dd);
    }
    body.appendChild(meta);

    clickable.appendChild(imgWrap);
    clickable.appendChild(body);
    li.appendChild(clickable);
    listEl.appendChild(li);
  }
}

/** Client + worker validation for “nothing to search” — inline under form, not toast. */
function isCrossRefFieldValidationError(message: string): boolean {
  const m = message.trim().replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  return (
    m === "Please fill in at least one field before searching." ||
    m === "Set at least one filter before searching." ||
    m === "At least one filter is required for /find."
  );
}

function clearCrossRefMessages(
  toastEl: HTMLElement,
  inlineEl: HTMLElement | null,
  formEl: HTMLFormElement,
): void {
  hidePageErrorToast(toastEl);
  if (inlineEl) {
    inlineEl.textContent = "";
    inlineEl.hidden = true;
    inlineEl.setAttribute("hidden", "");
  }
  formEl.classList.remove("cross-ref-page__form--inline-error");
}

function setCrossRefMessage(
  toastEl: HTMLElement,
  inlineEl: HTMLElement | null,
  formEl: HTMLFormElement,
  msg: string,
): void {
  if (!msg.trim()) {
    clearCrossRefMessages(toastEl, inlineEl, formEl);
    return;
  }
  if (isCrossRefFieldValidationError(msg)) {
    hidePageErrorToast(toastEl);
    if (inlineEl) {
      inlineEl.textContent = msg;
      inlineEl.hidden = false;
      inlineEl.removeAttribute("hidden");
    }
    formEl.classList.add("cross-ref-page__form--inline-error");
    return;
  }
  if (inlineEl) {
    inlineEl.textContent = "";
    inlineEl.hidden = true;
    inlineEl.setAttribute("hidden", "");
  }
  formEl.classList.remove("cross-ref-page__form--inline-error");
  showPageErrorToast(toastEl, msg);
}

function buildFindQuery(values: ReferenceValues): URLSearchParams {
  const q = new URLSearchParams();
  if (values.brand) q.set("brand", values.brand);
  if (values.model) q.set("model", values.model);
  if (values.part_number) q.set("part_number", values.part_number);
  if (values.motor_number) q.set("motor_number", values.motor_number);
  if (values.hp) q.set("hp", values.hp);
  return q;
}

function fillReference(values: ReferenceValues): void {
  const set = (id: string, value: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  };
  set("cross-ref-ref-brand", values.brand);
  set("cross-ref-ref-model", values.model);
  set("cross-ref-ref-part", values.part_number);
  set("cross-ref-ref-motor", values.motor_number);
  set("cross-ref-ref-hp", values.hp);
}

function syncSelectOptions(
  selectEl: HTMLSelectElement,
  options: string[],
  placeholder: string,
): void {
  const currentValue = text(selectEl.value);
  const uniqueOptions = uniqueStrings(options);
  const nextValue = uniqueOptions.includes(currentValue) ? currentValue : "";

  selectEl.replaceChildren();

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  selectEl.appendChild(placeholderOption);

  for (const option of uniqueOptions) {
    const optionEl = document.createElement("option");
    optionEl.value = option;
    optionEl.textContent = option;
    selectEl.appendChild(optionEl);
  }

  const selectRoot = selectEl.closest<HTMLElement>("[data-custom-select-root]");
  const menuEl =
    selectRoot?.querySelector<HTMLElement>("[data-custom-select-menu]") ?? null;
  if (menuEl) {
    menuEl.replaceChildren();
    for (const option of uniqueOptions) {
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cross-ref-page__custom-select-option";
      btn.setAttribute("role", "option");
      btn.setAttribute("data-custom-select-option", "");
      btn.setAttribute("data-value", option);
      btn.setAttribute("aria-selected", "false");
      btn.textContent = option;
      li.appendChild(btn);
      menuEl.appendChild(li);
    }
  }

  selectEl.value = nextValue;
  if (selectRoot) {
    syncCustomSelectFromNative(selectRoot);
  }
}

function wireAutocomplete(control: AutocompleteControl): () => void {
  const { input, list, getOptions, onPick, isLoading } = control;
  const wrap = input.closest(".cross-ref-page__control-wrap");

  /** Keeps focus on the input while choosing an item (avoids blur closing the list). */
  list.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
  };

  /** Always show the full option list (no substring filter). */
  const render = () => {
    if (isLoading?.()) {
      list.replaceChildren();
      const li = document.createElement("li");
      li.className = "cross-ref-page__suggest-loading";
      li.setAttribute("role", "status");
      li.setAttribute("aria-busy", "true");
      const spin = document.createElement("span");
      spin.className = "cross-ref-page__suggest-spinner";
      spin.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "cross-ref-page__suggest-loading-text";
      label.textContent = "Loading…";
      li.appendChild(spin);
      li.appendChild(label);
      list.appendChild(li);
      list.hidden = false;
      return;
    }

    const options = getOptions().slice();
    if (options.length === 0) {
      close();
      return;
    }

    const rawVal = text(input.value);
    if (rawVal.length === 0 && document.activeElement !== input) {
      close();
      return;
    }

    list.replaceChildren();
    for (const option of options) {
      const li = document.createElement("li");
      li.className = "cross-ref-page__suggest-item";
      li.setAttribute("role", "option");
      li.textContent = option;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = option;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        onPick?.(option);
        close();
      });
      list.appendChild(li);
    }
    list.hidden = false;
  };

  input.addEventListener("focus", render);
  input.addEventListener("click", render);
  input.addEventListener("input", render);
  input.addEventListener("blur", () => {
    window.setTimeout(close, 200);
  });

  const focusStillInThisAutocomplete = (t: EventTarget | null): boolean => {
    if (!(t instanceof Node)) return false;
    if (t === input || input.contains(t)) return true;
    if (list.contains(t)) return true;
    if (wrap?.contains(t)) return true;
    return false;
  };

  const onDocFocusIn = (e: FocusEvent) => {
    if (focusStillInThisAutocomplete(e.target)) return;
    close();
  };
  document.addEventListener("focusin", onDocFocusIn);

  return () => {
    if (!list.hidden) render();
  };
}

function wireCrossRefFieldClears(form: HTMLFormElement): () => void {
  const wraps = form.querySelectorAll<HTMLElement>(".cross-ref-page__control-wrap");
  const syncFns: Array<() => void> = [];

  for (const wrap of wraps) {
    const btnEl = wrap.querySelector("[data-cross-ref-field-clear]");
    const btn = btnEl instanceof HTMLButtonElement ? btnEl : null;
    const inputEl = wrap.querySelector("input");
    const input = inputEl instanceof HTMLInputElement ? inputEl : null;
    const nativeEl = wrap.querySelector("select[data-custom-select-native]");
    const native =
      nativeEl instanceof HTMLSelectElement ? nativeEl : null;
    if (!btn) continue;

    const sync = () => {
      const has = native
        ? text(native.value).length > 0
        : input
          ? text(input.value).length > 0
          : false;
      btn.hidden = !has;
    };
    syncFns.push(sync);

    if (input) {
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
    }
    if (native) {
      native.addEventListener("change", sync);
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (native) {
        native.value = "";
        native.dispatchEvent(new Event("change", { bubbles: true }));
        const selectRoot = wrap.querySelector<HTMLElement>("[data-custom-select-root]");
        if (selectRoot) {
          syncCustomSelectFromNative(selectRoot);
        }
      } else if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync();
    });
  }

  const syncAll = () => {
    for (const fn of syncFns) fn();
  };
  form.addEventListener("reset", () => {
    queueMicrotask(syncAll);
  });
  queueMicrotask(syncAll);
  return syncAll;
}

async function fetchFilters(brand: string, model: string): Promise<FilterLists> {
  const q = new URLSearchParams();
  if (brand) q.set("brand", brand);
  if (model) q.set("model", model);
  const res = await fetch(`/api/cross-ref-filters?${q.toString()}`);
  const payload = (await res.json()) as CrossRefFiltersResponse;
  const error = text((payload as Record<string, unknown>).error);
  if (!res.ok || error) {
    throw new Error(error || "Could not load filter options.");
  }
  return parseFilterLists(payload);
}

export function initProductCrossReferencePage(): void {
  const root = document.querySelector("[data-cross-ref-page]");
  if (!(root instanceof HTMLElement)) return;

  const form = document.getElementById("cross-ref-form");
  const formSection = document.getElementById("cross-ref-form-section");
  const resultsSection = document.getElementById("cross-ref-results-section");
  const errorEl = document.getElementById("cross-ref-error");
  const clearBtn = document.getElementById("cross-ref-clear");
  const submitBtn = document.getElementById("cross-ref-submit");
  const editBtn = document.getElementById("cross-ref-edit");
  const tryAgainBtn = document.getElementById("cross-ref-try-again");
  const listEl = document.getElementById("cross-ref-results-list");
  const countEl = document.getElementById("cross-ref-results-count");
  const emptyEl = document.getElementById("cross-ref-results-empty");
  const brandInput = document.getElementById("cross-ref-brand");
  const modelInput = document.getElementById("cross-ref-model");
  const partInput = document.getElementById("cross-ref-part-number");
  const partSuggest = document.getElementById("cross-ref-part-suggest");
  const motorInput = document.getElementById("cross-ref-motor-number");
  const motorSuggest = document.getElementById("cross-ref-motor-suggest");
  const hpInput = document.getElementById("cross-ref-hp");
  const hpSuggest = document.getElementById("cross-ref-hp-suggest");
  const inlineErrorEl = document.getElementById("cross-ref-form-inline-error");

  if (
    !(form instanceof HTMLFormElement) ||
    !(formSection instanceof HTMLElement) ||
    !(resultsSection instanceof HTMLElement) ||
    !(errorEl instanceof HTMLElement) ||
    !(listEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement) ||
    !(emptyEl instanceof HTMLElement) ||
    !(brandInput instanceof HTMLSelectElement) ||
    !(modelInput instanceof HTMLSelectElement) ||
    !(partInput instanceof HTMLInputElement) ||
    !(partSuggest instanceof HTMLElement) ||
    !(motorInput instanceof HTMLInputElement) ||
    !(motorSuggest instanceof HTMLElement) ||
    !(hpInput instanceof HTMLInputElement) ||
    !(hpSuggest instanceof HTMLElement)
  ) {
    return;
  }

  installPageErrorToast(errorEl);
  initFormCustomSelects(form);
  const syncFieldClears = wireCrossRefFieldClears(form);

  const clearMessagesOnEdit = () => {
    clearCrossRefMessages(errorEl, inlineErrorEl, form);
  };
  form.addEventListener("input", clearMessagesOnEdit);
  form.addEventListener("change", clearMessagesOnEdit);

  let currentLists: FilterLists = {
    brands: [],
    models: [],
    partNumbers: [],
    motorNumbers: [],
    hpValues: [],
  };

  /** Full brand list (API narrows `brands` when `brand` query is set — do not use that for the brand field). */
  let allBrands: string[] = [];
  /** All models for the current brand (request without `model` so the list is not narrowed to one row). */
  let allModels: string[] = [];

  /** Last selected values in required dropdowns. */
  let lastPickedBrand = "";
  let lastPickedModel = "";

  /** Until the first filter fetch finishes, dropdowns have no data — treat as loading. */
  let filtersReady = false;
  let filtersInflight = 0;
  const isFiltersLoading = () => filtersInflight > 0 || !filtersReady;

  const suggestRerenderIfOpen: Array<() => void> = [];
  const rerenderOpenSuggests = () => {
    for (const fn of suggestRerenderIfOpen) fn();
  };

  const switchToResults = (on: boolean) => {
    formSection.hidden = on;
    resultsSection.hidden = !on;
  };

  const scrollCrossRefToFormTop = (): void => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      formSection.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const refreshFilters = async (): Promise<void> => {
    filtersInflight++;
    rerenderOpenSuggests();
    try {
      const brand = text(brandInput.value);
      const model = text(modelInput.value);

      if (!brand && !model) {
        const only = await fetchFilters("", "");
        currentLists = only;
        allBrands = only.brands;
        allModels = only.models;
        syncSelectOptions(brandInput, allBrands, "Choose a brand");
        syncSelectOptions(modelInput, allModels, "Choose a model");
        return;
      }

      if (brand && !model) {
        const [emptyLists, byBrand] = await Promise.all([
          fetchFilters("", ""),
          fetchFilters(brand, ""),
        ]);
        currentLists = byBrand;
        allBrands = emptyLists.brands;
        allModels = byBrand.models;
        syncSelectOptions(brandInput, allBrands, "Choose a brand");
        syncSelectOptions(modelInput, allModels, "Choose a model");
        return;
      }

      const [narrow, emptyLists, modelsWide] = await Promise.all([
        fetchFilters(brand, model),
        fetchFilters("", ""),
        fetchFilters(brand, ""),
      ]);
      currentLists = narrow;
      allBrands = emptyLists.brands;
      allModels = modelsWide.models;
      syncSelectOptions(brandInput, allBrands, "Choose a brand");
      syncSelectOptions(modelInput, allModels, "Choose a model");
    } finally {
      filtersInflight = Math.max(0, filtersInflight - 1);
      filtersReady = true;
      rerenderOpenSuggests();
      syncFieldClears();
    }
  };

  let refreshTimer: number | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshFilters().catch((e) =>
        setCrossRefMessage(
          errorEl,
          inlineErrorEl,
          form,
          e instanceof Error ? e.message : String(e),
        ),
      );
    }, 180);
  };

  brandInput.addEventListener("change", () => {
    const value = text(brandInput.value);
    const changed = value !== lastPickedBrand;
    lastPickedBrand = value;
    if (changed) {
      lastPickedModel = "";
      modelInput.value = "";
      partInput.value = "";
      motorInput.value = "";
      hpInput.value = "";
    }
    scheduleRefresh();
    syncFieldClears();
  });

  modelInput.addEventListener("change", () => {
    const value = text(modelInput.value);
    const changed = value !== lastPickedModel;
    lastPickedModel = value;
    if (changed) {
      partInput.value = "";
      motorInput.value = "";
      hpInput.value = "";
    }
    scheduleRefresh();
    syncFieldClears();
  });

  suggestRerenderIfOpen.push(
    wireAutocomplete({
      input: partInput,
      list: partSuggest,
      getOptions: () => currentLists.partNumbers,
      isLoading: isFiltersLoading,
    }),
  );
  suggestRerenderIfOpen.push(
    wireAutocomplete({
      input: motorInput,
      list: motorSuggest,
      getOptions: () => currentLists.motorNumbers,
      isLoading: isFiltersLoading,
    }),
  );
  suggestRerenderIfOpen.push(
    wireAutocomplete({
      input: hpInput,
      list: hpSuggest,
      getOptions: () => currentLists.hpValues,
      isLoading: isFiltersLoading,
    }),
  );

  refreshFilters().catch((e) =>
    setCrossRefMessage(
      errorEl,
      inlineErrorEl,
      form,
      e instanceof Error ? e.message : String(e),
    ),
  );

  clearBtn?.addEventListener("click", () => {
    lastPickedBrand = "";
    lastPickedModel = "";
    form.reset();
    clearCrossRefMessages(errorEl, inlineErrorEl, form);
    refreshFilters().catch((e) =>
      setCrossRefMessage(
        errorEl,
        inlineErrorEl,
        form,
        e instanceof Error ? e.message : String(e),
      ),
    );
  });

  editBtn?.addEventListener("click", () => {
    switchToResults(false);
  });

  tryAgainBtn?.addEventListener("click", () => {
    switchToResults(false);
    listEl.replaceChildren();
    countEl.textContent = "";
    emptyEl.hidden = true;
    clearCrossRefMessages(errorEl, inlineErrorEl, form);
    scrollCrossRefToFormTop();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearCrossRefMessages(errorEl, inlineErrorEl, form);

    const values: ReferenceValues = {
      brand: text(brandInput.value),
      model: text(modelInput.value),
      part_number: text(partInput.value),
      motor_number: text(motorInput.value),
      hp: text(hpInput.value),
    };
    const hasAny = Object.values(values).some(Boolean);
    if (!hasAny) {
      setCrossRefMessage(
        errorEl,
        inlineErrorEl,
        form,
        "Please fill in at least one field before searching.",
      );
      return;
    }

    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
    try {
      const query = buildFindQuery(values).toString();
      const res = await fetch(`/api/cross-ref-find?${query}`);
      const payload = (await res.json()) as CrossRefFindResponse;
      const error =
        asObject(payload) && "error" in payload ? text(payload.error) : "";
      if (!res.ok || error) {
        setCrossRefMessage(
          errorEl,
          inlineErrorEl,
          form,
          error || "Could not load cross reference results.",
        );
        return;
      }

      const normalized = normalizeFindResults(payload);
      fillReference(values);
      renderResults(listEl, countEl, emptyEl, normalized.items, normalized.count);
      switchToResults(true);
      clearCrossRefMessages(errorEl, inlineErrorEl, form);
    } catch (e) {
      setCrossRefMessage(
        errorEl,
        inlineErrorEl,
        form,
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });

}
