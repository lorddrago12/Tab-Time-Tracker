// popup.js — Tab Time Tracker

// Firefox/LibreWolf compatibility
const api = typeof browser !== "undefined" ? browser : chrome;

// ─── Theme system ─────────────────────────────────────────────────────────────

const THEMES = [
  "dark",
  "catppuccin-mocha",
  "catppuccin-latte",
  "tokyo-night",
  "rose-pine",
  "gruvbox",
  "nord",
  "dracula",
  "solarized",
];

// Category colors per theme — [work, learning, social, entertainment, other]
const THEME_CATEGORY_COLORS = {
  dark: ["#1D9E75", "#378ADD", "#D85A30", "#BA7517", "#5F5E5A"],
  "catppuccin-mocha": ["#a6e3a1", "#89dceb", "#f38ba8", "#fab387", "#6c7086"],
  "catppuccin-latte": ["#40a02b", "#1e66f5", "#d20f39", "#fe640b", "#9ca0b0"],
  "tokyo-night": ["#9ece6a", "#7aa2f7", "#f7768e", "#e0af68", "#565f89"],
  "rose-pine": ["#31748f", "#9ccfd8", "#eb6f92", "#f6c177", "#6e6a86"],
  gruvbox: ["#98971a", "#458588", "#cc241d", "#d79921", "#7c6f64"],
  nord: ["#a3be8c", "#88c0d0", "#bf616a", "#ebcb8b", "#616e88"],
  dracula: ["#50fa7b", "#8be9fd", "#ff5555", "#ffb86c", "#6272a4"],
  solarized: ["#859900", "#268bd2", "#dc322f", "#b58900", "#93a1a1"],
};

function getCategoryColors(theme) {
  const cols = THEME_CATEGORY_COLORS[theme] || THEME_CATEGORY_COLORS["dark"];
  return {
    work: { bar: cols[0] },
    learning: { bar: cols[1] },
    social: { bar: cols[2] },
    entertainment: { bar: cols[3] },
    other: { bar: cols[4] },
  };
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // Update active swatch
  document.querySelectorAll(".theme-swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.theme === theme);
  });
  // Persist
  api.storage.local.set({ theme });
  // Re-render charts with new colours
  const period =
    document.querySelector(".day-btn.active")?.dataset.period || "today";
  render(period);
}

