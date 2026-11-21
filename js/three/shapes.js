/*
 * Procedural stand-ins for real objects. Each one quotes the project it opens:
 *   lattice  → Euplectella aspergillum (porous lattice, tubing, blue LED "shrimp")
 *   book     → Can Dongba Order Coffee? (the real cover as texture; opens on hover)
 *   poster   → Mammals with Headgear (the real posters, front and back)
 *   ice      → Frozen Flow (a frozen shell with moving water inside, in a basin)
 *   tangram  → Between the Museum and the Park (seven material pieces in a wooden frame)
 *   model    → any GLB/GLTF you add later
 *   mesh     → your own scanned / printed models (.mesh.json), with a material look per part
 *
 * Every builder returns { object, height, update(t, dt, hover) }.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ENV = 0.55; // how much the environment reflection contributes

export function buildShape(o, ctx) {
  const fn = { lattice, book, spiralbook, poster, ice, tangram, model, mesh }[o.shape] || lattice;
  return fn(o, ctx);
}

const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/* ── Lattice ─────────────────────────────────────────────── */
function lattice(o) {
  const g = new THREE.Group();
  const H = 1.5;
  const prof = (y) => { const t = y / H; return 0.19 + 0.19 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.5) + 0.09 * t ** 7; };
  const pts = [];
  for (let i = 0; i <= 56; i++) { const y = (i / 56) * H; pts.push(new THREE.Vector2(prof(y), y)); }
  const geo = new THREE.LatheGeometry(pts, 72);

  // seamless lattice tile: square grid + diagonals, like the sponge's silica skeleton
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#fff'; x.lineCap = 'square';
  x.lineWidth = 22;
  for (const p of [0, 128, 256]) { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 256); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(256, p); x.stroke(); }
  x.lineWidth = 9;
  for (const [a, b, cc, d] of [[0, 0, 256, 256], [256, 0, 0, 256], [0, 128, 128, 256], [128, 0, 256, 128], [0, 128, 128, 0], [128, 256, 256, 128]]) {
    x.beginPath(); x.moveTo(a, b); x.lineTo(cc, d); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 6);

  const mat = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.55, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: ENV });
  const shell = shadowed(new THREE.Mesh(geo, mat));
  shell.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: tex, alphaTest: 0.5 });
  g.add(shell);

  const solid = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.6, envMapIntensity: ENV });
  const foot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(prof(0.06), prof(0) + 0.04, 0.08, 48), solid));
  foot.position.y = 0.04; g.add(foot);

  // crown of spikes at the rim
  const n = 44;
  const spike = new THREE.InstancedMesh(new THREE.ConeGeometry(0.011, 0.16, 5), solid, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = prof(H) - 0.01;
    q.setFromEuler(new THREE.Euler(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5));
    m4.compose(new THREE.Vector3(Math.cos(a) * r, H + 0.06, Math.sin(a) * r), q, s.set(1, 0.7 + ((i * 37) % 10) / 15, 1));
    spike.setMatrixAt(i, m4);
  }
  spike.castShadow = true;
  g.add(spike);

  // transparent tubes wrapping the body
  const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xd9e6ff, roughness: 0.08, transparent: true, opacity: 0.5, clearcoat: 1, envMapIntensity: 1.2 });
  const helix = (turns, phase, off) => new THREE.CatmullRomCurve3(Array.from({ length: 90 }, (_, i) => {
    const t = i / 89, y = 0.1 + t * (H - 0.12), a = phase + t * turns * Math.PI * 2, r = prof(y) + off;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  }));
  for (const [tu, ph] of [[1.6, 0], [-1.2, 2.2]]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(helix(tu, ph, 0.05), 220, 0.02, 8), tubeMat);
    tube.castShadow = true; g.add(tube);
  }

  // the blue "shrimp" living inside
  const glow = new THREE.MeshStandardMaterial({ color: 0x2438f2, emissive: 0x2438f2, emissiveIntensity: 1.2 });
  const shrimp = [0.62, 0.86].map((y, i) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.11, 4, 10), glow);
    m.position.set(i ? 0.05 : -0.06, y, i ? -0.04 : 0.05); m.rotation.z = i ? 0.9 : -0.6;
    g.add(m); return m;
  });
  const light = new THREE.PointLight(0x3a55ff, 0.5, 1.8, 2);
  light.position.y = 0.75; g.add(light);

  return {
    object: g, height: H + 0.2,
    update(t, dt, hover) {
      glow.emissiveIntensity = 1.2 + hover * 2.6 + Math.sin(t * 2.4) * 0.25;
      light.intensity = 0.5 + hover * 1.4;
      shrimp[0].position.y = 0.62 + Math.sin(t * 1.3) * 0.03;
      shrimp[1].position.y = 0.86 + Math.sin(t * 1.1 + 1) * 0.03;
    },
  };
}

/* ── Book ────────────────────────────────────────────────── */
function book(o, ctx) {
  const g = new THREE.Group();
  const W = 0.92, L = 1.42, T = 0.17, C = 0.018;
  const coverColor = new THREE.Color(ctx.project.color || '#1F8A8A');
  const cloth = new THREE.MeshStandardMaterial({ color: coverColor, roughness: 0.85, envMapIntensity: ENV });
  const paper = new THREE.MeshStandardMaterial({ color: 0xeee6d3, roughness: 0.95, envMapIntensity: ENV });
  const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, envMapIntensity: ENV, map: o.texture ? ctx.tex(o.texture) : null });
  if (!front.map) front.color = coverColor;

  const tilt = new THREE.Group(); // leans the book like a lectern
  tilt.rotation.x = 0.36;
  tilt.position.set(0, Math.sin(0.36) * L / 2 + 0.01, 0);
  g.add(tilt);

  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, C, L), cloth));
  back.position.y = C / 2; tilt.add(back);
  const block = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, T - 2 * C, L - 0.04), paper));
  block.position.set(0.01, C + (T - 2 * C) / 2, 0); tilt.add(block);
  const spine = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, T, L), cloth));
  spine.position.set(-W / 2 + 0.015, T / 2, 0); tilt.add(spine);

  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, T - C / 2, 0); tilt.add(hinge);
  const cover = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, C, L), [cloth, cloth, front, paper, cloth, cloth]));
  cover.position.x = W / 2; hinge.add(cover);

  // little support behind
  const prop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, Math.sin(0.36) * L, 0.06), new THREE.MeshStandardMaterial({ color: 0xd7d4cc, roughness: 0.9 })));
  prop.position.set(0, Math.sin(0.36) * L / 2, -Math.cos(0.36) * L / 2 + 0.06); g.add(prop);

  return {
    object: g, height: Math.sin(0.36) * L + 0.25,
    update(t, dt, hover) { hinge.rotation.z = hover * 0.75; },
  };
}

