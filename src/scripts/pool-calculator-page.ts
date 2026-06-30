import {
  type ShapeId,
  SHAPE_LABELS,
  dimensionFieldsForShape,
  estimateVolumeGallons,
  formatGpm,
  gpmFromVolume,
} from "../lib/pool-calculator";
import { PUBLIC_API_ERROR_MESSAGE } from "../lib/public-api-error-message";

const MAX_FT_DIGITS = 4;
const MAX_IN_DIGITS = 2;

type FlowMode = "dimensions" | "gpmOnly";

let flowMode: FlowMode = "dimensions";
let currentStep = 1;
let selectedShape: ShapeId | null = null;
let cachedVolumeGallons = 0;
let cachedTurnovers = 1;
let cachedGpm = 0;
/** Step 2: footer Next stays disabled until user clicks Estimate volume. */
let step2HasEstimatedVolume = false;

const PANEL_FADE_MS = 340;
let panelFadeToken = 0;
let step2ViewFadeToken = 0;
/** Last applied step-2 layer (false = dimensions, true = result); null = re-apply on next sync without fade. */
let step2VolumeLayerApplied: boolean | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  const el = root.querySelector(sel);
  return el instanceof HTMLElement ? el : null;
}

function digitsOnlyFt(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MAX_FT_DIGITS);
}

function digitsOnlyIn(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MAX_IN_DIGITS);
}

/**
 * Maps internal `currentStep` (panels 1, 2, 4, 5 — no panel 3) to the three
 * `data-pool-stepper-index` items: 1 config, 2 volume, 3 GPM. Value 4 = results
 * (all segments done, none current).
 */
function stepperSegment(step: number): 1 | 2 | 3 | 4 {
  if (step <= 1) return 1;
  if (step <= 2) return 2;
  if (step < 5) return 3;
  return 4;
}

function syncStepper(): void {
  const seg = stepperSegment(currentStep);
  const skipFirstTwo = flowMode === "gpmOnly" && currentStep >= 4;
  for (let i = 1; i <= 3; i++) {
    const item = $(`[data-pool-stepper-index="${i}"]`);
    if (!item) continue;
    const isCurrent = seg <= 3 && i === seg;
    const isDone =
      (i < seg && !skipFirstTwo) || (seg === 4 && !(skipFirstTwo && i < 3));
    item.classList.toggle("pool-calc__stepper-item--current", isCurrent);
    item.classList.toggle("pool-calc__stepper-item--done", isDone);
    item.classList.toggle(
      "pool-calc__stepper-item--skip",
      skipFirstTwo && i < 3,
    );
  }
}

function applyPanelVisibility(step: number): void {
  document.querySelectorAll<HTMLElement>("[data-pool-panel]").forEach((el) => {
    const n = Number(el.dataset.poolPanel);
    el.hidden = n !== step;
  });
}

function showPanel(step: number, fromStep: number): void {
  const vp = $("#pool-calc-panels-viewport");
  const skipFade = prefersReducedMotion() || fromStep === step || !vp;
  const token = ++panelFadeToken;

  const finishFade = (): void => {
    if (token !== panelFadeToken) return;
    applyPanelVisibility(step);
    $("#pool-calc-panels-viewport")?.classList.remove(
      "pool-calc__panels--fade-out",
    );
  };

  if (skipFade) {
    vp?.classList.remove("pool-calc__panels--fade-out");
    applyPanelVisibility(step);
    return;
  }

  vp.classList.remove("pool-calc__panels--fade-out");
  void vp.offsetWidth;
  vp.classList.add("pool-calc__panels--fade-out");
  const onEnd = (e: TransitionEvent): void => {
    if (e.target !== vp || e.propertyName !== "opacity") return;
    vp.removeEventListener("transitionend", onEnd);
    window.clearTimeout(tid);
    if (token === panelFadeToken) finishFade();
  };
  vp.addEventListener("transitionend", onEnd);
  const tid = window.setTimeout(() => {
    vp.removeEventListener("transitionend", onEnd);
    if (token === panelFadeToken) finishFade();
  }, PANEL_FADE_MS + 80);
}

