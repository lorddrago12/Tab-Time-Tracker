const api = typeof browser !== 'undefined' ? browser : chrome;

// ─── Tabs ─────────────────────────────────────────────────────────────────
// Keeps the Blocked Sites and Category Overrides sections on separate tabs
// so a long blocked-sites list doesn't push categories out of reach.

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const isActive = btn.id === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === document.getElementById(tabId).dataset.panel);
  });
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateTab(btn.id);
    api.storage.local.set({ settingsTab: btn.id });
  });
});

(async () => {
  const result = await api.storage.local.get(['settingsTab']);
  if (result.settingsTab && document.getElementById(result.settingsTab)) {
    activateTab(result.settingsTab);
  }
})();

async function getBlockedSites() {
  const result = await api.storage.local.get(['blockedSites']);
  return result.blockedSites || [];
}

async function saveBlockedSites(sites) {
  await api.storage.local.set({ blockedSites: sites });
}

function normalizeUrl(input) {
  return input.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

async function renderList() {
  const sites = await getBlockedSites();
  const list = document.getElementById('blocked-list');
  list.innerHTML = '';

  if (sites.length === 0) {
    list.innerHTML = '<div class="empty">No sites blocked yet</div>';
    return;
  }

  sites.forEach((entry, i) => {
    const site = typeof entry === 'string' ? entry : entry.site;
    const redirect = typeof entry === 'object' ? (entry.redirect || '') : '';

    const item = document.createElement('div');
    item.className = 'blocked-item';

    const info = document.createElement('div');
    info.className = 'item-info';

    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site;

    const redirectLabel = document.createElement('span');
    redirectLabel.className = 'redirect-label';
    redirectLabel.textContent = redirect ? '→ ' + redirect : 'No redirect';

    info.appendChild(siteName);
    info.appendChild(redirectLabel);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditModal(i, site, redirect));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', async () => {
      const updated = sites.filter((_, idx) => idx !== i);
      await saveBlockedSites(updated);
      renderList();
      showToast('Site removed');
    });

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function openEditModal(index, site, redirect) {
  document.getElementById('modal-site').value = site;
  document.getElementById('modal-redirect').value = redirect;
  document.getElementById('modal').dataset.index = index;
  document.getElementById('modal-overlay').classList.add('show');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('show');
});

document.getElementById('modal-save').addEventListener('click', async () => {
  const index = parseInt(document.getElementById('modal').dataset.index);
  const site = normalizeUrl(document.getElementById('modal-site').value);
  const redirect = normalizeUrl(document.getElementById('modal-redirect').value);
  if (!site) return;

  const sites = await getBlockedSites();
  sites[index] = redirect ? { site, redirect } : site;
  await saveBlockedSites(sites);
  document.getElementById('modal-overlay').classList.remove('show');
  renderList();
  showToast('Saved!');
});

document.getElementById('add-btn').addEventListener('click', async () => {
  const siteInput = document.getElementById('url-input');
  const redirectInput = document.getElementById('redirect-input');
  const site = normalizeUrl(siteInput.value);
  const redirect = normalizeUrl(redirectInput.value);
  if (!site) return;

  const sites = await getBlockedSites();
  const exists = sites.some(e => (typeof e === 'string' ? e : e.site) === site);
  if (exists) { showToast('Already blocked!'); return; }

  sites.push(redirect ? { site, redirect } : site);
  await saveBlockedSites(sites);
  siteInput.value = '';
  redirectInput.value = '';
  renderList();
  showToast('Site blocked ✓');
});

document.getElementById('url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-btn').click();
});

renderList();

// ─── Category overrides ───────────────────────────────────────────────────

const CATEGORY_COLORS = {
  work: '#1D9E75',
  learning: '#378ADD',
  social: '#D85A30',
  entertainment: '#BA7517',
};

const CATEGORY_LABELS = {
  work: 'Work',
  learning: 'Learning',
  social: 'Social',
  entertainment: 'Entertainment',
};

async function getCategoryOverrides() {
  const result = await api.storage.local.get(['categoryOverrides']);
  return result.categoryOverrides || {};
}

async function saveCategoryOverrides(overrides) {
  await api.storage.local.set({ categoryOverrides: overrides });
}

// Updates the category on every stored day already recorded for this
// hostname, so past data reflects the override immediately instead of
// only new tracking going forward.
async function applyCategoryToHistory(hostname, category) {
  const all = await api.storage.local.get(null);
  const updates = {};
  for (const [key, day] of Object.entries(all)) {
    if (key.startsWith('data_') && day && day.sites && day.sites[hostname]) {
      day.sites[hostname].category = category;
      updates[key] = day;
    }
  }
  if (Object.keys(updates).length) {
    await api.storage.local.set(updates);
  }
}

async function renderCategoryList() {
  const overrides = await getCategoryOverrides();
  const list = document.getElementById('category-list');
  list.innerHTML = '';

  const entries = Object.entries(overrides);
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">No custom categories yet</div>';
    return;
  }

  entries.forEach(([site, category]) => {
    const item = document.createElement('div');
    item.className = 'blocked-item';

    const info = document.createElement('div');
    info.className = 'item-info';

    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site;

    const badge = document.createElement('span');
    badge.className = 'cat-badge';
    badge.style.color = CATEGORY_COLORS[category] || '#7d8590';
    badge.textContent = CATEGORY_LABELS[category] || category;

    info.appendChild(siteName);
    info.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', async () => {
      const updated = await getCategoryOverrides();
      delete updated[site];
      await saveCategoryOverrides(updated);
      renderCategoryList();
      showToast('Category override removed');
    });

    actions.appendChild(removeBtn);
    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

document.getElementById('cat-add-btn').addEventListener('click', async () => {
  const siteInput = document.getElementById('cat-url-input');
  const categorySelect = document.getElementById('cat-select');
  const site = normalizeUrl(siteInput.value);
  const category = categorySelect.value;
  if (!site) return;

  const overrides = await getCategoryOverrides();
  overrides[site] = category;
  await saveCategoryOverrides(overrides);
  await applyCategoryToHistory(site, category);

  siteInput.value = '';
  renderCategoryList();
  showToast('Category set ✓');
});

document.getElementById('cat-url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('cat-add-btn').click();
});

renderCategoryList();