async function loadTheme() {
  const result = await api.storage.local.get(["theme"]);
  const theme =
    result.theme && THEMES.includes(result.theme) ? result.theme : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.theme === theme);
  });
  return theme;
}

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  work: "Work",
  learning: "Learning",
  social: "Social",
  entertainment: "Entertainment",
  other: "Other",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (seconds < 60) return `0m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayKey() {
  return getDateKey(Date.now());
}

function getFaviconColor(hostname) {
  const palettes = [
    { bg: "#1a3a2a", color: "#4ade80" },
    { bg: "#1a2a3a", color: "#60a5fa" },
    { bg: "#3a1a2a", color: "#f472b6" },
    { bg: "#2a2a1a", color: "#facc15" },
    { bg: "#2a1a3a", color: "#c084fc" },
    { bg: "#1a3a3a", color: "#34d399" },
    { bg: "#3a2a1a", color: "#fb923c" },
  ];
  return palettes[(hostname.charCodeAt(0) || 0) % palettes.length];
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDataForKeys(keys) {
  const storageKeys = keys.map((k) => `data_${k}`);
  const result = await api.storage.local.get(storageKeys);
  const merged = { sites: {}, total: 0 };
  for (const sk of storageKeys) {
    const day = result[sk];
    if (!day) continue;
    merged.total += day.total || 0;
    for (const [hostname, info] of Object.entries(day.sites || {})) {
      if (!merged.sites[hostname]) {
        merged.sites[hostname] = {
          seconds: 0,
          category: info.category,
          visits: 0,
        };
      }
      merged.sites[hostname].seconds += info.seconds || 0;
      merged.sites[hostname].visits += info.visits || 0;
    }
  }
  return merged;
}

function getKeysForPeriod(period) {
  const keys = [];
  const now = new Date();
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

async function getPreviousPeriodData(period) {
  const keys = [];
  const now = new Date();
  const [offset, days] =
    period === "today" ? [1, 1] : period === "week" ? [7, 7] : [30, 30];
  for (let i = offset; i < offset + days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(getDateKey(d));
  }
  return getDataForKeys(keys);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

let currentSort = "time";

function renderSummary(data, prevData) {
  const totalSec = data.total;
  const prevSec = prevData.total;
  const diff = totalSec - prevSec;
  const sites = Object.keys(data.sites).length;
  const prevSites = Object.keys(prevData.sites).length;
  const prodSec = Object.values(data.sites)
    .filter((s) => ["work", "learning"].includes(s.category))
    .reduce((a, s) => a + s.seconds, 0);

  document.getElementById("stat-total").textContent = formatTime(totalSec);
  document.getElementById("stat-sites").textContent = sites;
  document.getElementById("stat-prod").textContent = formatTime(prodSec);

  const period = document.querySelector(".day-btn.active").dataset.period;
  const label = { today: "yesterday", week: "last week", month: "last month" }[
    period
  ];

  document.getElementById("stat-total-sub").textContent =
    prevSec > 0
      ? `${diff >= 0 ? "+" : ""}${formatTime(Math.abs(diff))} vs ${label}`
      : "No previous data";

  document.getElementById("stat-sites-sub").textContent =
    prevSites > 0
      ? `${sites - prevSites >= 0 ? "+" : ""}${sites - prevSites} vs ${label}`
      : "across this period";

  const prodPct = totalSec > 0 ? Math.round((prodSec / totalSec) * 100) : 0;
  document.getElementById("stat-prod-sub").textContent = `${prodPct}% of total`;
}

function renderBreakdownBar(data) {
  const bar = document.getElementById("breakdown-bar");
  const legend = document.getElementById("legend");
  bar.innerHTML = "";
  legend.innerHTML = "";

  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const COLORS = getCategoryColors(theme);
  const byCategory = {};
  for (const [, info] of Object.entries(data.sites)) {
    const cat = info.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + info.seconds;
  }

  const total = data.total || 1;
  for (const cat of ["work", "learning", "social", "entertainment", "other"]) {
    const sec = byCategory[cat] || 0;
    if (sec === 0) continue;
    const pct = Math.max(1, (sec / total) * 100);
    const color = COLORS[cat].bar;

    const seg = document.createElement("div");
    seg.className = "bar-seg";
    seg.style.cssText = `width:${pct.toFixed(1)}%;background:${color};`;
    seg.title = `${CATEGORY_LABELS[cat]}: ${formatTime(sec)}`;
    bar.appendChild(seg);

    const item = document.createElement("div");
    item.className = "legend-item";
    const dot = document.createElement("div");
    dot.className = "legend-dot";
    dot.style.background = color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(CATEGORY_LABELS[cat]));
    legend.appendChild(item);
  }
}

function renderSitesList(data) {
  const list = document.getElementById("sites-list");
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const COLORS = getCategoryColors(theme);
  const sites = Object.entries(data.sites);

  if (sites.length === 0) {
    list.innerHTML =
      '<div class="empty-state">No data yet — browse around and come back!</div>';
    return;
  }

  currentSort === "time"
    ? sites.sort((a, b) => b[1].seconds - a[1].seconds)
    : sites.sort((a, b) => a[0].localeCompare(b[0]));

  const top = sites.slice(0, 8);
  const maxSec = Math.max(...top.map(([, info]) => info.seconds), 1);

  list.innerHTML = "";
  top.forEach(([hostname, info], i) => {
    const pct = Math.round((info.seconds / maxSec) * 100);
    const color = COLORS[info.category || "other"].bar;
    const faviconStyle = getFaviconColor(hostname);
    const letter = hostname.charAt(0).toUpperCase();

    const row = document.createElement("div");
    row.className = "site-row";
    row.style.animationDelay = `${i * 30}ms`;

    const favicon = document.createElement("div");
    favicon.className = "favicon";
    favicon.style.background = faviconStyle.bg;
    favicon.style.color = faviconStyle.color;
    favicon.textContent = letter;

    const siteName = document.createElement("span");
    siteName.className = "site-name";
    siteName.title = hostname;
    siteName.textContent = hostname;

    const barWrap = document.createElement("div");
    barWrap.className = "site-bar-wrap";
    const barFill = document.createElement("div");
    barFill.className = "site-bar-fill";
    barFill.style.width = `${pct}%`;
    barFill.style.background = color;
    barWrap.appendChild(barFill);

    const siteTime = document.createElement("span");
    siteTime.className = "site-time";
    siteTime.textContent = formatTime(info.seconds);

    row.appendChild(favicon);
    row.appendChild(siteName);
    row.appendChild(barWrap);
    row.appendChild(siteTime);
    list.appendChild(row);
  });
}

async function renderLiveTab() {
  const dot = document.getElementById("live-dot");
  const label = document.getElementById("live-label");
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      const hostname = url.hostname.replace(/^www\./, "");
      if (hostname && !url.href.startsWith("chrome://")) {
        dot.classList.remove("idle");
        label.textContent = "Tracking ";
        const strong = document.createElement("strong");
        strong.style.color = "var(--text-secondary)";
        strong.textContent = hostname;
        label.appendChild(strong);
        return;
      }
    }
  } catch {}
  dot.classList.add("idle");
  label.textContent = "Not tracking (system page)";
}

// ─── Main render ──────────────────────────────────────────────────────────────

async function render(period) {
  const keys = getKeysForPeriod(period);
  const [data, prevData] = await Promise.all([
    getDataForKeys(keys),
    getPreviousPeriodData(period),
  ]);
  lastRenderData = data;
  renderSummary(data, prevData);
  renderBreakdownBar(data);
  renderSitesList(data);
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportData() {
  const result = await api.storage.local.get(null);
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tab-time-tracker-${getTodayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Period buttons
document.querySelectorAll(".day-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".day-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.period);
  });
});

// Sort — use cached data to avoid async re-render which can close the popup on Firefox
let lastRenderData = null;

document.getElementById("sort-btn").addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  currentSort = currentSort === "time" ? "alpha" : "time";
  if (lastRenderData) {
    renderSitesList(lastRenderData);
  } else {
    render(document.querySelector(".day-btn.active").dataset.period);
  }
});

// Export
document.getElementById("export-btn").addEventListener("click", exportData);

// Settings
document.getElementById("settings-btn").addEventListener("click", () => {
  api.runtime.openOptionsPage();
});

// Theme toggle button
document.getElementById("theme-toggle").addEventListener("click", () => {
  document.getElementById("theme-panel").classList.toggle("open");
});

// Theme swatches
document.querySelectorAll(".theme-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    applyTheme(swatch.dataset.theme);
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  await loadTheme();
  render("today");
  renderLiveTab();
})();
