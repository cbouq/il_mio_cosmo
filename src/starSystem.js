// ---------------------------------------------------------------------------
// starSystem.js — costruisce il sistema planetario di un progetto: la stella
// centrale e i pianeti (i dettagli del progetto) in orbita, come nella realtà.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { glowTexture, sunGlowTexture, planetTexture, toColor, hashStr, mulberry32, TWO_PI } from './utils.js';

export class StarSystem {
  // origin: posizione nel mondo dove costruire il sistema (di solito la stella).
  constructor(scene, star, origin) {
    this.scene = scene;
    this.star = star;
    this.group = new THREE.Group();
    this.group.position.copy(origin);
    this.planets = [];        // { pivot, mesh, data, orbitR, speed, spin }
    this.pickables = [];      // mesh cliccabili (pianeti e luna)
    this.radius = 40;         // raggio approssimativo del sistema (per la camera)

    scene.add(this.group);
    this._buildStar();
    this._buildPlanets();
  }

  _buildStar() {
    const col = toColor(this.star.coloreStella, '#ffd27f');
    const rStar = 26 * (this.star.dimensione || 1);
    this._rStar = rStar;

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(rStar, 40, 40),
      new THREE.MeshBasicMaterial({ color: col })
    );
    sun.userData = { type: 'sun', star: this.star };
    this.group.add(sun);
    this.sun = sun;

    // Bagliore
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: col, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6,
    }));
    glow.scale.set(rStar * 9, rStar * 9, 1);
    sun.add(glow);
    this._sunGlow = glow;

    // Corona ravvicinata (secondo strato con flare a stella)
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlowTexture(), color: col, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45,
    }));
    corona.scale.set(rStar * 4.2, rStar * 4.2, 1);
    sun.add(corona);

    // Luce della stella che illumina i pianeti (decay 0 = illuminazione uniforme).
    const light = new THREE.PointLight(col.getHex(), 2.6, 0, 0);
    sun.add(light);
    // Luce d'ambiente a gradiente: modella meglio i pianeti.
    this.group.add(new THREE.HemisphereLight(0x8294b8, 0x141020, 0.5));
    this.pickables.push(sun);
  }

  _buildPlanets() {
    const pianeti = this.star.pianeti || [];
    let maxOrbit = 0;

    pianeti.forEach((p, i) => {
      const seed = hashStr((this.star.id || 's') + ':' + (p.nome || i));
      const rnd = mulberry32(seed);
      const orbitR = 90 + (p.distanza || (i + 1)) * 70 + i * 22;
      maxOrbit = Math.max(maxOrbit, orbitR);
      const rPlanet = 8 * (p.dimensione || 1);
      const col = toColor(p.colore, '#9b8060');

      // Anello orbitale (linea)
      this.group.add(this._orbitLine(orbitR, col));

      // Pivot che ruota: il pianeta orbita attorno alla stella
      const pivot = new THREE.Group();
      pivot.rotation.y = rnd() * TWO_PI;
      this.group.add(pivot);

      const tex = planetTexture(p.tipo, p.colore, seed);
      const isHot = p.tipo === 'lava';
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(rPlanet, 28, 28),
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: p.tipo === 'oceano' ? 0.5 : 0.9,
          metalness: 0.0,
          emissive: isHot ? new THREE.Color('#ff5a1e') : new THREE.Color('#000000'),
          emissiveIntensity: isHot ? 0.5 : 0,
        })
      );
      mesh.position.set(orbitR, 0, 0);
      mesh.rotation.z = (rnd() - 0.5) * 0.6; // inclinazione assiale
      mesh.userData = { type: 'planet', data: p, star: this.star };
      pivot.add(mesh);
      this.pickables.push(mesh);

      // Atmosfera: alone sottile sul bordo del pianeta (rim glow)
      const atmCol = col.clone().lerp(new THREE.Color('#ffffff'), 0.35);
      const atm = new THREE.Mesh(
        new THREE.SphereGeometry(rPlanet * 1.14, 24, 24),
        new THREE.MeshBasicMaterial({
          color: atmCol, transparent: true, opacity: 0.08,
          blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
        })
      );
      mesh.add(atm);

      // Anelli planetari (tipo Saturno)
      if (p.anelli) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(rPlanet * 1.5, rPlanet * 2.4, 48),
          new THREE.MeshBasicMaterial({
            color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.5,
            depthWrite: false,
          })
        );
        ring.rotation.x = Math.PI / 2.2;
        mesh.add(ring);
      }

      // Lune
      const lune = [];
      const nLune = Math.min(3, p.lune || 0);
      for (let m = 0; m < nLune; m++) {
        const moonPivot = new THREE.Group();
        mesh.add(moonPivot);
        const moonR = rPlanet * 0.32;
        const moonDist = rPlanet * (2 + m * 0.9);
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(moonR, 14, 14),
          new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 1 })
        );
        moon.position.set(moonDist, 0, 0);
        moonPivot.rotation.y = rnd() * TWO_PI;
        moonPivot.add(moon);
        lune.push({ pivot: moonPivot, speed: 0.8 + rnd() * 1.2 });
      }

      this.planets.push({
        pivot, mesh, data: p,
        orbitR,
        speed: (0.25 + rnd() * 0.5) * (1 / Math.sqrt(orbitR / 30)), // più lente se lontane
        spin: 0.3 + rnd() * 0.8,
        lune,
      });
    });

    this.radius = Math.max(160, maxOrbit + 80);
  }

  _orbitLine(r, col) {
    const pts = [];
    const seg = 96;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TWO_PI;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: col, transparent: true, opacity: 0.22, depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }

  update(dt, time) {
    if (this._sunGlow) this._sunGlow.scale.setScalar(
      this._rStar * 9 * (1 + Math.sin(time * 2) * 0.04)
    );
    for (const pl of this.planets) {
      pl.pivot.rotation.y += pl.speed * dt;
      pl.mesh.rotation.y += pl.spin * dt;
      for (const moon of pl.lune) moon.pivot.rotation.y += moon.speed * dt;
    }
  }

  // Rimuove e libera la memoria del sistema.
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.planets = [];
    this.pickables = [];
  }
}
