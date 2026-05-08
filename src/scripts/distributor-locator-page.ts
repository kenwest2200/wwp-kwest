import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  hidePageErrorToast,
  installPageErrorToast,
  showPageErrorToast,
} from "../lib/page-error-toast";

export {};

/**
 * Distributor locator map: `false` = Leaflet / OpenStreetMap only (current default).
 * Set to `true` here **or** `PUBLIC_DISTRIBUTOR_LOCATOR_USE_GOOGLE_MAPS=true` in `.env` to try Google Maps when a browser key exists.
 */
const DL_MAP_PREFER_GOOGLE = false;
const DISTRIBUTOR_LOCATOR_USE_GOOGLE_MAP =
  DL_MAP_PREFER_GOOGLE ||
  import.meta.env.PUBLIC_DISTRIBUTOR_LOCATOR_USE_GOOGLE_MAPS === "true";

type RawLocation = Record<string, unknown>;
const DISTRIBUTOR_LOCATOR_MAX_DISTANCE_MI = 149;

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
  searchCenter?: { lat: number; lng: number };
};

/** Worker `geocodeUsLocationQuery` ZIP / query errors — show inline under the field, not as toast. */
function distributorLocationsZipUserErrorVariant(
  message: string,
): "error-inline" | "error-toast" {
  const m = message
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'");
  if (
    m ===
      "That didn't resolve to a U.S. ZIP. Enter a valid 5-digit ZIP code." ||
    m ===
      "Could not match that to a U.S. ZIP. Enter a valid 5-digit ZIP code." ||
    m === "No match for that ZIP. Check the 5-digit code and try again." ||
    m ===
      "That search is too broad. Enter a U.S. ZIP code (5 digits or ZIP+4)."
  ) {
    return "error-inline";
  }
  return "error-toast";
}

type GeocodeZipResponse = {
  lat: number | null;
  lng: number | null;
  error?: string;
  configured?: boolean;
};

type MapState =
  | {
      kind: "google";
      map: google.maps.Map;
      markers: Map<number, google.maps.Marker>;
      infoWindow: google.maps.InfoWindow;
      markerIcon: google.maps.Icon;
    }
  | {
      kind: "leaflet";
      map: L.Map;
      markers: Map<number, L.Marker>;
      markerIcon: L.Icon;
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

/** Client-side reverse geocode (no API key). */
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

function userGoogleLocationIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="#1a6b6b" stroke="#fff" stroke-width="2"/></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return {
    url,
    scaledSize: new google.maps.Size(16, 16),
    anchor: new google.maps.Point(8, 8),
  };
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
  if (v === "any") return DISTRIBUTOR_LOCATOR_MAX_DISTANCE_MI;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(DISTRIBUTOR_LOCATOR_MAX_DISTANCE_MI, Math.max(1, n));
}

function businessTypeValue(sel: HTMLSelectElement): string {
  const v = sel.value;
  return v === "Pool" || v === "Spa" || v === "All" ? v : "All";
}

