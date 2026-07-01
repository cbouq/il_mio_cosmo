// ---------------------------------------------------------------------------
// main.js — punto d'ingresso. Crea la scena, la galassia, la navicella e
// l'interfaccia, gestisce gli stati (galassia / iperspazio / sistema), gli
// input e il ciclo di rendering.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { loadData, buildUniverse, GALAXY_RADIUS } from './data.js';
import { Galaxy } from './galaxy.js';
import { StarSystem } from './starSystem.js';
import { Ship, DEFAULT_SHIP } from './ship.js';
import { UI } from './ui.js';
import { clamp } from './utils.js';

class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tone mapping filmico: comprime le alte luci additive così la scena non
    // satura più verso il bianco.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.42;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03040a');
    // Nebbia esponenziale: attenua il bagliore accumulato verso il nucleo
    // lontano (evita l'effetto "accecante" guardando il centro). Stelle di
    // sfondo e galassie lontane la ignorano (fog:false nei loro materiali).
    this.scene.fog = new THREE.FogExp2(0x05060f, 0.00005);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 260000);
    this.baseFov = 60;
    this.scene.add(this.camera); // la camera è nel grafo per agganciare l'effetto iperspazio

    this.scene.add(new THREE.AmbientLight(0x33384a, 0.6));

    this.clock = new THREE.Clock();
    this.mode = 'galaxy';        // 'galaxy' | 'cruise' | 'system'
    this.started = false;
    this.system = null;
    this.currentStar = null;
    this.currentConstellation = null;

    this.camLook = new THREE.Vector3();
    this.orbit = { theta: 0.6, phi: 1.05, radius: 120, target: new THREE.Vector3() };
    this.observe = { active: false, points: [], idx: 0, t: 0 };
    this._tmpObs = new THREE.Vector3();
    this._tmpObs2 = new THREE.Vector3();

    this._initInput();
    this._initWarp();

    this.ui = new UI(this);
    this.shipConfig = this._loadShipConfig();
    this.ship = new Ship(this.scene, this.shipConfig);
    this._initCustomizer();
    this._initObservation();

    window.addEventListener('resize', () => this._onResize());

    this._boot();
    this._loop();
  }

  async _boot() {
    this.ui.setLoadingText('Caricamento dei progetti…');
    const data = await loadData();
    this.universe = buildUniverse(data);

    this.ui.setLoadingText('Generazione della galassia…');
    this.galaxy = new Galaxy(this.scene, this.universe);

    this.ui.buildNav(this.universe);
    this.ui.buildLabels(this.universe);

    // Posizione panoramica iniziale della navicella
    this.ship.reset(new THREE.Vector3(0, GALAXY_RADIUS * 0.36, GALAXY_RADIUS * 1.7), new THREE.Vector3(0, 0, 0));
    this._placeFollowCameraInstant();

    this.ui.setBreadcrumb([{ text: this.universe.titolo.toUpperCase() }]);
    this.ui.loadingReady();
    this.ui.onStart(() => this._start());
  }

  _start() {
    this.started = true;
    this.ui.loadingDone();
    this.ui.toast('Benvenuto', 'Scegli un genere dalla carta stellare o vola libero', 2600);
    this.ui.setMode('GALASSIA');
  }

  // --- Effetto iperspazio (linee che sfrecciano) -----------------------------
  _initWarp() {
    const N = 480;
    this.warpN = N;
    this.warpFar = 1400;
    const positions = new Float32Array(N * 2 * 3);
    this.warpData = [];
    for (let i = 0; i < N; i++) {
      this.warpData.push(this._warpSpawn());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#aee7ff'), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.warp = new THREE.LineSegments(geo, mat);
    this.warp.frustumCulled = false;
    this.warp.visible = false;
    this.camera.add(this.warp); // coordinate locali alla camera
  }

  _warpSpawn() {
    const ang = Math.random() * Math.PI * 2;
    const rad = 12 + Math.pow(Math.random(), 0.5) * 230;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, z: -Math.random() * this.warpFar };
  }

  _updateWarp(dt, intensity) {
    this.warp.visible = intensity > 0.01;
    if (!this.warp.visible) { this.warp.material.opacity = 0; return; }
    const pos = this.warp.geometry.attributes.position.array;
    const speed = 1600 + 6000 * intensity;
    const streak = 30 + 420 * intensity;
    for (let i = 0; i < this.warpN; i++) {
      const d = this.warpData[i];
      d.z += speed * dt;
      if (d.z > 12) { const n = this._warpSpawn(); d.x = n.x; d.y = n.y; d.z = -this.warpFar; }
      const o = i * 6;
      pos[o] = d.x; pos[o + 1] = d.y; pos[o + 2] = d.z;
      pos[o + 3] = d.x; pos[o + 4] = d.y; pos[o + 5] = d.z - streak;
    }
    this.warp.geometry.attributes.position.needsUpdate = true;
    this.warp.material.opacity = clamp(intensity * 1.15, 0, 1);
  }

  // --- Input -----------------------------------------------------------------
  _initInput() {
    this.input = { keys: new Set(), look: { dx: 0, dy: 0 } };
    const dom = this.renderer.domElement;

    window.addEventListener('keydown', (e) => {
      if (this.observe && this.observe.active) { this.exitObservation(); return; }
      const k = e.key.toLowerCase();
      this.input.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.input.keys.clear());

    this._ptr = { down: false, dragging: false, x: 0, y: 0, sx: 0, sy: 0, t: 0, button: 0 };
    dom.addEventListener('pointerdown', (e) => {
      this._ptr.down = true; this._ptr.dragging = false; this._ptr.button = e.button;
      this._ptr.x = this._ptr.sx = e.clientX; this._ptr.y = this._ptr.sy = e.clientY;
      this._ptr.t = performance.now();
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._ptr.down) return;
      const dx = e.clientX - this._ptr.x, dy = e.clientY - this._ptr.y;
      this._ptr.x = e.clientX; this._ptr.y = e.clientY;
      if (Math.abs(e.clientX - this._ptr.sx) + Math.abs(e.clientY - this._ptr.sy) > 5) this._ptr.dragging = true;
      if (this.mode === 'galaxy') { this.input.look.dx += dx; this.input.look.dy += dy; }
      else if (this.mode === 'system') {
        this.orbit.theta -= dx * 0.005;
        this.orbit.phi = clamp(this.orbit.phi - dy * 0.005, 0.25, Math.PI - 0.25);
      }
    });
    const up = (e) => {
      if (this.observe && this.observe.active) { this._ptr.down = false; this.exitObservation(); return; }
      if (!this._ptr.down) return;
      this._ptr.down = false;
      const quick = performance.now() - this._ptr.t < 350;
      if (!this._ptr.dragging && quick) this._handleClick(this._ptr.sx, this._ptr.sy);
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', () => { this._ptr.down = false; });

    dom.addEventListener('wheel', (e) => {
      if (this.mode === 'system' && this.system) {
        const step = e.deltaY * this.system.radius * 0.003;
        this.orbit.radius = clamp(this.orbit.radius + step, this.system.radius * 1.1, this.system.radius * 6);
        e.preventDefault();
      }
    }, { passive: false });

    this.raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
  }

  _handleClick(sx, sy) {
    if (!this.started) return;
    this._ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this._ndc, this.camera);

    if (this.mode === 'galaxy') {
      const hits = this.raycaster.intersectObjects(this.galaxy.interactiveStars, false);
      if (hits.length) { this.selectStar(hits[0].object.userData.star); }
      else { this.ui.hideInfo(); }
    } else if (this.mode === 'system') {
      const hits = this.raycaster.intersectObjects(this.system.pickables, false);
      if (hits.length) {
        const ud = hits[0].object.userData;
        if (ud.type === 'planet') this.ui.showPlanet(ud.data, this.currentStar);
        else this.ui.showSystemHeader(this.currentStar);
      }
    }
  }

  // --- Selezione e navigazione (chiamate dall'interfaccia) --------------------
  selectStar(star) {
    this.currentStar = star;
    this.ui.showProject(star);
  }

  // Durata del salto in base alla distanza: i viaggi lunghi durano di più.
  _cruiseDuration(targetPos) {
    const d = this.ship.position.distanceTo(targetPos);
    return clamp(1.8 + d / 6000, 1.8, 4.8);
  }

  travelToConstellation(cost) {
    if (!this.started || this.mode === 'cruise') return;
    if (this.mode === 'system') this._teardownSystem();
    this.currentConstellation = cost;
    this.galaxy.setDimTarget(1);
    this.mode = 'cruise';
    this.ui.setMode('IPERSPAZIO');
    this.ui.setCrosshair(false);
    this.ui.flash();
    this.ui.toast('Iperspazio', 'Rotta su ' + cost.nome, 0);
    this.ui.setBreadcrumb([
      { text: this.universe.titolo.toUpperCase(), onClick: () => this.goOverview() },
      { text: cost.nome, ctx: true },
    ]);
    this.ship.setVisible(true);
    const cCenter = (cost._centerLive || cost.center);
    this.ship.startCruise(cCenter.clone(), (cost.clusterR || 1500) * 1.7, this._cruiseDuration(cCenter), () => {
      this.mode = 'galaxy';
      this.ui.setMode('GALASSIA');
      this.ui.setCrosshair(true);
      this.ui.hideToast();
      this.ui.toast(cost.nome, cost.descrizione, 2600);
    });
  }

  enterStar(star) {
    if (!this.started || this.mode === 'cruise') return;
    // Già dentro a questo sistema: non ripartire, mostra solo il pannello.
    if (this.mode === 'system' && this.currentStar === star) { this.ui.showSystemHeader(star); return; }
    if (this.mode === 'system') this._teardownSystem();
    this.currentStar = star;
    this.currentConstellation = star.costellazione;
    this.galaxy.setDimTarget(1);
    this.mode = 'cruise';
    this.ui.setMode('IPERSPAZIO');
    this.ui.setCrosshair(false);
    this.ui.flash();
    this.ui.toast('Iperspazio', 'Rotta su ' + star.nome, 0);
    this.ui.setBreadcrumb([
      { text: this.universe.titolo.toUpperCase(), onClick: () => this.goOverview() },
      { text: star.costellazione.nome, onClick: () => this.travelToConstellation(star.costellazione) },
      { text: star.nome, ctx: true },
    ]);
    this.ship.setVisible(true);
    this.ship.startCruise(star.position.clone(), 700, this._cruiseDuration(star.position), () => this._enterSystem(star));
  }

  _enterSystem(star) {
    this._teardownSystem();
    // Nasconde la stella gigante della galassia: nel sistema la sostituisce il sole.
    if (star._mesh) star._mesh.visible = false;
    this.system = new StarSystem(this.scene, star, star.position);
    this.currentStar = star;
    this.mode = 'system';
    this.galaxy.setDimTarget(0.12);
    this.ship.setVisible(false);
    this.orbit.target.copy(star.position);
    this.orbit.radius = this.system.radius * 2.3;
    this.orbit.theta = 0.6; this.orbit.phi = 1.0;
    this._placeOrbitCameraInstant();
    this.ui.setMode('SISTEMA');
    this.ui.setCrosshair(false);
    this.ui.hideToast();
    this.ui.flash();
    this.ui.showSystemHeader(star);
    this.ui.toast(star.nome, 'Sistema stellare · ' + star.pianeti.length + ' pianeti', 2600);
  }

  exitToGalaxy() {
    if (this.mode !== 'system') return;
    const star = this.currentStar;
    if (star && star._mesh) star._mesh.visible = true; // ripristina la stella gigante
    const outward = star.position.clone().sub(new THREE.Vector3(0, 0, 0));
    if (outward.lengthSq() < 1) outward.set(0, 0, 1);
    outward.normalize();
    const pos = star.position.clone().add(outward.multiplyScalar(this.system.radius * 1.6)).add(new THREE.Vector3(0, this.system.radius * 0.4, 0));
    this._teardownSystem();
    this.galaxy.setDimTarget(1);
    this.ship.setVisible(true);
    this.ship.reset(pos, new THREE.Vector3(0, 0, 0));
    this._placeFollowCameraInstant();
    this.mode = 'galaxy';
    this.ui.setMode('GALASSIA');
    this.ui.setCrosshair(true);
    this.ui.flash();
    this.ui.setBreadcrumb([
      { text: this.universe.titolo.toUpperCase(), onClick: () => this.goOverview() },
      { text: star.costellazione.nome, onClick: () => this.travelToConstellation(star.costellazione), ctx: true },
    ]);
    this.ui.showProject(star);
  }

  goOverview() {
    if (this.mode === 'system') this._teardownSystem();
    this.galaxy.setDimTarget(1);
    this.mode = 'cruise';
    this.ui.setMode('IPERSPAZIO');
    this.ui.setCrosshair(false);
    this.ship.setVisible(true);
    this.ui.flash();
    const dest = new THREE.Vector3(0, GALAXY_RADIUS * 0.36, GALAXY_RADIUS * 1.7);
    this.ship.startCruise(dest, 0, this._cruiseDuration(dest), () => {
      this.mode = 'galaxy';
      this.ui.setMode('GALASSIA');
      this.ui.setCrosshair(true);
      this.ui.hideToast();
    });
    this.ui.toast('Iperspazio', 'Ritorno alla vista galattica', 0);
    this.ui.setBreadcrumb([{ text: this.universe.titolo.toUpperCase(), ctx: true }]);
  }

  _teardownSystem() {
    if (this.system) { this.system.dispose(); this.system = null; }
  }

  // --- Personalizzatore della navicella --------------------------------------
  _loadShipConfig() {
    try { const s = localStorage.getItem('shipConfig'); if (s) return Object.assign({}, DEFAULT_SHIP, JSON.parse(s)); } catch (e) {}
    return Object.assign({}, DEFAULT_SHIP);
  }
  _saveShipConfig() { try { localStorage.setItem('shipConfig', JSON.stringify(this.shipConfig)); } catch (e) {} }

  _initCustomizer() {
    const open = document.getElementById('btn-customize');
    const panel = document.getElementById('ship-customizer');
    if (!open || !panel) return;
    const close = document.getElementById('cust-close');
    open.addEventListener('click', () => panel.classList.toggle('open'));
    if (close) close.addEventListener('click', () => panel.classList.remove('open'));
    const markActive = () => {
      panel.querySelectorAll('[data-color]').forEach((b) => {
        b.classList.toggle('active', this.shipConfig[b.getAttribute('data-part')] === b.getAttribute('data-color'));
      });
      panel.querySelectorAll('[data-shape]').forEach((b) => {
        b.classList.toggle('active', this.shipConfig.shape === b.getAttribute('data-shape'));
      });
    };
    panel.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      this.shipConfig[b.getAttribute('data-part')] = b.getAttribute('data-color');
      this.ship.applyConfig(this.shipConfig); this._saveShipConfig(); markActive();
    }));
    panel.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => {
      this.shipConfig.shape = b.getAttribute('data-shape');
      this.ship.applyConfig(this.shipConfig); this._saveShipConfig(); markActive();
    }));
    markActive();
  }

  // --- Modalità osservazione (tour cinematografico, niente HUD/navicella) -----
  _initObservation() {
    const btn = document.getElementById('btn-observe');
    if (btn) btn.addEventListener('click', () => this.enterObservation());
  }

  _buildObservationPoints() {
    const R = GALAXY_RADIUS;
    const C = new THREE.Vector3(0, 0, 0);
    const pts = [];
    const add = (x, y, z, look) => pts.push({ base: new THREE.Vector3(x, y, z), look: (look || C).clone() });
    add(0, R * 0.95, R * 0.25, C);          // dall'alto
    add(R * 1.7, R * 0.05, 0, C);           // di taglio
    add(R * 0.22, R * 0.06, R * 0.22, C);   // vicino al buco nero
    add(-R * 1.2, R * 0.55, R * 1.2, C);    // diagonale alta
    add(R * 0.9, -R * 0.12, -R * 0.9, C);   // radente dal basso
    add(0, R * 0.55, R * 2.4, C);           // panoramica lontana
    add(0, -R * 0.14, R * 0.32, C);         // buco nero dal basso
    const cs = (this.universe && this.universe.costellazioni) || [];
    for (let i = 0; i < 3; i++) {
      const c = cs.length ? cs[i % cs.length] : null;
      const ctr = (c && (c._centerLive || c.center)) || C;
      const off = (c && c.clusterR ? c.clusterR : 1500) * 2.2;
      add(ctr.x + off, ctr.y + off * 0.4, ctr.z + off, ctr.clone());
    }
    return pts;
  }

  enterObservation() {
    if (!this.started || this.observe.active) return;
    if (this.mode === 'system') {
      if (this.currentStar && this.currentStar._mesh) this.currentStar._mesh.visible = true;
      this._teardownSystem();
    }
    this.galaxy.setDimTarget(1);
    this.ship.setVisible(false);
    this.observe.active = true;
    this.observe.points = this._buildObservationPoints();
    this.observe.idx = 0;
    this.observe.t = 999; // forza il primo punto subito
    this.mode = 'galaxy';
    document.body.classList.add('observe');
    const panel = document.getElementById('ship-customizer'); if (panel) panel.classList.remove('open');
    this.ui.flash();
  }

  exitObservation() {
    if (!this.observe.active) return;
    this.observe.active = false;
    document.body.classList.remove('observe');
    this.ship.setVisible(true);
    this.ship.reset(new THREE.Vector3(0, GALAXY_RADIUS * 0.36, GALAXY_RADIUS * 1.7), new THREE.Vector3(0, 0, 0));
    this._placeFollowCameraInstant();
    this.mode = 'galaxy';
    this.ui.setMode('GALASSIA');
    this.ui.flash();
  }

  _updateObservation(dt) {
    const o = this.observe;
    o.t += dt;
    if (o.t >= 8) { o.t = 0; o.idx = (o.idx + 1) % o.points.length; }
    const p = o.points[o.idx];
    const ang = o.t * 0.05;
    const rel = this._tmpObs.copy(p.base).sub(p.look);
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const desired = this._tmpObs2.set(
      p.look.x + (rel.x * cosA - rel.z * sinA),
      p.base.y,
      p.look.z + (rel.x * sinA + rel.z * cosA)
    );
    this.camera.position.lerp(desired, Math.min(1, dt * 1.5));
    this.camera.lookAt(p.look);
  }

  // --- Camere ----------------------------------------------------------------
  _followGoal(out) {
    const offset = new THREE.Vector3(0, 7.5, 28).applyQuaternion(this.ship.group.quaternion);
    return out.copy(this.ship.position).add(offset);
  }

  _placeFollowCameraInstant() {
    const goal = this._followGoal(new THREE.Vector3());
    this.camera.position.copy(goal);
    this.ship.forward(this.camLook).multiplyScalar(40).add(this.ship.position);
    this.camera.lookAt(this.camLook);
  }

  _orbitPos(out) {
    const o = this.orbit;
    return out.set(
      o.target.x + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
      o.target.y + o.radius * Math.cos(o.phi),
      o.target.z + o.radius * Math.sin(o.phi) * Math.sin(o.theta)
    );
  }

  _placeOrbitCameraInstant() {
    this._orbitPos(this.camera.position);
    this.camera.lookAt(this.orbit.target);
  }

  _updateGalaxyCamera(dt) {
    const goal = this._followGoal(new THREE.Vector3());
    const k = clamp(dt * (this.mode === 'cruise' ? 7 : 4.5), 0, 1);
    this.camera.position.lerp(goal, k);
    const look = this.ship.forward(new THREE.Vector3()).multiplyScalar(40).add(this.ship.position);
    this.camLook.lerp(look, k);
    this.camera.lookAt(this.camLook);
  }

  _updateSystemCamera(dt) {
    if (!this._ptr.down) this.orbit.theta += 0.04 * dt; // rotazione lenta automatica
    const goal = this._orbitPos(new THREE.Vector3());
    this.camera.position.lerp(goal, clamp(dt * 5, 0, 1));
    this.camera.lookAt(this.orbit.target);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- Ciclo principale ------------------------------------------------------
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    if (this.galaxy) this.galaxy.update(dt, time, this.camera);

    if (this.observe.active) {
      this._updateObservation(dt);
    } else if (this.started) {
      if (this.mode === 'system') {
        if (this.system) this.system.update(dt, time);
        this._updateSystemCamera(dt);
      } else {
        this.ship.update(dt, this.input);
        // L'arrivo dell'iperspazio può aver appena aperto un sistema stellare.
        if (this.mode === 'system') { if (this.system) this._updateSystemCamera(dt); }
        else this._updateGalaxyCamera(dt);
      }
    } else {
      // Prima dell'avvio: lenta deriva panoramica
      this._updateGalaxyCamera(dt);
    }

    // Iperspazio + campo visivo
    const warpI = (!this.observe.active && this.mode === 'cruise') ? this.ship.cruiseProgress : 0;
    this._updateWarp(dt, warpI);
    const targetFov = this.baseFov + 34 * warpI;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }

    // Interfaccia
    if (this.ui && this.universe) {
      this.ui.setSpeed(this.mode === 'cruise' ? 9999 : this.ship.speed);
      this.ui.updateLabels(this.camera, window.innerWidth, window.innerHeight, this.observe.active ? 'observe' : this.mode);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Avvio (idempotente: una sola istanza)
function boot() {
  if (window.__viaLattea) return;
  window.__viaLattea = true;
  new App();
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();
