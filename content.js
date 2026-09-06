// Firefox-compatible blocker
(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  api.storage.local.get(['blockedSites'], function (data) {
    const blockedSites = data.blockedSites || [];
    const currentHost = location.hostname.replace(/^www\./, '').toLowerCase();

    const matched = blockedSites.find(entry => {
      const site = (typeof entry === 'string' ? entry : entry.site || '')
        .replace(/^www\./, '').toLowerCase().trim();
      return site && (currentHost === site || currentHost.endsWith('.' + site));
    });

    if (!matched) return;

    const redirectUrl = typeof matched === 'object' ? matched.redirect : null;

    if (redirectUrl) {
      location.replace(redirectUrl.startsWith('http') ? redirectUrl : 'https://' + redirectUrl);
      return;
    }

    // Redirect to our own blocked page — bypasses all CSP issues
    location.replace(api.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(location.hostname));
  });
})();
