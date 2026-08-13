<p align="center">
  <img src="icons/icon128.png" alt="Tab Time Tracker icon" width="96" height="96" />
</p>

<h1 align="center">Tab Time Tracker</h1>

<p align="center">
  A privacy-friendly Firefox extension that tracks how long you spend on each website — entirely on your own device.
</p>

<p align="center">
  <a href="https://addons.mozilla.org/en-US/firefox/addon/tab-time-tracker-by-drago/">
    <strong>➡️ Get it on Mozilla Add-ons</strong>
  </a>
</p>

---

This repository contains the source code for **Tab Time Tracker**, published on Mozilla Add-ons (AMO) as **"Tab Time Tracker by Drago"**:

🔗 **https://addons.mozilla.org/en-US/firefox/addon/tab-time-tracker-by-drago/**

If you just want to use the extension, install it from the link above. If you want to inspect the source, build it yourself, or contribute, read on.

## What it does

Tab Time Tracker runs in the background and measures how much time you spend on each website, based on which tab is active and whether your browser is idle. It stores this data locally per day, and presents it through a popup dashboard with daily, weekly, and monthly views. It also includes an optional site-blocking feature that can redirect you away from distracting sites.

Per the extension manifest, it requires no account and no data collection permissions — all tracking data is kept in the browser's local storage on the device where it's installed.

## Key features

Based on the current source code:

- **Automatic time tracking per site** — tracks the active tab's hostname and accumulates seconds spent on it per calendar day (`background.js`).
- **Idle detection** — pauses tracking when the browser is idle or locked, using the WebExtensions `idle` API (60-second detection threshold) and window-focus events, so time isn't counted while you're away.
- **Automatic category tagging** — each site is automatically classified into one of five categories (Work, Learning, Social, Entertainment, Other) using a built-in hostname-matching ruleset covering common sites (e.g. GitHub, Notion, and Slack as Work; Stack Overflow and MDN as Learning; Reddit and X/Twitter as Social; YouTube and Netflix as Entertainment).
- **Popup dashboard** with:
  - Today / Week / Month view toggle
  - Summary stats: total time, number of sites visited, and "productive" time (Work + Learning categories), each compared against the previous equivalent period
  - A category breakdown bar with a color-coded legend
  - A "Top sites" list (top 8 by time) with per-site time bars, sortable by time or alphabetically
  - A live indicator showing the site currently being tracked
- **Nine built-in color themes** for the popup (Dark, Catppuccin Mocha, Catppuccin Latte, Tokyo Night, Rosé Pine, Gruvbox, Nord, Dracula, Solarized), switchable from an in-popup theme picker and persisted in local storage.
- **Site blocking** — a settings/options page (`options.html`) lets you add hostnames to a block list, with an optional custom redirect URL for each entry. A content script (`content.js`) checks each page load against the block list and either redirects to your chosen URL or to a built-in "Blocked" page (`blocked.html`).
- **Data export** — the popup includes an "Export" button that downloads all locally stored tracking data as a timestamped JSON file.
- **Firefox-focused, cross-browser-aware code** — scripts detect the `browser` global (Firefox) and fall back to `chrome` where available, and the manifest declares Firefox-specific settings (`browser_specific_settings.gecko`) including a minimum Firefox version of 140.
- **Local-only by design** — the manifest declares `data_collection_permissions` of `"none"`, and all tracking/blocking data is read from and written to `browser.storage.local`; the code does not send data to any external server.

## Installation

The recommended way to install Tab Time Tracker is from Mozilla Add-ons:

**➡️ https://addons.mozilla.org/en-US/firefox/addon/tab-time-tracker-by-drago/**

This is the official, signed release of the extension described in this repository, listed under the name **"Tab Time Tracker by Drago."**

## Development / running from source

To run this repository's code directly in Firefox for development or testing:

1. Clone the repository:
   ```bash
   git clone https://github.com/lorddrago12/Tab-Time-Tracker.git
   ```
2. Move into the project directory:
   ```bash
   cd Tab-Time-Tracker
   ```
3. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on…**.
5. Select the `manifest.json` file from the cloned repository.
6. The extension icon will appear in the toolbar. Temporary add-ons are removed when Firefox is closed and need to be reloaded for further testing.

There is no build step, bundler, or package manager configuration in this repository — the extension runs directly from the raw HTML, CSS, and JavaScript files listed below.

## Technologies used

- **WebExtensions API** (`browser.*`, with a `chrome.*` fallback) — tabs, storage, alarms, and idle APIs
- **Manifest V2** (`manifest_version: 2`)
- **Vanilla JavaScript** — no frameworks or external JS libraries
- **HTML & CSS** — including CSS custom properties (`data-theme` attribute) for the popup's theme system

## Project structure

```
Tab-Time-Tracker/
├── manifest.json      # Extension manifest (Manifest V2, Firefox-targeted)
├── background.js      # Core tracking logic: active tab detection, idle handling, categorization, storage
├── content.js          # Injected on every page to check/enforce the site block list
├── popup.html          # Popup dashboard markup
├── popup.js            # Popup logic: rendering stats, charts, site list, themes, export
├── popup.css           # Popup styling and theme definitions
├── options.html        # Settings page markup (blocked sites manager)
├── options.js           # Settings page logic (add/edit/remove blocked sites)
├── blocked.html         # Page shown when a blocked site is visited (no redirect configured)
├── icons/               # Extension icons (16px, 48px, 128px)
└── README.txt            # Placeholder note about the icons folder
```

## Permissions

As declared in `manifest.json`, the extension requests:

| Permission | Purpose in this codebase |
|---|---|
| `tabs` | Read the active tab's URL/ID to determine which site to track (`background.js`). |
| `storage` | Persist daily tracking data, blocked-site lists, and theme preference locally via `browser.storage.local`. |
| `alarms` | Periodically flush in-progress tracking time to storage every 30 seconds. |
| `idle` | Detect when the browser is idle or locked so idle time isn't counted as active browsing. |
| `activeTab` | Access the currently active tab in response to user interaction (e.g. opening the popup). |
| `<all_urls>` | Required for the content script (`content.js`) to run on any page in order to check it against the block list, and for the background script to read tab URLs across all sites for tracking. |

The manifest also declares `data_collection_permissions: { required: ["none"] }` under `browser_specific_settings.gecko`, and `blocked.html` is listed as a `web_accessible_resource` so it can be loaded as the destination for blocked-site redirects.

## License

This project is licensed under the [MIT License](LICENSE).

mozilla-site-verification=a6edd0c2caf64197b269dc7d4aeac0ad
