// Pooled visual effects: no new objects per frame in the hot loop. One shared
// pool of tracer lines, muzzle flashes, impact sparks and smoke puffs, recycled.
import * as THREE from 'three';

const MAX_TRACERS = 24, MAX_SPARKS = 160, MAX_PUFFS = 24;

export function createEffects(scene) {
  const tracerGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(MAX_TRACERS * 6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracers = new THREE.LineSegments(tracerGeo, tracerMat);
  tracers.frustumCulled = false;
  scene.add(tracers);
  const tracerPool = Array.from({ length: MAX_TRACERS }, () => ({ life: 0, from: new THREE.Vector3(), to: new THREE.Vector3() }));

  const sparkGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(MAX_SPARKS * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xffc861, size: 0.09, transparent: true, opacity: 0.95 });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkPool = Array.from({ length: MAX_SPARKS }, () => ({ life: 0, vel: new THREE.Vector3(), pos: new THREE.Vector3() }));

  const flash = new THREE.PointLight(0xffc861, 0, 9, 1.6);
  scene.add(flash);
  let flashLife = 0;

  return {
    fireTracer(from, to) {
      const t = tracerPool.find((x) => x.life <= 0) ?? tracerPool[0];
      t.from.copy(from); t.to.copy(to); t.life = 0.09;
    },
    impact(p, n = 6) {
      let made = 0;
      for (const s of sparkPool) {
        if (made >= n) break;
        if (s.life > 0) continue;
        s.pos.copy(p);
        s.vel.set((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
        s.life = 0.35; made++;
      }
    },
    muzzle(p) { flash.position.copy(p); flash.intensity = 26; flashLife = 0.06; },
    update(dt) {
      for (let i = 0; i < MAX_TRACERS; i++) {
        const t = tracerPool[i];
        t.life = Math.max(0, t.life - dt);
        const o = i * 6;
        if (t.life > 0) {
          tPos[o] = t.from.x; tPos[o + 1] = t.from.y; tPos[o + 2] = t.from.z;
          tPos[o + 3] = t.to.x; tPos[o + 4] = t.to.y; tPos[o + 5] = t.to.z;
        } else { tPos[o + 3] = tPos[o]; tPos[o + 4] = tPos[o + 1]; tPos[o + 5] = tPos[o + 2]; }
      }
      tracerGeo.attributes.position.needsUpdate = true;
      tracerMat.opacity = 0.9;
      for (let i = 0; i < MAX_SPARKS; i++) {
        const s = sparkPool[i];
        const o = i * 3;
        if (s.life > 0) {
          s.life -= dt;
          s.vel.y -= 9 * dt;
          s.pos.addScaledVector(s.vel, dt);
          sPos[o] = s.pos.x; sPos[o + 1] = s.pos.y; sPos[o + 2] = s.pos.z;
        } else { sPos[o + 1] = -100; }
      }
      sparkGeo.attributes.position.needsUpdate = true;
      if (flashLife > 0) { flashLife -= dt; if (flashLife <= 0) flash.intensity = 0; }
    },
  };
}
