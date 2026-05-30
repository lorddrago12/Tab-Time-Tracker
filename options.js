const api = typeof browser !== 'undefined' ? browser : chrome;

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
