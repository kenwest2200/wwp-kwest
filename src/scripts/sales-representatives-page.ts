export {};

type SalesRepRow = {
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
};

type SalesRepsApiResponse = {
  reps?: SalesRepRow[];
  error?: string;
};

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "#";
  return `tel:${digits}`;
}

function setMessage(el: HTMLElement | null, text: string, visible: boolean): void {
  if (!el) return;
  el.textContent = text;
  el.hidden = !visible;
}

function renderRows(tbody: HTMLElement, reps: SalesRepRow[]): void {
  tbody.replaceChildren();
  if (reps.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "sr-page__row-empty";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No representatives found for this ZIP code.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const r of reps) {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = r.name || "—";

    const locTd = document.createElement("td");
    locTd.textContent = r.location?.trim() ? r.location : "—";

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
    tr.appendChild(locTd);
    tr.appendChild(phoneTd);
    tr.appendChild(emailTd);
    tbody.appendChild(tr);
  }
}

function initialPlaceholderRow(tbody: HTMLElement): void {
  tbody.replaceChildren();
  const tr = document.createElement("tr");
  tr.className = "sr-page__row-empty";
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = "Enter a ZIP code and select Search to see representatives.";
  tr.appendChild(td);
  tbody.appendChild(tr);
}

export function initSalesRepresentativesPage(): void {
  const form = document.getElementById("sr-search-form") as HTMLFormElement | null;
  const zipInput = document.getElementById("sr-zip-input") as HTMLInputElement | null;
  const tbody = document.getElementById("sr-table-body") as HTMLTableSectionElement | null;
  const msgEl = document.getElementById("sr-message");
  const submitBtn = form?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );

  if (!form || !zipInput || !tbody) return;

  initialPlaceholderRow(tbody);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zip = zipInput.value.trim().replace(/\s+/g, "");
    setMessage(msgEl, "", false);

    if (!zip) {
      setMessage(msgEl, "Please enter a ZIP code.", true);
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      setMessage(
        msgEl,
        "Enter a valid U.S. ZIP code (5 digits, optionally ZIP+4).",
        true,
      );
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    tbody.replaceChildren();
    const loadingTr = document.createElement("tr");
    loadingTr.className = "sr-page__row-empty";
    const loadingTd = document.createElement("td");
    loadingTd.colSpan = 4;
    loadingTd.textContent = "Loading…";
    loadingTr.appendChild(loadingTd);
    tbody.appendChild(loadingTr);

    try {
      const res = await fetch(
        `/api/sales-reps?zip=${encodeURIComponent(zip)}`,
      );
      const data = (await res.json()) as SalesRepsApiResponse;

      if (!res.ok || data.error) {
        const err = data.error ?? "Could not load representatives.";
        setMessage(msgEl, err, true);
        initialPlaceholderRow(tbody);
        return;
      }

      const reps = Array.isArray(data.reps) ? data.reps : [];
      renderRows(tbody, reps);
    } catch (err) {
      setMessage(
        msgEl,
        err instanceof Error ? err.message : String(err),
        true,
      );
      initialPlaceholderRow(tbody);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
