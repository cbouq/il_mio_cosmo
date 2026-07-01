// ---------------------------------------------------------------------------
// ui.js — l'interfaccia HTML sopra alla scena 3D: carta stellare (navigazione),
// pannelli informativi, etichette proiettate, barra di stato e messaggi.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp } from './utils.js';

const STATO_INFO = {
  'completato': { label: 'Completato', color: '#46d39a', bg: 'rgba(70,211,154,0.16)' },
  'in corso': { label: 'In corso', color: '#ffb347', bg: 'rgba(255,179,71,0.16)' },
  'in pausa': { label: 'In pausa', color: '#9fb0c4', bg: 'rgba(159,176,196,0.16)' },
  'idea': { label: 'Idea', color: '#7fb8ff', bg: 'rgba(127,184,255,0.16)' },
};

export class UI {
  constructor(app) {
    this.app = app;
    this.$ = (id) => document.getElementById(id);
    this.labelsLayer = this.$('labels');
    this.constLabels = [];
    this.starLabels = [];
    this._proj = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._toastTimer = null;
  }

  // --- Caricamento -----------------------------------------------------------
  setLoadingText(t) { const e = this.$('loading-sub'); if (e) e.textContent = t; }
  loadingReady() { this.$('loading').classList.add('ready'); }
  loadingDone() { this.$('loading').classList.add('done'); }
  onStart(cb) { this.$('start-btn').addEventListener('click', cb); }

  // --- Barra di stato --------------------------------------------------------
  setSpeed(v) { this.$('speed').textContent = String(Math.round(v)); }
  setMode(t) { this.$('mode').textContent = t; }
  setCrosshair(show) { this.$('crosshair').classList.toggle('hidden', !show); }

  setBreadcrumb(parts) {
    const el = this.$('breadcrumb');
    el.innerHTML = '';
    parts.forEach((p, i) => {
      if (i > 0) {
        const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '›';
        el.appendChild(sep);
      }
      const span = document.createElement('span');
      span.className = 'crumb' + (p.ctx ? ' ctx' : '');
      span.textContent = p.text;
      if (p.onClick) { span.style.cursor = 'pointer'; span.addEventListener('click', p.onClick); }
      el.appendChild(span);
    });
  }

