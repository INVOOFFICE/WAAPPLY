// Sector cards — source of truth for the 11 target economic sectors.
// Renders the "التقديم حسب القطاعات" grid (the sector equivalent of the
// countries grid). Each CTA carries the generic "info" contact trigger plus a
// data-sector attribute (the canonical French name) so the chosen sector
// travels through the contact modal into the payload. No country code is sent.
// Runs before animations.js so the generated .reveal cards get staggered in.

(function(){
  'use strict';

  /* ===== Data (11 economic sectors) =====
     img  = real photo filename in assets/images (kept verbatim, URL-encoded at
            render time), icon = Lucide sprite symbol tail (i-*). The French
            sector name (fr) is internal metadata only — never rendered. */
  var SECTORS = [
    { key:'industrie-manufacturiere', name:'الصناعة التحويلية', fr:'Industrie manufacturière', img:'Industrie manufacturière.jpg', icon:'i-factory',
      desc:'المصانع وخطوط الإنتاج فـ أوروبا كيبقاو باغين طاقات جديدة. كنستهدف شركات التصنيع اللي كتناسب الخبرة ديالك وكنوصّل ليهم البروفايل ديالك.' },
    { key:'hebergement-restauration', name:'الإيواء والمطاعم', fr:'Hébergement et restauration', img:'Hébergement et restauration .jpg', icon:'i-utensils',
      desc:'الفنادق والمطاعم والكوفيات قطاع كيدوّر على كادر بزاف. كنوجّهو البحث والترشيح للشركات المناسبة ليك فهاد المجال.' },
    { key:'services-administratifs', name:'أنشطة الخدمات الإدارية والدعم', fr:'Activités de service administratif et de soutien', img:'Activités de service administratif et de soutien .jpg', icon:'i-headset',
      desc:'الدعم الإداري والاستقبال والخدمات السندية. كنوصّلو البروفايل ديالك للشركات اللي محتاجة هاد النوع من الطاقات والكفاءات.' },
    { key:'commerce-gros-detail', name:'تجارة الجملة والتجزئة', fr:'Commerce de gros et de détail', img:'Commerce de gros et de détail .jpg', icon:'i-shopping-cart',
      desc:'البيع بالجملة والتجزئة والمخازن الكبيرة. كنعبرو بروفايلك للشركات التجارية المناسبة — فالمتاجر ولا فالتوزيع.' },
    { key:'activites-specialisees', name:'الأنشطة المتخصصة والعلمية والتقنية', fr:'Activités spécialisées, scientifiques et techniques', img:'Activités spécialisées, scientifiques et techniques .jpg', icon:'i-science',
      desc:'الهندسة والمجالات العلمية والتقنية. كنستهدف الشركات المتخصصة اللي كتناسب التكوين ديالك وكنقدمو ملفك بشكل احترافي.' },
    { key:'construction', name:'البناء والأشغال', fr:'Construction', img:'Construction .jpg', icon:'i-hammer',
      desc:'البناء والأشغال العامة والتجهيز. قطاع كيرحب بالخبرة، وكنوصّل طلبك لشركات البناء والأشغال فـ أوروبا.' },
    { key:'sante-action-sociale', name:'الصحة البشرية والعمل الاجتماعي', fr:"Santé humaine et activités d'action sociale", img:"Santé humaine et activités d'action sociale .jpg", icon:'i-shield',
      desc:'المستوصفات ودور الرعاية والمراكز الصحية والاجتماعية. كنتبعو الفرص المناسبة للكفاءات فالمجال الطبي والاجتماعي.' },
    { key:'enseignement', name:'التعليم', fr:'Enseignement', img:'Enseignement.jpg', icon:'i-graduation',
      desc:'المدارس والمعاهد والمؤسسات التربوية. كنوصّلو البروفايل ديالك للمؤسسات التعليمية اللي كتناسب التكوين ديالك.' },
    { key:'autres-services', name:'أنشطة الخدمات الأخرى', fr:'Autres activités de services', img:'Autres activités de services .jpg', icon:'i-sparkles',
      desc:'الخدمات الشخصية والأنشطة الخدماتية الأخرى. كنوصّل ملفك للمؤسسات الصغيرة والمتوسطة اللي محتاجة أيدٍ خدامة.' },
    { key:'transports-entreposage', name:'النقل والتخزين', fr:'Transports et entreposage', img:'Transports et entreposage .jpg', icon:'i-truck',
      desc:'النقل البري والتخزين. قطاع كيبقى باغي السواقين وعمال المستودعات، وكنوجّهو الترشيح للشركات المناسبة.' },
    { key:'agriculture-sylviculture-peche', name:'الفلاحة والغابات والصيد', fr:'Agriculture, sylviculture et pêche', img:'Agriculture, sylviculture et pêche.jpg', icon:'i-agriculture',
      desc:'الفلاحة والدفيئات والغابات والصيد البحري. فرص موسمية وثابتة، وكنقدمو طلبك للمقاولات الفلاحية والمستغلّين.' }
  ];

  /* 6 sectors per page — same pagination pattern as the countries grid. */
  var PER_PAGE = 6;

  function cardHtml(s){
    var src = 'assets/images/' + s.img;
    return '' +
      '<article class="sector-card reveal" data-sector="' + s.key + '">' +
        '<div class="sector-media">' +
          '<img src="' + encodeURI(src) + '" alt="' + s.name + '" width="1060" height="1484" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="sector-body">' +
          '<span class="country-ico sector-ico" aria-hidden="true"><svg class="ic"><use href="#' + s.icon + '"/></svg></span>' +
          '<h3 class="sector-title">' + s.name + '</h3>' +
          '<p class="sector-desc">' + s.desc + '</p>' +
          '<button type="button" data-contact-package="info" data-sector="' + s.fr + '" class="btn btn-ghost-light-2 sector-cta">ابدأ التقديم في هذا المجال</button>' +
        '</div>' +
      '</article>';
  }

  function renderPage(grid, page){
    var start = (page - 1) * PER_PAGE;
    var end = Math.min(start + PER_PAGE, SECTORS.length);
    var html = '';
    for(var i = start; i < end; i++){
      html += cardHtml(SECTORS[i]);
    }
    grid.innerHTML = html;

    // The page is already visible (pagination is on-screen), so reveal cards
    // immediately instead of waiting for the scroll observer.
    var cards = grid.querySelectorAll('.sector-card.reveal');
    for(var k = 0; k < cards.length; k++){
      cards[k].classList.add('in');
    }
  }

  function renderGrid(){
    var grid = document.querySelector('.sectors-grid');
    if(!grid){ return; }

    var page = 1;
    renderPage(grid, page);

    /* Pagination controls */
    var totalPages = Math.ceil(SECTORS.length / PER_PAGE);
    if(totalPages <= 1){ return; }

    var pager = document.createElement('nav');
    pager.className = 'sectors-pager';
    pager.setAttribute('aria-label', 'التنقل بين الصفحات');

    /* Prev button */
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'sectors-pager-btn';
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
    numWrap.className = 'sectors-pager-nums';
    var nums = [];
    for(var p = 1; p <= totalPages; p++){
      (function(pg){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sectors-pager-num' + (pg === page ? ' active' : '');
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
    next.className = 'sectors-pager-btn';
    next.setAttribute('aria-label', 'الصفحة التالية');
    next.innerHTML = '<svg class="ic" aria-hidden="true" style="transform:scaleX(-1)"><use href="#i-arrow-left"/></svg>';
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
      window.scrollToSectorsPager(grid);
    }
  }

  // Keep sector pagination in view after switching pages
  window.scrollToSectorsPager = function(grid){
    var pager = document.querySelector('.sectors-pager');
    if(pager){
      pager.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
  };

  renderGrid();
})();