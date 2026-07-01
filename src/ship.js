// ---------------------------------------------------------------------------
// ship.js — la navicella: modello 3D PERSONALIZZABILE (colori e forma), modello
// di volo (tastiera + mouse) e salto nell'iperspazio (cruise) verso un bersaglio.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, smoothstep } from './utils.js';

const FWD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

export const DEFAULT_SHIP = { hull: '#cdd6e6', accent: '#2a6cff', glass: '#7fd6ff', flame: '#66ccff', shape: 'caccia' };
const SHAPES = {
  caccia: { wingX: 1.0, fusY: 1.0, cockpit: 1.0 },
  esploratore: { wingX: 1.35, fusY: 0.95, cockpit: 1.25 },
  crociera: { wingX: 0.82, fusY: 1.35, cockpit: 0.9 },
};

export class Ship {
  constructor(scene, config) {
    this.scene = scene;
    this.config = Object.assign({}, DEFAULT_SHIP, config || {});
    this.group = new THREE.Group();
    this.velocity = new THREE.Vector3();
    this.mode = 'fly';
    this.maxSpeed = 2200;
    this.boostSpeed = 9000;
    this.accel = 3000;
    this._cruise = null;
    this._tmpQ = new THREE.Quaternion();
    this._tmpM = new THREE.Matrix4();
    this._tmpV = new THREE.Vector3();
    this._flames = [];

    this._build();
    this.applyConfig(this.config);
    scene.add(this.group);
  }