function applyStep2VolumeLayer(showResult: boolean): void {
  const dim = $("#pool-calc-dimensions");
  const res = $("#pool-calc-step2-result");
  if (!dim || !res) return;
  dim.hidden = showResult;
  res.hidden = !showResult;
}

/** Step 2: dimensions vs volume result card; fades when toggling on the same panel. */
function syncStep2VolumeUi(): void {
  const vp = $("#pool-calc-step2-viewport");
  if (currentStep !== 2) {
    $("#pool-calc-step2-viewport")?.classList.remove(
      "pool-calc__step2-viewport--fade-out",
    );
    step2VolumeLayerApplied = null;
    return;
  }

  const showResult = step2HasEstimatedVolume;
  if (step2VolumeLayerApplied === null) {
    vp?.classList.remove("pool-calc__step2-viewport--fade-out");
    applyStep2VolumeLayer(showResult);
    step2VolumeLayerApplied = showResult;
    return;
  }
  if (step2VolumeLayerApplied === showResult) return;

  const skipFade = prefersReducedMotion() || !vp;
  if (skipFade) {
    vp?.classList.remove("pool-calc__step2-viewport--fade-out");
    applyStep2VolumeLayer(showResult);
    step2VolumeLayerApplied = showResult;
    return;
  }

  const token = ++step2ViewFadeToken;
  const finishFade = (): void => {
    if (token !== step2ViewFadeToken) return;
    applyStep2VolumeLayer(showResult);
    step2VolumeLayerApplied = showResult;
    $("#pool-calc-step2-viewport")?.classList.remove(
      "pool-calc__step2-viewport--fade-out",
    );
  };

  vp.classList.remove("pool-calc__step2-viewport--fade-out");
  void vp.offsetWidth;
  vp.classList.add("pool-calc__step2-viewport--fade-out");
  const onEnd = (e: TransitionEvent): void => {
    if (e.target !== vp || e.propertyName !== "opacity") return;
    vp.removeEventListener("transitionend", onEnd);
    window.clearTimeout(tid);
    if (token === step2ViewFadeToken) finishFade();
  };
  vp.addEventListener("transitionend", onEnd);
  const tid = window.setTimeout(() => {
    vp.removeEventListener("transitionend", onEnd);
    if (token === step2ViewFadeToken) finishFade();
  }, PANEL_FADE_MS + 80);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeProductHref(uri: string): string {
  const u = uri.trim();
  if (!u) return "#";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

type ProductCategoryProductsApiItem = {
  title: string;
  uri: string;
};

type ProductCategoryProductsApiResponse = {
  items?: ProductCategoryProductsApiItem[];
  error?: string;
};

const PARTS_LOADED = "1";

function setPanelMessage(
  panel: HTMLElement,
  text: string,
  variant?: "error",
): void {
  panel.replaceChildren();
  const p = document.createElement("p");
  p.className =
    variant === "error"
      ? "pool-calc__accordion-panel-msg pool-calc__accordion-panel-msg--error"
      : "pool-calc__accordion-panel-msg";
  if (variant === "error") p.setAttribute("role", "alert");
  else p.setAttribute("role", "status");
  p.textContent = text;
  panel.appendChild(p);
}

function renderPartsProductList(
  panel: HTMLElement,
  items: ProductCategoryProductsApiItem[],
): void {
  panel.replaceChildren();
  const ul = document.createElement("ul");
  ul.className = "pool-calc__parts-list";
  for (const it of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "pool-calc__parts-link";
    a.href = normalizeProductHref(it.uri);
    a.textContent = it.title;
    li.appendChild(a);
    ul.appendChild(li);
  }
  panel.appendChild(ul);
}

async function loadCategoryProductsIfNeeded(
  item: HTMLElement,
  panel: HTMLElement,
): Promise<void> {
  const slug = item.dataset.poolCalcCategorySlug?.trim();
  if (!slug || panel.dataset.partsLoaded === PARTS_LOADED) return;
  if (panel.dataset.partsLoading === "1") return;

  panel.dataset.partsLoading = "1";
  setPanelMessage(panel, "Loading…");

  try {
    const res = await fetch(
      `/api/product-category-products?slug=${encodeURIComponent(slug)}`,
    );
    const json = (await res.json()) as ProductCategoryProductsApiResponse;
    if (!res.ok || json.error) {
      setPanelMessage(panel, PUBLIC_API_ERROR_MESSAGE, "error");
      return;
    }
    const items = (json.items ?? []).filter((x) => x.title && x.uri);
    if (items.length === 0) {
      setPanelMessage(panel, "No products in this category.");
    } else {
      renderPartsProductList(panel, items);
    }
    panel.dataset.partsLoaded = PARTS_LOADED;
  } catch (e) {
    setPanelMessage(panel, PUBLIC_API_ERROR_MESSAGE, "error");
  } finally {
    panel.dataset.partsLoading = "";
  }
}

function areDimensionFieldsComplete(): boolean {
  const host = $("#pool-calc-dimensions-fields");
  if (!host || !selectedShape) return false;
  const inputs = host.querySelectorAll<HTMLInputElement>("input");
  if (inputs.length === 0) return false;
  for (const inp of inputs) {
    if (!inp.value.trim()) return false;
  }
  return true;
}

function attachDimInputHandlers(host: HTMLElement): void {
  host.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => {
      const isInches = inp.classList.contains("pool-calc__dim-in");
      inp.value = isInches ? digitsOnlyIn(inp.value) : digitsOnlyFt(inp.value);
      step2HasEstimatedVolume = false;
      syncChrome();
    });
  });
}