function setupBusinessTypeSelect(
  root: HTMLElement,
  selectEl: HTMLSelectElement,
  options?: { onPick?: () => void },
): void {
  const wrap = root.querySelector<HTMLElement>("[data-dl-business-root]");
  const trigger = root.querySelector<HTMLButtonElement>(
    "[data-dl-business-trigger]",
  );
  const valueEl = root.querySelector<HTMLElement>("[data-dl-business-value]");
  const menu = root.querySelector<HTMLElement>("[data-dl-business-menu]");
  if (!wrap || !trigger || !valueEl || !menu) return;

  const optionButtons = Array.from(
    menu.querySelectorAll<HTMLButtonElement>("[data-dl-business-option]"),
  );
  if (optionButtons.length === 0) return;

  const closeMenu = (): void => {
    wrap.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  };

  const openMenu = (): void => {
    wrap.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  };

  const setActiveValue = (value: string): void => {
    const normalized =
      value === "Pool" || value === "Spa" || value === "All" ? value : "All";
    selectEl.value = normalized;
    valueEl.textContent = normalized;
    optionButtons.forEach((btn) => {
      const isActive = btn.dataset.dlBusinessOption === normalized;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  setActiveValue(selectEl.value);

  trigger.addEventListener("click", () => {
    if (menu.hidden) {
      openMenu();
      return;
    }
    closeMenu();
  });

  optionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.dlBusinessOption ?? "All";
      const normalized =
        next === "Pool" || next === "Spa" || next === "All" ? next : "All";
      const prev = selectEl.value;
      setActiveValue(normalized);
      closeMenu();
      trigger.focus();
      if (prev !== selectEl.value) options?.onPick?.();
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!wrap.contains(target)) closeMenu();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Google Maps browser keys almost never list `http://localhost:4321/*` as an
 * allowed referrer, which spams RefererNotAllowedMapError. Use OSM on local
 * hosts unless the URL contains `?dlGoogleMaps=1` (after you add the referrer).
 */
function googleMapsBrowserKeyForThisHost(key: string): string {
  if (typeof location === "undefined") return key;
  const host = location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === "0.0.0.0";
  if (!isLocal) return key;
  try {
    if (new URLSearchParams(location.search).get("dlGoogleMaps") === "1")
      return key;
  } catch {
    /* ignore */
  }
  return "";
}

/** Teal pin (approx. previous Leaflet div icon). */
function markerIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="#1a6b6b" stroke="#fff" stroke-width="2" d="M14 2C8 2 3 7 3 13c0 8 11 21 11 21s11-13 11-21c0-6-5-11-11-11z"/><circle cx="14" cy="13" r="4" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildGoogleMarkerIcon(): google.maps.Icon {
  return {
    url: markerIconUrl(),
    scaledSize: new google.maps.Size(28, 36),
    anchor: new google.maps.Point(14, 34),
  };
}

function buildLeafletMarkerIcon(): L.Icon {
  return L.icon({
    iconUrl: markerIconUrl(),
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  });
}

/** Wait for first idle or auth failure (invalid key / referrer). */
function waitGoogleMapReadyOrAuthFail(
  gMap: google.maps.Map,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as Window & { gm_authFailure?: () => void };
    let settled = false;
    const prevGm = w.gm_authFailure;
    const settleAuth = (): void => {
      if (settled) return;
      settled = true;
      google.maps.event.removeListener(idleListener);
      w.gm_authFailure = prevGm;
      reject(new Error("GOOGLE_MAPS_AUTH"));
    };
    const settleOk = (): void => {
      if (settled) return;
      settled = true;
      w.gm_authFailure = prevGm;
      resolve();
    };
    w.gm_authFailure = () => {
      if (typeof prevGm === "function") prevGm();
      settleAuth();
    };
    const idleListener = google.maps.event.addListenerOnce(gMap, "idle", () =>
      settleOk(),
    );
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      google.maps.event.removeListener(idleListener);
      w.gm_authFailure = prevGm;
      resolve();
    }, timeoutMs);
  });
}