/* Load one mesh from .stl, .glb or .gltf / .gltf.json and return its geometry. */
async function loadGeometry(url) {
  if (/\.stl$/i.test(url)) {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    return new STLLoader().loadAsync(url);
  }
  if (/\.mesh\.json$/i.test(url)) {
    const d = await (await fetch(url)).json();
    if (d.v === 2) { // simplified scan: quantised positions + indices, smooth-shaded
      const bin = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
      const q = new Uint16Array(bin(d.pos));
      const pos = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = d.min[k] + (q[i] / 65535) * (d.max[k] - d.min[k]); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(d.it === 'u16' ? new Uint16Array(bin(d.idx)) : new Uint32Array(bin(d.idx)), 1));
      if (d.col) geo.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(bin(d.col)), 3, true));
      geo.computeVertexNormals();
      return geo;
    }
    // v1: integer positions (1/100 mm) + triangle indices
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(d.p.map((v) => v / 100), 3));
    geo.setIndex(d.i);
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
    return geo;
  }
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  let geo = null;
  gltf.scene.traverse((n) => { if (!geo && n.isMesh) geo = n.geometry; });
  return geo;
}

/* ── Spiral book: A Day in Dongba, built from the real STL covers ── */
function spiralbook(o, ctx) {
  const MM = 139.7;                      // the printed covers are 139.7 mm square
  const BACK = 3.2, BLOCK = 10, FRONT = 2.4, TOTAL = BACK + BLOCK + FRONT;
  const g = new THREE.Group();
  const teal = new THREE.MeshStandardMaterial({ color: 0x38cbb8, roughness: 0.5, envMapIntensity: ENV });
  const tealBack = new THREE.MeshStandardMaterial({ color: 0x2db3a2, roughness: 0.6, envMapIntensity: ENV });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.95, envMapIntensity: ENV });
  const page = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.85, envMapIntensity: 0.4, toneMapped: false, map: o.page ? ctx.tex(o.page) : null });
  const coil = new THREE.MeshStandardMaterial({ color: 0xf2dc3a, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.9 });

  const lean = new THREE.Group();           // tilted like a book on a lectern
  lean.rotation.x = 0.3;
  lean.position.y = Math.sin(0.3) * 0.5 + 0.02;
  g.add(lean);
  const mm = new THREE.Group();             // everything inside is in millimetres
  mm.scale.setScalar(1 / MM);
  mm.position.set(-0.5, 0, 0.5);
  lean.add(mm);

  // page block: the printed cover illustration sits under the cut-out 3D-printed cover
  const block = new THREE.Mesh(new THREE.BoxGeometry(MM - 6, BLOCK, MM - 3), [paper, paper, page, paper, paper, paper]);
  block.position.set(MM / 2 + 3, BACK + BLOCK / 2, -MM / 2);
  block.castShadow = block.receiveShadow = true;
  mm.add(block);

  // yellow spiral: one half-loop through each of the 13 punched holes
  // each loop enters the hole (x = 8 mm) on top, wraps round the spine and comes out of the hole underneath
  const cy = TOTAL / 2, R = cy + 1.4, dx = Math.sqrt(R * R - cy * cy), start = Math.atan2(cy, dx);
  const loops = new THREE.InstancedMesh(new THREE.TorusGeometry(R, 0.9, 8, 36, Math.PI * 2 - start * 2), coil, 13);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, start)), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 13; i++) {
    m4.compose(new THREE.Vector3(8 - dx, cy, -(8.5 + i * (122.7 / 12))), q, one);
    loops.setMatrixAt(i, m4);
  }
  loops.castShadow = true;
  mm.add(loops);

  const hinge = new THREE.Group();
  hinge.position.set(8, BACK + BLOCK, 0);
  mm.add(hinge);

  // prop behind the book
  const prop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.45, Math.sin(0.3), 0.05), new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.8 })));
  prop.position.set(0, Math.sin(0.3) / 2, -Math.cos(0.3) * 0.5 + 0.06);
  g.add(prop);

  loadGeometry(o.cover).then(async (front) => {
    const back = await loadGeometry(o.back);
    back.rotateY(Math.PI); back.translate(MM, 0, BACK); back.rotateX(-Math.PI / 2);
    mm.add(shadowed(new THREE.Mesh(back, tealBack)));
    front.rotateX(-Math.PI / 2); front.translate(-8, 0, 0);
    hinge.add(shadowed(new THREE.Mesh(front, teal)));
    ctx.onLoad?.();
  }).catch((e) => console.warn('Could not load STL covers', e));

  return {
    object: g, height: Math.sin(0.3) + 0.12,
    update(t, dt, hover) { hinge.rotation.z = hover * 0.95; },
  };
}

/* ── Poster ──────────────────────────────────────────────── */
function poster(o, ctx) {
  const g = new THREE.Group();
  const W = 0.95; let Hh = W * 1.414;
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(ctx.project.color || '#F26B1D'), roughness: 0.7 });
  const mk = (file) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, envMapIntensity: 0.35, map: file ? ctx.tex(file, (tx) => fit(tx)) : null });
  const faceF = mk(o.texture), faceB = mk(o.backTexture || o.texture);
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.03), [edge, edge, edge, edge, faceF, faceB]));
  const sway = new THREE.Group(); sway.add(board); g.add(sway);
  function fit(tx) {
    const im = tx.image; if (!im?.width) return;
    Hh = W * (im.height / im.width);
    board.scale.set(W, Hh, 1); board.position.y = Hh / 2 + 0.03; api.height = Hh + 0.1;
  }
  board.scale.set(W, Hh, 1); board.position.y = Hh / 2 + 0.03;
  const clipMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5 });
  for (const sx of [-0.3, 0.3]) {
    const clip = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.12), clipMat));
    clip.position.set(sx, 0.035, 0); g.add(clip);
  }
  const api = {
    object: g, height: Hh + 0.1,
    update(t, dt, hover) { sway.rotation.z = Math.sin(t * 5) * 0.025 * hover; sway.rotation.x = -hover * 0.05; },
  };
  return api;
}

/* ── Ice ─────────────────────────────────────────────────── */
function ice() {
  const g = new THREE.Group();
  const blob = (r, k, seed) => {
    let geo = new THREE.IcosahedronGeometry(r, 18);
    geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const a = Math.atan2(v.z, v.x);
      let rr = r * (1 + k * (0.55 * Math.sin(v.x * 6 + seed) * Math.cos(v.z * 5 - seed) + 0.45 * Math.sin(a * 7 + v.y * 9 + seed)));
      if (v.y < 0) rr *= 1 + 0.25 * -v.y; // heavier at the base, like a frozen drip
      v.multiplyScalar(rr); v.y *= 1.75;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    geo.translate(0, r * 1.75 * 1.05, 0);
    return geo;
  };
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xe9f0ff, roughness: 0.1, transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4, depthWrite: false });
  const shell = new THREE.Mesh(blob(0.36, 0.12, 1.3), shellMat);
  shell.castShadow = true; shell.position.y = 0.1; shell.renderOrder = 2;
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x6d88ff, emissive: 0x2438f2, emissiveIntensity: 0.25, roughness: 0.25, envMapIntensity: 0.8 });
  const water = new THREE.Mesh(blob(0.19, 0.22, 4.1), waterMat);
  water.position.y = 0.18; water.scale.setScalar(1);

  const basinMat = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.55 });
  const basin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.12, 56), basinMat));
  basin.position.y = 0.06;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.45, envMapIntensity: ENV });
  const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 14, 72), rimMat));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.12;
  g.add(basin, rim, water, shell);

  return {
    object: g, height: 0.1 + 0.36 * 1.75 * 2.2,
    update(t, dt, hover) {
      water.rotation.y += dt * (0.5 + hover * 2.2);
      water.position.y = 0.18 + Math.sin(t * 1.7) * 0.02;
      waterMat.emissiveIntensity = 0.25 + hover * 0.9;
    },
  };
}