function renderDimensionForm(): void {
  const host = $("#pool-calc-dimensions-fields");
  if (!host || !selectedShape) return;
  const fields = dimensionFieldsForShape(selectedShape);
  host.innerHTML = fields
    .map(
      (f) => `
    <div class="pool-calc__dim-row">
      <div class="pool-calc__dim-label-wrap">
        <span class="pool-calc__dim-label">${escapeHtml(f.label)}<span class="pool-calc__dim-req" aria-hidden="true">*</span></span>
      </div>
      <div class="pool-calc__dim-inputs">
        <label class="pool-calc__dim-field">
          <div class="pool-calc__dim-control pool-calc__dim-control--ft">
            <span class="pool-calc__dim-sublabel">Feet</span>
            <input type="text" autocomplete="off" class="pool-calc__dim-ft" maxlength="${MAX_FT_DIGITS}" aria-label="${escapeHtml(f.label)} feet" />
            <span class="pool-calc__dim-unit">ft</span>
          </div>
        </label>
        <label class="pool-calc__dim-field">
          <div class="pool-calc__dim-control pool-calc__dim-control--in">
            <span class="pool-calc__dim-sublabel">Inches</span>
            <input type="text"  autocomplete="off" class="pool-calc__dim-in" maxlength="${MAX_IN_DIGITS}" aria-label="${escapeHtml(f.label)} inches" />
            <span class="pool-calc__dim-unit">in</span>
          </div>
        </label>
      </div>
    </div>`,
    )
    .join("");
  attachDimInputHandlers(host);
}

function readDimensionPairs(): [string, string][] {
  const rows = document.querySelectorAll<HTMLElement>(
    "#pool-calc-dimensions-fields .pool-calc__dim-row",
  );
  const out: [string, string][] = [];
  rows.forEach((row) => {
    const ft = row.querySelector<HTMLInputElement>(".pool-calc__dim-ft");
    const inch = row.querySelector<HTMLInputElement>(".pool-calc__dim-in");
    out.push([ft?.value ?? "", inch?.value ?? ""]);
  });
  return out;
}

