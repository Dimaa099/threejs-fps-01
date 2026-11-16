// SOLSTICE map: a compact three-lane Mediterranean hill town. Attackers spawn
// south, defenders north. A "Depot" (fuel-crate yard, rust markers) west, B
// "Terrace" (chapel terrace, teal markers) east, mid is a market street with
// awnings. Every wall the eye sees is a collider the simulation uses.
import * as THREE from 'three';
import { CFG } from './config.js';
import { box } from './collide.js';
import { buildGraph } from './nav.js';

export const SITES = [
  { id: 'A', name: 'Depot', x: -22, z: -17, r: 5 },
  { id: 'B', name: 'Terrace', x: 22, z: -12, r: 5 },
];
export const SPAWNS = {
  atk: [
    { x: -14, z: 21, yaw: 0 }, { x: -5, z: 21, yaw: 0 }, { x: 4, z: 21, yaw: 0 },
    { x: 12, z: 21, yaw: 0 }, { x: 20, z: 20, yaw: 0 },
  ],
  def: [
    { x: -22, z: -14, yaw: Math.PI }, { x: -16, z: -12, yaw: Math.PI }, { x: 0, z: -13, yaw: Math.PI },
    { x: 16, z: -12, yaw: Math.PI }, { x: 28, z: -10, yaw: Math.PI },
  ],
};

// Buildings: [x0, z0, x1, z1, height]. Gaps between them are the lanes.
const BUILDINGS = [
  // west-mid blocks (north / south of the west cross-lane)
  [-14, -22, -8, -6, 4.5], [-14, 0, -8, 14, 4.5],
  // mid-east blocks (north / south of the east cross-lane)
  [8, -22, 14, -8, 4.5], [8, -2, 14, 14, 4.5],
  // north-center block behind mid, flanking the bell tower
  [-6, -22, -2, -14, 5], [2, -22, 6, -14, 5],
  // south-center block splitting the attacker approach
  [-4, 10, 4, 20, 4],
  // chapel at B (Terrace)
  [20, -22, 28, -16, 6],
  // depot shed at A
  [-30, -22, -26, -16, 3.5],
];
// Low cover that blocks movement but not sight over the top.
const COVER = [
  // market stalls at mid
  [-5, -3, -2, -1, 1.1], [2, -3, 5, -1, 1.1], [-4, 4, -1, 6, 1.1], [1, 4, 4, 6, 1.1],
  // fuel crates at A
  [-26, -14, -23, -12, 1.2], [-19, -20, -17, -18, 1.2], [-25, -19, -23, -17, 1.0],
  // planters / crates at B
  [17, -14, 19, -12, 1.0], [24, -13, 26, -11, 1.2],
  // lane crates
  [-24, 2, -22, 4, 1.1], [20, 6, 22, 8, 1.1], [-3, -10, -1, -8, 1.0], [9, 12, 11, 14, 1.1],
];