/* ── Tangram ─────────────────────────────────────────────── */
function tangram() {
  const g = new THREE.Group();
  const S = 1.16 / 4;
  const polys = [
    [[0, 0], [4, 0], [2, 2]], [[0, 0], [2, 2], [0, 4]], [[4, 4], [2, 4], [4, 2]],
    [[2, 2], [3, 3], [2, 4], [1, 3]], [[2, 2], [3, 1], [3, 3]],
    [[3, 1], [4, 0], [4, 2], [3, 3]], [[1, 3], [2, 4], [0, 4]],
  ];
  // bark, moss, porcelain, plaster, gold leaf, terracotta, slate
  const colors = [0x6b4a32, 0x5f7d35, 0xdfe6f4, 0xefede6, 0xc9a24a, 0xb5653a, 0x34465c];
  const rough = [0.95, 1, 0.25, 0.9, 0.35, 0.8, 0.6];
  const pieces = polys.map((poly, i) => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(((cx + (x - cx) * 0.93) - cx) * S, -(((cy + (y - cy) * 0.93) - cy) * S))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const m = shadowed(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i], roughness: rough[i], metalness: i === 4 ? 0.6 : 0, envMapIntensity: ENV })));
    m.position.set((cx - 2) * S, 0.035, (cy - 2) * S);
    m.userData.base = m.position.clone();
    g.add(m); return m;
  });
  // wooden frame
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9bb8c, roughness: 0.8 });
  const F = 1.3, bar = 0.07, hgt = 0.1;
  for (const [x, z, w, d] of [[0, -F / 2, F + bar, bar], [0, F / 2, F + bar, bar], [-F / 2, 0, bar, F], [F / 2, 0, bar, F]]) {
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wood)); b.position.set(x, hgt / 2, z); g.add(b);
  }
  const bed = shadowed(new THREE.Mesh(new THREE.BoxGeometry(F, 0.03, F), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.9 })));
  bed.position.y = 0.015; g.add(bed);

  return {
    object: g, height: 0.45,
    update(t, dt, hover) {
      pieces.forEach((m, i) => {
        const k = hover;
        m.position.y = m.userData.base.y + k * (0.1 + (i % 4) * 0.06) + k * Math.sin(t * 2 + i) * 0.015;
        m.rotation.y = k * (i % 2 ? 0.35 : -0.3) * (1 + (i % 3) * 0.3);
        m.position.x = m.userData.base.x * (1 + k * 0.18);
        m.position.z = m.userData.base.z * (1 + k * 0.18);
      });
    },
  };
}

/* ── Your own GLB / GLTF ─────────────────────────────────── */
function model(o) {
  const g = new THREE.Group();
  const api = { object: g, height: o.height || 1.2, update() {} };
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(o.model)).then((gltf) => {
    const m = gltf.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const k = (o.height || 1.2) / Math.max(size.y, 1e-6);
    m.scale.setScalar(k);
    box.setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -box.min.y, -c.z);
    m.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    g.add(m);
  }).catch((e) => console.warn('Could not load model', o.model, e));
  return api;
}

/* The Puhpowee box: lid outline extruded, lid artwork on top, hand-applied bark round the edge. */
async function buildLid(part, ctx) {
  const d = await (await fetch(part.outline)).json();           // { aspect: h / w, pts: [[x, y], …] in 0..1, y down }
  const w = part.w || 2, hgt = part.depth || 0.35, ah = w * d.aspect;
  const shape = new THREE.Shape(d.pts.map(([x, y]) => new THREE.Vector2((x - 0.5) * w, (0.5 - y) * ah)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  // planar UVs for the top face
  const P = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / w + 0.5, -P.getZ(i) / ah + 0.5);
  // bark: a quick procedural texture for the side wall
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#5a3a22'; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = ['#3a2414', '#7a5333', '#8d6a45', '#2c1a0e'][i % 4];
    x.lineWidth = 1 + (i * 7) % 4; x.globalAlpha = 0.6;
    const px = (i * 97) % 512, py = (i * 31) % 128;
    x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 12, py + 30, px - 8, py + 60, px + 6, py + 120); x.stroke();
  }
  const bark = new THREE.CanvasTexture(cv); bark.wrapS = bark.wrapT = THREE.RepeatWrapping; bark.repeat.set(6, 1); bark.colorSpace = THREE.SRGBColorSpace;
  const top = new THREE.MeshStandardMaterial({ map: ctx.tex(part.art), roughness: 0.7 });
  const side = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95, bumpMap: bark, bumpScale: 0.02 });
  const m = new THREE.Mesh(geo, [top, side]);
  m.castShadow = m.receiveShadow = true;
  m.position.set(part.at?.[0] || 0, 0, part.at?.[1] || 0);
  m.rotation.y = part.turn || 0;
  return m;
}

/* ── Your real models (.mesh.json from the STL files) ────────────────────
   o.parts : [{ src, look }]  look = 'pearl' | 'ice' | 'core' | 'sponge' | 'holo' | 'resin'
   o.height: target height (or o.size: target largest dimension)
   o.zUp   : true when the file was modelled Z-up (most CAD / slicer exports)
   o.lights: 'sponge' adds blue LEDs inside;  o.glow: true lets setDark() switch on the glow-in-the-dark look */