  // --- Messaggi --------------------------------------------------------------
  toast(text, sub = '', ms = 1600) {
    const el = this.$('toast');
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    if (ms > 0) this._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  hideToast() { this.$('toast').classList.remove('show'); }
  flash() {
    const f = this.$('flash');
    f.style.opacity = '0.85';
    setTimeout(() => { f.style.opacity = '0'; }, 90);
  }

  // --- Carta stellare (navigazione) -----------------------------------------
  buildNav(universe) {
    const list = this.$('nav-list');
    list.innerHTML = '';
    this._navGroups = [];
    this._mobileButtons = [];

    universe.costellazioni.forEach((cost) => {
      const group = document.createElement('div');
      group.className = 'const-group';

      const head = document.createElement('div');
      head.className = 'const-head';
      head.innerHTML = `
        <span class="const-dot" style="background:${cost.colore};color:${cost.colore}"></span>
        <span class="const-name">${cost.nome}</span>
        <span class="const-count">${cost.stelle.length}</span>`;
      head.addEventListener('click', () => {
        this._openOnly(group);
        this.app.travelToConstellation(cost);
      });
      group.appendChild(head);

      const stars = document.createElement('div');
      stars.className = 'const-stars';
      cost.stelle.forEach((star) => {
        const item = document.createElement('div');
        item.className = 'star-item';
        const info = STATO_INFO[star.stato] || STATO_INFO['idea'];
        item.innerHTML = `
          <span class="sdot" style="background:${star.coloreStella};box-shadow:0 0 6px ${star.coloreStella}"></span>
          <span style="flex:1">${star.nome}</span>
          <span style="color:${info.color};font-size:10px">●</span>`;
        item.addEventListener('click', () => this.app.enterStar(star));
        stars.appendChild(item);
      });
      group.appendChild(stars);

      list.appendChild(group);
      this._navGroups.push(group);
    });

    this._buildMobileNav(universe);
  }

  _openOnly(group) {
    this._navGroups.forEach((g) => g.classList.toggle('open', g === group));
  }

  _buildMobileNav(universe) {
    const nav = this.$('mobile-nav');
    const toggle = this.$('mobile-nav-toggle');
    const menu = this.$('mobile-nav-menu');
    if (!nav || !toggle || !menu) return;

    menu.innerHTML = '';
    const close = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    };
    const setOpen = (value) => (value ? open() : close());

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!nav.classList.contains('open'));
    });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    universe.costellazioni.forEach((cost) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mobile-const';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = `
        <span class="mobile-const-dot" style="background:${cost.colore};color:${cost.colore}"></span>
        <span class="mobile-const-name">${cost.nome}</span>
        <span class="mobile-const-count">${cost.stelle.length}</span>`;
      item.addEventListener('click', () => {
        this._markMobileNav(cost);
        toggle.textContent = cost.nome;
        close();
        this.app.travelToConstellation(cost);
      });
      menu.appendChild(item);
      this._mobileButtons.push({ item, cost });
    });
  }

  _markMobileNav(cost) {
    if (!this._mobileButtons) return;
    this._mobileButtons.forEach(({ item, cost: itemCost }) => {
      item.classList.toggle('active', itemCost === cost);
    });
  }

  // --- Pannello informazioni -------------------------------------------------
  showProject(star) {
    const info = STATO_INFO[star.stato] || STATO_INFO['idea'];
    this.$('info-kicker').textContent = star.costellazione.nome;
    this.$('info-title').textContent = star.nome;
    this.$('info-meta').innerHTML =
      `<span class="badge" style="color:${info.color};background:${info.bg}">${info.label}</span>` +
      (star.anno ? ` &nbsp; ${star.anno}` : '') +
      ` &nbsp; · &nbsp; ${star.pianeti.length} pianeti`;
    this.$('info-desc').textContent = star.descrizione || '';
    const tags = this.$('info-tags');
    tags.innerHTML = '';
    (star.tecnologie || []).forEach((t) => {
      const s = document.createElement('span'); s.className = 'tag'; s.textContent = t; tags.appendChild(s);
    });

    const actions = this.$('info-actions');
    actions.innerHTML = '';
    const enter = document.createElement('button');
    enter.className = 'btn primary';
    enter.textContent = '🚀 Entra nel sistema';
    enter.addEventListener('click', () => this.app.enterStar(star));
    actions.appendChild(enter);
    if (star.link) {
      const link = document.createElement('a');
      link.className = 'btn'; link.textContent = '🔗 Apri progetto';
      link.href = star.link; link.target = '_blank'; link.rel = 'noopener';
      actions.appendChild(link);
    }
    this._showInfo();
  }

  showPlanet(planet, star) {
    this.$('info-kicker').textContent = `${star.nome} · pianeta`;
    this.$('info-title').textContent = planet.nome;
    this.$('info-meta').innerHTML = `<span class="badge" style="color:#cfe6f5;background:rgba(120,200,255,0.14)">${planet.tipo || 'roccioso'}</span>`;
    this.$('info-desc').textContent = planet.descrizione || '';
    this.$('info-tags').innerHTML = '';
    const actions = this.$('info-actions');
    actions.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = '↩ Info progetto';
    back.addEventListener('click', () => this.showSystemHeader(star));
    actions.appendChild(back);
    this._showInfo();
  }

  showSystemHeader(star) {
    // Pannello del progetto mentre si è dentro al suo sistema: niente pulsante
    // "Entra" (siamo già dentro), solo "Torna alla galassia" ed eventuale link.
    this.showProject(star);
    const actions = this.$('info-actions');
    actions.innerHTML = '';
    const exit = document.createElement('button');
    exit.className = 'btn primary';
    exit.textContent = '✦ Torna alla galassia';
    exit.addEventListener('click', () => this.app.exitToGalaxy());
    actions.appendChild(exit);
    if (star.link) {
      const link = document.createElement('a');
      link.className = 'btn'; link.textContent = '🔗 Apri progetto';
      link.href = star.link; link.target = '_blank'; link.rel = 'noopener';
      actions.appendChild(link);
    }
  }

  _showInfo() { this.$('info').classList.add('show'); }
  hideInfo() { this.$('info').classList.remove('show'); }

  // --- Etichette 3D proiettate ----------------------------------------------
  buildLabels(universe) {
    this.labelsLayer.innerHTML = '';
    this.constLabels = [];
    this.starLabels = [];

    universe.costellazioni.forEach((cost) => {
      const el = document.createElement('div');
      el.className = 'label constellation';
      el.textContent = cost.nome;
      el.style.color = '#dff3ff';
      this.labelsLayer.appendChild(el);
      // L'etichetta del genere segue il centro VIVO del cluster (che orbita)
      this.constLabels.push({ el, cost, offY: (cost.clusterR || 1500) * 0.5 });

      cost.stelle.forEach((star) => {
        const s = document.createElement('div');
        s.className = 'label star';
        s.textContent = star.nome;
        s.style.cursor = 'pointer';
        s.addEventListener('click', () => this.app.enterStar(star));
        s.style.pointerEvents = 'auto';
        this.labelsLayer.appendChild(s);
        // segue la posizione VIVA del sole (che orbita il buco nero)
        this.starLabels.push({ el: s, star, offY: 200 });
      });
    });
  }

  updateLabels(camera, w, h, mode) {
    camera.getWorldPosition(this._camPos);
    const project = (pos3) => {
      this._proj.copy(pos3).project(camera);
      return this._proj;
    };
    const galaxyMode = mode === 'galaxy' || mode === 'cruise';

    for (const L of this.constLabels) {
      if (!galaxyMode) { L.el.style.display = 'none'; continue; }
      const src = L.cost._centerLive || L.cost.center;
      this._tmp.copy(src); this._tmp.y += L.offY;
      const p = project(this._tmp);
      if (p.z > 1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = 'block';
      L.el.style.left = ((p.x * 0.5 + 0.5) * w) + 'px';
      L.el.style.top = ((-p.y * 0.5 + 0.5) * h) + 'px';
    }

    for (const L of this.starLabels) {
      if (!galaxyMode) { L.el.style.display = 'none'; continue; }
      this._tmp.copy(L.star.position); this._tmp.y += L.offY;
      const dist = this._camPos.distanceTo(this._tmp);
      if (dist > 7000) { L.el.style.display = 'none'; continue; }
      const p = project(this._tmp);
      if (p.z > 1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = 'block';
      L.el.style.left = ((p.x * 0.5 + 0.5) * w) + 'px';
      L.el.style.top = ((-p.y * 0.5 + 0.5) * h) + 'px';
      L.el.style.opacity = String(clamp(1 - (dist - 2500) / 4500, 0.15, 1));
    }
  }

  hideAllLabels() {
    for (const L of this.constLabels) L.el.style.display = 'none';
    for (const L of this.starLabels) L.el.style.display = 'none';
  }
}
