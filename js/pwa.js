// PWA (isolated from the rest of the app): service-worker registration,
// install invitation and user-controlled update flow.
// Works by feature detection only — on file:// or unsupported browsers every
// branch below simply stays off and the normal website is untouched.

(function(){
  'use strict';

  var SW_SRC = 'service-worker.js';

  // Lightweight localStorage state (no personal information, always best-effort).
  var DISMISS_KEY = 'waapply_pwa_install_dismissed';
  var INSTALLED_KEY = 'waapply_pwa_installed';
  var DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;      // invitation may return after 7 days
  var INSTALLED_TTL = 30 * 24 * 60 * 60 * 1000;   // "installed" record expires after 30 days
  var SHOW_DELAY = 1500;                          // appear shortly after, never instantly

  var deferredPrompt = null;
  var waitingWorker = null;
  var refreshOnControl = false;
  var updateVisible = false;

  var installEl = document.getElementById('pwaInstall');
  var installBtn = document.getElementById('pwaInstallBtn');
  var installLater = document.getElementById('pwaInstallLater');
  var installClose = document.getElementById('pwaInstallClose');
  var installDesc = document.getElementById('pwaInstallDesc');
  var installIosDesc = document.getElementById('pwaInstallIosDesc');
  var updateEl = document.getElementById('pwaUpdate');
  var updateApply = document.getElementById('pwaUpdateApply');
  var updateLater = document.getElementById('pwaUpdateLater');

  /* ---------- environment ---------- */

  // Service workers need a secure context: https, or localhost over http.
  function swSupported(){
    if(!('serviceWorker' in navigator)){ return false; }
    if(location.protocol === 'https:'){ return true; }
    if(location.protocol === 'http:'){
      return location.hostname === 'localhost' ||
             location.hostname === '127.0.0.1' ||
             location.hostname === '[::1]';
    }
    return false; // file:// and friends: PWA features stay unavailable
  }

  function isStandalone(){
    try{
      if(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches){ return true; }
    }catch(e){}
    if(window.navigator.standalone === true){ return true; }
    return false;
  }

  function isIOS(){
    var ua = navigator.userAgent || '';
    if(/iPad|iPhone|iPod/.test(ua)){ return true; }
    // iPadOS 13+ reports macOS but stays touch-capable.
    if(/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1){ return true; }
    return false;
  }

  /* ---------- local state ---------- */

  function readTs(key){
    try{
      var v = parseInt(window.localStorage.getItem(key) || '0', 10);
      return isNaN(v) ? 0 : v;
    }catch(e){ return 0; }
  }
  function writeTs(key, value){
    try{ window.localStorage.setItem(key, String(value)); }catch(e){}
  }
  function clearKey(key){
    try{ window.localStorage.removeItem(key); }catch(e){}
  }

  function isDismissed(){
    var t = readTs(DISMISS_KEY);
    if(!t){ return false; }
    if(Date.now() - t > DISMISS_TTL){ clearKey(DISMISS_KEY); return false; }
    return true;
  }

  function isInstalledRecord(){
    var t = readTs(INSTALLED_KEY);
    if(!t){ return false; }
    if(Date.now() - t > INSTALLED_TTL){ clearKey(INSTALLED_KEY); return false; }
    return true;
  }

  /* ---------- install invitation UI ---------- */

  function canShowInstall(){
    return !!(installEl && swSupported() && !updateVisible && !isStandalone() && !isDismissed() && !isInstalledRecord());
  }

  function showInstall(mode){
    if(!canShowInstall()){ return; }
    if(mode === 'native' && !deferredPrompt){ return; }
    var ios = (mode === 'ios');
    var badgeUse = installEl.querySelector('.pwa-install-ico use');
    if(badgeUse){ badgeUse.setAttribute('href', ios ? '#i-share' : '#i-download'); }
    if(installIosDesc){ installIosDesc.hidden = !ios; }
    if(installDesc){ installDesc.hidden = ios; }
    if(installBtn){ installBtn.hidden = ios; }        // iOS: JS cannot open the native dialog
    if(installLater){ installLater.textContent = ios ? 'إغلاق' : 'لاحقاً'; }
    installEl.hidden = false;
    void installEl.offsetHeight;                    // flush the hidden style so the entrance transition runs
    installEl.classList.add('is-shown');
  }

  function hideInstall(){
    if(!installEl || installEl.hidden){ return; }
    installEl.classList.remove('is-shown');
    installEl.hidden = true;
  }

  function dismissInstall(){
    writeTs(DISMISS_KEY, Date.now());
    hideInstall();
  }

  function scheduleInstallShow(mode){
    if(!canShowInstall()){ return; }
    window.setTimeout(function(){ showInstall(mode); }, SHOW_DELAY);
  }

  if(installLater){
    installLater.addEventListener('click', dismissInstall);
  }
  if(installClose){
    installClose.addEventListener('click', dismissInstall);
  }

  if(installBtn){
    installBtn.addEventListener('click', function(){
      var promptEvent = deferredPrompt;
      if(!promptEvent){ return; }
      deferredPrompt = null;
      try{ promptEvent.prompt(); }
      catch(e){ hideInstall(); return; }
      var choice = promptEvent.userChoice || Promise.resolve(null);
      choice.then(function(result){
        hideInstall();
        if(result && result.outcome === 'accepted'){
          writeTs(INSTALLED_KEY, Date.now());
        }
      }).catch(function(){});
    });
  }

  // The browser says WAAPPLY is installable → remember it, show our own card.
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();          // our card replaces the browser mini-infobar
    deferredPrompt = e;
    scheduleInstallShow('native');
  });

  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    writeTs(INSTALLED_KEY, Date.now());
    hideInstall();
  });

  // iOS/Safari: no beforeinstallprompt exists — show the manual instructions.
  function maybeShowIOSFallback(){
    if(!swSupported() || deferredPrompt){ return; }
    if(!isIOS()){ return; }
    scheduleInstallShow('ios');
  }

  /* ---------- service-worker registration + updates ---------- */

  function showUpdate(worker){
    if(!updateEl){ return; }
    waitingWorker = worker;
    if(!updateEl.hidden){ return; }
    updateVisible = true;
    hideInstall();               // never show both surfaces at once
    updateEl.hidden = false;
    void updateEl.offsetHeight;                    // flush the hidden style so the entrance transition runs
    updateEl.classList.add('is-shown');
  }

  function hideUpdate(){
    if(!updateEl || updateEl.hidden){ return; }
    updateVisible = false;
    waitingWorker = null;
    updateEl.classList.remove('is-shown');
    updateEl.hidden = true;
    // The install invitation may take its place once again.
    if(deferredPrompt){ scheduleInstallShow('native'); }
    else{ maybeShowIOSFallback(); }
  }

  if(updateApply){
    updateApply.addEventListener('click', function(){
      if(!waitingWorker){ return; }
      updateApply.disabled = true;
      refreshOnControl = true;
      waitingWorker.postMessage({type:'SKIP_WAITING'});   // controlled activation
    });
  }
  if(updateLater){
    updateLater.addEventListener('click', hideUpdate);
  }

  // Reload exactly once when the new worker takes control (no loops).
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(!refreshOnControl){ return; }
      refreshOnControl = false;
      window.location.reload();
    });
  }

  function registerServiceWorker(){
    if(!swSupported()){ return; }
    navigator.serviceWorker.register(SW_SRC).then(function(reg){
      // An update already downloaded and is waiting for the user.
      if(reg.waiting && navigator.serviceWorker.controller){
        showUpdate(reg.waiting);
      }
      reg.addEventListener('updatefound', function(){
        var installing = reg.installing;
        if(!installing){ return; }
        installing.addEventListener('statechange', function(){
          // 'installed' with an existing controller = a new version is ready.
          // Without a controller it is the very first install → no prompt.
          if(installing.state === 'installed' && navigator.serviceWorker.controller){
            showUpdate(installing);
          }
        });
      });
      // Cheap update check whenever the tab returns to the foreground.
      document.addEventListener('visibilitychange', function(){
        if(document.visibilityState === 'visible' && !updateVisible){
          reg.update().catch(function(){});
        }
      });
    }).catch(function(){ /* insecure context / unsupported: PWA stays off, silently */ });
  }

  registerServiceWorker();
  maybeShowIOSFallback();
})();