/** Steps 2–4: label “Selected shape:” is static in markup; value span holds shape name or “Volume entry only”. */
function updateShapeBadges(): void {
  const hasShape = selectedShape !== null;
  const valueText =
    selectedShape != null
      ? SHAPE_LABELS[selectedShape]
      : flowMode === "gpmOnly"
        ? "Volume entry only"
        : "";
  const show = valueText.length > 0;

  document
    .querySelectorAll<HTMLElement>(".pool-calc__js-shape-badge")
    .forEach((el) => {
      const label = el.querySelector<HTMLElement>(
        ".pool-calc__js-shape-badge-label",
      );
      const valueEl = el.querySelector<HTMLElement>(
        ".pool-calc__js-shape-badge-value",
      );
      if (valueEl) valueEl.textContent = valueText;
      if (label) label.hidden = !hasShape;
      el.hidden = !show;
    });
}

function updateFinalSummary(): void {
  const root = $("#pool-calc-final-shape");
  if (!root) return;
  const label = root.querySelector<HTMLElement>(
    ".pool-calc__js-shape-badge-label",
  );
  const valueEl = root.querySelector<HTMLElement>(
    ".pool-calc__js-shape-badge-value",
  );
  const hasShape = selectedShape !== null;
  const valueText =
    selectedShape != null
      ? SHAPE_LABELS[selectedShape]
      : flowMode === "gpmOnly"
        ? "Volume entry only"
        : "";
  if (valueEl) valueEl.textContent = valueText;
  if (label) label.hidden = !hasShape;
}

function updateVolumeDisplays(): void {
  const v1 = $("#pool-calc-volume-result");
  const v2 = $("#pool-calc-final-volume");
  const g = $("#pool-calc-final-gpm");
  const t = $("#pool-calc-final-turnover");
  if (v1) v1.textContent = String(cachedVolumeGallons);
  if (v2) v2.textContent = String(cachedVolumeGallons);
  if (g) g.textContent = formatGpm(cachedGpm);
  if (t) {
    const turnoverVal = t.querySelector<HTMLElement>(
      ".pool-calc__js-shape-badge-value",
    );
    if (turnoverVal) {
      turnoverVal.textContent = `${cachedTurnovers}× / day`;
    }
  }
}

function readVolumeInput(): number {
  const inp = $("#pool-calc-volume-input") as HTMLInputElement | null;
  if (!inp) return 0;
  const n = Math.floor(Number(inp.value.replace(/\D/g, "") || 0));
  return Math.max(0, n);
}

function readTurnovers(): number {
  const sel = $("#pool-calc-turnovers") as HTMLSelectElement | null;
  if (!sel) return 1;
  const n = Number(sel.value);
  return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1;
}

function turnoverRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-pool-turnover-root]");
}

function setTurnoverMenuOpen(open: boolean): void {
  const root = turnoverRoot();
  if (!root) return;
  root.classList.toggle("product-filters__custom-select--open", open);
  root
    .querySelector<HTMLElement>("[data-pool-turnover-trigger]")
    ?.setAttribute("aria-expanded", open ? "true" : "false");
  const menu = root.querySelector<HTMLElement>("[data-pool-turnover-menu]");
  if (menu) menu.hidden = !open;
}

function syncTurnoverCustomFromNative(): void {
  const sel = $("#pool-calc-turnovers") as HTMLSelectElement | null;
  const valEl = $("#pool-calc-turnovers-value");
  if (!sel || !valEl) return;
  const n = Number(sel.value);
  const v = Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1;
  valEl.textContent = String(v);
  turnoverRoot()
    ?.querySelectorAll<HTMLButtonElement>("[data-pool-turnover-value]")
    .forEach((btn) => {
      const bn = Number(btn.dataset.poolTurnoverValue);
      btn.setAttribute("aria-selected", bn === v ? "true" : "false");
    });
}

function setTurnoversValue(n: number): void {
  const sel = $("#pool-calc-turnovers") as HTMLSelectElement | null;
  if (sel) {
    const v = Math.min(6, Math.max(1, Math.floor(n)));
    sel.value = String(v);
  }
  syncTurnoverCustomFromNative();
}

