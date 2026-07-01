/* ===========================================================================
   site.js — comportamenti del portfolio (JavaScript puro, nessuna libreria):
   menu hamburger, voce attiva, carousel, lightbox, cookie banner, form,
   anno del footer. Collegato prima della chiusura di </body>.
   =========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initActiveLink();
    initSearch();
    initMarquee();
    initCarousels();
    initLightbox();
    initCookieBanner();
    initForms();
    initYear();
    initPageTransitions();
  });

  /* --- Menu hamburger -------------------------------------------------- */
  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Chiude il menu cliccando una voce (su mobile)
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --- Voce di menu attiva in base alla pagina ------------------------- */
  function initActiveLink() {
    var nav = document.getElementById('siteNav');
    if (!nav) return;
    var current = location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === current) a.classList.add('active');
    });
  }

  /* --- Carousel (ne supporta più di uno nella pagina) ------------------ */
  function initCarousels() {
    document.querySelectorAll('.carousel').forEach(function (carousel) {
      var track = carousel.querySelector('.carousel-track');
      var slides = carousel.querySelectorAll('.slide');
      if (!track || slides.length === 0) return;
      var index = 0;
      var dotsWrap = carousel.querySelector('.carousel-dots');

      // Crea i dots
      var dots = [];
      if (dotsWrap) {
        slides.forEach(function (_, i) {
          var b = document.createElement('button');
          b.setAttribute('aria-label', 'Vai alla slide ' + (i + 1));
          b.addEventListener('click', function () { go(i); });
          dotsWrap.appendChild(b);
          dots.push(b);
        });
      }

      function update() {
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        dots.forEach(function (d, i) { d.classList.toggle('active', i === index); });
      }
      function go(i) { index = (i + slides.length) % slides.length; update(); restart(); }
      function next() { go(index + 1); }
      function prev() { go(index - 1); }

      var prevBtn = carousel.querySelector('.carousel-btn.prev');
      var nextBtn = carousel.querySelector('.carousel-btn.next');
      if (prevBtn) prevBtn.addEventListener('click', prev);
      if (nextBtn) nextBtn.addEventListener('click', next);

      // Autoplay con pausa al passaggio del mouse
      var timer = null;
      function restart() { if (timer) clearInterval(timer); timer = setInterval(next, 5000); }
      carousel.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
      carousel.addEventListener('mouseleave', restart);

      update();
      if (slides.length > 1) restart();
    });
  }

  /* --- Lightbox per le immagini -------------------------------------- */
  function initLightbox() {
    var images = document.querySelectorAll('[data-lightbox] img, .lightboxable');
    if (images.length === 0) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<button class="lightbox-close" aria-label="Chiudi">&times;</button><img alt="">';
    document.body.appendChild(box);
    var boxImg = box.querySelector('img');

    images.forEach(function (img) {
      img.addEventListener('click', function () {
        boxImg.src = img.getAttribute('src');
        boxImg.alt = img.getAttribute('alt') || '';
        box.classList.add('open');
      });
    });
    function close() { box.classList.remove('open'); }
    box.addEventListener('click', function (e) { if (e.target !== boxImg) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* --- Cookie banner (persistente in localStorage) -------------------- */
  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    try {
      if (!localStorage.getItem('cookieAccepted')) banner.classList.add('show');
    } catch (e) { banner.classList.add('show'); }

    var accept = document.getElementById('accept-cookies');
    if (accept) {
      accept.addEventListener('click', function () {
        try { localStorage.setItem('cookieAccepted', 'true'); } catch (e) {}
        banner.classList.remove('show');
      });
    }
  }

  /* --- Form: validazione nativa + messaggio di conferma --------------- */
  function initForms() {
    document.querySelectorAll('form[data-contact]').forEach(function (form) {
      var msg = form.querySelector('.form-msg');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (msg) msg.textContent = 'Grazie! Il tuo messaggio è stato preso in carico. Ti risponderò al più presto.';
        form.reset();
      });
    });
  }

  /* --- Anno corrente nel footer --------------------------------------- */
  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* --- Ricerca nella navbar (progetti + categorie) -------------------- */
  function initSearch() {
    var nav = document.getElementById('siteNav');
    if (!nav) return;
    var DATA = [
      { n: 'Human Before Prompt', t: 'Installazione', href: 'lavoro-1.html', k: 'installazione ai arte interattiva human before prompt' },
      { n: 'ATLAS — Nike Kiosk', t: 'Interaction & UI/UX', href: 'lavoro-2.html', k: 'nike atlas kiosk ui ux marketing retail gamification' },
      { n: 'Maskuest', t: 'Game Design', href: 'lavoro-3.html', k: 'maskuest gioco videogioco platformer game' },
      { n: 'Web Design', t: 'Categoria', href: 'esperienza.html', k: 'web sito browser' },
      { n: 'App & Mobile', t: 'Categoria', href: 'esperienza.html', k: 'app mobile smartphone' },
      { n: 'Game Design', t: 'Categoria', href: 'esperienza.html', k: 'game videogiochi gioco' },
      { n: 'Interaction & UI/UX', t: 'Categoria', href: 'esperienza.html', k: 'ui ux interaction interfacce' },
      { n: 'Installazioni Interattive', t: 'Categoria', href: 'esperienza.html', k: 'installazioni interattive eventi' },
      { n: 'Motion & Video', t: 'Categoria', href: 'esperienza.html', k: 'motion video animazione' },
      { n: 'AR / VR', t: 'Categoria', href: 'esperienza.html', k: 'ar vr realta aumentata virtuale immersive' },
      { n: 'Creative Coding & Data Viz', t: 'Categoria', href: 'esperienza.html', k: 'creative coding data visualization generativa' },
      { n: 'Il mio universo', t: 'Esperienza 3D', href: 'esperienza.html', k: 'esperienza galassia 3d navicella' },
      { n: 'Portfolio', t: 'Pagina', href: 'portfolio.html', k: 'portfolio progetti lavori' },
      { n: 'Bio', t: 'Pagina', href: 'bio.html', k: 'bio chi sono ied media design' },
      { n: 'Contatti', t: 'Pagina', href: 'contatti.html', k: 'contatti email telefono roma' }
    ];
    var wrap = document.createElement('div');
    wrap.className = 'nav-search';
    wrap.innerHTML = '<input type="search" id="navSearch" placeholder="Cerca progetti o categorie…" autocomplete="off" aria-label="Cerca nel portfolio"><div class="nav-search-results" id="navSearchResults" role="listbox"></div>';
    nav.insertBefore(wrap, nav.firstChild);
    var input = wrap.querySelector('#navSearch');
    var box = wrap.querySelector('#navSearchResults');

    function render(q) {
      q = (q || '').trim().toLowerCase();
      box.innerHTML = '';
      if (!q) { box.classList.remove('open'); return; }
      var m = DATA.filter(function (d) { return (d.n + ' ' + d.t + ' ' + d.k).toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
      if (!m.length) { box.innerHTML = '<div class="nsr-empty">Nessun risultato</div>'; box.classList.add('open'); return; }
      m.forEach(function (d) {
        var a = document.createElement('a');
        a.href = d.href; a.className = 'nsr-item';
        a.innerHTML = '<span class="nsr-name">' + d.n + '</span><span class="nsr-type">' + d.t + '</span>';
        box.appendChild(a);
      });
      box.classList.add('open');
    }
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('focus', function () { if (input.value) render(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; box.classList.remove('open'); input.blur(); } });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) box.classList.remove('open'); });
  }

  /* --- Transizioni morbide tra le pagine ------------------------------ */
  function initPageTransitions() {
    var ov = document.createElement('div');
    ov.className = 'page-transition';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { document.body.classList.add('pt-ready'); });

    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (href.charAt(0) === '#' || href.indexOf(':') !== -1) return; // ancore, mailto, tel, http esterni
      if (a.hostname && a.hostname !== location.hostname) return;
      e.preventDefault();
      document.body.classList.remove('pt-ready');
      document.body.classList.add('pt-leaving');
      setTimeout(function () { window.location.href = href; }, 360);
    });
  }

  /* --- Carosello infinito "a fontana" (solo i 3 progetti) ------------- */
  function initMarquee() {
    var m = document.getElementById('marquee');
    if (!m) return;
    var rows = m.querySelectorAll('.marquee-row');
    if (!rows.length) return;
    var items = [
      { img: 'img/hbp-cover.svg', b: 'Human Before Prompt', s: 'Installazione', href: 'lavoro-1.html' },
      { img: 'img/nike-cover.jpg', b: 'ATLAS — Nike Kiosk', s: 'Interaction · UI/UX', href: 'lavoro-2.html' },
      { img: 'img/maskuest-portale.jpg', b: 'Maskuest', s: 'Game Design', href: 'lavoro-3.html' }
    ];
    function card(it) {
      return '<a class="m-card" href="' + it.href + '"><img src="' + it.img + '" alt="' + it.b + '" /><div class="m-cap"><b>' + it.b + '</b><span>' + it.s + '</span></div></a>';
    }
    var cardW = 318; // larghezza card + gap
    var copies = Math.max(2, Math.ceil((window.innerWidth * 1.6) / (items.length * cardW)));
    var seq = '';
    for (var i = 0; i < copies; i++) { items.forEach(function (it) { seq += card(it); }); }
    var oneCopyW = copies * items.length * cardW;
    rows.forEach(function (row, idx) {
      row.innerHTML = seq + seq; // due copie identiche → loop continuo a -50%
      var speed = idx === 0 ? 70 : 46; // px/s: righe a velocità diverse (effetto cascata)
      row.style.animationDuration = Math.round(oneCopyW / speed) + 's';
    });
  }
})();
