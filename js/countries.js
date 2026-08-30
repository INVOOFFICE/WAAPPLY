// Country cards — single source of truth for the 31 target countries.
// Renders the "التقديم حسب الدول" grid from the COUNTRIES data and passes the
// real ISO country code to the contact modal via the card's data-country attr.
// Runs before animations.js so the generated .reveal cards get staggered in.

(function(){
  'use strict';

  /* ===== Data (exactly the 31 target countries) =====
     f = sprite symbol tail (i-flag-*), w/h = flag viewBox for the rendered svg. */
  var COUNTRIES = [
    { code:'DE', name:'ألمانيا',          f:'de',  w:30, h:18 },
    { code:'FR', name:'فرنسا',            f:'fr',  w:30, h:20 },
    { code:'NL', name:'هولندا',           f:'nl',  w:30, h:20 },
    { code:'BE', name:'بلجيكا',           f:'be',  w:13, h:15 },
    { code:'SE', name:'السويد',           f:'se',  w:32, h:20 },
    { code:'AT', name:'النمسا',           f:'at',  w:30, h:20 },
    { code:'CH', name:'سويسرا',           f:'ch',  w:20, h:20 },
    { code:'CZ', name:'التشيك',           f:'cz',  w:30, h:20 },
    { code:'ES', name:'إسبانيا',          f:'es',  w:30, h:20 },
    { code:'PL', name:'بولندا',           f:'pl',  w:40, h:25 },
    { code:'FI', name:'فنلندا',           f:'fi',  w:30, h:18 },
    { code:'NO', name:'النرويج',          f:'no',  w:33, h:24 },
    { code:'BG', name:'بلغاريا',          f:'bg',  w:30, h:18 },
    { code:'SK', name:'سلوفاكيا',         f:'sk',  w:30, h:20 },
    { code:'EE', name:'إستونيا',          f:'ee',  w:30, h:18 },
    { code:'HR', name:'كرواتيا',          f:'hr',  w:30, h:15 },
    { code:'IT', name:'إيطاليا',          f:'it',  w:30, h:20 },
    { code:'IE', name:'أيرلندا',          f:'ie',  w:30, h:15 },
    { code:'IS', name:'آيسلندا',          f:'is',  w:25, h:18 },
    { code:'HU', name:'المجر',            f:'hu',  w:30, h:15 },
    { code:'EL', name:'اليونان',          f:'el',  w:27, h:18 },
    { code:'CY', name:'قبرص',             f:'cy',  w:30, h:20 },
    { code:'DK', name:'الدنمارك',         f:'dk',  w:37, h:28 },
    { code:'LV', name:'لاتفيا',           f:'lv',  w:30, h:15 },
    { code:'MT', name:'مالطا',            f:'mt',  w:30, h:20 },
    { code:'LI', name:'ليختنشتاين',       f:'li',  w:30, h:18 },
    { code:'LT', name:'ليتوانيا',         f:'lt',  w:30, h:18 },
    { code:'LU', name:'لوكسمبورغ',        f:'lu',  w:30, h:18 },
    { code:'SI', name:'سلوفينيا',         f:'si',  w:30, h:15 },
    { code:'RO', name:'رومانيا',          f:'ro',  w:30, h:20 },
    { code:'PT', name:'البرتغال',         f:'pt',  w:30, h:20 }
  ];

  var DESC_TEMPLATES = [
    'كنستهدفو الشركات داخل {name} اللي ممكن تناسب الملف ديالك، وكنوصلو البروفايل ديالك ليهوم باش الـrecruteur يشوف واش مناسب للمنصب المنشور أو لفرصة أخرى داخل الشركة.',
    'فـ{name} كنبحثو على الشركات والفرص المناسبة ليك، وكنقدمو الملف ديالك للشركة — ماشي غير للمنصب اللي فالإعلان — باش الـrecruteur يقرر واش مناسب ليك لأي فرصة أخرى.',
    'داخل {name} كنوصلو البروفايل ديالك للشركات المناسبة بشكل منظم، باش يتعرفو عليك حتى إلا ما كانش منصب مناسب دابا — ويمكن يرجعو ليك إلا ظهرت فرصة كتوافق مهاراتك وخبرتك.'
  ];

  function renderGrid(){
    var grid = document.querySelector('.countries-grid');
    if(!grid){ return; }

    var html = '';
    for(var i = 0; i < COUNTRIES.length; i++){
      var c = COUNTRIES[i];
      var desc = DESC_TEMPLATES[i % DESC_TEMPLATES.length].replace('{name}', c.name);
      html +=
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

    grid.innerHTML = html;
  }

  renderGrid();
})();