function bindPoolTurnoverCustomSelect(): void {
  const root = turnoverRoot();
  if (!root) return;
  root.addEventListener("click", (e) => e.stopPropagation());
  root
    .querySelector("[data-pool-turnover-trigger]")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !root.classList.contains(
        "product-filters__custom-select--open",
      );
      setTurnoverMenuOpen(open);
    });
  root
    .querySelector("[data-pool-turnover-menu]")
    ?.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-pool-turnover-value]",
      );
      if (!t) return;
      const v = Number(t.dataset.poolTurnoverValue);
      if (!Number.isFinite(v) || v < 1 || v > 6) return;
      setTurnoversValue(v);
      setTurnoverMenuOpen(false);
    });
  document.addEventListener("click", () => setTurnoverMenuOpen(false));
}

function syncChrome(): void {
  const prevBtn = $("#pool-calc-btn-prev") as HTMLButtonElement | null;
  const nextTop = $("#pool-calc-btn-next") as HTMLButtonElement | null;
  const finishBtn = $("#pool-calc-btn-finish") as HTMLButtonElement | null;
  const step2Actions = $("#pool-calc-step2-actions");
  const step4Actions = $("#pool-calc-step4-actions");

  if (step2Actions) step2Actions.hidden = currentStep !== 2;
  if (step4Actions) step4Actions.hidden = currentStep !== 4;

  const estimateVolBtn = $(
    "#pool-calc-estimate-volume",
  ) as HTMLButtonElement | null;
  if (estimateVolBtn) {
    estimateVolBtn.hidden = currentStep !== 2;
    estimateVolBtn.disabled =
      currentStep !== 2 || !areDimensionFieldsComplete();
  }

  if (prevBtn) {
    prevBtn.hidden = currentStep === 1;
    prevBtn.disabled = false;
  }

  if (nextTop) {
    const showNext =
      currentStep === 1 || (currentStep === 2 && flowMode === "dimensions");
    nextTop.hidden = !showNext;
    if (currentStep === 1) {
      nextTop.disabled = flowMode === "dimensions" && !selectedShape;
    } else if (currentStep === 2) {
      nextTop.disabled = !step2HasEstimatedVolume;
    } else {
      nextTop.disabled = true;
    }
  }

  if (finishBtn) {
    finishBtn.hidden = currentStep !== 5;
    finishBtn.disabled = false;
  }

  updateShapeBadges();
  if (currentStep === 5) updateFinalSummary();
  if (currentStep === 2) syncStep2VolumeUi();
}

function goToStep(step: number): void {
  const fromStep = currentStep;
  if (step === 2 && fromStep !== 4) {
    step2HasEstimatedVolume = false;
  }
  if (step === 2 && (fromStep === 1 || fromStep === 4)) {
    step2VolumeLayerApplied = null;
  }
  currentStep = step;
  showPanel(step, fromStep);
  syncStepper();
  syncChrome();

  if (step === 4) {
    const inp = $("#pool-calc-volume-input") as HTMLInputElement | null;
    if (inp && flowMode === "dimensions") {
      inp.value = String(cachedVolumeGallons);
    }
    setTurnoversValue(cachedTurnovers);
  }
}

function deselectAllShapeCards(): void {
  document.querySelectorAll(".pool-calc__shape-card").forEach((c) => {
    c.classList.remove("is-selected");
  });
}

function resetAll(): void {
  flowMode = "dimensions";
  currentStep = 1;
  selectedShape = null;
  cachedVolumeGallons = 0;
  cachedTurnovers = 1;
  cachedGpm = 0;
  deselectAllShapeCards();
  const dimFields = $("#pool-calc-dimensions-fields");
  if (dimFields) dimFields.innerHTML = "";
  const volInp = $("#pool-calc-volume-input") as HTMLInputElement | null;
  if (volInp) volInp.value = "";
  setTurnoversValue(1);
  document.querySelectorAll(".pool-calc__stepper-item").forEach((el) => {
    el.classList.remove("pool-calc__stepper-item--skip");
  });
  step2ViewFadeToken += 1;
  $("#pool-calc-step2-viewport")?.classList.remove(
    "pool-calc__step2-viewport--fade-out",
  );
  step2VolumeLayerApplied = null;
  goToStep(1);
}

