/* ===========================================================================
   intro.js — intro cinematografica all'ingresso del portfolio.
   Sfondo cosmico animato (canvas) + il discorso di Dmitry in sequenza, poi
   "Entra nel portfolio". Si mostra una volta per sessione; pulsante "Salta".
   Per sostituirla con un VIDEO reale: metti public/intro.mp4 e l'intro lo userà.
   =========================================================================== */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var intro = document.getElementById('intro');
    if (!intro) return;

    // già vista in questa sessione → salta subito
    var seen = false;
    try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
    if (seen) { intro.parentNode && intro.parentNode.removeChild(intro); document.body.classList.remove('intro-lock'); return; }

    document.body.classList.add('intro-lock');

    // ----- starfield -----
    var canvas = document.getElementById('intro-stars');
    var ctx = canvas && canvas.getContext('2d');
    var stars = [], W = 0, H = 0, raf = null, t0 = performance.now();
    function resize() {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      stars = [];
      var n = Math.min(520, Math.floor(W * H / 3400));
      for (var i = 0; i < n; i++) {
        stars.push({ x: (Math.random() - 0.5) * W, y: (Math.random() - 0.5) * H, z: Math.random() * W, o: 0.4 + Math.random() * 0.6 });
      }
    }
    function draw(now) {
      if (!ctx) return;
      var dt = Math.min(50, now - t0); t0 = now;
      ctx.fillStyle = 'rgba(3,4,10,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.z -= dt * 0.045;
        if (s.z < 1) { s.z = W; s.x = (Math.random() - 0.5) * W; s.y = (Math.random() - 0.5) * H; }
        var k = 180 / s.z;
        var px = s.x * k, py = s.y * k;
        var r = (1 - s.z / W) * 2.2;
        var grd = ctx.createRadialGradient(px, py, 0, px, py, r * 3 + 1);
        grd.addColorStop(0, 'rgba(180,220,255,' + s.o + ')');
        grd.addColorStop(1, 'rgba(180,220,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py, r * 3 + 1, 0, 6.28); ctx.fill();
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    // ----- sequenza del discorso -----
    var lines = Array.prototype.slice.call(intro.querySelectorAll('[data-line]'));
    var enterBtn = document.getElementById('intro-enter');
    var idx = 0, timers = [];
    function showNext() {
      if (idx > 0 && lines[idx - 1]) lines[idx - 1].classList.remove('on');
      if (idx < lines.length) {
        lines[idx].classList.add('on');
        var dur = 2600 + lines[idx].textContent.length * 26;
        timers.push(setTimeout(showNext, dur));
        idx++;
      } else {
        // ultima frase resta, mostra "Buona visione" e il pulsante
        if (lines.length) lines[lines.length - 1].classList.add('on');
        var bv = document.getElementById('intro-bv');
        if (bv) bv.classList.add('on');
        if (enterBtn) enterBtn.classList.add('on');
      }
    }
    // mostra l'ultima frase persistente: gestiamo lasciando l'ultima visibile
    function startSeq() { showNext(); }
    timers.push(setTimeout(startSeq, 700));

    // ----- chiusura -----
    function finish() {
      timers.forEach(clearTimeout);
      try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
      intro.classList.add('hide');
      document.body.classList.remove('intro-lock');
      setTimeout(function () {
        if (raf) cancelAnimationFrame(raf);
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 900);
    }
    if (enterBtn) enterBtn.addEventListener('click', finish);
    var skip = document.getElementById('intro-skip');
    if (skip) skip.addEventListener('click', function () {
      // salta direttamente alla fine della sequenza
      timers.forEach(clearTimeout);
      lines.forEach(function (l) { l.classList.remove('on'); });
      if (lines.length) lines[lines.length - 1].classList.add('on');
      var bv = document.getElementById('intro-bv');
      if (bv) bv.classList.add('on');
      if (enterBtn) enterBtn.classList.add('on');
    });
  });
})();