function mesh(o, ctx) {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  g.add(holder);
  const api = { object: g, height: o.height || 1.2, ready: false, update() {}, setDark() {} };
  const anim = [];
  let dark = 0, darkTarget = 0;

  // MeshStandardMaterial throughout: much cheaper to draw than the physical material
  const looks = {
    pearl: () => new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.22, envMapIntensity: 1.0 }),
    frost: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, envMapIntensity: 1.25, vertexColors: true, vertexAlphas: true, transparent: true, side: THREE.DoubleSide }),
    flowcore: () => new THREE.MeshStandardMaterial({ color: 0x9ccbef, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.2, vertexColors: true }),
    sponge: () => new THREE.MeshStandardMaterial({ color: 0xf3f5fa, roughness: 0.26, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    ice: () => new THREE.MeshStandardMaterial({ color: 0xeef3ff, roughness: 0.12, transparent: true, opacity: 0.6, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
    core: () => new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.2, emissive: 0x3d5cff, emissiveIntensity: 0.05, envMapIntensity: 1.1 }),
    holo: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, envMapIntensity: 0.55 }),
    resin: () => new THREE.MeshStandardMaterial({ color: 0x3f7fe8, roughness: 0.22, envMapIntensity: 0.8 }),
    painted: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, envMapIntensity: 0.85 }),
    nutrient: () => new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.35, envMapIntensity: 0.7 }),
    water: () => new THREE.MeshStandardMaterial({ color: 0x5aa6ff, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 1.4, depthWrite: false }),
  };

  // pastel holographic colouring, after the castle's cyan / butter-yellow / periwinkle prints
  function paintHolo(geo) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    const pal = ['#43dbe9', '#efe58a', '#8fb0f6', '#8ff0d0', '#5fd0ff'].map((h) => new THREE.Color(h));
    const tmp = new THREE.Color();
    geo.computeBoundingBox();
    const bb = geo.boundingBox, sz = new THREE.Vector3(); bb.getSize(sz);
    for (let i = 0; i < p.count; i++) {
      const x = (p.getX(i) - bb.min.x) / sz.x, y = (p.getY(i) - bb.min.y) / sz.y, z = (p.getZ(i) - bb.min.z) / sz.z;
      const n = 0.5 + 0.5 * Math.sin(x * 11 + Math.sin(z * 7) * 2) * Math.cos(y * 9 - x * 4) ;
      const k = (n * 3.2 + z * 1.4 + y * 0.6) % pal.length;
      const a = Math.floor(k), f = k - a;
      tmp.copy(pal[a % pal.length]).lerp(pal[(a + 1) % pal.length], f * f * (3 - 2 * f));
      c.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  // glow-in-the-dark speckles: an additive overlay that only shows when the lights go off
  const glowLayers = [];
  function addGlow(geo, m) {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', geo.attributes.position);
    g2.setAttribute('normal', geo.attributes.normal);
    g2.setIndex(geo.index);
    const n = geo.attributes.position.count, c = new Float32Array(n * 3);
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const v = rnd();
      const k = v > 0.95 ? 1 : v > 0.86 ? 0.4 : 0.02;
      c.set([0.25 * k, 0.95 * k, 1.0 * k], i * 3);
    }
    g2.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ov = new THREE.Mesh(g2, mat);
    ov.renderOrder = 3;
    m.add(ov);
    glowLayers.push({ mat, base: m.material });
  }

  const extra = o.storms ? fetch(o.storms).then((r) => r.json()) : Promise.resolve(null);
  Promise.all([extra, ...o.parts.map((part) => (part.lid ? buildLid(part, ctx) : loadGeometry(part.src)).then((geo) => ({ part, geo })))]).then(([stormData, ...loaded]) => {
    const box = new THREE.Box3();
    const placed = loaded.some(({ part }) => part.at);   // a little scene of separate objects
    loaded.forEach(({ part, geo }) => {
      if (part.lid) { holder.add(geo); return; }
      if (o.zUp !== false) geo.rotateX(-Math.PI / 2);
      if (part.look === 'holo') paintHolo(geo);
      const mat = (looks[part.look] || looks.pearl)();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = part.look !== 'water';
      m.receiveShadow = part.look !== 'ice' && part.look !== 'water';
      if (part.look === 'ice' || part.look === 'water') m.renderOrder = 2;
      if (part.look === 'core') anim.push((t, dt, hover) => { mat.emissiveIntensity = 0.05 + hover * 0.3 + Math.sin(t * 1.6) * 0.03; });
      geo.computeBoundingBox();
      if (placed) {
        // each part: own scale (part.scale, or part.h = height), feet on the floor at part.at = [x, z]
        const bb = geo.boundingBox, sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
        const k = part.scale || (part.h || 1) / sz.y;
        m.scale.setScalar(k);
        m.rotation.y = part.turn || 0;
        const off = new THREE.Vector3(-c.x * k, -bb.min.y * k, -c.z * k).applyAxisAngle(new THREE.Vector3(0, 1, 0), m.rotation.y);
        m.position.set((part.at?.[0] || 0) + off.x, off.y, (part.at?.[1] || 0) + off.z);
        holder.add(m);
        box.expandByObject(m);
      } else {
        holder.add(m);
        box.union(geo.boundingBox);
      }
      if (part.look === 'resin' && o.glow) addGlow(geo, m);
      if (part.thaw) setupThaw(m);
      if (part.flow) setupCoreFlow(m);
      if (part.basin) setupBasinWater(m);
    });
    if (placed) {
      loaded.forEach(({ part, geo }) => { if (part.lid) box.expandByObject(geo); });
      api.height = box.max.y;
      api.ready = true; ctx.onLoad?.();
      return;
    }
    // scale to target size, centre on the footprint, sit on y = 0
    const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = o.size ? o.size / Math.max(size.x, size.y, size.z) : (o.height || 1.2) / size.y;
    holder.scale.setScalar(k);
    holder.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
    api.height = size.y * k;

    if (o.lights === 'sponge') {
      // blue LED patches glowing through the lattice, like the installation photos (no real lights: cheap)
      const geo = loaded[0].geo, P = geo.attributes.position;
      const cell = size.y * 0.06, c = new Float32Array(P.count * 3);
      const hash = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i) / cell, y = P.getY(i) / cell, z = P.getZ(i) / cell;
        const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
        const hv = hash(cx, cy, cz);
        const d = Math.hypot(x - cx - 0.5, y - cy - 0.5, z - cz - 0.5);
        const low = 1 - Math.min(1, Math.max(0, (P.getY(i) - box.min.y) / size.y - 0.15)); // more light low down
        const kk = hv > 0.62 ? Math.max(0, 1 - d * 1.5) * (0.6 + 0.6 * low) : 0;
        c.set([0.1 * kk, 0.28 * kk, 1.0 * kk], i * 3);
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', P); g2.setIndex(geo.index); g2.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const spotMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const spots = new THREE.Mesh(g2, spotMat); spots.renderOrder = 3;
      holder.children[0].add(spots);
      anim.push((t, dt, hover) => { if (!api.flows?.on?.organism) spotMat.opacity = 0.85 + hover * 0.15 + Math.sin(t * 1.7) * 0.1; });
      // clear tubing spiralling round the trunk: follow the trunk's centre line, slice by slice
      const axis = [], curves = [];
      for (let f = 0.35; f <= 0.97; f += 0.06) {
        const y0 = box.min.y + size.y * f, band = size.y * 0.03;
        let sx = 0, sz = 0, cnt = 0, rr = 0;
        for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (Math.abs(y - y0) < band) { sx += P.getX(i); sz += P.getZ(i); cnt++; } }
        if (!cnt) continue;
        sx /= cnt; sz /= cnt;
        for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (Math.abs(y - y0) < band) rr = Math.max(rr, Math.hypot(P.getX(i) - sx, P.getZ(i) - sz) * 0.75); }
        axis.push([sx, y0, sz, rr]);
      }
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0xe6eeff, roughness: 0.05, transparent: true, opacity: 0.38, envMapIntensity: 1.6, depthWrite: false });
      if (axis.length > 3) {
        [[1.4, 0], [-1.1, 2.4]].forEach(([turns, ph]) => {
          const pts = [];
          for (let j = 0; j <= 60; j++) {
            const u = j / 60, a = axis[Math.min(axis.length - 1, Math.floor(u * (axis.length - 1)))], b2 = axis[Math.min(axis.length - 1, Math.ceil(u * (axis.length - 1)))];
            const f = u * (axis.length - 1) % 1, x = a[0] + (b2[0] - a[0]) * f, y = a[1] + (b2[1] - a[1]) * f, z = a[2] + (b2[2] - a[2]) * f, r = (a[3] + (b2[3] - a[3]) * f) * 1.05;
            const ang = ph + u * turns * Math.PI * 2;
            pts.push(new THREE.Vector3(x + Math.cos(ang) * r, y, z + Math.sin(ang) * r));
          }
          const curve = new THREE.CatmullRomCurve3(pts);
          curves.push(curve);
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, size.y * 0.012, 8), tubeMat);
          tube.renderOrder = 2;
          holder.add(tube);
        });
      }
      if (o.flows) setupFlows({ axis, box, size, spotMat, tubeMat, curves });
    }
    if (stormData) setupStorms(stormData, holder.children.find((c) => c.isMesh));
    api.ready = true;
    ctx.onLoad?.();
  }).catch((e) => console.warn('Could not load model', o.parts, e));

  /* Frozen Flow: the shell is frosted ice; the pointer thaws it, and it freezes over again.
     Under it, light keeps running up and down the core: the water that never stopped. */
  function setupThaw(m) {
    const geo = m.geometry, P = geo.attributes.position, n = P.count;
    const c = new Float32Array(n * 4), heat = new Float32Array(n);
    const ice = new THREE.Color(0xdde9f7);
    for (let i = 0; i < n; i++) c.set([ice.r, ice.g, ice.b, 0.74], i * 4);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 4));
    m.renderOrder = 2; m.castShadow = true;
    geo.computeBoundingBox();
    const R = geo.boundingBox.getSize(new THREE.Vector3()).length() * 0.17;
    let warm = 0;
    const local = new THREE.Vector3();
    api.thaw = (hit) => {
      local.copy(hit); m.worldToLocal(local);
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(P.getX(i) - local.x, P.getY(i) - local.y, P.getZ(i) - local.z);
        if (d < R) heat[i] = Math.min(1, heat[i] + (1 - d / R) * 0.7);
      }
      warm = 1;
    };
    api.thawMesh = m;
    anim.push((t, dt) => {
      if (!warm) return;
      let any = 0;
      const k = Math.min(1, dt * 0.22);          // slow refreeze
      for (let i = 0; i < n; i++) {
        if (heat[i] <= 0) continue;
        heat[i] = Math.max(0, heat[i] - k * (0.4 + heat[i] * 0.6));
        any = 1;
        c[i * 4 + 3] = 0.74 - heat[i] * 0.7;
      }
      geo.attributes.color.needsUpdate = true;
      if (!any) warm = 0;
    });
  }
  function setupCoreFlow(m) {
    const geo = m.geometry, P = geo.attributes.position, n = P.count, N = geo.attributes.normal;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h0 = bb.min.y, hs = bb.max.y - bb.min.y;
    const c = new Float32Array(n * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const ph = new Float32Array(n), yy = new Float32Array(n);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    for (let i = 0; i < n; i++) { ph[i] = Math.atan2(P.getZ(i) - cz, P.getX(i) - cx); yy[i] = (P.getY(i) - h0) / hs; }
    // thin bright sheets sliding down the wet surface (glints, not stripes)
    let acc = 0;
    anim.push((t, dt) => {
      acc += dt; if (acc < 1 / 30) return; acc = 0;
      for (let i = 0; i < n; i++) {
        const u = yy[i] * 9 + t * 1.1 + Math.sin(ph[i] * 3 + yy[i] * 4) * 0.6;
        const f = u - Math.floor(u);
        const glint = Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 6), 3);
        const k = 0.85 + 0.08 * Math.sin(ph[i] * 5 + t * 2);
        c[i * 3] = k + glint * 0.5; c[i * 3 + 1] = k + glint * 0.4; c[i * 3 + 2] = k + glint * 0.3;
      }
      geo.attributes.color.needsUpdate = true;
    });
    // rivulets: drops that run down the core along the steepest way, following its real surface
    const I = geo.index.array, nb = Array.from({ length: n }, () => []);
    for (let f = 0; f < I.length; f += 3) { const a = I[f], b2 = I[f + 1], d = I[f + 2]; nb[a].push(b2, d); nb[b2].push(a, d); nb[d].push(a, b2); }
    const paths = [];
    let sd = 3; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < 90 && paths.length < 45; r++) {
      let v = Math.floor(rnd() * n); if (yy[v] < 0.45) continue;
      const pts = [];
      for (let s2 = 0; s2 < 600; s2++) {
        const off = 0.012 * hs;
        pts.push(new THREE.Vector3(P.getX(v) + N.getX(v) * off, P.getY(v) + N.getY(v) * off, P.getZ(v) + N.getZ(v) * off));
        let best = -1, by = P.getY(v);
        for (const w of nb[v]) { const y2 = P.getY(w); if (y2 < by) { by = y2; best = w; } }
        if (best < 0) break; v = best;
      }
      if (pts.length > 12) paths.push({ pts, len: pts.length });
    }
    const PER = 7, cnt = paths.length * PER, dp = new Float32Array(cnt * 3), g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    g2.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, h0 + hs / 2, cz), hs);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    { const x = cv.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(170,215,255,.8)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 32, 32); }
    const dm = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: hs * 0.035, transparent: true, depthWrite: false, opacity: 0.95 });
    const drops = new THREE.Points(g2, dm); drops.renderOrder = 1; m.add(drops);
    const ph2 = Array.from({ length: cnt }, () => rnd());
    const ws = new THREE.Vector3();
    anim.push((t, dt) => {
      dm.size = hs * 0.045 * m.getWorldScale(ws).x;
      paths.forEach((p, pi) => {
        for (let k = 0; k < PER; k++) {
          const j = pi * PER + k;
          const u = (ph2[j] + t * 0.18 * (0.8 + (j % 5) * 0.08)) % 1, f = u * (p.len - 1), a = Math.floor(f), e = f - a;
          const A = p.pts[a], B = p.pts[Math.min(p.len - 1, a + 1)];
          dp[j * 3] = A.x + (B.x - A.x) * e; dp[j * 3 + 1] = A.y + (B.y - A.y) * e; dp[j * 3 + 2] = A.z + (B.z - A.z) * e;
        }
      });
      g2.attributes.position.needsUpdate = true;
    });
  }

  /* Frozen Flow: water standing in the basin, rippling out from the core */
  function setupBasinWater(m) {
    const P = m.geometry.attributes.position, n = P.count;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const level = bb.min.y + (bb.max.y - bb.min.y) * 0.8, band = (bb.max.y - bb.min.y) * 0.04;
    const SEG = 96, RINGS = 14, inner = new Float32Array(SEG).fill(Infinity);
    for (let i = 0; i < n; i++) {
      if (Math.abs(P.getY(i) - level) > band) continue;
      const dx = P.getX(i) - cx, dz = P.getZ(i) - cz, a = Math.atan2(dz, dx), k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * SEG) % SEG;
      inner[k] = Math.min(inner[k], Math.hypot(dx, dz));
    }
    // fill any empty bins from neighbours, then smooth a little
    for (let pass = 0; pass < SEG; pass++) for (let k = 0; k < SEG; k++) if (!isFinite(inner[k])) inner[k] = inner[(k + 1) % SEG];
    const rad = inner.map((_, k) => (inner[(k + SEG - 1) % SEG] + inner[k] * 2 + inner[(k + 1) % SEG]) / 4 * 0.985);
    const pos = new Float32Array((1 + SEG * RINGS) * 3), idx = [];
    const vid = (r, k) => 1 + (r - 1) * SEG + (k % SEG);
    pos.set([cx, level, cz], 0);
    for (let r = 1; r <= RINGS; r++) for (let k = 0; k < SEG; k++) {
      const a = (k + 0.5) / SEG * Math.PI * 2 - Math.PI, f = r / RINGS;
      pos.set([cx + Math.cos(a) * rad[k] * f, level, cz + Math.sin(a) * rad[k] * f], vid(r, k) * 3);
    }
    for (let k = 0; k < SEG; k++) idx.push(0, vid(1, k + 1), vid(1, k));
    for (let r = 1; r < RINGS; r++) for (let k = 0; k < SEG; k++) {
      const a = vid(r, k), b = vid(r, k + 1), c2 = vid(r + 1, k), d = vid(r + 1, k + 1);
      idx.push(a, b, c2, b, d, c2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fbde9, roughness: 0.06, envMapIntensity: 1.1, transparent: true, opacity: 0.9, depthWrite: false });
    const water = new THREE.Mesh(g, mat); water.renderOrder = 1; water.receiveShadow = true; m.add(water);
    const amp = (bb.max.y - bb.min.y) * 0.008, R0 = Math.max(...rad);
    let acc = 0;
    anim.push((t, dt) => {
      acc += dt; if (acc < 1 / 30) return; acc = 0;
      for (let v = 1; v < pos.length / 3; v++) {
        const x = pos[v * 3] - cx, z = pos[v * 3 + 2] - cz, d = Math.hypot(x, z) / R0;
        pos[v * 3 + 1] = level + Math.sin(d * 26 - t * 3.2) * amp * (0.4 + d) + Math.sin(x * 3 + t * 1.3) * amp * 0.3;
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    });
  }

  /* Euplectella: the four touch sensors of the installation, as buttons.
     water runs up through the tubes and out through the lattice · nutrients drift in and stay ·
     particles are caught on the outside · organism: the shrimp lights pulse */
  function setupFlows({ axis, box, size, spotMat, tubeMat, curves }) {
    const on = { water: false, nutrients: false, particles: false, organism: false };
    const rnd = (() => { let sd = 7; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();
    const at = (u) => { // centre line + radius at height fraction u (0 = bottom of the trunk, 1 = top)
      const f = Math.max(0, Math.min(1, u)) * (axis.length - 1), a = axis[Math.floor(f)], b = axis[Math.ceil(f)], k = f % 1;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    };
    const layer = (count, color, sz) => {
      const pos = new Float32Array(count * 3), g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color, size: sz, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.NormalBlending });
      const pts = new THREE.Points(g, mat); pts.renderOrder = 5; pts.frustumCulled = false; holder.add(pts);
      return { pos, g, mat, fade: 0 };
    };
    // water: bright drops riding up the two tubes, then spilling out through the lattice
    const W = layer(260, 0x1f74ff, 0.05), wp = Array.from({ length: 260 }, () => ({ c: Math.floor(rnd() * Math.max(1, curves.length)), u: rnd(), out: rnd() < 0.45, a: rnd() * Math.PI * 2 }));
    // nutrients: yellow specks drift in from outside and settle against the inner wall
    const N = layer(140, 0xeaa000, 0.055), np = Array.from({ length: 140 }, () => ({ u: 0.1 + rnd() * 0.85, a: rnd() * Math.PI * 2, r: 2.2 + rnd(), stop: 0.55 + rnd() * 0.3, sp: 0.3 + rnd() * 0.4 }));
    // particles: grey grit carried in, stopped at the lattice and left outside
    const P = layer(160, 0x5a5a5a, 0.04), pp = Array.from({ length: 160 }, () => ({ u: 0.05 + rnd() * 0.9, a: rnd() * Math.PI * 2, r: 2.4 + rnd() * 1.2, stop: 1.45 + rnd() * 0.18, sp: 0.35 + rnd() * 0.4 }));
    // organism: the shrimp LEDs, as blue lights sitting in the lattice
    const L = layer(1, 0x2b45ff, 0.075);
    {
      let spots = null; holder.traverse((c) => { if (c.material === spotMat) spots = c; });
      const sc = spots?.geometry.attributes.color, sp = spots?.geometry.attributes.position, pick = [];
      if (sc) for (let i = 0; i < sc.count; i += 3) if (sc.getZ(i) > 0.45) pick.push(i);
      const keep = pick.filter((_, k) => k % Math.max(1, Math.floor(pick.length / 45)) === 0);
      const pos = new Float32Array(keep.length * 3);
      keep.forEach((i, k) => pos.set([sp.getX(i), sp.getY(i), sp.getZ(i)], k * 3));
      L.g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      // soft round glow, seen through the lattice like the real LEDs
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g2d = cv.getContext('2d'), gr = g2d.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(70,95,255,1)'); gr.addColorStop(0.35, 'rgba(43,69,255,.75)'); gr.addColorStop(1, 'rgba(43,69,255,0)');
      g2d.fillStyle = gr; g2d.fillRect(0, 0, 64, 64);
      Object.assign(L.mat, { map: new THREE.CanvasTexture(cv), size: 0.3, depthTest: false, color: new THREE.Color(0xffffff) });
      L.mat.needsUpdate = true;
    }
    const tubeBase = tubeMat.color.clone(), tubeWet = new THREE.Color(0x6fb8ff);
    const radial = (arr, L, dt, reset) => {
      arr.forEach((q, i) => {
        q.r = Math.max(q.stop, q.r - q.sp * dt);
        if (q.r === q.stop) { q.hold = (q.hold || 0) + dt; if (q.hold > reset) { q.r = 2.2 + rnd(); q.hold = 0; q.a = rnd() * Math.PI * 2; } }
        const [x, y, z, r] = at(q.u);
        L.pos.set([x + Math.cos(q.a) * r * q.r, y, z + Math.sin(q.a) * r * q.r], i * 3);
      });
      L.g.attributes.position.needsUpdate = true;
    };
    anim.push((t, dt) => {
      dt = Math.min(dt, 0.05);
      [[W, on.water], [N, on.nutrients], [P, on.particles]].forEach(([L, v]) => { L.fade += ((v ? 1 : 0) - L.fade) * Math.min(1, dt * 3); L.mat.opacity = L.fade * (L === P ? 0.85 : 1); });
      tubeMat.color.copy(tubeBase).lerp(tubeWet, W.fade); tubeMat.opacity = 0.38 + W.fade * 0.25;
      if (W.fade > 0.01 && curves.length) {
        wp.forEach((q, i) => {
          q.u += dt * 0.12; if (q.u > 1) { q.u = 0; q.out = rnd() < 0.45; q.a = rnd() * Math.PI * 2; }
          const p = curves[q.c % curves.length].getPointAt(Math.min(1, q.u));
          if (q.out && q.u > 0.5) { // seeping out through the walls
            const [x, , z, r] = at(0.35 + q.u * 0.6), k = (q.u - 0.5) * 2;
            p.x += (Math.cos(q.a) * r * 1.6 - (p.x - x)) * k; p.z += (Math.sin(q.a) * r * 1.6 - (p.z - z)) * k;
          }
          W.pos.set([p.x, p.y, p.z], i * 3);
        });
        W.g.attributes.position.needsUpdate = true;
      }
      if (N.fade > 0.01) radial(np, N, dt, 6);
      if (P.fade > 0.01) radial(pp, P, dt, 3);
      L.fade += ((on.organism ? 1 : 0) - L.fade) * Math.min(1, dt * 3);
      L.mat.opacity = L.fade * (0.45 + 0.5 * Math.max(0, Math.sin(t * 4)));
      if (on.organism) spotMat.opacity = 1.1 + Math.max(0, Math.sin(t * 5)) * 1.4;
    });
    api.flows = { on, modes: ['water', 'nutrients', 'particles', 'organism'], toggle(k) { on[k] = !on[k]; return on[k]; } };
  }

  /* Hurricanes: replay 1992–2024. Each storm on the landfall print is tagged (vertex → storm);
     storms still to come sit pale, the ones that have arrived take the resin blue, this year's glow. */
  function setupStorms(data, m) {
    const geo = m.geometry, n = geo.attributes.position.count;
    const lab = Uint8Array.from(atob(data.labels), (c) => c.charCodeAt(0));
    const wt = data.weights ? Uint8Array.from(atob(data.weights), (c) => c.charCodeAt(0)) : null;   // soft edge: 0–255
    const ids = data.names.map((nm) => ctx.storms.findIndex((s) => s.name === nm));
    const yearOf = ids.map((i) => ctx.storms[i]?.year ?? 0);
    const resin = new THREE.Color(0x3f7fe8), ghost = new THREE.Color(0xe3e9f2);
    const gr = ghost.r / resin.r, gg = ghost.g / resin.g, gb = ghost.b / resin.b;   // vertex colour multiplies the resin colour
    const col = new Float32Array(n * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.material.vertexColors = true; m.material.needsUpdate = true;
    // glow overlay for the storms of the current year
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', geo.attributes.position); g2.setAttribute('normal', geo.attributes.normal); g2.setIndex(geo.index);
    const gcol = new Float32Array(n * 3);
    g2.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
    const gmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ov = new THREE.Mesh(g2, gmat); ov.renderOrder = 3; m.add(ov);
    // a ring on the sea where each storm made landfall
    const rings = data.centers.map(([x, y, z]) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(data.r * 0.92, data.r, 64),
        new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      r.rotation.x = -Math.PI / 2; r.position.set(x, z + 0.03, -y); r.renderOrder = 4;
      r.visible = false;   // no rings on the sea: they marked spots where the print has nothing
      holder.add(r); return r;
    });
    /* wind and rain over each storm: a small swirl of cloud, its spin read from her description of the storm */
    const PER = 60, nS = data.centers.length;
    const wPos = new Float32Array(nS * PER * 3), wAlpha = new Float32Array(nS * PER);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 64;
    { const c2 = cvs.getContext('2d'), gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.45, 'rgba(214,228,246,.5)'); gr.addColorStop(1, 'rgba(200,215,240,0)');
      c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64); }
    const wMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cvs), size: 0.05, transparent: true, opacity: 0, depthWrite: false, color: 0xeaf4ff });
    { const [x, y, z] = data.centers[0], c0 = new THREE.Vector3(x, z, -y);   // keep the clouds out of the camera framing
      wg.boundingBox = new THREE.Box3(c0.clone(), c0.clone()); wg.boundingSphere = new THREE.Sphere(c0.clone(), 0.001); }
    const wPts = new THREE.Points(wg, wMat); wPts.frustumCulled = false; wPts.renderOrder = 6; m.add(wPts);
    const feel = (trait = '') => {
      const t = trait.toLowerCase();
      if (/stationary|stagnant/.test(t)) return { spin: 0.35, spread: 1.0, tight: 0.5 };
      if (/compact|concentrated|extreme|rapid|powerful|sudden/.test(t)) return { spin: 2.4, spread: 0.7, tight: 0.85 };
      if (/wide|broad|loose|weak|long-lived/.test(t)) return { spin: 0.8, spread: 1.5, tight: 0.25 };
      if (/symmetr|balanced|concentric|stable/.test(t)) return { spin: 1.4, spread: 1.0, tight: 0.7 };
      if (/zigzag|fluctuating|irregular|asymmetric|hybrid|mixed/.test(t)) return { spin: 1.6, spread: 1.15, tight: 0.35, wobble: 1 };
      return { spin: 1.2, spread: 1.1, tight: 0.5 };
    };
    let rW = 0;
    // storms with no raised shape on the print (Dorian, Maria) get no cloud either
    const mass = new Float32Array(data.centers.length);
    for (let v = 0; v < lab.length; v++) if (lab[v] !== 255) mass[lab[v]] += wt ? wt[v] / 255 : 1;
    const swirl = data.centers.map((c, i) => {
      const f = feel(ctx.storms[ids[i]]?.trait);
      return { ...f, p: Array.from({ length: PER }, (_, k) => ({ a: Math.random() * Math.PI * 2, rr: Math.pow(Math.random(), f.tight + 0.3), h: Math.random(), sp: 0.7 + Math.random() * 0.6 })) };
    });
    const shown = new Float32Array(ids.length), want = new Float32Array(ids.length);  // 0 future · 1 arrived · 2 this year
    let dirty = true;
    /* point at a storm: it lights up; click it: a copy lifts off the map and turns, the spot it left goes pale */
    let hoverI = -1, selI = -1, lift = 0, liftT = 0, spin = 0, hov = new Float32Array(ids.length);
    const pivot = new THREE.Group(); m.add(pivot);
    let float = null;
    const sub = (i) => {
      const I = geo.index.array, out = [];
      for (let f = 0; f < I.length; f += 3) if (lab[I[f]] === i && lab[I[f + 1]] === i && lab[I[f + 2]] === i) out.push(I[f], I[f + 1], I[f + 2]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
      g.setIndex(out);
      return g;
    };
    const floatMat = new THREE.MeshStandardMaterial({ color: 0x3f7fe8, roughness: 0.2, envMapIntensity: 0.9, emissive: 0x2a6bff, emissiveIntensity: 0.15 });
    api.stormMesh = m;
    api.stormAt = (hit) => { const v = hit.face ? lab[hit.face.a] : 255; return v === 255 ? -1 : v; };
    api.stormInfo = (i) => { const st = ctx.storms[ids[i]]; return st ? { ...st, index: ids[i] } : null; };
    api.hoverStorm = (i) => { hoverI = i; };
    api.selectStorm = (i) => {
      if (float) { pivot.remove(float); float.geometry.dispose(); float = null; }
      selI = i; liftT = i < 0 ? 0 : 1; lift = 0; spin = 0; dirty = true;
      if (i < 0) return;
      const [x, y, z] = data.centers[i];
      pivot.position.set(x, z, -y);
      float = new THREE.Mesh(sub(i), floatMat); float.position.set(-x, -z, y); float.castShadow = true;
      pivot.add(float);
    };
    // the world position just above a storm, for the name tag
    api.stormWorld = (i, v) => { const [x, y, z] = data.centers[i]; v.set(x, z, -y); return m.localToWorld(v); };
    api.stormRadiusWorld = () => { const a = m.localToWorld(new THREE.Vector3(0, 0, 0)), b = m.localToWorld(new THREE.Vector3(data.r, 0, 0)); return a.distanceTo(b); };
    api.stormTop = (i, v) => { const [x, y, z] = data.centers[i]; v.set(x, z + data.r * 2.2, -y); return m.localToWorld(v); };
    api.timeline = {
      years: [...new Set(yearOf)].sort((a, b) => a - b), count: data.names.length,
      indicesOf: (y) => yearOf.map((yy, i) => (yy === y ? i : -1)).filter((i) => i >= 0),
      setYear(y) {
        yearOf.forEach((yy, i) => { want[i] = yy > y ? 0 : yy === y ? 2 : 1; });
        dirty = true;
        return data.names.filter((_, i) => yearOf[i] === y);
      },
    };
    api.timeline.setYear(9999);
    anim.push((t, dt) => {
      let moved = dirty;
      for (let i = 0; i < shown.length; i++) {
        const d = want[i] - shown[i];
        if (Math.abs(d) > 0.002) { shown[i] += d * Math.min(1, dt * 4); moved = true; } else shown[i] = want[i];
      }
      // hover glow + the lifted copy
      for (let i = 0; i < hov.length; i++) {
        const w = i === hoverI && i !== selI ? 1 : 0;
        if (Math.abs(hov[i] - w) > 0.01) { hov[i] += (w - hov[i]) * Math.min(1, dt * 8); moved = true; } else if (hov[i] !== w) { hov[i] = w; moved = true; }
      }
      if (float) {
        lift += (liftT - lift) * Math.min(1, dt * 3);
        spin += dt * 0.9;
        pivot.position.y = data.centers[selI][2] + lift * data.r * 2.6;
        pivot.rotation.y = spin; pivot.scale.setScalar(1 + lift * 0.25);
        floatMat.emissiveIntensity = 0.12 + 0.1 * Math.sin(t * 3);
      }
      // cloud swirls: drawn for every storm that has arrived, brighter for this year's
      let anyCloud = 0;
      for (let i = 0; i < nS; i++) {
        const [cx, cy, cz] = data.centers[i], S = swirl[i], vis = mass[i] < 10 ? 0 : Math.min(1, shown[i]);
        for (let k = 0; k < PER; k++) {
          const q = S.p[k];
          q.a += dt * S.spin * q.sp * (1.6 - q.rr);
          const wob = S.wobble ? Math.sin(t * 1.3 + i) * data.r * 0.25 : 0;
          const rad = data.r * S.spread * (0.25 + q.rr * 0.9) * (vis > 0 ? 1 : 0.0001);
          const j = (i * PER + k) * 3;
          wPos[j] = cx + Math.cos(q.a) * rad + wob;
          wPos[j + 1] = cz + data.r * (0.35 + q.h * 1.3 + (1 - q.rr) * 0.6);
          wPos[j + 2] = -cy + Math.sin(q.a) * rad;
          if (vis < 0.05) wPos[j + 1] = -999;  // not yet: out of sight
        }
        anyCloud = Math.max(anyCloud, vis);
      }
      wg.attributes.position.needsUpdate = true;
      wMat.opacity = 0.9 * anyCloud;
      wMat.size = (rW ||= api.stormRadiusWorld()) * 0.75;
      const pulse = 0.75 + 0.25 * Math.sin(t * 4);
      rings.forEach((r, i) => { const now = Math.max(0, shown[i] - 1); r.material.opacity = now * pulse + Math.min(1, shown[i]) * 0.12; r.scale.setScalar(1 + now * 0.08 * Math.sin(t * 4)); });
      gmat.opacity = 0.55 + 0.35 * pulse;
      if (!moved) return;
      dirty = false;
      for (let v = 0; v < n; v++) {
        const s = lab[v];
        if (s === 255) continue;
        const w = wt ? wt[v] / 255 : 1;
        const a0 = s === selI ? 0.15 : Math.min(1, shown[s]), a = 1 - (1 - a0) * w;
        const hi = Math.max(Math.max(0, shown[s] - 1), hov[s] * 0.9) * w;
        col[v * 3] = gr + (1 - gr) * a; col[v * 3 + 1] = gg + (1 - gg) * a; col[v * 3 + 2] = gb + (1 - gb) * a;
        gcol[v * 3] = 0.15 * hi; gcol[v * 3 + 1] = 0.55 * hi; gcol[v * 3 + 2] = 0.9 * hi;
      }
      geo.attributes.color.needsUpdate = true; g2.attributes.color.needsUpdate = true;
    });
  }

  if (o.glow) {
    api.setDark = (on) => { darkTarget = on ? 1 : 0; };
  }
  api.update = (t, dt, hover) => {
    anim.forEach((f) => f(t, dt, hover));
    if (glowLayers.length && Math.abs(dark - darkTarget) > 0.001) {
      dark += (darkTarget - dark) * Math.min(1, dt * 2.5);
      const lit = new THREE.Color(0x3f7fe8), off = new THREE.Color(0x0a1630);
      glowLayers.forEach(({ mat, base }) => {
        mat.opacity = dark * (0.85 + 0.15 * Math.sin(t * 3));
        base.color.copy(lit).lerp(off, dark);
        base.clearcoat = 0.9 * (1 - dark);
        base.envMapIntensity = 0.7 * (1 - dark * 0.95);
      });
    } else if (glowLayers.length && dark > 0.5) {
      glowLayers.forEach(({ mat }) => { mat.opacity = 0.85 + 0.15 * Math.sin(t * 3); });
    }
  };
  return api;
}
