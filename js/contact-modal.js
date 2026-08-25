// Contact modal: reusable lead form with Google Apps Script backend.
// Opens from any [data-contact-package] trigger. Handles form validation,
// API submission, success/error states, and WhatsApp follow-up.

(function(){
  'use strict';

  /* ===== Configuration ===== */
  var CONTACT_API_URL = 'https://script.google.com/macros/s/AKfycbwQoq81Au2syQFHk81gVhcLsbDQb-lJekxjFvb9dj4czZMV8Xqvg1vuH4DIv0hk-NaZtw/exec';
  var WHATSAPP_PHONE = '32465327875';

  /* ===== Package definitions ===== */
  var PACKAGES = {
    info:     { label: 'بغيت نعرف أكثر', price: null },
    '20days':  { label: 'عرض 20 يوم — 500 درهم', price: '500 درهم' },
    '3months': { label: 'باقة 3 أشهر — 1,000 درهم', price: '1,000 درهم' },
    '6months': { label: 'باقة 6 أشهر — 1,400 درهم', price: '1,400 درهم' }
  };

  /* ===== State ===== */
  var lastFocus = null;
  var isOpen = false;
  var isSubmitting = false;

  /* ===== DOM refs (cached on init) ===== */
  var overlay, panel, form, nameInput, phoneInput, packageSelect, submitBtn, submitText;
  var formState, successState, errorState;
  var whatsappFallbackBtn;
  var nameError, phoneError, packageError, phonePrefix;

  function init(){
    overlay = document.getElementById('contactModal');
    if(!overlay) return;

    panel            = overlay.querySelector('.cm-panel');
    form             = document.getElementById('cmForm');
    nameInput        = document.getElementById('cm-name');
    phoneInput       = document.getElementById('cm-phone');
    packageSelect    = document.getElementById('cm-package');
    submitBtn        = document.getElementById('cm-submit');
    submitText       = document.getElementById('cm-submit-text');
    formState        = document.getElementById('cmFormState');
    successState     = document.getElementById('cmSuccessState');
    errorState       = document.getElementById('cmErrorState');
    whatsappFallbackBtn = document.getElementById('cm-whatsapp-fallback-btn');
    nameError        = document.getElementById('cm-name-error');
    phoneError       = document.getElementById('cm-phone-error');
    packageError     = document.getElementById('cm-package-error');
    phonePrefix      = overlay.querySelector('.cm-phone-prefix');

    overlay.addEventListener('click', handleOverlayClick);
    form.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleTriggerClick);

    /* Clear per-field errors on interaction */
    nameInput.addEventListener('input', function(){
      nameError.textContent = '';
      nameInput.classList.remove('cm-invalid');
    });
    phoneInput.addEventListener('input', function(){
      phoneError.textContent = '';
      phoneInput.closest('.cm-phone-wrap').classList.remove('cm-invalid');
      /* Hide prefix when user types a full international number */
      if(phonePrefix){
        phonePrefix.classList.toggle('cm-hidden', phoneInput.value.charAt(0) === '+');
      }
    });
    packageSelect.addEventListener('change', function(){
      packageError.textContent = '';
      packageSelect.classList.remove('cm-invalid');
    });
  }

  /* ===== Open / Close ===== */
  function openContactModal(packageType){
    if(isOpen) return;
    isOpen = true;

    lastFocus = document.activeElement;
    resetModal();

    if(packageType && PACKAGES[packageType]){
      packageSelect.value = packageType;
    }

    /* Show prefix for Moroccan default */
    if(phonePrefix){ phonePrefix.classList.remove('cm-hidden'); }

    overlay.classList.add('cm-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setAriaHidden(true);

    requestAnimationFrame(function(){
      nameInput.focus();
    });
  }

  function closeContactModal(){
    if(!isOpen) return;
    isOpen = false;

    overlay.classList.remove('cm-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    setAriaHidden(false);

    var restoreTo = lastFocus && document.contains(lastFocus) ? lastFocus : document.getElementById('hamburger');
    if(restoreTo){
      requestAnimationFrame(function(){
        if(!overlay.classList.contains('cm-open') && document.contains(restoreTo)){
          restoreTo.focus({preventScroll:true});
        }
      });
    }
    lastFocus = null;
  }

  function resetModal(){
    form.reset();
    formState.style.display = '';
    successState.style.display = 'none';
    errorState.style.display = 'none';
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.classList.remove('cm-submit-loading');
    submitText.textContent = 'أكد الطلب';
    clearErrors();
  }

  function setAriaHidden(hidden){
    var selectors = ['#site-header','#main','footer','.sticky-mobile-cta'];
    for(var i = 0; i < selectors.length; i++){
      var el = document.querySelector(selectors[i]);
      if(!el) continue;
      if(hidden){ el.setAttribute('aria-hidden','true'); }
      else{ el.removeAttribute('aria-hidden'); }
    }
  }

  /* ===== Event handlers ===== */
  function handleTriggerClick(e){
    var trigger = e.target.closest('[data-contact-package]');
    if(!trigger) return;
    e.preventDefault();
    var packageType = trigger.getAttribute('data-contact-package');
    openContactModal(packageType);
  }

  function handleOverlayClick(e){
    if(e.target.closest('[data-close-modal]')){
      closeContactModal();
    }
  }

  function handleKeyDown(e){
    if(!isOpen) return;

    if(e.key === 'Escape'){
      e.preventDefault();
      closeContactModal();
      return;
    }

    /* Focus trap */
    if(e.key === 'Tab'){
      var focusables = overlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      var visible = [];
      for(var i = 0; i < focusables.length; i++){
        if(focusables[i].offsetParent !== null) visible.push(focusables[i]);
      }
      if(!visible.length) return;
      var first = visible[0];
      var last = visible[visible.length - 1];
      if(e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      } else if(!overlay.contains(document.activeElement)){
        e.preventDefault(); first.focus();
      }
    }
  }

  /* ===== Validation ===== */
  function validateForm(){
    var valid = true;
    clearErrors();

    var name = nameInput.value.trim();
    if(!name){
      nameError.textContent = 'عافاك دخل الاسم ديالك.';
      nameInput.classList.add('cm-invalid');
      valid = false;
    }

    var phone = phoneInput.value.trim();
    if(!phone){
      phoneError.textContent = 'عافاك دخل رقم واتساب صحيح.';
      phoneInput.closest('.cm-phone-wrap').classList.add('cm-invalid');
      valid = false;
    } else if(!isValidPhone(phone)){
      phoneError.textContent = 'عافاك دخل رقم واتساب صحيح.';
      phoneInput.closest('.cm-phone-wrap').classList.add('cm-invalid');
      valid = false;
    }

    var pkg = packageSelect.value;
    if(!pkg || !PACKAGES[pkg]){
      packageError.textContent = 'اختار الباقة اللي كتهمك.';
      packageSelect.classList.add('cm-invalid');
      valid = false;
    }

    return valid;
  }

  function isValidPhone(phone){
    var cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    var digits = cleaned.replace(/\D/g, '');
    return digits.length >= 6;
  }

  function clearErrors(){
    nameError.textContent = '';
    phoneError.textContent = '';
    packageError.textContent = '';
    nameInput.classList.remove('cm-invalid');
    phoneInput.closest('.cm-phone-wrap').classList.remove('cm-invalid');
    packageSelect.classList.remove('cm-invalid');
  }

  /* ===== Form submission ===== */
  function handleSubmit(e){
    e.preventDefault();
    if(isSubmitting) return;
    if(!validateForm()) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('cm-submit-loading');
    submitText.textContent = 'جاري التسجيل...';

    var name  = nameInput.value.trim();
    var phone = phoneInput.value.trim();
    var pkg   = packageSelect.value;
    var pkgData = PACKAGES[pkg];
    var fullPhone = formatPhone(phone);

    var payload = {
      name:         name,
      whatsapp:     fullPhone,
      package:      pkg,
      packagePrice: pkgData.price || '',
      source:       'waapply.com',
      page:         window.location.pathname + window.location.hash,
      timestamp:    new Date().toISOString()
    };

    sendToApi(payload)
      .then(function(){ showSuccess(pkg, name); })
      .catch(function(){ showError(pkg, name); });
  }

  function formatPhone(phone){
    var cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    if(cleaned.charAt(0) === '+') return cleaned;
    return '+212' + cleaned;
  }

  function sendToApi(payload){
    return new Promise(function(resolve, reject){
      var xhr = new XMLHttpRequest();
      xhr.open('POST', CONTACT_API_URL, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.timeout = 15000;

      xhr.onload = function(){
        if(xhr.status >= 200 && xhr.status < 300){
          try {
            var response = JSON.parse(xhr.responseText);
            if(response.success) resolve(response);
            else reject(new Error(response.message || 'API error'));
          } catch(ex){
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function(){ reject(new Error('Network error')); };
      xhr.ontimeout = function(){ reject(new Error('Timeout')); };
      xhr.send(JSON.stringify(payload));
    });
  }

  /* ===== Result states ===== */
  function showSuccess(pkg, name){
    formState.style.display = 'none';
    successState.style.display = '';
    requestAnimationFrame(function(){
      var firstBtn = successState.querySelector('button, a');
      if(firstBtn) firstBtn.focus();
    });
  }

  function showError(pkg, name){
    formState.style.display = 'none';
    errorState.style.display = '';
    whatsappFallbackBtn.href = buildWhatsAppUrl(name, pkg);
    requestAnimationFrame(function(){
      var firstBtn = errorState.querySelector('button, a');
      if(firstBtn) firstBtn.focus();
    });
  }

  function buildWhatsAppUrl(name, pkg){
    var message;
    if(pkg === '20days'){
      message = 'سلام، أنا ' + name + '. مهتم بعرض 20 يوم بـ 500 درهم ديال WAAPPLY وبغيت نكمل المعلومات.';
    } else if(pkg === '3months'){
      message = 'سلام، أنا ' + name + '. مهتم بباقة 3 أشهر بـ 1,000 درهم ديال WAAPPLY وبغيت نكمل المعلومات.';
    } else if(pkg === '6months'){
      message = 'سلام، أنا ' + name + '. مهتم بباقة 6 أشهر بـ 1,400 درهم ديال WAAPPLY وبغيت نكمل المعلومات.';
    } else {
      message = 'سلام، أنا ' + name + '. بغيت نعرف أكثر على خدمة WAAPPLY وكيفاش كتخدم. ممكن تعطيني المعلومات والتفاصيل؟';
    }
    return 'https://wa.me/' + WHATSAPP_PHONE + '?text=' + encodeURIComponent(message);
  }

  /* ===== Init ===== */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public API */
  window.openContactModal = openContactModal;
  window.closeContactModal = closeContactModal;
})();