function onPrevStep(): void {
  if (currentStep <= 1) return;
  if (currentStep === 5) {
    goToStep(4);
    return;
  }
  if (currentStep === 4 && flowMode === "gpmOnly") {
    resetAll();
    return;
  }
  if (currentStep === 4) {
    goToStep(2);
    return;
  }
  if (currentStep === 2) {
    goToStep(1);
  }
}

function applyEstimateVolumeOnStep2(): void {
  if (!selectedShape) return;
  if (!areDimensionFieldsComplete()) return;
  const pairs = readDimensionPairs();
  const fields = dimensionFieldsForShape(selectedShape);
  if (pairs.length !== fields.length) return;
  cachedVolumeGallons = estimateVolumeGallons(selectedShape, pairs);
  updateVolumeDisplays();
  step2HasEstimatedVolume = true;
  syncChrome();
}

function computeGpmAndFinish(): void {
  cachedVolumeGallons = readVolumeInput();
  cachedTurnovers = readTurnovers();
  cachedGpm = gpmFromVolume(cachedVolumeGallons, cachedTurnovers);
  updateVolumeDisplays();
  goToStep(5);
}

export function initPoolCalculator(): void {
  document
    .querySelectorAll<HTMLElement>(".pool-calc__shape-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const shape = card.dataset.shape as ShapeId | undefined;
        if (!shape) return;
        flowMode = "dimensions";
        selectedShape = shape;
        document.querySelectorAll(".pool-calc__shape-card").forEach((c) => {
          c.classList.toggle("is-selected", c === card);
        });
        syncChrome();
      });
    });

  $("#pool-calc-gpm-only")?.addEventListener("click", () => {
    flowMode = "gpmOnly";
    selectedShape = null;
    deselectAllShapeCards();
    goToStep(4);
  });

  const onNext = () => {
    if (currentStep === 1 && flowMode === "dimensions" && selectedShape) {
      renderDimensionForm();
      goToStep(2);
    } else if (
      currentStep === 2 &&
      flowMode === "dimensions" &&
      selectedShape
    ) {
      if (!step2HasEstimatedVolume) return;
      goToStep(4);
    }
  };
  $("#pool-calc-btn-next")?.addEventListener("click", onNext);

  $("#pool-calc-btn-prev")?.addEventListener("click", onPrevStep);

  $("#pool-calc-clear-dim")?.addEventListener("click", () => {
    $("#pool-calc-dimensions-fields")
      ?.querySelectorAll("input")
      .forEach((i) => {
        (i as HTMLInputElement).value = "";
      });
    step2HasEstimatedVolume = false;
    syncChrome();
  });

  $("#pool-calc-estimate-volume")?.addEventListener("click", () => {
    applyEstimateVolumeOnStep2();
  });

  $("#pool-calc-try-again")?.addEventListener("click", () => {
    goToStep(2);
  });

  $("#pool-calc-clear-gpm")?.addEventListener("click", () => {
    const inp = $("#pool-calc-volume-input") as HTMLInputElement | null;
    if (inp) inp.value = "";
    setTurnoversValue(1);
  });

  bindPoolTurnoverCustomSelect();

  $("#pool-calc-estimate-gpm")?.addEventListener("click", () => {
    computeGpmAndFinish();
  });

  $("#pool-calc-btn-finish")?.addEventListener("click", () => {
    resetAll();
  });

  $("#pool-calc-try-again-final")?.addEventListener("click", () => {
    resetAll();
  });

  $("#pool-calc-volume-input")?.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    t.value = t.value.replace(/\D/g, "").slice(0, 9);
  });

  document.querySelectorAll(".pool-calc__accordion-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".pool-calc__accordion-item");
      if (!(item instanceof HTMLElement)) return;
      item.classList.toggle("is-open");
      const expanded = item.classList.contains("is-open");
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      const panel = item.querySelector<HTMLElement>(
        ".pool-calc__accordion-panel",
      );
      if (panel) panel.hidden = !expanded;
      if (expanded && panel) {
        void loadCategoryProductsIfNeeded(item, panel);
      }
    });
  });

  resetAll();
}
