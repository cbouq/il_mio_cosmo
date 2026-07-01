// ---------------------------------------------------------------------------
// galaxy.js — Via Lattea viva e maestosa: ~500.000 stelline che orbitano il
// buco nero con rotazione differenziale (shader). I SOLI dei progetti orbitano
// anch'essi il buco nero (ognuno alla velocità del proprio raggio) e brillano
// con un bagliore a stella. Etichette e navigazione seguono le posizioni vive.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GALAXY_RADIUS } from './data.js';
import { glowTexture, starTexture, sunGlowTexture, nebulaTexture, diskTexture, toColor, mulberry32, hashStr, TWO_PI, clamp } from './utils.js';

const S = GALAXY_RADIUS / 1100;
// rotazione differenziale: omega(r) = ORBIT_K / (r + ORBIT_SOFT)
const ORBIT_K = GALAXY_RADIUS * 0.02;
const ORBIT_SOFT = GALAXY_RADIUS * 0.12;

export class Galaxy {
  constructor(scene, universe) {
    this.scene = scene;
    this.universe = universe;
    this.group = new THREE.Group();
    this.spiralGroup = new THREE.Group();
    this.starGroup = new THREE.Group();
    this.lineGroup = new THREE.Group();
    this.interactiveStars = [];
    this._orbitMats = [];
    this.dim = 1;
    this._dimTarget = 1;
    this._tmpV = new THREE.Vector3();

    this.group.add(this.starGroup, this.lineGroup);
    scene.add(this.group);
    scene.add(this.spiralGroup);

    this._buildBackgroundStars();
    this._buildDistantBackdrop();
    this._buildSpiral();
    this._buildBulge();
    this._buildBlackHole();
    this._buildConstellations();
  }

