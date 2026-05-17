/** Dynamic news loader: fetches news.json and replaces static #actualites content. */
const NEWS_URLS = ['news.json', '/news.json'];
const TAG_CFG = {
  alert: { cls: 'tag-alert', icon: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L9 8H1L5 1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 4.5V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="5" cy="7.5" r=".5" fill="currentColor"/></svg>` },
  info:  { cls: 'tag-info',  icon: '' },
  news:  { cls: 'tag-news',  icon: '' },
};
const clockLg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3V6L8 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const clockSm = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.1"/><path d="M5 2.5V5L6.5 6.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;

const fmt = iso => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export async function loadNews() {
  const mainEl = document.querySelector('#actualites .news-main');
  const listEl = document.querySelector('#actualites .news-list');
  if (!mainEl || !listEl) return;

  let data;
  for (const url of NEWS_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) { data = await res.json(); break; }
    } catch (_) { /* try next */ }
  }

  if (!data || !data.main) return;

  const main = data.main;
  const items = data.items || [];
  const mainTag = TAG_CFG[main.tag_type] || TAG_CFG.news;

  mainEl.innerHTML = `
    <span class="news-tag ${mainTag.cls}">
      ${mainTag.icon ? mainTag.icon + ' ' : ''}${main.tag_label || 'Important'}
    </span>
    <h4>${main.title}</h4>
    ${main.summary ? `<p>${main.summary}</p>` : ''}
    <div class="news-date">${clockLg} ${fmt(main.published_at)}</div>
  `;

  if (items.length === 0) return;

  listEl.innerHTML = items.map(item => {
    const cfg = TAG_CFG[item.tag_type] || TAG_CFG.info;
    return `
      <div class="news-item">
        <span class="news-tag ${cfg.cls}">${item.tag_label || 'Info'}</span>
        <h5>${item.title}</h5>
        <div class="news-date">${clockSm} ${fmt(item.published_at)}</div>
      </div>
    `;
  }).join('');
}
