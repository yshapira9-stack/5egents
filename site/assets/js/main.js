/* בית הספר לצורפות — יניב וטלי שפירא · סקריפט ראשי */
(function () {
  'use strict';

  /* ----- תפריט מובייל ----- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // סגירה בלחיצה על קישור
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  /* ----- Lightbox לגלריה ----- */
  var items = document.querySelectorAll('.gallery-item');
  if (items.length) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<button class="lightbox__close" aria-label="סגור">&times;</button><img alt="">';
    document.body.appendChild(box);
    var boxImg = box.querySelector('img');
    var closeBtn = box.querySelector('.lightbox__close');

    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        if (!img) return;
        boxImg.src = img.src;
        boxImg.alt = img.alt || '';
        box.classList.add('open');
      });
    });
    function closeBox() { box.classList.remove('open'); }
    closeBtn.addEventListener('click', closeBox);
    box.addEventListener('click', function (e) { if (e.target === box) closeBox(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBox(); });
  }

  /* ----- שנה נוכחית בפוטר ----- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
