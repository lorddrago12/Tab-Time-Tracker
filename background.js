// background.js — Tab Time Tracker
// Firefox/LibreWolf compatible — uses browser.* with chrome.* fallback

const api = typeof browser !== "undefined" ? browser : chrome;
const IDLE_THRESHOLD = 60;

let activeTabId = null;
let activeUrl = null;
let sessionStart = null;
let isIdle = false;
let stateReady = false;
let categoryOverrides = {};

async function loadOverrides() {
  try {
    const result = await api.storage.local.get(["categoryOverrides"]);
    categoryOverrides = result.categoryOverrides || {};
  } catch (e) {
    console.error("loadOverrides error:", e);
  }
}

// Keep the in-memory cache in sync if the options page changes overrides
// while this background script is already running.
api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.categoryOverrides) {
    categoryOverrides = changes.categoryOverrides.newValue || {};
  }
});

// Firefox's background page is non-persistent and can unload while the
// browser is still open. When it wakes back up, the module-level state
// above resets to its initial values, so we mirror it into
// browser.storage.session (cleared only when the browser fully closes)
// and restore from there once per background-script lifetime.
async function initIfNeeded() {
  if (stateReady) return;
  stateReady = true;
  await loadOverrides();
  if (!api.storage.session) return; // older engines without storage.session
  try {
    const stored = await api.storage.session.get([
      "activeTabId",
      "activeUrl",
      "sessionStart",
      "isIdle",
    ]);
    if (typeof stored.activeTabId === "number") activeTabId = stored.activeTabId;
    if (typeof stored.activeUrl === "string") activeUrl = stored.activeUrl;
    if (typeof stored.sessionStart === "number") sessionStart = stored.sessionStart;
    if (typeof stored.isIdle === "boolean") isIdle = stored.isIdle;
  } catch (e) {
    console.error("initIfNeeded error:", e);
  }
}

async function persistSessionState() {
  if (!api.storage.session) return;
  try {
    await api.storage.session.set({ activeTabId, activeUrl, sessionStart, isIdle });
  } catch (e) {
    console.error("persistSessionState error:", e);
  }
}

