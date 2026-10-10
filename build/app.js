// ---- Storage keys ----
const THEME_KEY = "stratus.theme";
const STAMPS_KEY = "stratus.stamps";
const COUNTRY_META_KEY = "stratus.countryMeta";

const PAGE_SIZE = 6;
const INKS = [
  { key: "navy", color: "#1d3b6d" },
  { key: "crimson", color: "#9c2d41" },
  { key: "forest", color: "#1f5c3f" },
  { key: "plum", color: "#5b3468" },
  { key: "sepia", color: "#6b4a2b" },
  { key: "charcoal", color: "#2b2b2b" },
];

// ---- State ----
let stamps = loadStamps();
let countryMeta = loadCountryMeta();
let currentPage = 0;
let editingId = null;
let draftStamp = null;
let lastSearchResults = [];
let searchDebounceTimer = null;

function loadStamps() {
  try {
    return JSON.parse(localStorage.getItem(STAMPS_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function saveStamps() {
  localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps));
}
function loadCountryMeta() {
  try {
    return JSON.parse(localStorage.getItem(COUNTRY_META_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveCountryMeta() {
  localStorage.setItem(COUNTRY_META_KEY, JSON.stringify(countryMeta));
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function randomInk() {
  return INKS[Math.floor(Math.random() * INKS.length)].key;
}
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return null;
  const codePoints = [...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
function typeIcon(type) {
  switch (type) {
    case "country": return "🌍";
    case "state": return "🏞️";
    case "city": return "🏙️";
    case "landmark": return "🏛️";
    case "nature": return "🏔️";
    default: return "📍";
  }
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

// ---- Atmosphere theme picker ----
const themePicker = document.getElementById("theme-picker");
function resolveEffectiveTheme(preference) {
  if (preference !== "random") return preference === "dark" ? "night" : preference;
  const initialTheme = window.__stratusInitialRandomTheme;
  if (["day", "twilight", "night"].includes(initialTheme)) {
    delete window.__stratusInitialRandomTheme;
    return initialTheme;
  }
  const themes = ["day", "twilight", "night"];
  return themes[Math.floor(Math.random() * themes.length)];
}
function applyTheme(preference) {
  const effective = resolveEffectiveTheme(preference);
  document.documentElement.classList.remove("dark", "night", "twilight");
  if (effective === "night") document.documentElement.classList.add("dark", "night");
  else if (effective === "twilight") document.documentElement.classList.add("twilight");
  themePicker?.querySelectorAll(".theme-chip").forEach((chip) => {
    chip.classList.toggle("theme-chip--active", chip.dataset.themeVal === preference);
  });
}
const storedTheme = localStorage.getItem(THEME_KEY) || "day";
applyTheme(storedTheme === "light" ? "day" : storedTheme);
themePicker?.addEventListener("click", (event) => {
  const chip = event.target.closest(".theme-chip");
  if (!chip) return;
  const preference = chip.dataset.themeVal;
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
});

// ---- Stamp SVG generator ----
function scallopCirclePath(cx, cy, r, scallops) {
  const points = [];
  const n = scallops * 8;
  for (let i = 0; i <= n; i++) {
    const theta = (i / n) * Math.PI * 2;
    const wave = Math.sin(theta * scallops) * 6;
    const rad = r + wave;
    const x = (cx + rad * Math.cos(theta)).toFixed(1);
    const y = (cy + rad * Math.sin(theta)).toFixed(1);
    points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  points.push("Z");
  return points.join(" ");
}

function stampSvg(stamp) {
  const uid = String(stamp.id || "draft").replace(/[^a-zA-Z0-9]/g, "");
  const ink = (INKS.find((i) => i.key === stamp.ink) || INKS[0]).color;
  const shape = stamp.shape || "circle";
  const name = escapeHtml((stamp.name || "Somewhere").toUpperCase());
  const dateLabel = escapeHtml(formatDateLabel(stamp.dateVisited));
  const icon = escapeHtml(flagEmoji(stamp.countryCode) || typeIcon(stamp.type));
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const filterId = `grain-${uid}`;
  // Light grunge texture so the ink looks hand-stamped rather than vector-perfect.
  const grunge = `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${hashSeed(uid)}" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.85 0" result="alphaNoise"/>
      <feComposite in="SourceGraphic" in2="alphaNoise" operator="in"/>
    </filter>`;

  if (shape === "rect") {
    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-label="${name}">
      <defs>${grunge}</defs>
      <g filter="url(#${filterId})" fill="none" stroke="${ink}">
        <rect x="18" y="40" width="184" height="140" rx="6" stroke-width="5"/>
        <rect x="26" y="48" width="168" height="124" rx="3" stroke-width="2"/>
      </g>
      <g filter="url(#${filterId})" fill="${ink}" text-anchor="middle" font-family="Georgia, serif">
        <text x="${cx}" y="76" font-size="15" font-weight="700" letter-spacing="1.5">${name}</text>
        <text x="${cx}" y="114" font-size="32">${icon}</text>
        <text x="${cx}" y="150" font-size="13" letter-spacing="1">${dateLabel}</text>
        <text x="${cx}" y="167" font-size="9" letter-spacing="3">STRATUS</text>
      </g>
    </svg>`;
  }

  const r = shape === "scallop" ? 86 : 90;
  const edge = shape === "scallop"
    ? `<path d="${scallopCirclePath(cx, cy, r, 20)}" fill="none" stroke="${ink}" stroke-width="4"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="7 6"/>`;
  const topArcId = `arcTop-${uid}`;
  const bottomArcId = `arcBottom-${uid}`;

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-label="${name}">
    <defs>
      ${grunge}
      <path id="${topArcId}" d="M ${cx - 74} ${cy + 6} A 74 74 0 0 1 ${cx + 74} ${cy + 6}" fill="none"/>
      <path id="${bottomArcId}" d="M ${cx - 60} ${cy + 30} A 60 60 0 0 0 ${cx + 60} ${cy + 30}" fill="none"/>
    </defs>
    <g filter="url(#${filterId})">
      ${edge}
      <circle cx="${cx}" cy="${cy}" r="${r - 8}" fill="none" stroke="${ink}" stroke-width="2"/>
      <text font-family="Georgia, serif" font-size="13" font-weight="700" fill="${ink}" letter-spacing="2">
        <textPath href="#${topArcId}" startOffset="50%" text-anchor="middle">${name}</textPath>
      </text>
      <text x="${cx}" y="${cy + 2}" font-size="30" text-anchor="middle" fill="${ink}">${icon}</text>
      <text font-family="Georgia, serif" font-size="11" fill="${ink}" letter-spacing="3">
        <textPath href="#${bottomArcId}" startOffset="50%" text-anchor="middle">${dateLabel}</textPath>
      </text>
    </g>
  </svg>`;
}

// ---- Search (OpenStreetMap Nominatim, no API key required) ----
function inferType(item) {
  const addr = item.address || {};
  const addressType = item.addresstype || "";
  if (addressType === "country") return "country";
  if (addressType === "state" || addressType === "region" || (addr.state && !addr.city)) return "state";
  if (["city", "town", "village", "municipality", "hamlet"].includes(addressType)) return "city";
  if (["tourism", "historic", "man_made", "building"].includes(item.class)) return "landmark";
  if (["natural", "waterway", "water"].includes(item.class)) return "nature";
  return "other";
}

async function searchPlaces(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

function searchResultHtml(item, idx) {
  const type = inferType(item);
  const name = item.namedetails?.name || item.display_name.split(",")[0];
  return `<div class="search-result" data-idx="${idx}">
    <span class="search-result__icon">${typeIcon(type)}</span>
    <div class="search-result__body">
      <p class="search-result__name">${escapeHtml(name)}</p>
      <p class="search-result__meta">${escapeHtml(item.display_name)}</p>
    </div>
  </div>`;
}

const searchInput = document.getElementById("search-input");
const searchResultsEl = document.getElementById("search-results");

async function runSearch(query) {
  query = query.trim();
  if (!query) {
    searchResultsEl.classList.remove("open");
    searchResultsEl.innerHTML = "";
    return;
  }
  searchResultsEl.classList.add("open");
  searchResultsEl.innerHTML = `<p class="search-result__status">Searching…</p>`;
  try {
    const results = await searchPlaces(query);
    lastSearchResults = results;
    if (!results.length) {
      searchResultsEl.innerHTML = `<p class="search-result__status">No matches. Try "Add Manually" instead.</p>`;
      return;
    }
    searchResultsEl.innerHTML = results.map(searchResultHtml).join("");
  } catch (e) {
    searchResultsEl.innerHTML = `<p class="search-result__status">Search unavailable right now — check your connection.</p>`;
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  const query = searchInput.value;
  // Debounced to stay well under Nominatim's shared-usage rate limit (~1 request/sec).
  searchDebounceTimer = setTimeout(() => runSearch(query), 500);
});
document.getElementById("search-btn").addEventListener("click", () => runSearch(searchInput.value));
searchResultsEl.addEventListener("click", (e) => {
  const row = e.target.closest(".search-result");
  if (!row) return;
  const item = lastSearchResults[Number(row.dataset.idx)];
  if (item) openStampModalFromSearch(item);
});

// ---- Country region lookup (for the Continents stat), cached per country code ----
async function hydrateCountryMeta(cc) {
  if (!cc || countryMeta[cc]) return;
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${cc}?fields=region,name`);
    if (!res.ok) return;
    const data = await res.json();
    const info = Array.isArray(data) ? data[0] : data;
    if (info) {
      countryMeta[cc] = { region: info.region, name: info.name?.common || cc };
      saveCountryMeta();
      renderStats();
    }
  } catch (e) {
    // Offline or blocked — the Continents stat just stays incomplete until next hydrate attempt.
  }
}
function hydrateAllCountryMeta() {
  const codes = new Set(stamps.filter((s) => s.countryCode).map((s) => s.countryCode.toUpperCase()));
  codes.forEach((cc) => hydrateCountryMeta(cc));
}

// ---- Stamp editor modal ----
const stampModal = document.getElementById("stamp-modal");
const inkRow = document.getElementById("ink-swatch-row");
const shapeRow = document.getElementById("shape-swatch-row");

INKS.forEach((ink) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ink-chip";
  b.style.background = ink.color;
  b.dataset.ink = ink.key;
  b.title = ink.key;
  inkRow.appendChild(b);
});

function updateInkActive() {
  inkRow.querySelectorAll(".ink-chip").forEach((c) => c.classList.toggle("ink-chip--active", c.dataset.ink === draftStamp.ink));
}
function updateShapeActive() {
  shapeRow.querySelectorAll(".shape-chip").forEach((c) => c.classList.toggle("shape-chip--active", c.dataset.shape === draftStamp.shape));
}
function renderPreview() {
  document.getElementById("stamp-preview").innerHTML = stampSvg(draftStamp);
}

function fillStampModal() {
  document.getElementById("stamp-modal-title").textContent = editingId ? "Edit Stamp" : "New Stamp";
  document.getElementById("stamp-name-input").value = draftStamp.name || "";
  document.getElementById("stamp-type-input").value = draftStamp.type || "country";
  document.getElementById("stamp-country-input").value = draftStamp.countryCode || "";
  document.getElementById("stamp-date-input").value = draftStamp.dateVisited || todayStr();
  document.getElementById("stamp-note-input").value = draftStamp.note || "";
  document.getElementById("stamp-delete-btn").hidden = !editingId;
  updateInkActive();
  updateShapeActive();
  renderPreview();
}

function openStampModalFromSearch(item) {
  const addr = item.address || {};
  const name = item.namedetails?.name || item.display_name.split(",")[0];
  draftStamp = {
    name,
    type: inferType(item),
    countryCode: (addr.country_code || "").toUpperCase(),
    lat: item.lat || null,
    lon: item.lon || null,
    dateVisited: todayStr(),
    note: "",
    ink: randomInk(),
    shape: "circle",
  };
  editingId = null;
  fillStampModal();
  stampModal.classList.add("open");
}

document.getElementById("add-manual-btn").addEventListener("click", () => {
  draftStamp = { name: "", type: "country", countryCode: "", lat: null, lon: null, dateVisited: todayStr(), note: "", ink: randomInk(), shape: "circle" };
  editingId = null;
  fillStampModal();
  stampModal.classList.add("open");
});

function openStampModalForEdit(stamp) {
  draftStamp = { ...stamp };
  editingId = stamp.id;
  fillStampModal();
  stampModal.classList.add("open");
}

document.getElementById("stamp-name-input").addEventListener("input", (e) => { draftStamp.name = e.target.value; renderPreview(); });
document.getElementById("stamp-type-input").addEventListener("change", (e) => { draftStamp.type = e.target.value; renderPreview(); });
document.getElementById("stamp-country-input").addEventListener("input", (e) => { draftStamp.countryCode = e.target.value.toUpperCase(); renderPreview(); });
document.getElementById("stamp-date-input").addEventListener("change", (e) => { draftStamp.dateVisited = e.target.value; renderPreview(); });
document.getElementById("stamp-note-input").addEventListener("input", (e) => { draftStamp.note = e.target.value; });

inkRow.addEventListener("click", (e) => {
  const chip = e.target.closest(".ink-chip");
  if (!chip) return;
  draftStamp.ink = chip.dataset.ink;
  updateInkActive();
  renderPreview();
});
shapeRow.addEventListener("click", (e) => {
  const chip = e.target.closest(".shape-chip");
  if (!chip) return;
  draftStamp.shape = chip.dataset.shape;
  updateShapeActive();
  renderPreview();
});

document.getElementById("stamp-cancel-btn").addEventListener("click", () => stampModal.classList.remove("open"));
document.getElementById("stamp-save-btn").addEventListener("click", () => {
  if (!draftStamp.name.trim()) {
    alert("Give this stamp a place name first.");
    return;
  }
  if (editingId) {
    const idx = stamps.findIndex((s) => s.id === editingId);
    if (idx >= 0) stamps[idx] = { ...stamps[idx], ...draftStamp, id: editingId };
  } else {
    stamps.push({ ...draftStamp, id: uuid(), createdAt: new Date().toISOString() });
    currentPage = 0;
  }
  saveStamps();
  if (draftStamp.countryCode) hydrateCountryMeta(draftStamp.countryCode);
  stampModal.classList.remove("open");
  renderAll();
});
document.getElementById("stamp-delete-btn").addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Remove this stamp from your passport?")) return;
  stamps = stamps.filter((s) => s.id !== editingId);
  saveStamps();
  stampModal.classList.remove("open");
  renderAll();
});

// ---- Passport pages ----
function sortedStamps() {
  return [...stamps].sort((a, b) => {
    const da = a.dateVisited || "";
    const db = b.dateVisited || "";
    if (da !== db) return db.localeCompare(da);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function renderPassport() {
  const ordered = sortedStamps();
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const pageEl = document.getElementById("passport-page");
  if (!ordered.length) {
    pageEl.classList.add("passport-page--empty");
    pageEl.innerHTML = `<p>Your passport is empty.<br>Search above to add your first stamp.</p>`;
  } else {
    pageEl.classList.remove("passport-page--empty");
    const pageStamps = ordered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
    const slots = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      const s = pageStamps[i];
      slots.push(
        s
          ? `<button type="button" class="stamp-slot" data-id="${s.id}">${stampSvg(s)}<span class="stamp-slot__name">${escapeHtml(s.name)}</span><span class="stamp-slot__date">${escapeHtml(formatDateLabel(s.dateVisited))}</span></button>`
          : `<div class="stamp-slot stamp-slot--empty"><div class="stamp-placeholder"></div></div>`
      );
    }
    pageEl.innerHTML = slots.join("");
  }

  document.getElementById("page-label").textContent = `Page ${currentPage + 1} of ${totalPages}`;
  document.getElementById("page-prev-btn").disabled = currentPage === 0;
  document.getElementById("page-next-btn").disabled = currentPage >= totalPages - 1;
}

document.getElementById("passport-page").addEventListener("click", (e) => {
  const slot = e.target.closest(".stamp-slot:not(.stamp-slot--empty)");
  if (!slot) return;
  const stamp = stamps.find((s) => s.id === slot.dataset.id);
  if (stamp) openStampModalForEdit(stamp);
});
document.getElementById("page-prev-btn").addEventListener("click", () => { currentPage--; renderPassport(); });
document.getElementById("page-next-btn").addEventListener("click", () => { currentPage++; renderPassport(); });

// ---- Stats ----
function renderStats() {
  document.getElementById("stat-stamps").textContent = stamps.length;
  const countries = new Set(stamps.filter((s) => s.countryCode).map((s) => s.countryCode.toUpperCase()));
  document.getElementById("stat-countries").textContent = countries.size;
  const continents = new Set();
  countries.forEach((cc) => {
    const meta = countryMeta[cc];
    if (meta && meta.region) continents.add(meta.region);
  });
  document.getElementById("stat-continents").textContent = continents.size;
}

function renderAll() {
  renderStats();
  renderPassport();
}

// ---- Settings modal ----
const settingsModal = document.getElementById("settings-modal");
document.getElementById("settings-btn").addEventListener("click", () => settingsModal.classList.add("open"));
document.getElementById("settings-close-btn").addEventListener("click", () => settingsModal.classList.remove("open"));

document.getElementById("export-btn").addEventListener("click", () => {
  const payload = { stamps, countryMeta, theme: localStorage.getItem(THEME_KEY) || "day", exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stratus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (Array.isArray(imported.stamps)) {
        stamps = imported.stamps;
        saveStamps();
      }
      if (imported.countryMeta) {
        countryMeta = imported.countryMeta;
        saveCountryMeta();
      }
      if (imported.theme) {
        localStorage.setItem(THEME_KEY, imported.theme);
        applyTheme(imported.theme);
      }
      currentPage = 0;
      renderAll();
      hydrateAllCountryMeta();
      alert("Import complete.");
    } catch (err) {
      alert("Couldn't import that file: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("clear-data-btn").addEventListener("click", () => {
  if (!confirm("This deletes all Stratus stamps and settings from this browser. Continue?")) return;
  localStorage.removeItem(STAMPS_KEY);
  localStorage.removeItem(COUNTRY_META_KEY);
  location.reload();
});

// ---- About modal ----
const aboutModal = document.getElementById("about-modal");
document.getElementById("about-link").addEventListener("click", () => {
  settingsModal.classList.remove("open");
  aboutModal.classList.add("open");
});
document.getElementById("about-close-btn").addEventListener("click", () => aboutModal.classList.remove("open"));

// Close modals on backdrop click
[stampModal, settingsModal, aboutModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });
});

// Mirror the About version into the header badge so there's only one place to bump each release.
(() => {
  const src = document.querySelector(".about-modal__version");
  const badge = document.getElementById("app-version");
  if (src && badge) badge.textContent = src.textContent.replace(/^Version\s+/i, "v");
})();

renderAll();
hydrateAllCountryMeta();
