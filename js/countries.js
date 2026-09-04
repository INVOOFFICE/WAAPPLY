// Country cards — source of truth for the selected target countries.
// Renders the "التقديم حسب الدول" grid with pagination (8 per page) and passes
// the real ISO country code to the contact modal via the card's data-country attr.
// Runs before animations.js so the generated .reveal cards get staggered in.

(function(){
  'use strict';

  /* ===== Data (selected countries) =====
     f = sprite symbol tail (i-flag-*), w/h = flag viewBox for the rendered svg. */
  var COUNTRIES = [
    { code:'AT', name:'النمسا',           f:'at',  w:30, h:20 },
    { code:'SE', name:'السويد',           f:'se',  w:32, h:20 },
    { code:'NO', name:'النرويج',          f:'no',  w:33, h:24 },
    { code:'LV', name:'لاتفيا',           f:'lv',  w:30, h:15 },
    { code:'FI', name:'فنلندا',           f:'fi',  w:30, h:18 },
    { code:'CZ', name:'التشيك',           f:'cz',  w:30, h:20 },
    { code:'DE', name:'ألمانيا',          f:'de',  w:30, h:18 },
    { code:'ES', name:'إسبانيا',          f:'es',  w:30, h:20 },
    { code:'HR', name:'كرواتيا',          f:'hr',  w:30, h:15 },
    { code:'PL', name:'بولندا',           f:'pl',  w:40, h:25 },
    { code:'MT', name:'مالطا',            f:'mt',  w:30, h:20 },
    { code:'NL', name:'هولندا',           f:'nl',  w:30, h:20 }
  ];

  var DESC_TEMPLATES = [
    'كنستهدفو الشركات داخل {name} اللي ممكن تناسب الملف ديالك، وكنوصلو البروفايل ديالك ليهوم باش الـrecruteur يشوف واش مناسب للمنصب المنشور أو لفرصة أخرى داخل الشركة.',
    'فـ{name} كنبحثو على الشركات والفرص المناسبة ليك، وكنقدمو الملف ديالك للشركة — ماشي غير للمنصب اللي فالإعلان — باش الـrecruteur يقرر واش مناسب ليك لأي فرصة أخرى.',
    'داخل {name} كنوصلو البروفايل ديالك للشركات المناسبة بشكل منظم، باش يتعرفو عليك حتى إلا ما كانش منصب مناسب دابا — ويمكن يرجعو ليك إلا ظهرت فرصة كتوافق مهاراتك وخبرتك.'
  ];

  var PER_PAGE = 8;

  function cardHtml(c, idx){
    var desc = DESC_TEMPLATES[idx % DESC_TEMPLATES.length].replace('{name}', c.name);
    return '' +
      '<article class="country-card reveal">' +
        '<div class="country-media" aria-hidden="true">' +
          '<svg class="country-flag" viewBox="0 0 ' + c.w + ' ' + c.h + '" preserveAspectRatio="xMidYMid meet"><use href="#i-flag-' + c.f + '"/></svg>' +
        '</div>' +
        '<div class="country-body">' +
          '<span class="country-ico"><svg class="ic" aria-hidden="true"><use href="#i-map-pin"/></svg></span>' +
          '<h3>' + c.name + '</h3>' +
          '<p>' + desc + '</p>' +
          '<button type="button" data-contact-package="info" data-country="' + c.code + '" class="btn btn-ghost-light-2 country-cta">ابدأ التقديم في هذا البلد</button>' +
        '</div>' +
      '</article>';
  }

  function renderPage(grid, page){
    var start = (page - 1) * PER_PAGE;
    var end = Math.min(start + PER_PAGE, COUNTRIES.length);
    var html = '';
    for(var i = start; i < end; i++){
      html += cardHtml(COUNTRIES[i], i);
    }
    grid.innerHTML = html;

    // The page is already visible (pagination is on-screen), so reveal cards
    // immediately instead of waiting for the scroll observer.
    var cards = grid.querySelectorAll('.country-card.reveal');
    for(var k = 0; k < cards.length; k++){
      cards[k].classList.add('in');
    }
  }

  function renderGrid(){
    var grid = document.querySelector('.countries-grid');
    if(!grid){ return; }

    var page = 1;
    renderPage(grid, page);

    /* Pagination controls */
    var totalPages = Math.ceil(COUNTRIES.length / PER_PAGE);
    if(totalPages <= 1){ return; }

    var pager = document.createElement('nav');
    pager.className = 'countries-pager';
    pager.setAttribute('aria-label', 'التنقل بين الصفحات');

    /* Prev button */
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'countries-pager-btn';
    prev.setAttribute('aria-label', 'الصفحة السابقة');
    prev.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-arrow-left"/></svg>';
    prev.disabled = true;
    prev.addEventListener('click', function(){
      if(page > 1){
        page--;
        update();
      }
    });

    /* Page number buttons */
    var numWrap = document.createElement('div');
    numWrap.className = 'countries-pager-nums';
    var nums = [];
    for(var p = 1; p <= totalPages; p++){
      (function(pg){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'countries-pager-num' + (pg === page ? ' active' : '');
        b.textContent = pg;
        b.setAttribute('aria-label', 'الصفحة ' + pg);
        b.addEventListener('click', function(){
          if(page !== pg){
            page = pg;
            update();
          }
        });
        nums.push(b);
        numWrap.appendChild(b);
      })(p);
    }

    /* Next button */
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'countries-pager-btn';
    next.setAttribute('aria-label', 'الصفحة التالية');
    next.innerHTML = '<svg class="ic" aria-hidden="true" style="transform:scaleX(-1)"><use href="#i-arrow-left"/></svg>';
    if(totalPages <= 1){
      next.disabled = true;
    }
    next.addEventListener('click', function(){
      if(page < totalPages){
        page++;
        update();
      }
    });

    pager.appendChild(prev);
    pager.appendChild(numWrap);
    pager.appendChild(next);

    grid.parentNode.appendChild(pager);

    function update(){
      renderPage(grid, page);
      prev.disabled = page <= 1;
      next.disabled = page >= totalPages;
      for(var n = 0; n < nums.length; n++){
        nums[n].classList.toggle('active', n + 1 === page);
      }
      window.scrollToPager(grid);
    }
  }

  // Keep pagination in view after switching pages
  window.scrollToPager = function(grid){
    var pager = document.querySelector('.countries-pager');
    if(pager){
      pager.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
  };

  renderGrid();
})();
