import {
  hidePageErrorToast,
  installPageErrorToast,
  showPageErrorToast,
} from "../lib/page-error-toast";

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
  results: CrossRefResult[],
  totalCount: number | null,
): void {
  listEl.replaceChildren();
  const visible = results.length;
  const countText = totalCount !== null ? totalCount : visible;
  countEl.textContent = `Found ${countText} replacement${countText === 1 ? "" : "s"}`;

  if (visible === 0) {
    const li = document.createElement("li");
    li.className = "cross-ref-page__result-empty";
    li.textContent = "No replacements found for selected filters.";
    listEl.appendChild(li);
    return;
  }

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

function setError(el: HTMLElement, msg: string): void {
  if (!msg.trim()) {
    hidePageErrorToast(el);
    return;
  }
  showPageErrorToast(el, msg);
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

function wireAutocomplete(control: AutocompleteControl): () => void {
  const { input, list, getOptions, onPick, isLoading } = control;

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
    list.replaceChildren();
    for (const option of options) {
      const li = document.createElement("li");
      li.className = "cross-ref-page__suggest-item";
      li.setAttribute("role", "option");
      li.textContent = option;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = option;
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

  return () => {
    if (!list.hidden) render();
  };
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
  const brandInput = document.getElementById("cross-ref-brand");
  const brandSuggest = document.getElementById("cross-ref-brand-suggest");
  const modelInput = document.getElementById("cross-ref-model");
  const modelSuggest = document.getElementById("cross-ref-model-suggest");
  const partInput = document.getElementById("cross-ref-part-number");
  const partSuggest = document.getElementById("cross-ref-part-suggest");
  const motorInput = document.getElementById("cross-ref-motor-number");
  const motorSuggest = document.getElementById("cross-ref-motor-suggest");
  const hpInput = document.getElementById("cross-ref-hp");
  const hpSuggest = document.getElementById("cross-ref-hp-suggest");

  if (
    !(form instanceof HTMLFormElement) ||
    !(formSection instanceof HTMLElement) ||
    !(resultsSection instanceof HTMLElement) ||
    !(errorEl instanceof HTMLElement) ||
    !(listEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement) ||
    !(brandInput instanceof HTMLInputElement) ||
    !(brandSuggest instanceof HTMLElement) ||
    !(modelInput instanceof HTMLInputElement) ||
    !(modelSuggest instanceof HTMLElement) ||
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

  /** Last value chosen from the suggest list (not free-typing). */
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
    } finally {
      filtersInflight = Math.max(0, filtersInflight - 1);
      filtersReady = true;
      rerenderOpenSuggests();
    }
  };

  let refreshTimer: number | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshFilters().catch((e) =>
        setError(errorEl, e instanceof Error ? e.message : String(e)),
      );
    }, 180);
  };

  brandInput.addEventListener("input", () => {
    if (!text(brandInput.value)) {
      lastPickedBrand = "";
      lastPickedModel = "";
      modelInput.value = "";
      partInput.value = "";
      motorInput.value = "";
      hpInput.value = "";
    }
    scheduleRefresh();
  });
  modelInput.addEventListener("input", () => {
    if (!text(modelInput.value)) {
      lastPickedModel = "";
      partInput.value = "";
      motorInput.value = "";
      hpInput.value = "";
    }
    scheduleRefresh();
  });
  brandInput.addEventListener("change", scheduleRefresh);
  modelInput.addEventListener("change", scheduleRefresh);

  suggestRerenderIfOpen.push(
    wireAutocomplete({
      input: brandInput,
      list: brandSuggest,
      getOptions: () => (allBrands.length ? allBrands : currentLists.brands),
      isLoading: isFiltersLoading,
      onPick: (value) => {
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
      },
    }),
  );
  suggestRerenderIfOpen.push(
    wireAutocomplete({
      input: modelInput,
      list: modelSuggest,
      getOptions: () => (allModels.length ? allModels : currentLists.models),
      isLoading: isFiltersLoading,
      onPick: (value) => {
        const changed = value !== lastPickedModel;
        lastPickedModel = value;
        if (changed) {
          partInput.value = "";
          motorInput.value = "";
          hpInput.value = "";
        }
        scheduleRefresh();
      },
    }),
  );

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
    setError(errorEl, e instanceof Error ? e.message : String(e)),
  );

  clearBtn?.addEventListener("click", () => {
    lastPickedBrand = "";
    lastPickedModel = "";
    form.reset();
    setError(errorEl, "");
    refreshFilters().catch((e) =>
      setError(errorEl, e instanceof Error ? e.message : String(e)),
    );
  });

  editBtn?.addEventListener("click", () => {
    switchToResults(false);
  });

  tryAgainBtn?.addEventListener("click", () => {
    switchToResults(false);
    listEl.replaceChildren();
    countEl.textContent = "";
    setError(errorEl, "");
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setError(errorEl, "");

    const values: ReferenceValues = {
      brand: text(brandInput.value),
      model: text(modelInput.value),
      part_number: text(partInput.value),
      motor_number: text(motorInput.value),
      hp: text(hpInput.value),
    };
    const hasAny = Object.values(values).some(Boolean);
    if (!hasAny) {
      setError(errorEl, "Set at least one filter before searching.");
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
        setError(errorEl, error || "Could not load cross reference results.");
        return;
      }

      const normalized = normalizeFindResults(payload);
      fillReference(values);
      renderResults(listEl, countEl, normalized.items, normalized.count);
      switchToResults(true);
    } catch (e) {
      setError(errorEl, e instanceof Error ? e.message : String(e));
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });

}
