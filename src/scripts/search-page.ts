export {};

const titleEl = document.getElementById(
  "search-results-title",
) as HTMLHeadingElement | null;
const summaryEl = document.getElementById(
  "search-results-summary",
) as HTMLParagraphElement | null;
const listEl = document.getElementById("search-results-list") as HTMLUListElement | null;
const emptyEl = document.getElementById(
  "search-results-empty",
) as HTMLParagraphElement | null;
const errorEl = document.getElementById(
  "search-results-error",
) as HTMLParagraphElement | null;
const params = new URLSearchParams(window.location.search);
const query = (params.get("q") ?? "").trim();

type SearchApiItem = {
  title?: string;
  slug?: string;
};

type SearchApiPayload = {
  total?: number;
  items?: SearchApiItem[];
  error?: string;
};

function resetState() {
  if (listEl) listEl.innerHTML = "";
  if (emptyEl) emptyEl.hidden = true;
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }
}

function setError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function setSummary(text: string) {
  if (summaryEl) summaryEl.textContent = text;
}

function setTitle(text: string) {
  if (titleEl) titleEl.textContent = text;
}

async function runSearch() {
  resetState();
  if (!query) {
    setTitle("Search");
    setSummary("Enter a query to search.");
    return;
  }

  setTitle(`Results for "${query}"`);
  setSummary("Loading...");
  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&limit=20&offset=0`,
    );
    const payload = (await res.json()) as SearchApiPayload;
    if (!res.ok) {
      throw new Error(payload.error || "Search request failed.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    const total = Number(payload.total ?? items.length);
    setSummary(`${total} result${total === 1 ? "" : "s"}`);

    if (items.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (!listEl) return;
    for (const item of items) {
      if (!item?.slug || !item.title) continue;
      const li = document.createElement("li");
      li.className = "search-results-page__item";
      const link = document.createElement("a");
      link.className = "search-results-page__link";
      link.href = `/product/${item.slug}/`;
      link.textContent = item.title;
      li.appendChild(link);
      listEl.appendChild(li);
    }
  } catch (e) {
    setSummary("");
    setError(e instanceof Error ? e.message : String(e));
  }
}

void runSearch();
