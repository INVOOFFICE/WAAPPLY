// Free European manufacturing-industry job offers page — renders
// window.OFFERS_MFG_DATA (generated from eures_jobs_SECC.csv, EURES) with 50
// offers per page, search on title / Arabic title / employer, country +
// sector filters, date sorting, pagination, email reveal/copy and
// original-source links.
// Vanilla JS, no dependencies, works over file:// (data is a classic script).

(function(){
  'use strict';

  var DATA = window.OFFERS_MFG_DATA || [];
  var PER_PAGE = 50;
  var state = { page:1, search:'', country:'', sector:'', sort:'new' };

  var grid     = document.getElementById('offers-grid');
  var countEl  = document.getElementById('offers-count');
  var emptyEl  = document.getElementById('offers-empty');
  var pagerEl  = document.getElementById('offers-pager');
  var pagerNumsEl = document.getElementById('offers-pager-nums');
  var prevBtn  = document.getElementById('offers-pager-prev');
  var nextBtn  = document.getElementById('offers-pager-next');
  var searchEl = document.getElementById('offers-search');
  var countryEl = document.getElementById('offers-country');
  var sectorEl = document.getElementById('offers-sector');
  var sortEl   = document.getElementById('offers-sort');

  if(!grid || !DATA.length){ return; }

  /* ---------- esc: escape text for safe insertion into HTML ---------- */
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function ic(name){ return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function latin(s){ return '<span class="latin">' + esc(s) + '</span>'; }
  function has(v){ return v && String(v) !== '-'; }

  /* ---------- build country + sector filter options from the data ---------- */
  (function fillFilters(){
    var seenC = {}, countries = [];
    var seenS = {}, sectors = [];
    DATA.forEach(function(o){
      if(has(o.c) && !seenC[o.c]){ seenC[o.c] = 1; countries.push({ v:o.c, l:has(o.ca) ? o.ca : o.c }); }
      if(has(o.sa) && !seenS[o.sa]){ seenS[o.sa] = 1; sectors.push({ v:o.sa, l:o.sa }); }
    });
    function byLabel(a, b){ return String(a.l).localeCompare(String(b.l), 'ar'); }
    countries.sort(byLabel);
    sectors.sort(byLabel);
    function append(el, pairs){
      pairs.forEach(function(p){
        var opt = document.createElement('option');
        opt.value = p.v;
        opt.textContent = p.l;
        el.appendChild(opt);
      });
    }
    append(countryEl, countries);
    append(sectorEl, sectors);
  })();

  /* ---------- filtering / sorting ---------- */
  function cmpTitle(a, b){
    var x = (has(a.t) ? a.t : '').toLowerCase();
    var y = (has(b.t) ? b.t : '').toLowerCase();
    if(x === y){ return 0; }
    return x < y ? -1 : 1;
  }

  function filtered(){
    var q = state.search.toLowerCase();
    var list = DATA.filter(function(o){
      if(state.country && o.c !== state.country){ return false; }
      if(state.sector && o.sa !== state.sector){ return false; }
      if(q){
        var aText = (has(o.a) && o.a) ? (o.a + ' ') : '';
        var hay = (o.t + ' ' + aText + o.e + ' ' + o.ca + ' ' + o.sa).toLowerCase();
        if(hay.indexOf(q) === -1){ return false; }
      }
      return true;
    });
    list.sort(function(a, b){
      if(state.sort === 'az'){ return cmpTitle(a, b); }
      // d is an ISO "YYYY-MM-DD" string, so lexicographic order is chronological
      var d = a.d < b.d ? -1 : (a.d > b.d ? 1 : 0);
      if(state.sort === 'old'){ return d !== 0 ? d : cmpTitle(a, b); }
      return d !== 0 ? -d : cmpTitle(a, b);
    });
    return list;
  }

  /* ---------- card rendering ---------- */
  function cardHtml(o){
    var chips = '';
    if(has(o.ca)){ chips += '<span class="offer-chip">' + ic('globe') + 'الدولة: ' + esc(o.ca) + '</span>'; }
    if(has(o.d)){ chips += '<span class="offer-chip">' + ic('clock') + '<span class="offer-date latin">' + esc(o.d) + '</span></span>'; }

    var title = has(o.t)
      ? esc(o.t)
      : '<span class="is-muted">غير متوفر</span>';

    // Arabic helper line under the original title (rendered in the natural RTL
    // direction; omitted when the generated record has no Arabic translation).
    var arLine = (has(o.a) && o.a)
      ? '<p class="offer-title-ar" dir="auto">' + esc(o.a) + '</p>'
      : '';

    var employer = has(o.e)
      ? '<div class="offer-employer">' + ic('building-2') + '<span>' + esc(o.e) + '</span></div>'
      : '<div class="offer-employer is-muted">' + ic('building-2') + '<span>غير متوفر</span></div>';

    var emailBtn = '<button type="button" class="btn btn-ghost-light-2 offer-email-btn" data-email="' + esc(has(o.m) ? o.m : '') + '">' + ic('mail') + 'إظهار البريد الإلكتروني</button>';

    var sourceBlock = has(o.u)
      ? '<a class="btn btn-ghost-light-2 offer-source-link" href="' + esc(o.u) + '" target="_blank" rel="noopener noreferrer">' + ic('globe') + 'عرض المصدر الأصلي</a>'
      : '<span class="offer-source-na">غير متوفر</span>';

    return '' +
      '<article class="offer-card">' +
        '<h3 class="offer-title">' + title + '</h3>' +
        arLine +
        employer +
        '<div class="offer-chips">' + chips + '</div>' +
        '<div class="offer-divider"></div>' +
        '<div class="offer-actions">' +
          '<div class="offer-act"><span class="offer-act-label">المصدر الأصلي للعرض</span>' + sourceBlock + '</div>' +
          '<div class="offer-act"><span class="offer-act-label">البريد الإلكتروني</span>' + emailBtn + '</div>' +
        '</div>' +
        '<div class="offer-email-panel" hidden></div>' +
        '<div class="offer-cta-premium">' +
          '<span class="offer-cta-premium-label">' + ic('sparkles') + 'خدماتنا المميزة</span>' +
          '<button type="button" class="btn btn-gold offer-cta-btn" data-premium-info>عرض التفاصيل</button>' +
        '</div>' +
      '</article>';
  }

  function emailPanelHtml(o){
    if(!has(o.m)){
      return '<span class="offer-email-unavailable">' + ic('circle-alert') + 'البريد الإلكتروني غير متوفر لهذا العرض</span>';
    }
    return '' +
      '<span class="offer-email-label">' + ic('mail') + 'البريد الإلكتروني</span>' +
      '<a class="offer-email-value latin" href="mailto:' + esc(o.m) + '">' + esc(o.m) + '</a>' +
      '<button type="button" class="offer-email-copy">' + ic('copy') + '<span>نسخ البريد الإلكتروني</span></button>';
  }

  /* ---------- rendering ---------- */
  function render(){
    var list = filtered();
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if(state.page > totalPages){ state.page = totalPages; }
    if(state.page < 1){ state.page = 1; }

    var start = (state.page - 1) * PER_PAGE;
    var pageItems = list.slice(start, start + PER_PAGE);

    // grid
    var html = '';
    for(var i = 0; i < pageItems.length; i++){ html += cardHtml(pageItems[i]); }
    grid.innerHTML = html;

    // count
    var first = total ? start + 1 : 0;
    var last = total ? Math.min(start + PER_PAGE, total) : 0;
    countEl.innerHTML = (total === 0)
      ? 'ما لقينا حتى عرض'
      : 'عرض <span class="latin">' + first + '</span> – <span class="latin">' + last + '</span> من أصل <span class="latin">' + total.toLocaleString('en-US') + '</span> عرض';

    // empty state
    emptyEl.hidden = total !== 0;
    grid.hidden = total === 0;

    // pager
    pagerEl.hidden = totalPages <= 1;
    renderPager(totalPages, total);
  }

  function renderPager(totalPages){
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;

    var items = pageWindow(state.page, totalPages);
    var html = '';
    for(var i = 0; i < items.length; i++){
      var it = items[i];
      if(it === '...'){
        html += '<span class="offers-pager-num ellipsis">…</span>';
      } else {
        html += '<button type="button" class="offers-pager-num' + (it === state.page ? ' active' : '') + '" data-page="' + it + '">' + it + '</button>';
      }
    }
    pagerNumsEl.innerHTML = html;
  }

  function pageWindow(current, total){
    var pages = [1];
    var lo = Math.max(2, current - 2);
    var hi = Math.min(total - 1, current + 2);
    if(lo > 2){ pages.push('...'); }
    for(var i = lo; i <= hi; i++){ pages.push(i); }
    if(hi < total - 1){ pages.push('...'); }
    if(total > 1){ pages.push(total); }
    return pages;
  }

  /* ---------- navigation helpers ---------- */
  function go(page){
    state.page = page;
    render();
    var meta = document.querySelector('.offers-results');
    if(meta){
      window.requestAnimationFrame(function(){
        meta.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    }
  }

  /* ---------- events ---------- */
  var searchTimer = null;
  searchEl.addEventListener('input', function(){
    state.search = searchEl.value;
    state.page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 220);
  });
  countryEl.addEventListener('change', function(){ state.country = countryEl.value; state.page = 1; render(); });
  sectorEl.addEventListener('change', function(){ state.sector = sectorEl.value; state.page = 1; render(); });
  sortEl.addEventListener('change', function(){ state.sort = sortEl.value; state.page = 1; render(); });

  prevBtn.addEventListener('click', function(){ if(state.page > 1){ go(state.page - 1); } });
  nextBtn.addEventListener('click', function(){ if(state.page < Math.ceil(filtered().length / PER_PAGE)){ go(state.page + 1); } });
  pagerNumsEl.addEventListener('click', function(e){
    var b = e.target.closest('.offers-pager-num');
    if(b && b.dataset.page){ go(parseInt(b.dataset.page, 10)); }
  });

  // Grid interactions via delegation: email reveal, email copy
  grid.addEventListener('click', function(e){
    var eb = e.target.closest('.offer-email-btn');
    if(eb){
      var card2 = eb.closest('.offer-card');
      var panel = card2.querySelector('.offer-email-panel');
      if(panel.hidden){
        var email = eb.getAttribute('data-email') || '';
        panel.innerHTML = emailPanelHtml({ m: email });
        panel.hidden = false;
        eb.hidden = true;
      } else {
        panel.hidden = true;
        eb.hidden = false;
      }
      return;
    }

    var cb = e.target.closest('.offer-email-copy');
    if(cb){
      var valueEl = cb.closest('.offer-email-panel').querySelector('.offer-email-value');
      if(valueEl){
        copyText(valueEl.textContent, cb);
      }
      return;
    }
  });

  /* ---------- copy helper (clipboard API + fallback) ---------- */
  function copyText(text, btn){
    function done(){
      var label = btn.querySelector('span');
      btn.classList.add('copied');
      if(label){ label.textContent = 'تم النسخ'; }
      setTimeout(function(){
        btn.classList.remove('copied');
        if(label){ label.textContent = 'نسخ البريد الإلكتروني'; }
      }, 1600);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(function(){ fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta);
    done();
  }

  /* ---------- premium info modal ---------- */
  var pmOverlay = document.getElementById('pmOverlay');
  var pmOpen = false;

  function openPm(){
    if(!pmOverlay || pmOpen) return;
    pmOverlay.setAttribute('aria-hidden','false');
    document.body.classList.add('pm-lock');
    pmOpen = true;
  }
  function closePm(){
    if(!pmOverlay || !pmOpen) return;
    pmOverlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('pm-lock');
    pmOpen = false;
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-premium-info]')){
      e.preventDefault();
      openPm();
      return;
    }
    if(pmOpen && e.target.closest('[data-pm-close]')){
      closePm();
    }
  });
  document.addEventListener('keydown', function(e){
    if(pmOpen && e.key === 'Escape'){ e.preventDefault(); closePm(); }
  });

  /* ---------- init ---------- */
  render();
})();
