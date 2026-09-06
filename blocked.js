const site = new URLSearchParams(location.search).get('site') || 'this site';
document.getElementById('domain').textContent = site;
