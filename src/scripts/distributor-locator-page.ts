import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export {};

type RawLocation = Record<string, unknown>;

type DistributorLocation = {
  id: number;
  customerName: string;
  locationName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
};

type ApiResponse = {
  locations?: RawLocation[];
  error?: string;
};

type GeocodeZipResponse = {
  lat: number | null;
  lng: number | null;
  error?: string;
  configured?: boolean;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeLocation(raw: RawLocation): DistributorLocation | null {
  const lat = num(raw.Latitude);
  const lng = num(raw.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: 0,
    customerName:
      str(raw.CustomerName) || str(raw.LocationName) || "Distributor",
    locationName: str(raw.LocationName),
    address1: str(raw.Address1),
    address2: str(raw.Address2),
    city: str(raw.City),
    state: str(raw.State),
    zip: str(raw.Zip),
    phone: str(raw.Phone),
    email: str(raw.Email),
    lat,
    lng,
  };
}

function formatAddress(loc: DistributorLocation): string {
  const parts = [
    [loc.address1, loc.address2].filter(Boolean).join(" "),
    [loc.city, loc.state, loc.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  return parts.join(" · ") || "Address on file";
}

function haversineMi(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function zipCenterFromGoogle(zip: string): Promise<{
  lat: number;
  lng: number;
} | null> {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  try {
    const res = await fetch(
      `/api/geocode-zip?${new URLSearchParams({ zip }).toString()}`,
    );
    const data = (await res.json()) as GeocodeZipResponse;
    if (
      typeof data.lat === "number" &&
      typeof data.lng === "number" &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng)
    ) {
      return { lat: data.lat, lng: data.lng };
    }
  } catch {
    /* fallback */
  }
  return null;
}

async function zipCenterZippopotam(zip: string): Promise<{
  lat: number;
  lng: number;
} | null> {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{ latitude?: string; longitude?: string }>;
    };
    const p = data.places?.[0];
    if (!p) return null;
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function zipCenterUs(
  zip: string,
): Promise<{ lat: number; lng: number } | null> {
  return (await zipCenterFromGoogle(zip)) ?? (await zipCenterZippopotam(zip));
}

function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

function telHref(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d ? `tel:${d}` : "#";
}

function readRadiusMiles(form: HTMLFormElement): number {
  const checked = form.querySelector<HTMLInputElement>(
    'input[name="dl-radius"]:checked',
  );
  const v = checked?.value ?? "10";
  if (v === "any") return 5000;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 10;
}

function businessTypeValue(sel: HTMLSelectElement): string {
  const v = sel.value;
  return v === "Pool" || v === "Spa" || v === "All" ? v : "All";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAPS_AUTH_HELP =
  "Google Maps could not authorize this page. Open the browser console (F12) for the exact error " +
  "(e.g. RefererNotAllowedMapError). For your Browser API key: add HTTP referrer " +
  "`" +
  (typeof location !== "undefined"
    ? `${location.origin}/*`
    : "https://your-domain.com/*") +
  "`" +
  " in Google Cloud Console, enable Maps JavaScript API for the project, and ensure billing is on.";

/** Teal pin (approx. previous Leaflet div icon). */
function markerIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="#1a6b6b" stroke="#fff" stroke-width="2" d="M14 2C8 2 3 7 3 13c0 8 11 21 11 21s11-13 11-21c0-6-5-11-11-11z"/><circle cx="14" cy="13" r="4" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function init(): void {
  const root = document.querySelector<HTMLElement>("[data-dl-locator]");
  const form = document.getElementById(
    "dl-locator-form",
  ) as HTMLFormElement | null;
  const zipInput = document.getElementById(
    "dl-zip-input",
  ) as HTMLInputElement | null;
  const list = document.getElementById(
    "dl-results-list",
  ) as HTMLUListElement | null;
  const mapEl = document.getElementById("dl-map") as HTMLElement | null;
  const msg = document.getElementById("dl-locator-message");
  const businessSel = document.getElementById(
    "dl-business-type",
  ) as HTMLSelectElement | null;

  if (!root || !form || !zipInput || !list || !mapEl || !businessSel) return;

  const dlForm = form;
  const dlZipInput = zipInput;
  const dlList = list;
  const dlMapEl = mapEl;
  const dlBusinessSel = businessSel;

  const mapsKey = (root.dataset.dlMapsKey ?? "").trim();
  const mapPlaceholder = document.getElementById("dl-map-placeholder");

  let map: google.maps.Map | null = null;
  let mapReady = false;
  let markerById = new Map<number, google.maps.Marker>();
  let infoWindow: google.maps.InfoWindow | null = null;
  let markerIcon: google.maps.Icon | null = null;

  function getMarkerIcon(): google.maps.Icon {
    if (!markerIcon) {
      markerIcon = {
        url: markerIconUrl(),
        scaledSize: new google.maps.Size(28, 36),
        anchor: new google.maps.Point(14, 34),
      };
    }
    return markerIcon;
  }

  function setMessage(text: string, visible: boolean): void {
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = !visible;
  }

  function installMapsAuthFailureHandler(): void {
    (window as Window & { gm_authFailure?: () => void }).gm_authFailure =
      () => {
        setMessage(MAPS_AUTH_HELP, true);
      };
  }

  async function ensureMap(): Promise<google.maps.Map> {
    if (map) return map;
    if (!mapsKey) {
      throw new Error(
        "Map is not configured: PUBLIC_GOOGLE_MAPS_BROWSER_KEY must be present at build time (see site setup).",
      );
    }
    try {
      setOptions({ key: mapsKey, v: "weekly" });
      await importLibrary("maps");
    } catch (loadErr) {
      throw new Error(
        `Could not load the Google Maps script. Check PUBLIC_GOOGLE_MAPS_BROWSER_KEY and the network. ${
          loadErr instanceof Error ? loadErr.message : String(loadErr)
        }`,
      );
    }
    map = new google.maps.Map(dlMapEl, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    infoWindow = new google.maps.InfoWindow();
    markerIcon = null;
    mapReady = true;
    mapPlaceholder?.setAttribute("hidden", "");
    requestAnimationFrame(() => google.maps.event.trigger(map!, "resize"));
    return map;
  }

  function clearResults(): void {
    dlList.replaceChildren();
    markerById.forEach((m) => m.setMap(null));
    markerById = new Map();
    infoWindow?.close();
  }

  function shortPopupHtml(loc: DistributorLocation): string {
    const title = escapeHtml(loc.customerName);
    const addr = escapeHtml(formatAddress(loc));
    const phoneLine =
      loc.phone !== ""
        ? `<a class="dl-page__map-popup-link" href="${escapeHtml(telHref(loc.phone))}">${escapeHtml(loc.phone)}</a>`
        : "—";
    return `<div class="dl-page__map-popup"><strong class="dl-page__map-popup-title">${title}</strong><p class="dl-page__map-popup-addr">${addr}</p><p class="dl-page__map-popup-phone">${phoneLine}</p></div>`;
  }

  function activateLocation(loc: DistributorLocation): void {
    dlList.querySelectorAll(".dl-page__result-card").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const on = el.dataset.dlLocId === String(loc.id);
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    const m = markerById.get(loc.id);
    if (m && map && infoWindow) {
      map.panTo(m.getPosition()!);
      const z = map.getZoom() ?? 4;
      if (z < 11) map.setZoom(11);
      infoWindow.setContent(shortPopupHtml(loc));
      infoWindow.open({ map, anchor: m });
    }
  }

  function renderCard(
    loc: DistributorLocation,
    miles: number | null,
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "dl-page__result-card";
    li.tabIndex = 0;
    li.dataset.dlLocId = String(loc.id);
    li.setAttribute("aria-selected", "false");

    const head = document.createElement("div");
    head.className = "dl-page__result-card-head";
    const name = document.createElement("span");
    name.className = "dl-page__result-card-name";
    name.textContent = loc.customerName;
    head.appendChild(name);
    if (miles != null) {
      const dist = document.createElement("span");
      dist.className = "dl-page__result-card-dist";
      dist.textContent = `${miles.toFixed(1)} miles`;
      head.appendChild(dist);
    }
    li.appendChild(head);

    const addrRow = document.createElement("div");
    addrRow.className = "dl-page__result-card-addr-row";
    const pin = document.createElement("span");
    pin.className = "dl-page__result-card-pin";
    pin.setAttribute("aria-hidden", "true");
    pin.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-8-4.35-8-11a8 8 0 0 1 16 0c0 6.65-8 11-8 11z"/><circle cx="12" cy="10" r="3"/></svg>';
    const addrText = document.createElement("span");
    addrText.className = "dl-page__result-card-addr";
    addrText.textContent = formatAddress(loc);
    const dir = document.createElement("a");
    dir.className = "dl-page__result-card-dir";
    dir.href = mapsDirectionsUrl(loc.lat, loc.lng);
    dir.target = "_blank";
    dir.rel = "noopener noreferrer";
    dir.textContent = "Get direction";
    addrRow.appendChild(pin);
    addrRow.appendChild(addrText);
    addrRow.appendChild(dir);
    li.appendChild(addrRow);

    const foot = document.createElement("div");
    foot.className = "dl-page__result-card-foot";
    const biz = dlBusinessSel.value === "Spa" ? "Spa" : "Pool";
    foot.appendChild(document.createTextNode(`${biz} • `));
    if (loc.phone) {
      const a = document.createElement("a");
      a.href = telHref(loc.phone);
      a.className = "dl-page__result-card-phone";
      a.textContent = loc.phone;
      foot.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.className = "dl-page__result-card-phone is-muted";
      span.textContent = "Call dealer";
      foot.appendChild(span);
    }
    li.appendChild(foot);

    li.addEventListener("click", () => activateLocation(loc));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateLocation(loc);
      }
    });

    return li;
  }

  async function runSearch(): Promise<void> {
    const zip = dlZipInput.value.trim().replace(/\s+/g, "");
    setMessage("", false);

    if (!zip) {
      setMessage("Please enter a ZIP code.", true);
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      setMessage("Enter a valid U.S. ZIP code (5 digits or ZIP+4).", true);
      return;
    }

    const distance = readRadiusMiles(dlForm);
    const businessType = businessTypeValue(dlBusinessSel);
    const params = new URLSearchParams({
      zip,
      country: "US",
      distance: String(distance),
      unit: "mi",
      businessType,
    });

    clearResults();
    setMessage("Loading…", true);

    try {
      const mapInstance = await ensureMap();

      const [center, res] = await Promise.all([
        zipCenterUs(zip),
        fetch(`/api/distributor-locations?${params.toString()}`),
      ]);
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || data.error) {
        setMessage(data.error ?? "Could not load locations.", true);
        return;
      }

      const rawList = Array.isArray(data.locations) ? data.locations : [];
      const locs: DistributorLocation[] = [];
      rawList.forEach((raw) => {
        const n = normalizeLocation(raw);
        if (n) locs.push({ ...n, id: locs.length });
      });
      setMessage("", false);

      if (locs.length === 0) {
        const empty = document.createElement("li");
        empty.className = "dl-page__result-empty";
        empty.textContent = "No locations found in this area.";
        dlList.appendChild(empty);
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      for (const loc of locs) {
        const miles =
          center != null
            ? haversineMi(center.lat, center.lng, loc.lat, loc.lng)
            : null;
        dlList.appendChild(renderCard(loc, miles));

        const marker = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map: mapInstance,
          title: loc.customerName,
          icon: getMarkerIcon(),
        });
        marker.addListener("click", () => activateLocation(loc));
        markerById.set(loc.id, marker);
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      }

      if (locs.length === 1) {
        mapInstance.setCenter({ lat: locs[0]!.lat, lng: locs[0]!.lng });
        mapInstance.setZoom(12);
      } else {
        mapInstance.fitBounds(bounds, 48);
      }
      google.maps.event.trigger(mapInstance, "resize");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err), true);
    }
  }

  dlForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void runSearch();
  });

  window.addEventListener("resize", () => {
    if (mapReady && map) google.maps.event.trigger(map, "resize");
  });

  const prompt = document.createElement("li");
  prompt.className = "dl-page__result-prompt";
  prompt.setAttribute("role", "status");
  prompt.textContent =
    "Enter a U.S. ZIP code, adjust radius or category if you like, then click Search to see distributors on the list and map.";
  dlList.appendChild(prompt);

  if (!mapsKey) {
    setMessage(
      "Map unavailable: PUBLIC_GOOGLE_MAPS_BROWSER_KEY was empty when this site was built. " +
        "Local: add it to .env and restart npm run dev. " +
        "Production/stage/dev: this project builds on GitHub Actions — add repository secret PUBLIC_GOOGLE_MAPS_BROWSER_KEY (Settings → Secrets and variables → Actions) and redeploy via workflow.",
      true,
    );
    return;
  }

  installMapsAuthFailureHandler();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
