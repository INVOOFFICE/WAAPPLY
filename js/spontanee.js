// Candidature Spontanée visual — animated Europe map with floating country cards.
// Source of truth for the floating cards' data (flag/name/sector/status).
// Pure DOM rendering + a light status-rotation timer; runs after the DOM is built.

(function(){
  'use strict';

  /* ===== Editable data =====
     f    = sprite symbol tail (i-flag-*)
     w/h  = flag viewBox for the rendered svg
     name = country name (Arabic)
     sector = professional field shown under the name   */
  var SP_COUNTRIES = [
    { f:'de',  w:30, h:18, name:'ألمانيا',   sector:'IT' },
    { f:'fr',  w:30, h:20, name:'فرنسا',     sector:'Marketing' },
    { f:'es',  w:30, h:20, name:'إسبانيا',   sector:'Finance' },
    { f:'it',  w:30, h:20, name:'إيطاليا',   sector:'Engineering' },
    { f:'nl',  w:30, h:20, name:'هولندا',    sector:'Commerce' },
    { f:'be',  w:13, h:15, name:'بلجيكا',    sector:'IT' },
    { f:'pl',  w:40, h:25, name:'بولندا',    sector:'Logistics' },
    { f:'se',  w:32, h:20, name:'السويد',    sector:'Engineering' }
  ];

  /* Statuses that rotate automatically across the visible cards. */
  var SP_SENT    = 'Candidature envoyée';
  var SP_TRANS   = 'Profil transmis';
  var ROTATE_MS  = 3400;

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function checkIcon(){
    return '<svg class="ic" aria-hidden="true"><use href="#i-circle-check"/></svg>';
  }

  function flagSvg(c){
    return '<svg class="sp-cflag" viewBox="0 0 ' + c.w + ' ' + c.h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#i-flag-' + c.f + '"/></svg>';
  }

  function cardHtml(c){
    return '' +
      '<div class="sp-country-card" data-pos="' + c.i + '" style="animation-delay:' + (c.i * 0.7) + 's">' +
        flagSvg(c) +
        '<div class="sp-cbody">' +
          '<span class="sp-cname">' + c.name + '</span>' +
          '<span class="sp-cstatus"><span class="sp-check"></span><span class="sp-status-text"></span></span>' +
          '<span class="sp-csector"><span class="latin">' + c.sector + '</span></span>' +
        '</div>' +
      '</div>';
  }

  function buildCards(container){
    var i;
    for(i = 0; i < SP_COUNTRIES.length; i++){
      SP_COUNTRIES[i].i = i;
      container.innerHTML += cardHtml(SP_COUNTRIES[i]);
    }
    return container.querySelectorAll('.sp-country-card');
  }

  /* Show the first N cards as "envoyée", the rest as "transmis"; each card
     stores its current status so rotation can flip an individual card. */
  function seedStatuses(cards){
    var i;
    for(i = 0; i < cards.length; i++){
      var card = cards[i];
      var check = document.createElement('svg');
      check.setAttribute('class', 'ic');
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = '<use href="#i-circle-check"/>';
      var text = card.querySelector('.sp-status-text');
      var kind = i % 2 === 0 ? SP_SENT : SP_TRANS;
      card.setAttribute('data-status', kind);
      card.querySelector('.sp-check').appendChild(check);
      text.textContent = kind;
    }
  }

  /* Every few seconds flip a random card's status so the map feels live. */
  function startRotation(cards){
    if(reduced || cards.length === 0 || ROTATE_MS <= 0){ return; }
    setInterval(function(){
      var n = Math.floor(Math.random() * cards.length);
      var card = cards[n];
      var next = card.getAttribute('data-status') === SP_SENT ? SP_TRANS : SP_SENT;
      card.setAttribute('data-status', next);
      card.querySelector('.sp-status-text').textContent = next;
    }, ROTATE_MS);
  }

  function init(){
    var container = document.getElementById('spontaneeCards');
    if(!container){ return; }
    var cards = buildCards(container);
    seedStatuses(cards);
    startRotation(cards);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