  // Points con rotazione differenziale attorno all'asse Y (via shader).
  _makeOrbitPoints(positions, colors, size, opacity) {
    const n = positions.length / 3;
    const aR = new Float32Array(n), aA = new Float32Array(n), aH = new Float32Array(n), aS = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      aR[i] = Math.hypot(x, z); aA[i] = Math.atan2(z, x); aH[i] = y;
      const u = Math.random();
      aS[i] = 0.55 + u * u * 1.9; // tante stelle piccole, poche grandi → varietà
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(aR, 1));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(aA, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(aH, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(aS, 1));
    const mat = new THREE.PointsMaterial({
      size, sizeAttenuation: true, map: starTexture(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader =
        'uniform float uTime;\nattribute float aRadius;\nattribute float aAngle;\nattribute float aHeight;\nattribute float aScale;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        'float _a = aAngle + uTime * (' + ORBIT_K.toFixed(4) + ' / (aRadius + ' + ORBIT_SOFT.toFixed(1) + '));\n' +
        'vec3 transformed = vec3(cos(_a) * aRadius, aHeight, sin(_a) * aRadius);'
      );
      shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aScale;');
      mat.userData.shader = shader;
    };
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this._orbitMats.push(mat);
    return pts;
  }

  _buildBackgroundStars() {
    const N = 7000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const rnd = mulberry32(99173);
    const R = GALAXY_RADIUS * 3.4;
    const tint = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = R + rnd() * R * 0.7;
      const theta = rnd() * TWO_PI;
      const phi = Math.acos(rnd() * 2 - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const h = rnd();
      if (h < 0.15) tint.setRGB(1, 0.85, 0.7);
      else if (h < 0.3) tint.setRGB(0.75, 0.85, 1);
      else tint.setRGB(1, 1, 1);
      const b = 0.5 + rnd() * 0.5;
      col[i * 3] = tint.r * b; col[i * 3 + 1] = tint.g * b; col[i * 3 + 2] = tint.b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 13, sizeAttenuation: true, map: starTexture(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false,
    });
    this.bgStars = new THREE.Points(geo, mat);
    this.bgStars.frustumCulled = false;
    this.scene.add(this.bgStars);
  }

  _buildDistantBackdrop() {
    const rnd = mulberry32(7777);
    const galPalette = ['#bcd0ff', '#ffd9a8', '#ffb0d6', '#a8ffe0', '#cdbaff', '#9ec5ff', '#ffc89a'];
    for (let i = 0; i < 8; i++) {
      const theta = rnd() * TWO_PI;
      const phi = Math.acos(rnd() * 2 - 1);
      const R = GALAXY_RADIUS * (3.0 + rnd() * 1.2);
      const pos = new THREE.Vector3(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: nebulaTexture(900 + i), color: new THREE.Color(galPalette[i % galPalette.length]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22, fog: false,
      }));
      const sc = GALAXY_RADIUS * (0.5 + rnd() * 0.7);
      spr.scale.set(sc, sc * (0.28 + rnd() * 0.5), 1);
      spr.position.copy(pos);
      spr.material.rotation = rnd() * TWO_PI;
      this.scene.add(spr);
    }
    const nebPalette = ['#4f6bff', '#c46bff', '#37e0b0', '#ff7a9a', '#ffae5a', '#6fd0ff'];
    for (let i = 0; i < 6; i++) {
      const theta = rnd() * TWO_PI;
      const phi = Math.acos(rnd() * 2 - 1);
      const R = GALAXY_RADIUS * (3.1 + rnd() * 1.0);
      const pos = new THREE.Vector3(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: nebulaTexture(300 + i), color: new THREE.Color(nebPalette[i % nebPalette.length]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1, fog: false,
      }));
      const sc = GALAXY_RADIUS * (0.5 + rnd() * 0.7);
      spr.scale.set(sc, sc * (0.6 + rnd() * 0.4), 1);
      spr.position.copy(pos);
      spr.material.rotation = rnd() * TWO_PI;
      this.scene.add(spr);
    }
  }

  _buildSpiral() {
    const N = 480000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const rnd = mulberry32(20260629);
    const arms = 4;
    const spin = 2.7;
    const RMAX = GALAXY_RADIUS * 1.35;
    const core = new THREE.Color('#ffe7c2');
    const mid = new THREE.Color('#dfe2ff');
    const edge = new THREE.Color('#6486d6');
    const tmp = new THREE.Color();

    for (let i = 0; i < N; i++) {
      const t = Math.pow(rnd(), 0.5);
      const radius = t * RMAX;
      const arm = i % arms;
      const branch = (arm / arms) * TWO_PI;
      const spinAngle = radius / GALAXY_RADIUS * spin * TWO_PI;
      const spread = (1 - t) * 0.30 + 0.03;
      const rx = Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * spread * 120 * S;
      const ry = Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * (22 * (1 - t) + 3) * S;
      const rz = Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * spread * 120 * S;
      const a = branch + spinAngle;
      pos[i * 3] = Math.cos(a) * radius + rx;
      pos[i * 3 + 1] = ry;
      pos[i * 3 + 2] = Math.sin(a) * radius + rz;

      if (t < 0.4) tmp.copy(core).lerp(mid, t / 0.4);
      else tmp.copy(mid).lerp(edge, (t - 0.4) / 0.6);
      const fade = 1 - 0.5 * t;
      const b = (0.4 + rnd() * 0.3) * fade;
      col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
    }
    this.spiral = this._makeOrbitPoints(pos, col, 4.5, 0.55);
    this.spiralGroup.add(this.spiral);
  }

  _buildBulge() {
    const N = 45000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const rnd = mulberry32(556677);
    const c1 = new THREE.Color('#ffeccb');
    const c2 = new THREE.Color('#ffce93');
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = Math.pow(rnd(), 2.4) * GALAXY_RADIUS * 0.17;
      const theta = rnd() * TWO_PI;
      const phi = Math.acos(rnd() * 2 - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.55;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      tmp.copy(c1).lerp(c2, rnd());
      const b = 0.35 + rnd() * 0.4;
      col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
    }
    this.bulge = this._makeOrbitPoints(pos, col, 6, 0.55);
    this.spiralGroup.add(this.bulge);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color('#ffd6a0'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.08,
    }));
    const gs = GALAXY_RADIUS * 0.14;
    glow.scale.set(gs, gs, 1);
    this.coreGlow = glow;
    this.spiralGroup.add(glow);
  }

  // ---- BUCO NERO supermassiccio, grande e imponente ----
  _buildBlackHole() {
    const g = new THREE.Group();
    const rH = GALAXY_RADIUS * 0.06;
    const tilt = -Math.PI / 2 + 0.36;

    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(rH, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })
    );
    horizon.renderOrder = 2;
    g.add(horizon);

    const diskOuter = rH * 5;
    const disk = new THREE.Mesh(
      new THREE.PlaneGeometry(diskOuter * 2, diskOuter * 2),
      new THREE.MeshBasicMaterial({
        map: diskTexture(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.42, fog: false,
      })
    );
    disk.rotation.x = tilt;
    disk.renderOrder = 1;
    g.add(disk);
    this._bhDisk = disk;

    // anello di fotoni + alone di "lensing" leggermente più ampio
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rH * 1.12, rH * 0.028, 24, 140),
      new THREE.MeshBasicMaterial({ color: 0xfff0d4, fog: false })
    );
    ring.rotation.x = tilt;
    g.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(rH * 1.28, rH * 0.012, 16, 140),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.5, fog: false })
    );
    ring2.rotation.x = tilt;
    g.add(ring2);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color('#ff8a3c'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1, fog: false,
    }));
    const gs = diskOuter * 1.1;
    glow.scale.set(gs, gs, 1);
    g.add(glow);
    this._bhGlow = glow;

    this.blackHole = g;
    this.group.add(g);
  }

  // Costellazioni: SOLI dei progetti, che orbitano il buco nero e brillano.
  _buildConstellations() {
    const starGeo = new THREE.SphereGeometry(1, 24, 24);

    this.universe.costellazioni.forEach((cost) => {
      const cCol = toColor(cost.colore, '#8fe9ff');

      // parametri orbitali del genere (tutte le sue stelle ruotano insieme)
      const cR = Math.hypot(cost.center.x, cost.center.z);
      const cA = Math.atan2(cost.center.z, cost.center.x);
      const omega = ORBIT_K / (cR + ORBIT_SOFT);
      cost._orbit = { radius: cR, angle0: cA, height: cost.center.y, omega };
      cost._centerLive = cost.center.clone();
      cost._lineRefs = [];

      cost.links.forEach(([a, b]) => {
        const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const m = new THREE.LineBasicMaterial({
          color: cCol, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const line = new THREE.Line(geo, m);
        line.frustumCulled = false;
        line.userData.baseOpacity = 0.16;
        this.lineGroup.add(line);
        cost._lineRefs.push({ line, a, b });
      });

      cost.stelle.forEach((star) => {
        const col = toColor(star.coloreStella, cost.colore);
        const rCore = 70 * (star.dimensione || 1);

        const cmat = new THREE.MeshBasicMaterial({ color: col, transparent: true, fog: false });
        const cmesh = new THREE.Mesh(starGeo, cmat);
        cmesh.scale.setScalar(rCore);
        cmesh.position.copy(star.position);
        cmesh.userData = { type: 'star', star, baseColor: col.clone() };

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: sunGlowTexture(), color: col, transparent: true,
          depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3, fog: false,
        }));
        const gs = rCore * 2.2;
        glow.scale.set(gs, gs, 1);
        cmesh.add(glow);

        // alone esterno morbido e tenue (doppio strato, per atmosfera)
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture(), color: col, transparent: true,
          depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1, fog: false,
        }));
        halo.scale.set(gs * 1.7, gs * 1.7, 1);
        cmesh.add(halo);

        star._glow = glow;
        star._halo = halo;
        star._mesh = cmesh;
        star._baseGlow = gs;
        star._phase = (hashStr(star.id) % 1000) / 1000 * TWO_PI;
        // orbita: stesso omega del genere → rotazione rigida del cluster
        star._orbit = {
          radius: Math.hypot(star.position.x, star.position.z),
          angle0: Math.atan2(star.position.z, star.position.x),
          height: star.position.y,
          omega,
        };

        this.starGroup.add(cmesh);
        this.interactiveStars.push(cmesh);
      });
    });
  }

  setDimTarget(v) { this._dimTarget = v; }

  update(dt, time, camera) {
    this.dim += (this._dimTarget - this.dim) * Math.min(1, dt * 3);
    const d = this.dim;

    // rotazione differenziale del campo stellare (shader)
    for (const m of this._orbitMats) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = time;
    }

    if (this.spiral) this.spiral.material.opacity = 0.45 * d;
    if (this.bulge) this.bulge.material.opacity = 0.45 * d;
    if (this.coreGlow) this.coreGlow.material.opacity = 0.08 * d;
    if (this._bhDisk) this._bhDisk.rotation.z += dt * 0.04;
    if (this._bhGlow) this._bhGlow.material.opacity = 0.1 * (0.9 + Math.sin(time * 1.0) * 0.1);

    // orbita dei soli dei progetti + scintillio + linee + etichette vive
    const pulseT = time * 2.2;
    this.universe.costellazioni.forEach((cost) => {
      const o = cost._orbit;
      const ca = o.angle0 + o.omega * time;
      cost._centerLive.set(Math.cos(ca) * o.radius, o.height, Math.sin(ca) * o.radius);

      cost.stelle.forEach((star) => {
        const so = star._orbit;
        const a = so.angle0 + o.omega * time;
        star.position.set(Math.cos(a) * so.radius, so.height, Math.sin(a) * so.radius);
        if (star._mesh) star._mesh.position.copy(star.position);
        if (star._mesh) star._mesh.material.opacity = clamp(0.5 + 0.5 * d, 0, 1);
        if (star._glow) {
          const tw = 0.82 + 0.18 * Math.sin(pulseT + (star._phase || 0));
          star._glow.material.opacity = 0.3 * d * tw;
          star._glow.scale.setScalar(star._baseGlow * (0.94 + 0.12 * tw));
        }
        if (star._halo) star._halo.material.opacity = 0.1 * d;
      });

      cost._lineRefs.forEach((lr) => {
        const p = lr.line.geometry.attributes.position;
        p.setXYZ(0, lr.a.x, lr.a.y, lr.a.z);
        p.setXYZ(1, lr.b.x, lr.b.y, lr.b.z);
        p.needsUpdate = true;
        lr.line.material.opacity = lr.line.userData.baseOpacity * d;
      });
    });
  }

  nearestStar(posWorld, maxDist = 2000) {
    let best = null, bestD = maxDist * maxDist;
    for (const cmesh of this.starGroup.children) {
      const dd = cmesh.getWorldPosition(this._tmpV).distanceToSquared(posWorld);
      if (dd < bestD) { bestD = dd; best = cmesh.userData.star; }
    }
    return best;
  }
}
