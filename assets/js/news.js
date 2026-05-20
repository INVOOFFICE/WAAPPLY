/** Dynamic blog loader: fetches blogs.json and renders #blog section. */
const CLOCK_LG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3V6L8 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const CLOCK_SM = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.1"/><path d="M5 2.5V5L6.5 6.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;
const TAG_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L9 8H1L5 1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 4.5V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

const CAT_MAP = {
  'Actualités Schengen': { cls: 'tag-alert', label: 'Important' },
  'Visa par pays':       { cls: 'tag-info',  label: 'Visa par pays' },
  'Refus & Recours':     { cls: 'tag-alert', label: 'Refus' },
  'Dossier & Documents': { cls: 'tag-info',  label: 'Documents' },
  'Procédure & RDV':     { cls: 'tag-info',  label: 'Procédure' },
  'Conseils pratiques':  { cls: 'tag-news',  label: 'Conseils' },
  'Profils spécifiques': { cls: 'tag-news',  label: 'Profil' },
};

const TYPE_CLS = { alert: 'tag-alert', info: 'tag-info', news: 'tag-news' };

const FMT = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '';

function tagHtml(item) {
  // Use tag_type/tag_label from GAS if available
  if (item.tag_type && item.tag_label) {
    const cls = TYPE_CLS[item.tag_type] || 'tag-info';
    const icon = item.tag_type === 'alert' ? TAG_ICON + ' ' : '';
    return `<span class="news-tag ${cls}">${icon}${item.tag_label}</span>`;
  }
  // Fallback to category-based mapping
  const category = item.category || '';
  const m = CAT_MAP[category] || { cls: 'tag-info', label: category || 'Info' };
  const icon = m.cls === 'tag-alert' ? TAG_ICON + ' ' : '';
  return `<span class="news-tag ${m.cls}">${icon}${m.label}</span>`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function loadNews() {
  const section = document.getElementById('blog');
  const container = section?.querySelector('.news-layout');
  if (!container) return;

  let items;
  const urls = ['blogs-latest.json', '/WAAPPLY/blogs-latest.json', '/blogs-latest.json', 'blogs.json', '/WAAPPLY/blogs.json', '/blogs.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) continue;
      const raw = await res.json();
      items = (Array.isArray(raw) ? raw : (raw.all || []))
        .filter(i => i.status === 'published' && i.slug && i.title);
      if (items.length > 0) break;
    } catch (_) { /* try next */ }
  }

  if (!items || items.length === 0) {
    console.warn('[Blog] blogs.json introuvable');
    section.style.display = 'none';
    return;
  }

  const [first, second, third, fourth, fifth, sixth, seventh, eighth, ..._rest] = items;
  const leftMini = [third, fourth].filter(Boolean);
  const rightItems = [fifth, sixth, seventh, eighth].filter(Boolean);

  container.innerHTML = `
    <div class="news-main-col">
      <a href="blog/${esc(first.slug)}/" class="news-main-link">
        <div class="news-main">
          ${first.image_url ? `<img src="${esc(first.image_url)}" alt="" class="news-main-img" loading="lazy">` : ''}
          ${tagHtml(first)}
          <h4>${esc(first.title)}</h4>
          ${first.summary ? `<p>${esc(first.summary)}</p>` : ''}
          <div class="news-date">${CLOCK_LG} ${FMT(first.published_at)}</div>
        </div>
      </a>
      ${second ? `
      <a href="blog/${esc(second.slug)}/" class="news-sub-link">
        <div class="news-sub">
          ${second.image_url ? `<img src="${esc(second.image_url)}" alt="" class="news-sub-img" loading="lazy">` : ''}
          <div class="news-sub-body">
            ${tagHtml(second)}
            <h5>${esc(second.title)}</h5>
            <div class="news-date">${CLOCK_SM} ${FMT(second.published_at)}</div>
          </div>
        </div>
      </a>
      ` : ''}
      ${leftMini.map(a => `
      <a href="blog/${esc(a.slug)}/" class="news-item-link">
        <div class="news-item news-mini">
          ${tagHtml(a)}
          <h5>${esc(a.title)}</h5>
          <div class="news-date">${CLOCK_SM} ${FMT(a.published_at)}</div>
        </div>
      </a>
      `).join('')}
    </div>
    <div class="news-list">
      ${rightItems.map(a => `
        <a href="blog/${esc(a.slug)}/" class="news-item-link">
          <div class="news-item">
            ${a.image_url ? `<img src="${esc(a.image_url)}" alt="" class="news-item-img" loading="lazy">` : ''}
            ${tagHtml(a)}
            <h5>${esc(a.title)}</h5>
            <div class="news-date">${CLOCK_SM} ${FMT(a.published_at)}</div>
          </div>
        </a>
      `).join('')}
    </div>
  `;
}