function getHostname(url) {
  try {
    if (!url) return null;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("about:") ||
      url.startsWith("browser:")
    )
      return null;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCategory(hostname) {
  if (!hostname) return "other";
  if (categoryOverrides[hostname]) return categoryOverrides[hostname];
  const rules = {
    work: [
      "github.com",
      "gitlab.com",
      "bitbucket.org",
      "jira",
      "confluence",
      "notion.so",
      "linear.app",
      "figma.com",
      "vercel.com",
      "netlify.com",
      "docs.google.com",
      "sheets.google.com",
      "slides.google.com",
      "mail.google.com",
      "outlook.",
      "slack.com",
      "trello.com",
      "asana.com",
      "monday.com",
    ],
    learning: [
      "stackoverflow.com",
      "developer.mozilla.org",
      "medium.com",
      "dev.to",
      "hashnode.dev",
      "coursera.org",
      "udemy.com",
      "khanacademy.org",
      "wikipedia.org",
      "docs.",
      "learn.",
    ],
    social: [
      "reddit.com",
      "twitter.com",
      "x.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "discord.com",
      "whatsapp.com",
      "telegram.org",
      "tiktok.com",
      "pinterest.com",
    ],
    entertainment: [
      "youtube.com",
      "netflix.com",
      "twitch.tv",
      "spotify.com",
      "primevideo.com",
      "disneyplus.com",
      "hulu.com",
      "crunchyroll.com",
    ],
  };
  for (const [cat, patterns] of Object.entries(rules)) {
    if (patterns.some((p) => hostname.includes(p))) return cat;
  }
  return "other";
}

// ─── Core tracking ────────────────────────────────────────────────────────────

async function flushTime() {
  if (!activeUrl || !sessionStart || isIdle) return;
  const hostname = getHostname(activeUrl);
  if (!hostname) return;

  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  if (elapsed <= 0) return;

  const storageKey = `data_${getTodayKey()}`;
  const result = await api.storage.local.get([storageKey]);
  const data = result[storageKey] || { sites: {}, total: 0 };

  if (!data.sites[hostname]) {
    data.sites[hostname] = {
      seconds: 0,
      category: getCategory(hostname),
      visits: 0,
    };
  }
  data.sites[hostname].seconds += elapsed;
  data.total += elapsed;

  await api.storage.local.set({ [storageKey]: data });
  sessionStart = Date.now();
  await persistSessionState();
}

async function startTracking(tabId, url) {
  await flushTime();
  activeTabId = tabId;
  activeUrl = url;
  sessionStart = Date.now();
  await persistSessionState();
}

async function stopTracking() {
  await flushTime();
  activeTabId = null;
  activeUrl = null;
  sessionStart = null;
  await persistSessionState();
}

async function markVisit(url) {
  const hostname = getHostname(url);
  if (!hostname) return;
  const storageKey = `data_${getTodayKey()}`;
  const result = await api.storage.local.get([storageKey]);
  const data = result[storageKey] || { sites: {}, total: 0 };
  if (!data.sites[hostname]) {
    data.sites[hostname] = {
      seconds: 0,
      category: getCategory(hostname),
      visits: 0,
    };
  }
  data.sites[hostname].visits += 1;
  await api.storage.local.set({ [storageKey]: data });
}

// ─── Event listeners ──────────────────────────────────────────────────────────

api.tabs.onActivated.addListener(async (activeInfo) => {
  await initIfNeeded();
  try {
    const tab = await api.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await startTracking(tab.id, tab.url);
      await markVisit(tab.url);
    }
  } catch (e) {
    console.error("onActivated error:", e);
  }
});

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await initIfNeeded();
  if (changeInfo.status === "complete" && tabId === activeTabId && tab.url) {
    await startTracking(tabId, tab.url);
  }
});

api.windows.onFocusChanged.addListener(async (windowId) => {
  await initIfNeeded();
  const NONE = api.windows.WINDOW_ID_NONE;
  if (windowId === NONE) {
    await flushTime();
    isIdle = true;
    await persistSessionState();
    return;
  }
  isIdle = false;
  try {
    const tabs = await api.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].url) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  } catch (e) {
    console.error("onFocusChanged error:", e);
  }
});

api.idle.setDetectionInterval(IDLE_THRESHOLD);
api.idle.onStateChanged.addListener(async (state) => {
  await initIfNeeded();
  if (state === "idle" || state === "locked") {
    await flushTime();
    isIdle = true;
  } else {
    isIdle = false;
    sessionStart = Date.now();
  }
  await persistSessionState();
});

// Periodic flush every 30 seconds
api.alarms.create("flush", { periodInMinutes: 0.5 });
api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") flushTime();
});

// Startup: pick up the current active tab
const UNINSTALL_PAGE =
  "https://tab-time-tracker-website.vercel.app/uninstall.html";

function updateUninstallURL() {
  if (!api.runtime.setUninstallURL) return; // not supported (e.g. Safari)
  const version = api.runtime.getManifest().version;
  const browserName = typeof browser !== "undefined" ? "firefox" : "chrome";
  const url = `${UNINSTALL_PAGE}?v=${encodeURIComponent(version)}&b=${browserName}`;
  api.runtime
    .setUninstallURL(url)
    .catch((e) => console.error("setUninstallURL failed:", e));
}

async function initTracking() {
  await initIfNeeded();
  updateUninstallURL();
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  } catch (e) {
    console.error("initTracking error:", e);
  }
}

api.runtime.onInstalled.addListener(initTracking);
api.runtime.onStartup.addListener(initTracking);

// Firefox doesn't always fire onStartup for the background — init immediately too
initTracking();