  _build() {
    const body = new THREE.Group();
    this._hullMat = new THREE.MeshStandardMaterial({ color: 0xcdd6e6, metalness: 0.2, roughness: 0.45, emissive: 0x2a3550, emissiveIntensity: 0.5 });
    this._accentMat = new THREE.MeshStandardMaterial({ color: 0x2a6cff, metalness: 0.15, roughness: 0.5, emissive: 0x10204a, emissiveIntensity: 0.5 });
    this._glassMat = new THREE.MeshStandardMaterial({ color: 0x7fd6ff, metalness: 0.1, roughness: 0.15, emissive: 0x1d5b80, emissiveIntensity: 0.9 });
    const engMat = new THREE.MeshStandardMaterial({ color: 0x333a48, metalness: 0.5, roughness: 0.5 });

    // Fusoliera (cono che punta in avanti, verso -Z)
    this._fus = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.2, 18), this._hullMat);
    this._fus.rotation.x = -Math.PI / 2;
    this._fus.position.z = -0.6;
    body.add(this._fus);

    // Abitacolo
    this._cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), this._glassMat);
    this._cockpit.position.set(0, 0.35, -0.4);
    this._cockpit.scale.set(1, 0.7, 1.3);
    body.add(this._cockpit);

    // Ali
    this._wing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 1.5), this._accentMat);
    this._wing.position.z = 1.0;
    body.add(this._wing);

    // Motori + fiamme
    for (const x of [-1.4, 1.4]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 14), engMat);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(x, 0, 1.5);
      body.add(eng);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1.6, 14),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 })
      );
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, 0, 2.6);
      body.add(flame);
      this._flames.push(flame);
    }

    const l = new THREE.PointLight(0x88bbff, 1.2, 60);
    l.position.set(0, 4, 2);
    body.add(l);

    this.group.add(body);
    this.body = body;
  }

  // Applica colori e forma (chiamabile a runtime dal personalizzatore).
  applyConfig(cfg) {
    this.config = Object.assign({}, this.config, cfg || {});
    const c = this.config;
    if (this._hullMat) this._hullMat.color.set(c.hull);
    if (this._accentMat) this._accentMat.color.set(c.accent);
    if (this._glassMat) { this._glassMat.color.set(c.glass); this._glassMat.emissive.set(c.glass).multiplyScalar(0.35); }
    for (const fl of this._flames) fl.material.color.set(c.flame);
    const s = SHAPES[c.shape] || SHAPES.caccia;
    if (this._wing) this._wing.scale.x = s.wingX;
    if (this._fus) this._fus.scale.y = s.fusY;
    if (this._cockpit) this._cockpit.scale.set(s.cockpit, 0.7 * s.cockpit, 1.3 * s.cockpit);
  }

  reset(pos, lookAtTarget) {
    this.group.position.copy(pos);
    if (lookAtTarget) this.group.lookAt(lookAtTarget);
    this.velocity.set(0, 0, 0);
    this.mode = 'fly';
    this._cruise = null;
  }

  forward(out = new THREE.Vector3()) { return out.copy(FWD).applyQuaternion(this.group.quaternion); }
  get position() { return this.group.position; }
  get speed() { return this.velocity.length(); }
  setVisible(v) { this.group.visible = v; }

  startCruise(targetPos, approachDist, duration, onArrive) {
    const start = this.group.position.clone();
    const dir = this._tmpV.copy(targetPos).sub(start);
    const total = dir.length();
    if (total < 1e-3) dir.set(0, 0, -1); else dir.normalize();
    const end = targetPos.clone().sub(dir.clone().multiplyScalar(Math.min(approachDist, total * 0.6)));
    this._cruise = { start, end, target: targetPos.clone(), t: 0, duration: duration || 2.4, onArrive, progress: 0 };
    this.mode = 'cruise';
    this.velocity.set(0, 0, 0);
  }

  get cruiseProgress() { return this._cruise ? this._cruise.progress : 0; }

  update(dt, input) {
    if (this.mode === 'cruise') this._updateCruise(dt);
    else if (this.mode === 'fly') this._updateFly(dt, input);

    if (this._flames.length) {
      const intensity = this.mode === 'cruise' ? 2.2 : clamp(this.speed / this.maxSpeed, 0.15, 1.4);
      const f = intensity * (0.85 + Math.random() * 0.3);
      for (const fl of this._flames) { fl.scale.set(1, 1, f); fl.material.opacity = clamp(0.4 + f * 0.4, 0, 1); }
    }
  }

  _updateFly(dt, input) {
    const k = input.keys;
    let yaw = 0, pitch = 0, roll = 0;
    if (k.has('a') || k.has('arrowleft')) yaw += 1;
    if (k.has('d') || k.has('arrowright')) yaw -= 1;
    if (k.has('arrowup')) pitch += 1;
    if (k.has('arrowdown')) pitch -= 1;
    if (k.has('q')) roll += 1;
    if (k.has('e')) roll -= 1;

    this.group.rotateY(yaw * 1.1 * dt);
    this.group.rotateX(pitch * 0.9 * dt);
    this.group.rotateZ(roll * 1.3 * dt);

    if (input.look.dx || input.look.dy) {
      this.group.rotateY(-input.look.dx * 0.0024);
      this.group.rotateX(-input.look.dy * 0.0024);
      input.look.dx = 0; input.look.dy = 0;
    }

    const boost = k.has('shift');
    const maxV = boost ? this.boostSpeed : this.maxSpeed;
    const acc = boost ? this.accel * 2.1 : this.accel;
    let throttle = 0;
    if (k.has('w')) throttle += 1;
    if (k.has('s')) throttle -= 0.8;

    const fwd = this.forward(this._tmpV);
    this.velocity.addScaledVector(fwd, throttle * acc * dt);

    let vert = 0;
    if (k.has(' ') || k.has('spacebar') || k.has('space')) vert += 1;
    if (k.has('control') || k.has('c')) vert -= 1;
    if (vert) {
      const up = UP.clone().applyQuaternion(this.group.quaternion);
      this.velocity.addScaledVector(up, vert * acc * 0.7 * dt);
    }

    const damp = throttle === 0 && vert === 0 ? 0.6 : 0.25;
    this.velocity.multiplyScalar(1 - Math.min(1, damp * dt));
    if (this.velocity.length() > maxV) this.velocity.setLength(maxV);

    this.group.position.addScaledVector(this.velocity, dt);
  }

  _updateCruise(dt) {
    const c = this._cruise;
    c.t += dt;
    let tt = clamp(c.t / c.duration, 0, 1);
    c.progress = Math.sin(tt * Math.PI);
    const eased = smoothstep(smoothstep(tt));
    this.group.position.lerpVectors(c.start, c.end, eased);

    this._tmpM.lookAt(this.group.position, c.target, UP);
    this._tmpQ.setFromRotationMatrix(this._tmpM);
    this.group.quaternion.slerp(this._tmpQ, Math.min(1, dt * 5));

    if (tt >= 1) {
      this.mode = 'fly';
      this.forward(this.velocity).multiplyScalar(200);
      const cb = c.onArrive; this._cruise = null;
      if (cb) cb();
    }
  }
}
