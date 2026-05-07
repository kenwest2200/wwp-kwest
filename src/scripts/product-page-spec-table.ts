export {};

const SPEC_ROOT = ".product-page__spec";
const SORTABLE_CELL_CLASS = "product-page__spec-colhead--sortable";
const BTN_GROUP_CLASS = "product-page__spec-sort-btns";
const BTN_CLASS = "product-page__spec-sort-btn";

const svgChevronUp = `<svg class="product-page__spec-sort-svg" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="product-page__spec-sort-path" d="M1.5 6.5L6 2L10.5 6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const svgChevronDown = `<svg class="product-page__spec-sort-svg" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="product-page__spec-sort-path" d="M1.5 2L6 6.5L10.5 2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function getHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
  if (table.tHead?.rows[0]) return table.tHead.rows[0];
  return table.rows[0] ?? null;
}

function getTbody(table: HTMLTableElement): HTMLTableSectionElement | null {
  if (table.tBodies.length > 0) return table.tBodies[0]!;
  return null;
}

function getDataRows(
  table: HTMLTableElement,
  headerRow: HTMLTableRowElement,
): HTMLTableRowElement[] {
  const tbody = getTbody(table);
  if (!tbody) return [];
  if (table.tHead) {
    return [...tbody.rows];
  }
  return [...tbody.rows].filter((r) => r !== headerRow);
}

function compareValues(aRaw: string, bRaw: string, dir: 1 | -1): number {
  const a = aRaw.replace(/\u00a0/g, " ").trim();
  const b = bRaw.replace(/\u00a0/g, " ").trim();

  const parseNum = (s: string): number | null => {
    const normalized = s
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, "")
      .replace(/[^\d.,\-/]/g, " ")
      .trim();
    if (!normalized) return null;
    const first = normalized.split(/\s+/)[0] ?? "";
    if (!first) return null;
    const n = Number.parseFloat(first.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const na = parseNum(a);
  const nb = parseNum(b);
  if (na != null && nb != null && na !== nb) return (na - nb) * dir;

  return (
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) * dir
  );
}

function initSpecTable(table: HTMLTableElement) {
  if (table.dataset.specSortInit === "1") return;
  const headerRow = getHeaderRow(table);
  const tbody = getTbody(table);
  if (!headerRow || !tbody) return;

  const dataRows = getDataRows(table, headerRow);
  const canSort = dataRows.length > 1;

  const headerCells = [...headerRow.cells] as HTMLTableCellElement[];
  if (headerCells.length === 0) return;

  table.dataset.specSortInit = "1";
  table.classList.add("product-page__spec-table");
  if (!table.tHead) {
    table.classList.add("product-page__spec-table--no-thead");
  }

  const sortPairs: { asc: HTMLButtonElement; desc: HTMLButtonElement }[] = [];

  headerCells.forEach((cell, colIndex) => {
    cell.classList.add(SORTABLE_CELL_CLASS);

    const colTitle = cell.textContent?.trim() || `Column ${colIndex + 1}`;

    const group = document.createElement("span");
    group.className = BTN_GROUP_CLASS;
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `Sort by: ${colTitle}`);

    const btnAsc = document.createElement("button");
    btnAsc.type = "button";
    btnAsc.className = `${BTN_CLASS} ${BTN_CLASS}--asc`;
    btnAsc.setAttribute("aria-label", `Sort by ascending: ${colTitle}`);
    btnAsc.setAttribute("title", "Sort by ascending");
    btnAsc.innerHTML = svgChevronUp;

    const btnDesc = document.createElement("button");
    btnDesc.type = "button";
    btnDesc.className = `${BTN_CLASS} ${BTN_CLASS}--desc`;
    btnDesc.setAttribute("aria-label", `Sort by descending: ${colTitle}`);
    btnDesc.setAttribute("title", "Sort by descending");
    btnDesc.innerHTML = svgChevronDown;

    if (!canSort) {
      btnAsc.disabled = true;
      btnDesc.disabled = true;
      btnAsc.classList.add("is-disabled");
      btnDesc.classList.add("is-disabled");
      btnAsc.setAttribute("aria-disabled", "true");
      btnDesc.setAttribute("aria-disabled", "true");
      btnAsc.setAttribute("title", "Not enough rows to sort");
      btnDesc.setAttribute("title", "Not enough rows to sort");
    }

    group.appendChild(btnAsc);
    group.appendChild(btnDesc);
    cell.appendChild(group);
    sortPairs.push({ asc: btnAsc, desc: btnDesc });

    cell.setAttribute("aria-sort", "none");

    const applySort = (nextDir: "asc" | "desc") => {
      if (!canSort) return;
      headerCells.forEach((c, i) => {
        c.removeAttribute("data-sort-dir");
        c.classList.remove("is-sorted-asc", "is-sorted-desc");
        c.setAttribute("aria-sort", "none");
        const p = sortPairs[i];
        if (p) {
          p.asc.classList.remove("is-active");
          p.desc.classList.remove("is-active");
        }
      });

      cell.setAttribute("data-sort-dir", nextDir);
      cell.classList.add(
        nextDir === "asc" ? "is-sorted-asc" : "is-sorted-desc",
      );
      if (nextDir === "asc") {
        btnAsc.classList.add("is-active");
      } else {
        btnDesc.classList.add("is-active");
      }
      cell.setAttribute(
        "aria-sort",
        nextDir === "asc" ? "ascending" : "descending",
      );

      const dir: 1 | -1 = nextDir === "asc" ? 1 : -1;
      const rows = [...dataRows];
      rows.sort((rowA, rowB) => {
        const a = rowA.cells[colIndex]?.textContent ?? "";
        const b = rowB.cells[colIndex]?.textContent ?? "";
        return compareValues(a, b, dir);
      });
      for (const row of rows) {
        tbody.appendChild(row);
      }
    };

    const onKeyActivate = (e: KeyboardEvent, dir: "asc" | "desc") => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      applySort(dir);
    };

    if (canSort) {
      btnAsc.addEventListener("click", (e) => {
        e.stopPropagation();
        applySort("asc");
      });
      btnAsc.addEventListener("keydown", (e) => onKeyActivate(e, "asc"));

      btnDesc.addEventListener("click", (e) => {
        e.stopPropagation();
        applySort("desc");
      });
      btnDesc.addEventListener("keydown", (e) => onKeyActivate(e, "desc"));
    }
  });
}

function scan() {
  document.querySelectorAll<HTMLDivElement>(SPEC_ROOT).forEach((root) => {
    root.querySelectorAll<HTMLTableElement>("table").forEach(initSpecTable);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scan);
} else {
  scan();
}
