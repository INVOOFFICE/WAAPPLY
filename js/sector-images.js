// Sector image auto-matching.
// For every sector card, look for an image in assets/job whose filename equals
// the card's Arabic title (the <h3>), and display it inside the .sector-media
// placeholder. No manual list is maintained: the filename is derived from the
// visible sector name, so adding a new image with a matching name "just works".
// Multiple image extensions are tried, in order: .jpg, .webp, .jpeg. Cards
// without a matching image keep their gradient placeholder.

(function(){
  'use strict';

  var EXTENSIONS = ['jpg', 'webp', 'jpeg'];

  function attachImage(card){
    var titleEl = card.querySelector('h3');
    var media = card.querySelector('.sector-media');
    if(!titleEl || !media){ return; }

    var name = (titleEl.textContent || '').trim();
    if(!name){ return; }

    var img = new Image();
    img.className = 'sector-img';
    img.alt = '';
    img.decoding = 'async';

    var extIndex = 0;
    img.onerror = function(){
      if(extIndex < EXTENSIONS.length - 1){
        extIndex++;
        img.src = 'assets/job/' + encodeURIComponent(name) + '.' + EXTENSIONS[extIndex];
      } else {
        img.remove();
      }
    };
    img.src = 'assets/job/' + encodeURIComponent(name) + '.' + EXTENSIONS[0];
    media.appendChild(img);
  }

  function applySectorImages(){
    var cards = document.querySelectorAll('.sector-card');
    for(var i = 0; i < cards.length; i++){
      attachImage(cards[i]);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applySectorImages);
  } else {
    applySectorImages();
  }
})();