export function buildMap(scene) {
  const boxes = [];
  const mat = {
    white: new THREE.MeshStandardMaterial({ color: CFG.WHITEWASH, roughness: 0.9 }),
    terra: new THREE.MeshStandardMaterial({ color: CFG.TERRA, roughness: 0.85 }),
    terraDark: new THREE.MeshStandardMaterial({ color: CFG.TERRA_DARK, roughness: 0.85 }),
    sand: new THREE.MeshStandardMaterial({ color: CFG.SAND, roughness: 1 }),
    sandDark: new THREE.MeshStandardMaterial({ color: CFG.SAND_DARK, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: CFG.STONE, roughness: 0.95 }),
    teal: new THREE.MeshStandardMaterial({ color: CFG.TEAL, roughness: 0.7 }),
    rust: new THREE.MeshStandardMaterial({ color: CFG.RUST, roughness: 0.8 }),
    awning: new THREE.MeshStandardMaterial({ color: CFG.AWNING, roughness: 0.9, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: CFG.LEAF, roughness: 1 }),
  };
  // Ground: sandstone plaza.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(72, 56), mat.sand);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Site yards: slightly darker sand inlays so A and B read from above.
  for (const s of SITES) {
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), mat.sandDark);
    yard.rotation.x = -Math.PI / 2; yard.position.set(s.x, 0.02, s.z); yard.receiveShadow = true;
    scene.add(yard);
  }
  // Perimeter walls.
  const perim = [[-33, -25, 33, -24, 5], [-33, 24, 33, 25, 5], [-33, -25, -32, 25, 5], [32, -25, 33, 25, 5]];
  for (const [x0, z0, x1, z1, h] of perim) {
    boxes.push(box(x0, z0, x1, z1, h));
    addBox(scene, mat.white, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
  }
  // Buildings: whitewashed walls + terracotta roof slab.
  for (const [x0, z0, x1, z1, h] of BUILDINGS) {
    boxes.push(box(x0, z0, x1, z1, h));
    addBox(scene, mat.white, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
    addBox(scene, mat.terra, (x0 + x1) / 2, h + 0.18, (z0 + z1) / 2, x1 - x0 + 0.7, 0.36, z1 - z0 + 0.7);
  }
  // Low cover: crates (rust at A, stone elsewhere), stalls with awnings at mid.
  for (const [x0, z0, x1, z1, h] of COVER) {
    boxes.push(box(x0, z0, x1, z1, h));
    const atA = x0 < -15 && z0 < -10;
    addBox(scene, atA ? mat.rust : mat.stone, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0);
  }
  // Market awnings over the mid stalls.
  for (const [cx, cz, col] of [[-3.5, -2, 0xe8b13c], [3.5, -2, 0x2fb3a8], [-2.5, 5, 0xc23b22], [2.5, 5, 0xe8b13c]]) {
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }));
    awn.rotation.x = -Math.PI / 2 + 0.18; awn.position.set(cx, 2.6, cz);
    awn.castShadow = true; scene.add(awn);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), mat.stone);
    pole.position.set(cx + 1.8, 1.3, cz + 1.2); scene.add(pole);
  }
  // Bell tower landmark, center-north: sandstone shaft, arched top, terracotta cap.
  boxes.push(box(-1.2, -23.5, 1.2, -21.1, 14));
  addBox(scene, mat.stone, 0, 7, -22.3, 2.4, 14, 2.4);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 4), mat.terraDark);
  cap.position.set(0, 15, -22.3); cap.rotation.y = Math.PI / 4; cap.castShadow = true; scene.add(cap);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe8b13c, metalness: 0.6, roughness: 0.4 }));
  bell.position.set(0, 12.2, -21); scene.add(bell);
  // Chapel dome at B: teal half-dome on the chapel roof.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.teal);
  dome.position.set(24, 6, -19); dome.castShadow = true; scene.add(dome);
  // Site markers: tall pole + coloured flag + floating letter sprite.
  for (const s of SITES) {
    const col = s.id === 'A' ? CFG.RUST : CFG.TEAL;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.4, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
    pole.position.set(s.x + 4.5, 2.7, s.z + 4.5); pole.castShadow = true; scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(s.x + 5.4, 4.9, s.z + 4.5); scene.add(flag);
    const sprite = makeLetterSprite(s.id, col);
    sprite.position.set(s.x, 4.6, s.z); scene.add(sprite);
  }
  // A few cypress trees for the hill-town read.
  for (const [tx, tz] of [[-30, 20], [30, 18], [-10, -20], [16, -20], [30, -8], [-30, 10]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.6, 6), mat.terraDark);
    trunk.position.set(tx, 0.8, tz); scene.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 8), mat.leaf);
    top.position.set(tx, 3.2, tz); top.castShadow = true; scene.add(top);
  }
  // Waypoints: 5 m grid over open ground, plus site and spawn points.
  const nodes = [];
  for (let x = -29; x <= 29; x += 5) {
    for (let z = -21; z <= 21; z += 5) {
      if (pointBlocked(boxes, x, z)) continue;
      nodes.push({ x, z });
    }
  }
  for (const s of SITES) nodes.push({ x: s.x, z: s.z });
  for (const team of ['atk', 'def']) for (const s of SPAWNS[team]) nodes.push({ x: s.x, z: s.z });
  const graph = buildGraph(nodes, boxes);
  return { boxes, sites: SITES, spawns: SPAWNS, graph };
}

function pointBlocked(boxes, x, z) {
  for (const b of boxes) if (x >= b.x0 - 0.6 && x <= b.x1 + 0.6 && z >= b.z0 - 0.6 && z <= b.z1 + 0.6 && b.y1 > 1.2) return true;
  return false;
}
function addBox(scene, material, x, y, z, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}
function makeLetterSprite(letter, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'bold 84px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(2.0, 2.0, 1);
  return sprite;
}