async function init(): Promise<void> {
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
  const mapWrap = document.getElementById("dl-map-wrap") as HTMLElement | null;
  const msg = document.getElementById(
    "dl-locator-message",
  ) as HTMLElement | null;
  const errorToast = document.getElementById("dl-locator-error-toast");
  const inlineErrorEl = document.getElementById("dl-search-inline-error");
  const businessSel = document.getElementById(
    "dl-business-type",
  ) as HTMLSelectElement | null;

  if (!root || !form || !zipInput || !list || !mapEl || !businessSel) return;

  installPageErrorToast(errorToast);

  const geoBtnEl = root.querySelector<HTMLButtonElement>("[data-dl-geolocate]");
  const zipClearBtn = root.querySelector<HTMLButtonElement>("[data-dl-zip-clear]");

  const dlForm = form;
  const dlZipInput = zipInput;
  const dlList = list;
  const dlMapEl = mapEl;
  const dlMapWrap = mapWrap;
  const dlBusinessSel = businessSel;

  let mapsKey = "";
  if (DISTRIBUTOR_LOCATOR_USE_GOOGLE_MAP) {
    mapsKey = (root.dataset.dlMapsKey ?? "").trim();
    if (!mapsKey) {
      try {
        const r = await fetch("/api/maps-browser-key");
        if (r.ok) {
          const j = (await r.json()) as { key?: string };
          mapsKey = (j.key ?? "").trim();
        }
      } catch {
        /* ignore */
      }
    }
    mapsKey = googleMapsBrowserKeyForThisHost(mapsKey);
  }
  const mapPlaceholder = document.getElementById("dl-map-placeholder");

  let mapState: MapState | null = null;
  let mapReady = false;
  let userLocMarker: google.maps.Marker | L.CircleMarker | null = null;
  /** Blocks duplicate ZIP/API searches until the current run finishes. */
  let locatorSearchInFlight = false;

  function syncDlZipAccessoryButtons(): void {
    const has = dlZipInput.value.trim().length > 0;
    if (geoBtnEl) geoBtnEl.hidden = has;
    if (zipClearBtn) zipClearBtn.hidden = !has;
  }

  function setLocatorSearchUiLocked(locked: boolean): void {
    if (!root) return;
    root
      .querySelector<HTMLButtonElement>("[data-dl-search-submit]")
      ?.toggleAttribute("disabled", locked);
    root
      .querySelector<HTMLButtonElement>("[data-dl-geolocate]")
      ?.toggleAttribute("disabled", locked);
    zipClearBtn?.toggleAttribute("disabled", locked);
    dlForm.toggleAttribute("aria-busy", locked);
  }

  function resetMapDom(): void {
    dlMapEl.replaceChildren();
  }

  function setZipFieldError(active: boolean): void {
    const wrap = dlZipInput.closest(".dl-page__locator-input-wrap");
    if (!wrap) return;
    wrap.classList.toggle("is-invalid", active);
    if (active) {
      dlZipInput.setAttribute("aria-invalid", "true");
    } else {
      dlZipInput.removeAttribute("aria-invalid");
    }
  }

  function clearZipInlineError(): void {
    if (!inlineErrorEl) return;
    inlineErrorEl.textContent = "";
    inlineErrorEl.hidden = true;
    inlineErrorEl.setAttribute("hidden", "");
    setZipFieldError(false);
  }

  function showZipInlineError(text: string): void {
    if (!inlineErrorEl) return;
    inlineErrorEl.textContent = text;
    inlineErrorEl.hidden = false;
    inlineErrorEl.removeAttribute("hidden");
    setZipFieldError(true);
  }

  type LocatorMessageVariant = "loading" | "error-toast";

  /** Handles loading state and toast-level errors (non-field errors). */
  function setMessage(
    text: string,
    visible: boolean,
    variant: LocatorMessageVariant = "error-toast",
  ): void {
    if (!visible) {
      hidePageErrorToast(errorToast);
      clearZipInlineError();
      if (!msg) return;
      msg.hidden = true;
      msg.setAttribute("hidden", "");
      msg.classList.remove("is-loading", "is-error");
      msg.removeAttribute("aria-busy");
      msg.setAttribute("role", "status");
      msg.setAttribute("aria-live", "polite");
      const spinner = msg.querySelector<HTMLElement>(
        ".dl-page__locator-message-spinner",
      );
      const textEl = msg.querySelector<HTMLElement>(
        ".dl-page__locator-message-text",
      );
      if (textEl) textEl.textContent = "";
      if (spinner) spinner.hidden = true;
      return;
    }

    if (variant === "error-toast") {
      clearZipInlineError();
      if (msg) {
        msg.hidden = true;
        msg.setAttribute("hidden", "");
        msg.classList.remove("is-loading", "is-error");
        msg.removeAttribute("aria-busy");
      }
      showPageErrorToast(errorToast, text);
      return;
    }

    clearZipInlineError();
    hidePageErrorToast(errorToast);
    if (!msg) return;
    const spinner = msg.querySelector<HTMLElement>(
      ".dl-page__locator-message-spinner",
    );
    const textEl = msg.querySelector<HTMLElement>(
      ".dl-page__locator-message-text",
    );
    if (!textEl) {
      msg.textContent = text;
      msg.hidden = false;
      msg.removeAttribute("hidden");
      return;
    }

    msg.classList.remove("is-loading", "is-error");
    textEl.textContent = text;
    msg.classList.add("is-loading");
    msg.hidden = false;
    msg.removeAttribute("hidden");
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");
    msg.setAttribute("aria-busy", "true");
    if (spinner) spinner.hidden = false;
  }

  async function initLeafletMap(): Promise<void> {
    resetMapDom();
    const leafletMap = L.map(dlMapEl, {
      center: [39.8283, -98.5795],
      zoom: 4,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMap);
    mapState = {
      kind: "leaflet",
      map: leafletMap,
      markers: new Map(),
      markerIcon: buildLeafletMarkerIcon(),
    };
    mapReady = true;
    mapPlaceholder?.setAttribute("hidden", "");
    requestAnimationFrame(() => leafletMap.invalidateSize());
  }

  async function initGoogleMap(): Promise<void> {
    resetMapDom();
    setOptions({ key: mapsKey, v: "weekly" });
    await importLibrary("maps");
    const gMap = new google.maps.Map(dlMapEl, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    await waitGoogleMapReadyOrAuthFail(gMap, 12000);
    mapState = {
      kind: "google",
      map: gMap,
      markers: new Map(),
      infoWindow: new google.maps.InfoWindow(),
      markerIcon: buildGoogleMarkerIcon(),
    };
    mapReady = true;
    mapPlaceholder?.setAttribute("hidden", "");
    requestAnimationFrame(() => google.maps.event.trigger(gMap, "resize"));
  }

  async function ensureMap(): Promise<void> {
    if (mapState) return;
    if (DISTRIBUTOR_LOCATOR_USE_GOOGLE_MAP && mapsKey) {
      try {
        await initGoogleMap();
        return;
      } catch {
        mapState = null;
        mapReady = false;
        resetMapDom();
      }
    }
    try {
      await initLeafletMap();
    } catch (leafErr) {
      const message = `Could not load the map (OpenStreetMap). ${
        leafErr instanceof Error ? leafErr.message : String(leafErr)
      }`;
      throw leafErr instanceof Error
        ? new Error(message, { cause: leafErr })
        : new Error(message);
    }
  }

  function clearUserLocMarker(): void {
    if (!userLocMarker) return;
    if (mapState?.kind === "google") {
      (userLocMarker as google.maps.Marker).setMap(null);
    } else if (mapState?.kind === "leaflet") {
      (userLocMarker as L.CircleMarker).remove();
    }
    userLocMarker = null;
  }

  function clearMapMarkers(): void {
    clearUserLocMarker();
    if (!mapState) return;
    if (mapState.kind === "google") {
      mapState.markers.forEach((m) => m.setMap(null));
      mapState.markers.clear();
      mapState.infoWindow.close();
    } else {
      mapState.markers.forEach((m) => {
        m.remove();
      });
      mapState.markers.clear();
      mapState.map.closePopup();
    }
  }

  function clearResults(): void {
    dlList.replaceChildren();
    const wrap = dlList.closest<HTMLElement>(".dl-page__locator-list-wrap");
    if (wrap) wrap.scrollTop = 0;
    clearMapMarkers();
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
    if (!mapState) return;
    if (mapState.kind === "google") {
      const m = mapState.markers.get(loc.id);
      if (m) {
        mapState.map.panTo(m.getPosition()!);
        const z = mapState.map.getZoom() ?? 4;
        if (z < 11) mapState.map.setZoom(11);
        mapState.infoWindow.setContent(shortPopupHtml(loc));
        mapState.infoWindow.open({ map: mapState.map, anchor: m });
      }
    } else {
      const m = mapState.markers.get(loc.id);
      if (m) {
        mapState.map.panTo(m.getLatLng());
        if ((mapState.map.getZoom() ?? 4) < 11) mapState.map.setZoom(11);
        m.getPopup()?.setContent(shortPopupHtml(loc));
        m.openPopup();
      }
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
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 10C20 14.993 14.461 20.193 12.601 21.799C12.4277 21.9293 12.2168 21.9998 12 21.9998C11.7832 21.9998 11.5723 21.9293 11.399 21.799C9.539 20.193 4 14.993 4 10C4 7.87827 4.84285 5.84344 6.34315 4.34315C7.84344 2.84285 9.87827 2 12 2C14.1217 2 16.1566 2.84285 17.6569 4.34315C19.1571 5.84344 20 7.87827 20 10Z" stroke="#007D8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="#007D8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    const biz = businessTypeValue(dlBusinessSel);
    if (biz !== "All") {
      foot.appendChild(document.createTextNode(`${biz} `));
      const footSep = document.createElement("span");
      footSep.textContent = "•";
      foot.appendChild(footSep);
      foot.appendChild(document.createTextNode(" "));
    }
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

  function placeUserLocationPin(u: { lat: number; lng: number }): void {
    clearUserLocMarker();
    if (!mapState) return;
    if (mapState.kind === "google") {
      userLocMarker = new google.maps.Marker({
        position: { lat: u.lat, lng: u.lng },
        map: mapState.map,
        icon: userGoogleLocationIcon(),
        zIndex: 999,
        title: "Your location",
      });
    } else {
      userLocMarker = L.circleMarker([u.lat, u.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#1a6b6b",
        fillOpacity: 1,
      })
        .addTo(mapState.map)
        .bindTooltip("Your location", { direction: "top", opacity: 0.95 });
    }
  }

  async function runSearch(
    opts?: { userLatLng?: { lat: number; lng: number } },
    callOpts?: { externalLock?: boolean },
  ): Promise<void> {
    const query = dlZipInput.value.trim().replace(/\s+/g, " ");
    setMessage("", false);

    if (!query) {
      setMessage("", false);
      showZipInlineError("Please enter a U.S. ZIP code.");
      return;
    }
    if (query.length < 3) {
      setMessage("", false);
      showZipInlineError(
        "Enter a U.S. ZIP code (5 digits or ZIP+4), or at least 3 characters.",
      );
      return;
    }

    const externalLock = callOpts?.externalLock === true;
    if (!externalLock) {
      if (locatorSearchInFlight) return;
      locatorSearchInFlight = true;
      setLocatorSearchUiLocked(true);
    }

    const distance = readRadiusMiles(dlForm);
    const businessType = businessTypeValue(dlBusinessSel);
    if (dlMapWrap) dlMapWrap.hidden = true;
    const params = new URLSearchParams({
      zip: query,
      country: "US",
      distance: String(distance),
      unit: "mi",
      businessType,
    });

    clearResults();
    setMessage("Loading…", true, "loading");

    try {
      const userLL = opts?.userLatLng;
      const strictZip = /^\d{5}(-\d{4})?$/.test(query.replace(/\s/g, ""));
      const [centerZip, res] = await Promise.all([
        userLL || !strictZip ? Promise.resolve(null) : zipCenterUs(query),
        fetch(`/api/distributor-locations?${params.toString()}`),
      ]);
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || data.error) {
        const errText = data.error ?? "Could not load locations.";
        if (distributorLocationsZipUserErrorVariant(errText) === "error-inline") {
          setMessage("", false);
          showZipInlineError(errText);
        } else {
          setMessage(errText, true, "error-toast");
        }
        return;
      }

      let center: { lat: number; lng: number } | null = userLL ?? centerZip;
      const sc = data.searchCenter;
      if (
        !userLL &&
        sc &&
        typeof sc.lat === "number" &&
        typeof sc.lng === "number" &&
        Number.isFinite(sc.lat) &&
        Number.isFinite(sc.lng)
      ) {
        center = { lat: sc.lat, lng: sc.lng };
      }

      const rawList = Array.isArray(data.locations) ? data.locations : [];
      const locs: DistributorLocation[] = [];
      rawList.forEach((raw) => {
        const n = normalizeLocation(raw);
        if (n) locs.push({ ...n, id: locs.length });
      });
      setMessage("", false);

      if (dlMapWrap) dlMapWrap.hidden = false;
      await ensureMap();
      if (!mapState) {
        setMessage("Could not initialize the map.", true, "error-toast");
        if (dlMapWrap) dlMapWrap.hidden = true;
        return;
      }

      if (locs.length === 0) {
        const empty = document.createElement("li");
        empty.className = "dl-page__result-empty";
        empty.textContent = "No locations found in this area.";
        dlList.appendChild(empty);
        if (userLL) {
          placeUserLocationPin(userLL);
          if (mapState.kind === "google") {
            mapState.map.setCenter({ lat: userLL.lat, lng: userLL.lng });
            mapState.map.setZoom(11);
            google.maps.event.trigger(mapState.map, "resize");
          } else {
            mapState.map.setView([userLL.lat, userLL.lng], 11);
            mapState.map.invalidateSize();
          }
        }
        return;
      }

      if (mapState.kind === "google") {
        const bounds = new google.maps.LatLngBounds();
        for (const loc of locs) {
          const miles =
            center != null
              ? haversineMi(center.lat, center.lng, loc.lat, loc.lng)
              : null;
          dlList.appendChild(renderCard(loc, miles));

          const marker = new google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map: mapState.map,
            title: loc.customerName,
            icon: mapState.markerIcon,
          });
          marker.addListener("click", () => activateLocation(loc));
          mapState.markers.set(loc.id, marker);
          bounds.extend({ lat: loc.lat, lng: loc.lng });
        }
        if (userLL) bounds.extend({ lat: userLL.lat, lng: userLL.lng });

        if (locs.length === 1 && !userLL) {
          mapState.map.setCenter({ lat: locs[0]!.lat, lng: locs[0]!.lng });
          mapState.map.setZoom(12);
        } else {
          mapState.map.fitBounds(bounds, 48);
        }
        if (userLL) placeUserLocationPin(userLL);
        google.maps.event.trigger(mapState.map, "resize");
      } else {
        const bounds = L.latLngBounds([]);
        for (const loc of locs) {
          const miles =
            center != null
              ? haversineMi(center.lat, center.lng, loc.lat, loc.lng)
              : null;
          dlList.appendChild(renderCard(loc, miles));

          const marker = L.marker([loc.lat, loc.lng], {
            icon: mapState.markerIcon,
            title: loc.customerName,
          })
            .addTo(mapState.map)
            .bindPopup(shortPopupHtml(loc));
          marker.on("click", () => activateLocation(loc));
          mapState.markers.set(loc.id, marker);
          bounds.extend([loc.lat, loc.lng]);
        }
        if (userLL) bounds.extend([userLL.lat, userLL.lng]);

        if (locs.length === 1 && !userLL) {
          mapState.map.setView([locs[0]!.lat, locs[0]!.lng], 12);
        } else if (bounds.isValid()) {
          mapState.map.fitBounds(bounds, { padding: [48, 48] });
        }
        if (userLL) placeUserLocationPin(userLL);
        mapState.map.invalidateSize();
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : String(err),
        true,
        "error-toast",
      );
    } finally {
      if (!externalLock) {
        locatorSearchInFlight = false;
        setLocatorSearchUiLocked(false);
      }
    }
  }

  function locationReadyForSearch(): boolean {
    const q = dlZipInput.value.trim();
    return q.length >= 3;
  }

  function runSearchIfZipReady(): void {
    if (!locationReadyForSearch()) return;
    void runSearch();
  }

  dlForm
    .querySelectorAll<HTMLInputElement>('input[name="dl-radius"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => runSearchIfZipReady());
    });

  setupBusinessTypeSelect(root, dlBusinessSel, {
    onPick: () => runSearchIfZipReady(),
  });

  geoBtnEl?.addEventListener("click", () => {
    void (async () => {
      if (locatorSearchInFlight) return;
      if (!navigator.geolocation) {
        setMessage(
          "Geolocation is not supported in this browser.",
          true,
          "error-toast",
        );
        return;
      }
      locatorSearchInFlight = true;
      setLocatorSearchUiLocked(true);
      setMessage("Finding your location…", true, "loading");
      try {
        const pos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 120_000,
            });
          },
        );
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const z = await reverseGeocodeToZip(lat, lng);
        if (!z) {
          setMessage(
            "Could not determine a U.S. ZIP code from your location.",
            true,
            "error-toast",
          );
          return;
        }
        dlZipInput.value = z;
        syncDlZipAccessoryButtons();
        await runSearch(
          { userLatLng: { lat, lng } },
          { externalLock: true },
        );
      } catch (e) {
        const denied =
          e instanceof GeolocationPositionError &&
          e.code === e.PERMISSION_DENIED;
        setMessage(
          denied
            ? "Location access was denied. Allow location for this site in browser settings."
            : "Could not get your location. Try entering a ZIP code.",
          true,
          "error-toast",
        );
      } finally {
        locatorSearchInFlight = false;
        setLocatorSearchUiLocked(false);
      }
    })();
  });

  dlZipInput.addEventListener("input", () => {
    clearZipInlineError();
    hidePageErrorToast(errorToast);
    syncDlZipAccessoryButtons();
  });

  zipClearBtn?.addEventListener("click", () => {
    dlZipInput.value = "";
    clearZipInlineError();
    hidePageErrorToast(errorToast);
    syncDlZipAccessoryButtons();
    dlZipInput.focus();
  });

  syncDlZipAccessoryButtons();

  dlZipInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (locatorSearchInFlight) return;
    e.preventDefault();
    void runSearch();
  });

  dlForm
    .querySelector<HTMLButtonElement>("[data-dl-search-submit]")
    ?.addEventListener("click", () => {
      if (locatorSearchInFlight) return;
      void runSearch();
    });

  dlForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (locatorSearchInFlight) return;
    void runSearch();
  });

  window.addEventListener("resize", () => {
    if (!mapReady || !mapState) return;
    if (mapState.kind === "google") {
      google.maps.event.trigger(mapState.map, "resize");
    } else {
      mapState.map.invalidateSize();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init());
} else {
  void init();
}
