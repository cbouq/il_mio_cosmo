// ---------------------------------------------------------------------------
// utils.js — funzioni di supporto: numeri casuali deterministici, texture
// procedurali (stelle, bagliori, pianeti) e piccole utilità matematiche.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// --- Matematica ------------------------------------------------------------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const TWO_PI = Math.PI * 2;

// Generatore pseudo-casuale deterministico (mulberry32): stesso seme => stessa
// sequenza. Serve per posizionare le costellazioni sempre allo stesso modo.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash di una stringa -> intero, per derivare un seme da un id testuale.
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --- Texture ---------------------------------------------------------------

// Bagliore morbido radiale (per stelle e sole). Bianco: lo coloriamo poi.
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.30)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// Puntino stellare morbido per i campi di Points.
let _starTex = null;
export function starTexture() {
  if (_starTex) return _starTex;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _starTex = new THREE.CanvasTexture(c);
  _starTex.colorSpace = THREE.SRGBColorSpace;
  return _starTex;
}

// Texture procedurale per un pianeta, in base al tipo e al colore di base.
// Restituisce una CanvasTexture (equirettangolare) usabile come map.
export function planetTexture(tipo, coloreHex, seed = 1) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed >>> 0);
  const base = new THREE.Color(coloreHex || '#9b8060');

  const shade = (col, f) => {
    const r = clamp(col.r * f, 0, 1), g = clamp(col.g * f, 0, 1), b = clamp(col.b * f, 0, 1);
    return `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
  };

  // Sfondo di base
  ctx.fillStyle = shade(base, 1);
  ctx.fillRect(0, 0, w, h);

  if (tipo === 'gassoso') {
    // Bande orizzontali tipo gigante gassoso
    let y = 0;
    while (y < h) {
      const band = 6 + rnd() * 22;
      const f = 0.7 + rnd() * 0.6;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(0, y, w, band);
      y += band;
    }
    // Tempeste / ovali
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.3 + rnd() * 0.3;
      ctx.fillStyle = shade(base, 1.3 + rnd() * 0.4);
      const ex = rnd() * w, ey = rnd() * h, rx = 10 + rnd() * 40, ry = 6 + rnd() * 14;
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (tipo === 'oceano') {
    // Mari + qualche "continente" verde/marrone
    ctx.fillStyle = shade(base, 0.85);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.5 + rnd() * 0.4;
      ctx.fillStyle = rnd() > 0.5 ? '#5b8f4e' : shade(base, 1.25);
      const ex = rnd() * w, ey = rnd() * h, r = 8 + rnd() * 34;
      ctx.beginPath(); ctx.ellipse(ex, ey, r, r * (0.5 + rnd()), rnd() * TWO_PI, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (tipo === 'lava') {
    // Crosta scura con vene incandescenti
    ctx.fillStyle = shade(base, 0.4);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = rnd() > 0.4 ? '#ff7a33' : '#ffd24a';
      ctx.globalAlpha = 0.5 + rnd() * 0.5;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.beginPath();
      let x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (tipo === 'ghiacciato') {
    // Superficie chiara con crepe
    ctx.fillStyle = shade(base, 1.05);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = shade(base, 0.75);
      ctx.globalAlpha = 0.4 + rnd() * 0.4;
      ctx.lineWidth = 1 + rnd() * 1.5;
      ctx.beginPath();
      let x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 80; y += (rnd() - 0.5) * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // roccioso (default): crateri e macchie
    for (let i = 0; i < 240; i++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.45;
      ctx.fillStyle = shade(base, 0.6 + rnd() * 0.7);
      const ex = rnd() * w, ey = rnd() * h, r = 2 + rnd() * 12;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Nuvola di nebulosa procedurale: tanti bagliori morbidi sovrapposti, mascherati
// in un disco sfumato ai bordi. Bianca, da colorare con SpriteMaterial.color.
export function nebulaTexture(seed = 1) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed >>> 0);
  ctx.clearRect(0, 0, s, s);
  // Strati di "gas"
  for (let i = 0; i < 18; i++) {
    const x = s * (0.2 + rnd() * 0.6);
    const y = s * (0.2 + rnd() * 0.6);
    const r = 20 + rnd() * 90;
    const a = 0.04 + rnd() * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  // Maschera circolare: dissolve i bordi
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s * 0.5);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Bagliore "a sole": nucleo morbido + flare a croce. Per i soli dei progetti.
let _sunTex = null;
export function sunGlowTexture() {
  if (_sunTex) return _sunTex;
  const s = 160;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // flare a croce
  ctx.globalCompositeOperation = 'lighter';
  let lg = ctx.createLinearGradient(0, s / 2, s, s / 2);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, s / 2 - 1.5, s, 3);
  lg = ctx.createLinearGradient(s / 2, 0, s / 2, s);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(s / 2 - 1.5, 0, 3, s);
  ctx.globalCompositeOperation = 'source-over';
  _sunTex = new THREE.CanvasTexture(c);
  _sunTex.colorSpace = THREE.SRGBColorSpace;
  return _sunTex;
}

// Texture del disco di accrescimento del buco nero: un buco trasparente al
// centro, un bordo interno caldissimo e una progressiva dissolvenza esterna.
let _diskTex = null;
export function diskTexture() {
  if (_diskTex) return _diskTex;
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const cx = s / 2, cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, s * 0.16, cx, cy, s * 0.5);
  g.addColorStop(0.00, 'rgba(0,0,0,0)');          // buco centrale (orizzonte)
  g.addColorStop(0.05, 'rgba(255,252,240,0.95)'); // bordo interno incandescente
  g.addColorStop(0.18, 'rgba(255,185,95,0.80)');
  g.addColorStop(0.45, 'rgba(255,110,40,0.34)');
  g.addColorStop(1.00, 'rgba(120,40,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // Effetto doppler (beaming relativistico): un lato del disco più luminoso.
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createLinearGradient(0, 0, s, 0);
  lg.addColorStop(0.0, 'rgba(120,170,255,0.0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  lg.addColorStop(1.0, 'rgba(255,244,214,0.32)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, s, s);
  // CLIP CIRCOLARE: elimina gli angoli del quadrato (niente bordo squadrato).
  ctx.globalCompositeOperation = 'destination-in';
  const clip = ctx.createRadialGradient(cx, cy, s * 0.30, cx, cy, s * 0.5);
  clip.addColorStop(0, 'rgba(0,0,0,1)');
  clip.addColorStop(0.86, 'rgba(0,0,0,1)');
  clip.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = clip;
  ctx.fillRect(0, 0, s, s);
  // Ritaglia il buco centrale (l'orizzonte degli eventi).
  ctx.globalCompositeOperation = 'destination-out';
  const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.18);
  hole.addColorStop(0, 'rgba(0,0,0,1)');
  hole.addColorStop(0.8, 'rgba(0,0,0,1)');
  hole.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hole;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';
  _diskTex = new THREE.CanvasTexture(c);
  _diskTex.colorSpace = THREE.SRGBColorSpace;
  return _diskTex;
}

// Converte un colore esadecimale in THREE.Color in modo sicuro.
export function toColor(hex, fallback = '#ffffff') {
  try { return new THREE.Color(hex); } catch (e) { return new THREE.Color(fallback); }
}
