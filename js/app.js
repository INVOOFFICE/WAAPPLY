// Global init: behaviors that span the whole page.

// Header scroll shadow
const header = document.getElementById('site-header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 8);
});
