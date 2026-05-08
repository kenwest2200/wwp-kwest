import {
  hidePageErrorToast,
  installPageErrorToast,
  showPageErrorToast,
} from "../lib/page-error-toast";

export {};

type SortDir = "asc" | "desc";

type SalesRepRow = {
  name: string;
  phone: string;
  email: string | null;
};

type SalesRepsApiResponse = {
  reps?: SalesRepRow[];
  error?: string;
};

/** Under ZIP field; network / upstream / config errors use toast instead. */
function isSalesRepsFieldValidationError(message: string): boolean {
  const m = message
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'");
  return (
    m === "Please enter a ZIP code." ||
    m === "ZIP code is required." ||
    m === "Enter a valid U.S. ZIP code (5 digits, optionally ZIP+4)." ||
    m === "Enter a valid U.S. ZIP code (5 digits or ZIP+4)."
  );
}

const COL_SPAN = 3;

let cachedReps: SalesRepRow[] = [];
let sortDir: SortDir = "asc";

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "#";
  return `tel:${digits}`;
}

async function reverseGeocodeToZip(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=en`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { postcode?: string };
    const raw = (data.postcode ?? "").trim();
    const digits = raw.replace(/\D/g, "").slice(0, 5);
    return digits.length === 5 ? digits : null;
  } catch {
    return null;
  }
}

function clearSalesRepsFieldError(
  zipInput: HTMLInputElement,
  inlineEl: HTMLElement | null,
  inputWrap: HTMLElement | null,
): void {
  if (inlineEl) {
    inlineEl.textContent = "";
    inlineEl.hidden = true;
    inlineEl.setAttribute("hidden", "");
  }
  zipInput.removeAttribute("aria-invalid");
  inputWrap?.classList.remove("is-invalid");
}

function showSalesRepsFieldError(
  zipInput: HTMLInputElement,
  inlineEl: HTMLElement | null,
  inputWrap: HTMLElement | null,
  text: string,
): void {
  if (!inlineEl) return;
  inlineEl.textContent = text;
  inlineEl.hidden = false;
  inlineEl.removeAttribute("hidden");
  zipInput.setAttribute("aria-invalid", "true");
  inputWrap?.classList.add("is-invalid");
}

function showSalesRepsToast(host: HTMLElement | null, text: string): void {
  showPageErrorToast(host, text);
}

function compareByName(a: SalesRepRow, b: SalesRepRow, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  const va = (a.name || "").toLocaleLowerCase();
  const vb = (b.name || "").toLocaleLowerCase();
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

function sortedReps(reps: SalesRepRow[]): SalesRepRow[] {
  return [...reps].sort((a, b) => compareByName(a, b, sortDir));
}

function syncSortHeaderUi(): void {
  const th = document.getElementById("sr-th-name");
  const btnAsc = document.getElementById("sr-sort-name-asc");
  const btnDesc = document.getElementById("sr-sort-name-desc");
  if (!th || !btnAsc || !btnDesc) return;

  if (cachedReps.length === 0) {
    th.setAttribute("aria-sort", "none");
    th.classList.remove("is-sorted-asc", "is-sorted-desc");
    th.removeAttribute("data-sort-dir");
    btnAsc.classList.remove("is-active");
    btnDesc.classList.remove("is-active");
    return;
  }

  th.classList.remove("is-sorted-asc", "is-sorted-desc");
  btnAsc.classList.remove("is-active");
  btnDesc.classList.remove("is-active");

  if (sortDir === "asc") {
    th.classList.add("is-sorted-asc");
    th.setAttribute("aria-sort", "ascending");
    th.setAttribute("data-sort-dir", "asc");
    btnAsc.classList.add("is-active");
  } else {
    th.classList.add("is-sorted-desc");
    th.setAttribute("aria-sort", "descending");
    th.setAttribute("data-sort-dir", "desc");
    btnDesc.classList.add("is-active");
  }
}

function renderRows(tbody: HTMLElement, reps: SalesRepRow[]): void {
  tbody.replaceChildren();
  if (reps.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "sr-page__row-empty";
    const td = document.createElement("td");
    td.colSpan = COL_SPAN;
    td.textContent = "No representatives found for this ZIP code.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    syncSortHeaderUi();
    return;
  }

  const rows = sortedReps(reps);
  for (const r of rows) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = r.name || "—";

    const phoneTd = document.createElement("td");
    if (r.phone) {
      const a = document.createElement("a");
      a.href = telHref(r.phone);
      a.className = "sr-page__link";
      a.textContent = r.phone;
      phoneTd.appendChild(a);
    } else {
      phoneTd.textContent = "—";
    }

    const emailTd = document.createElement("td");
    if (r.email) {
      const a = document.createElement("a");
      a.href = `mailto:${r.email}`;
      a.className = "sr-page__link";
      a.textContent = r.email;
      emailTd.appendChild(a);
    } else {
      emailTd.textContent = "—";
    }

    tr.appendChild(nameTd);
    tr.appendChild(phoneTd);
    tr.appendChild(emailTd);
    tbody.appendChild(tr);
  }
  syncSortHeaderUi();
}

function renderStatusRow(tbody: HTMLElement, text: string): void {
  tbody.replaceChildren();
  const tr = document.createElement("tr");
  tr.className = "sr-page__row-empty";
  const td = document.createElement("td");
  td.colSpan = COL_SPAN;
  td.textContent = text;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function bindNameSortHandlers(tbody: HTMLTableSectionElement): void {
  const btnAsc = document.getElementById("sr-sort-name-asc");
  const btnDesc = document.getElementById("sr-sort-name-desc");
  if (!btnAsc || !btnDesc) return;

  const applyAsc = (): void => {
    if (cachedReps.length === 0) return;
    sortDir = "asc";
    renderRows(tbody, cachedReps);
  };
  const applyDesc = (): void => {
    if (cachedReps.length === 0) return;
    sortDir = "desc";
    renderRows(tbody, cachedReps);
  };

  btnAsc.addEventListener("click", (e) => {
    e.stopPropagation();
    applyAsc();
  });
  btnDesc.addEventListener("click", (e) => {
    e.stopPropagation();
    applyDesc();
  });

  const onKey = (e: KeyboardEvent, fn: () => void): void => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    fn();
  };
  btnAsc.addEventListener("keydown", (e) => onKey(e, applyAsc));
  btnDesc.addEventListener("keydown", (e) => onKey(e, applyDesc));
}

export function initSalesRepresentativesPage(): void {
  const form = document.getElementById(
    "sr-search-form",
  ) as HTMLFormElement | null;
  const zipInput = document.getElementById(
    "sr-zip-input",
  ) as HTMLInputElement | null;
  const tbody = document.getElementById(
    "sr-table-body",
  ) as HTMLTableSectionElement | null;
  const msgEl = document.getElementById("sr-message");
  const inlineErrorEl = document.getElementById("sr-search-inline-error");
  const resultsSection = document.getElementById("sr-results");
  const resultsLoader = document.getElementById("sr-results-loader");
  const tableWrap = document.getElementById("sr-table-wrap");
  const submitBtn = form?.querySelector<HTMLButtonElement>("[data-sr-search-submit]");
  const geolocateBtn = form?.querySelector<HTMLButtonElement>("[data-sr-geolocate]");
  const zipClearBtn = form?.querySelector<HTMLButtonElement>("[data-sr-zip-clear]");

  if (!form || !zipInput || !tbody) return;

  const zipField = zipInput;
  const inputWrap = zipField.closest<HTMLElement>(".sr-page__input-wrap");

  function syncSrZipAccessoryButtons(): void {
    const has = zipField.value.trim().length > 0;
    if (geolocateBtn) geolocateBtn.hidden = has;
    if (zipClearBtn) zipClearBtn.hidden = !has;
  }
  let searchInFlight = false;

  installPageErrorToast(msgEl);

  const setResultsVisible = (visible: boolean): void => {
    if (!resultsSection) return;
    resultsSection.hidden = !visible;
    if (visible) resultsSection.removeAttribute("hidden");
    else resultsSection.setAttribute("hidden", "");
  };

  const setResultsLoading = (loading: boolean): void => {
    if (resultsLoader) {
      resultsLoader.hidden = !loading;
      if (loading) resultsLoader.removeAttribute("hidden");
      else resultsLoader.setAttribute("hidden", "");
    }
    if (tableWrap) {
      tableWrap.hidden = loading;
      if (loading) tableWrap.setAttribute("hidden", "");
      else tableWrap.removeAttribute("hidden");
    }
  };

  const setRequestLocked = (locked: boolean): void => {
    searchInFlight = locked;
    submitBtn?.toggleAttribute("disabled", locked);
    geolocateBtn?.toggleAttribute("disabled", locked);
    zipClearBtn?.toggleAttribute("disabled", locked);
    form.toggleAttribute("aria-busy", locked);
  };

  setResultsVisible(false);
  bindNameSortHandlers(tbody);

  zipField.addEventListener("input", () => {
    hidePageErrorToast(msgEl);
    clearSalesRepsFieldError(zipField, inlineErrorEl, inputWrap);
    syncSrZipAccessoryButtons();
  });

  const performSearch = async (zip: string): Promise<void> => {
    hidePageErrorToast(msgEl);
    clearSalesRepsFieldError(zipField, inlineErrorEl, inputWrap);

    setResultsVisible(true);
    setResultsLoading(true);
    cachedReps = [];
    syncSortHeaderUi();
    tbody.replaceChildren();

    try {
      const res = await fetch(`/api/sales-reps?zip=${encodeURIComponent(zip)}`);
      const data = (await res.json()) as SalesRepsApiResponse;

      if (!res.ok || data.error) {
        const err = data.error ?? "Could not load representatives.";
        if (isSalesRepsFieldValidationError(err)) {
          showSalesRepsFieldError(zipField, inlineErrorEl, inputWrap, err);
        } else {
          showSalesRepsToast(msgEl, err);
        }
        renderStatusRow(tbody, "Could not load representatives.");
        return;
      }

      const reps = Array.isArray(data.reps) ? data.reps : [];
      sortDir = "asc";
      cachedReps = reps.map((r) => ({
        name: r.name ?? "",
        phone: r.phone ?? "",
        email: r.email ?? null,
      }));
      renderRows(tbody, cachedReps);
      clearSalesRepsFieldError(zipField, inlineErrorEl, inputWrap);
    } catch (err) {
      showSalesRepsToast(
        msgEl,
        err instanceof Error ? err.message : String(err),
      );
      renderStatusRow(tbody, "Could not load representatives.");
    }
    finally {
      setResultsLoading(false);
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (searchInFlight) return;
    const zip = zipField.value.trim().replace(/\s+/g, "");
    if (!zip) {
      showSalesRepsFieldError(
        zipField,
        inlineErrorEl,
        inputWrap,
        "Please enter a ZIP code.",
      );
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      showSalesRepsFieldError(
        zipField,
        inlineErrorEl,
        inputWrap,
        "Enter a valid U.S. ZIP code (5 digits, optionally ZIP+4).",
      );
      return;
    }
    setRequestLocked(true);
    try {
      await performSearch(zip);
    } finally {
      setRequestLocked(false);
    }
  });

  geolocateBtn?.addEventListener("click", () => {
    void (async () => {
      if (searchInFlight) return;
      if (!navigator.geolocation) {
        showSalesRepsToast(msgEl, "Geolocation is not supported in this browser.");
        return;
      }
      setRequestLocked(true);
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 120000,
          });
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const zip = await reverseGeocodeToZip(lat, lng);
        if (!zip) {
          showSalesRepsToast(
            msgEl,
            "Could not determine a U.S. ZIP code from your location.",
          );
          return;
        }
        zipField.value = zip;
        syncSrZipAccessoryButtons();
        await performSearch(zip);
      } catch (err) {
        const denied =
          err instanceof GeolocationPositionError &&
          err.code === err.PERMISSION_DENIED;
        showSalesRepsToast(
          msgEl,
          denied
            ? "Location access was denied. Allow location for this site in browser settings."
            : "Could not get your location. Try entering a ZIP code.",
        );
      } finally {
        setRequestLocked(false);
      }
    })();
  });

  zipClearBtn?.addEventListener("click", () => {
    zipField.value = "";
    hidePageErrorToast(msgEl);
    clearSalesRepsFieldError(zipField, inlineErrorEl, inputWrap);
    syncSrZipAccessoryButtons();
    zipField.focus();
  });

  syncSrZipAccessoryButtons();
}
