/*
 * THE PLAYGROUND — the homepage as a work table.
 * The name is cut, letter by letter, out of the work itself; real pieces sit around it.
 * AT REST : one composed poster.  DRAG : anything; what it touches gets nudged; it keeps a little momentum.
 * Paper is light (it lifts and flutters), objects are heavy (they turn as you pull them).
 * CLICK : opens the project the piece comes from.  RESET : everything slides back.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildShape } from './shapes.js';
import { media, clamp, lerp } from '../lib/util.js';

const D = 6.3;                 // camera distance; with fov 18° the plane z=0 is 2 units tall
const FOV = 18;
const MASS = { letter: 1, paper: 0.8, toy: 1.6, object: 3 };
// everything around the name is printed in one ink: deep blue to paper white (a cyanotype)
const DUO_LO = '0.161, 0.204, 0.337', DUO_HI = '0.86, 0.875, 0.91';
function duotone(m) {
  if (!m || m.userData.duo || m.isShadowMaterial) return;
  m.userData.duo = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { float l = clamp(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)), 0.0, 1.0);
        l = pow(smoothstep(0.06, 1.0, l), 2.4);
        gl_FragColor.rgb = mix(vec3(${DUO_LO}), vec3(${DUO_HI}), l); }`);
  };
  m.customProgramCacheKey = () => 'duo';
  m.needsUpdate = true;
}

export function createPlayground({ items, reducedMotion }) {
  const touch = window.matchMedia('(hover: none)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; pm.dispose();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x30343c, 0.6);
  const sun = new THREE.DirectionalLight(0xfffaf2, 1.6);
  sun.position.set(-0.6, 0.9, 5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 3, bottom: -3, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.015; sun.shadow.radius = 12;
  scene.add(hemi, sun, sun.target);

  // the table: invisible, it only catches (light) shadows
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ color: 0x2a1e14, opacity: 0.13, depthWrite: false }));
  catcher.position.z = -0.45; catcher.receiveShadow = true; catcher.renderOrder = -1;
  scene.add(catcher);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, D);
  const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * D;   // ≈ 1

  const loader = new THREE.TextureLoader();
  const tex = (slug, file) => { const t = loader.load(media(slug, file)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const img = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

  /* ---------------- build each piece ---------------- */
  const pickables = [];
  const els = items.map((o, idx) => {
    const root = new THREE.Group();     // pose + where it has been dragged to
    const inner = new THREE.Group();    // spin / tilt / flutter
    root.add(inner);
    root.userData.el = idx;
    root.visible = false;
    pickables.push(root);
    scene.add(root);
    const el = {
      o, idx, root, inner, ready: false, unit: 1, hover: 0, appear: 0, update: () => {},
      kind: o.kind || 'object', mass: MASS[o.kind] || 1.5,
      off: new THREE.Vector2(), vel: new THREE.Vector2(), rot: 0, rotV: 0, spin: 0, spinV: 0,
      lift: 0, tx: 0, ty: 0, wob: 0, wobV: 0,
    };
    if (o.patch) buildPatch(el);
    else if (o.record !== undefined) buildRecord(el);
    else if (o.image) buildImage(el);
    else {
      const ctx = {
        project: o.project,
        tex: (file) => tex(o.project.slug, file),
        onLoad: () => {
          const parent = shape.object.parent;
          parent?.remove(shape.object);
          shape.object.position.set(0, 0, 0);
          shape.object.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(shape.object);
          parent?.add(shape.object);
          if (bb.isEmpty()) return;
          const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
          shape.object.position.sub(c);
          el.unit = 1 / Math.max(sz.x, sz.y, sz.z);
          el.size = sz.multiplyScalar(el.unit);
          inner.scale.setScalar(el.unit);
          shape.object.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
          el.ready = true;
        },
      };
      const shape = buildShape(o, ctx);
      inner.add(shape.object);
      el.shape = shape;
      if (o.shape === 'tangram') ctx.onLoad();
      el.update = (t, dt) => shape.update(t, dt, el.hover);
    }
    return el;
  });

  /* a flat piece cut out of the work: a letter, a drawing, a toy (transparent or opaque WebP).
     Shown at its own colours (no tone mapping), it still throws a shadow on the table. */
  function buildImage(el) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
    const base = Float32Array.from(geo.attributes.position.array);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    el.inner.add(mesh); el.mesh = mesh;
    const url = media(el.o.project.slug, el.o.image);
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      mat.map = t; mat.needsUpdate = true;
      const a = t.image.width / t.image.height;
      mesh.scale.set(a >= 1 ? 1 : a, a >= 1 ? 1 / a : 1, 1);
      el.size = new THREE.Vector3(mesh.scale.x, mesh.scale.y, 0.02);
      el.ready = true;
    });
    // paper bends a little while it is held and moved
    if (el.kind === 'letter' || el.kind === 'paper') {
      let lastB = 0;
      el.update = () => {
        const b = clamp(el.lift * 6, 0, 1) * (0.5 + Math.min(1, el.vel.length() * 1.5) * 0.5);
        if (Math.abs(b - lastB) < 0.004) return;
        lastB = b;
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; p.setZ(i, (x * x + y * y * 0.4) * -0.14 * b); }
        p.needsUpdate = true;
      };
    }
  }


  /* vinyl record: black grooves with one solar-term label in the middle; it keeps turning, faster on hover */
  function buildRecord(el) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
    const g = cv.getContext('2d'), c = 512;
    const draw = (label) => {
      g.clearRect(0, 0, 1024, 1024);
      g.fillStyle = '#0d0c0c'; g.beginPath(); g.arc(c, c, 510, 0, Math.PI * 2); g.fill();
      for (let r = 250; r < 500; r += 3) { g.strokeStyle = `rgba(255,255,255,${0.025 + ((r * 7) % 5) * 0.006})`; g.lineWidth = 1; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
      const sheen = g.createConicGradient(0.6, c, c);
      sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.08, 'rgba(255,255,255,.14)'); sheen.addColorStop(0.16, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(0.58, 'rgba(255,255,255,.12)'); sheen.addColorStop(0.66, 'rgba(255,255,255,0)');
      g.fillStyle = sheen; g.beginPath(); g.arc(c, c, 500, 0, Math.PI * 2); g.arc(c, c, 246, 0, Math.PI * 2, true); g.fill();
      if (label) {
        const n = el.o.record, cw = label.naturalWidth / 6, ch = label.naturalHeight / 4, sx = (n % 6) * cw, sy = Math.floor(n / 6) * ch, side = Math.min(cw, ch);
        g.save(); g.beginPath(); g.arc(c, c, 240, 0, Math.PI * 2); g.clip();
        g.drawImage(label, sx + (cw - side) / 2, sy + (ch - side) / 2, side, side, c - 240, c - 240, 480, 480); g.restore();
      }
      g.fillStyle = '#0d0c0c'; g.beginPath(); g.arc(c, c, 10, 0, Math.PI * 2); g.fill();
    };
    draw(null);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.1, transparent: true });
    const edge = new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.4 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 96), [edge, top, top]);
    disc.rotation.x = Math.PI / 2; disc.castShadow = true; disc.receiveShadow = true;
    el.inner.add(disc);
    el.size = new THREE.Vector3(1, 1, 0.02);
    img(media('rhythm-of-solar-term', 'labels.webp')).then((label) => { draw(label); t.needsUpdate = true; el.ready = true; }, () => { el.ready = true; });
    let last = 0;
    el.update = (time) => { const dt = Math.min(0.05, time - last || 0); last = time; if (!reducedMotion) disc.rotation.y += dt * (0.5 + el.hover * 2.2); };
  }

  /* embroidery patch: a square of stitched cloth, one corner lifts on hover */
  function buildPatch(el) {
    const geo = new THREE.PlaneGeometry(1, 1, 12, 12);
    const base = Float32Array.from(geo.attributes.position.array);
    const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, envMapIntensity: 0.2, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    el.inner.add(mesh); el.mesh = mesh;
    el.size = new THREE.Vector3(1, 1, 0.02);
    img(media('home-in-small-moments', 'stitches.webp')).then((sheet) => {
      const n = el.o.patch - 1, cell = sheet.naturalWidth / 4;
      const cv = document.createElement('canvas'); cv.width = cv.height = 512;
      cv.getContext('2d').drawImage(sheet, (n % 4) * cell, Math.floor(n / 4) * cell, cell, cell, 0, 0, 512, 512);
      t.image = cv; t.needsUpdate = true; el.ready = true;
    });
    let lastLift = -1;
    el.update = () => {
      const lift = el.hover;
      if (Math.abs(lift - lastLift) < 0.002) return;
      lastLift = lift;
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const d = Math.max(0, (x - y) - 0.35);          // the bottom-right corner peels up
        p.setZ(i, d * d * 0.9 * lift);
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    };
  }
  /* ---------------- layout ---------------- */
  let W = 1, H = 1, halfW = 1, narrow = false, fit = 1;
  const poseFor = (el) => (narrow ? (el.o.mobile === undefined ? el.o.at : el.o.mobile) : el.o.at);
  const home = (el) => { const p = poseFor(el); return p ? [p.u * halfW, p.v * halfH] : [0, 0]; };
  const radius = (el) => { const p = poseFor(el); return p ? p.s * fit * 0.42 : 0; };

  /* ---------------- interaction ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoverI = -1, focusI = -1, selectI = -1, down = null, resetting = false;
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables.filter((p) => p.visible), true)[0];
    let n = hit?.object;
    while (n && n.userData.el === undefined) n = n.parent;
    return n ? { i: n.userData.el } : null;
  }
  const open = (i) => { location.hash = `#work-${els[i].o.project.slug}`; };
  const toWorld = (dxPx, dyPx) => [dxPx / H * 2 * halfH, -dyPx / H * 2 * halfH];
  const pv = new THREE.Vector2();          // pointer velocity, world units / s

  function onDown(e) {
    const h = pick(e.clientX, e.clientY);
    if (!h) { if (e.pointerType !== 'mouse') selectI = -1; return; }
    down = { i: h.i, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), t: performance.now(), drag: false, id: e.pointerId, type: e.pointerType };
    resetting = false;
    const el = els[h.i]; el.vel.set(0, 0); el.holding = true; pv.set(0, 0);
    if (e.pointerType === 'mouse') { canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
  }
  function onMove(e) {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        down.drag = true;
        if (down.type !== 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } }
      }
      if (down.drag) {
        const el = els[down.i];
        const [wx, wy] = toWorld(dx, dy);
        el.off.x += wx; el.off.y += wy;
        const now = performance.now(), dt = Math.max(0.008, (now - down.lt) / 1000);
        pv.lerp(new THREE.Vector2(wx / dt, wy / dt), 0.5);
        down.lt = now;
        if (el.kind === 'object') { el.spin += wx * 3.2; el.spinV = (wx * 3.2) / dt; }
        else el.rotV += clamp(-wx / dt * 0.04, -0.6, 0.6);    // paper swings round the finger
      }
      down.lx = e.clientX; down.ly = e.clientY;
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.pointerType === 'mouse') {
      const h = pick(e.clientX, e.clientY);
      hoverI = h ? h.i : -1;
      canvas.style.cursor = h ? 'grab' : '';
    }
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    const el = els[d.i]; el.holding = false;
    canvas.style.cursor = hoverI >= 0 ? 'grab' : '';
    if (d.drag) {
      // let go: it keeps the speed of the hand, a bit less for heavy things
      const k = reducedMotion ? 0 : 0.55 / Math.sqrt(el.mass);
      el.vel.copy(pv).multiplyScalar(k).clampLength(0, 1.6);
      return;
    }
    if (performance.now() - d.t > 650) return;
    if (d.type === 'mouse') open(d.i);
    else if (selectI === d.i) open(d.i);
    else selectI = d.i;
  }
  function onCancel() { if (down) els[down.i].holding = false; down = null; }
  function onLeave(e) { if (e.pointerType === 'mouse') hoverI = -1; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);

  /* ---------------- physics ---------------- */
  const P = (el) => { const [hx, hy] = home(el); return [hx + el.off.x, hy + el.off.y]; };
  function physics(dt) {
    // something moving nudges what it runs into (resting overlaps stay as composed)
    for (let a = 0; a < els.length; a++) {
      const A = els[a]; if (!A.root.visible) continue;
      const moving = A.holding && down?.drag ? pv : A.vel;
      const speed = moving.length();
      if (speed < 0.05) continue;
      const [ax, ay] = P(A), ra = radius(A);
      for (let b = 0; b < els.length; b++) {
        if (b === a) continue;
        const B = els[b]; if (!B.root.visible || B.holding) continue;
        const [bx, by] = P(B), rb = radius(B);
        const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 0.001, min = (ra + rb) * 0.8;
        if (dist >= min) continue;
        const over = (min - dist) / min;
        const push = over * Math.min(speed, 2) * 0.7 / B.mass;
        B.vel.x += (dx / dist) * push * dt * 10; B.vel.y += (dy / dist) * push * dt * 10;
        // a glancing touch turns it a little
        const side = Math.sign(dx * moving.y - dy * moving.x) || 1;
        if (B.kind === 'object') B.spinV += side * push * 1.2; else B.rotV += side * push * 0.25;
        B.wobV += push * 0.5;
      }
    }
    els.forEach((el) => {
      if (!el.root.visible) return;
      const heavy = el.kind === 'object';
      if (resetting) {
        const k = 1 - Math.pow(0.004, dt);
        el.off.multiplyScalar(1 - k); el.rot *= 1 - k; el.spin *= 1 - k; el.vel.set(0, 0); el.rotV = 0; el.spinV = 0;
      } else if (!el.holding) {
        el.off.addScaledVector(el.vel, dt);
        el.vel.multiplyScalar(Math.pow(heavy ? 0.01 : 0.025, dt));   // table friction
        if (el.vel.lengthSq() < 1e-5) el.vel.set(0, 0);
        // stay on the table
        const [x, y] = P(el), mx = halfW * 1.02, my = halfH * 0.98;
        if (x < -mx || x > mx) { el.off.x -= (x - clamp(x, -mx, mx)); el.vel.x *= -0.4; }
        if (y < -my || y > my) { el.off.y -= (y - clamp(y, -my, my)); el.vel.y *= -0.4; }
      }
      el.rot += el.rotV * dt; el.rotV *= Math.pow(0.02, dt);
      el.spin += el.spinV * dt; el.spinV *= Math.pow(heavy ? 0.08 : 0.02, dt);
      if (heavy && !el.holding) el.spin *= Math.pow(0.35, dt);   // an object settles back to its own face
      el.wobV += (-el.wob * 70 - el.wobV * 5) * dt; el.wob += el.wobV * dt * 6;
      // held: paper lifts and flutters with the hand, objects lift less
      const liftT = el.holding && down?.drag ? (heavy ? 0.06 : 0.14) : 0;
      el.lift += (liftT - el.lift) * (1 - Math.pow(0.0005, dt));
      const fl = el.holding && down?.drag && !heavy;
      el.tx += ((fl ? clamp(-pv.y * 0.12, -0.45, 0.45) : 0) - el.tx) * (1 - Math.pow(0.002, dt));
      el.ty += ((fl ? clamp(pv.x * 0.12, -0.45, 0.45) : 0) - el.ty) * (1 - Math.pow(0.002, dt));
    });
    if (resetting && els.every((e) => e.off.lengthSq() < 1e-6 && Math.abs(e.rot) < 1e-3)) resetting = false;
  }

  /* ---------------- loop ---------------- */
  let mount = null, labels = null, ro = null, raf = 0, last = 0, running = false, t0 = -1;
  const clock = { t: 0 };
  const v = new THREE.Vector3();
  const smooth = (x) => x * x * (3 - 2 * x);
  let lastActive = performance.now();
  const wake = () => { lastActive = performance.now(); };
  ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    const busy = resetting || down || els.some((e) => e.vel.lengthSq() > 1e-4 || Math.abs(e.spinV) > 0.01 || Math.abs(e.rotV) > 0.01);
    if (!busy && now - lastActive > 3000 && last && now - last < 31) return;   // idle at ~30 fps
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; clock.t += dt;
    const t = clock.t; if (t0 < 0) t0 = t;
    const k = (r) => (reducedMotion ? 1 : 1 - Math.pow(r, dt));

    physics(dt);
    const active = down?.drag ? down.i : hoverI >= 0 ? hoverI : focusI >= 0 ? focusI : selectI;
    els.forEach((el, i) => {
      const pose = poseFor(el);
      el.root.visible = !!pose && el.ready;
      if (!pose) return;
      el.hover += ((i === active ? 1 : 0) - el.hover) * k(0.0008);
      if (el.ready && el.appear < 1) el.appear = Math.min(1, el.appear + dt / (reducedMotion ? 0.01 : 0.8) * (t - t0 > i * 0.05 ? 1 : 0));
      const a = smooth(el.appear);
      const [x, y] = P(el);
      el.root.position.set(x, y + (1 - a) * 0.3, pose.z + el.lift * 2.2 + el.hover * 0.03);
      el.root.rotation.set(pose.rx || 0, pose.ry || 0, (pose.rz || 0) + el.rot);
      el.root.scale.setScalar(pose.s * fit * (0.7 + 0.3 * a) * (1 + el.hover * 0.03 + el.lift * 0.25));
      if (el.kind === 'object') el.inner.rotation.set(0, el.spin, el.wob * 0.05);
      else el.inner.rotation.set(el.tx, el.ty, el.wob * 0.12);
      if (el.kind === 'toy' && !reducedMotion) {
        // the little friends never sit still: they hop, squash when they land, stretch on the way up
        const speed = 0.55 + el.hover * 0.35 + (el.holding ? 0.6 : 0) + Math.min(0.6, el.vel.length() * 0.6);
        el.hopT = (el.hopT || i * 0.37) + dt * speed;
        const ph = el.hopT % 1, up = Math.pow(Math.sin(ph * Math.PI), 1.4);   // 0 on the ground, 1 at the top
        const h = (0.04 + el.hover * 0.03 + Math.abs(el.wob) * 0.2) * up;
        const land = Math.max(0, 1 - ph / 0.14) + Math.max(0, (ph - 0.88) / 0.12);   // squash around the touch-down
        const sq = land * 0.06, st = up * 0.03;
        el.inner.position.set(0, h - sq * 0.5, 0);
        el.inner.scale.set(1 + sq - st * 0.6, 1 - sq + st, 1);
        el.inner.rotation.z += Math.sin(el.hopT * Math.PI) * 0.025;
      }
      el.update(t, dt);
      if (el.kind !== 'letter' && el.ready && !el.duoDone) {
        el.root.traverse((n) => { if (n.material) [].concat(n.material).forEach(duotone); });
        if (t - t0 > 6) el.duoDone = true;    // late-loading parts are caught for a few seconds
      }
    });
    renderer.render(scene, camera);

    if (labels) {
      const screen = els.map((el) => {
        if (!el.root.visible) return null;
        v.copy(el.root.position).project(camera);
        return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
      });
      labels.update(screen, down?.drag ? -1 : active, 0, [W, H]);
    }
  }

  function resize() {
    if (!mount) return;
    W = Math.max(1, mount.clientWidth); H = Math.max(1, mount.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfW = halfH * camera.aspect;
    narrow = W / H < 0.85;
    // drawn for a 16:10 screen (or a phone); squarer windows shrink everything to fit
    fit = narrow ? Math.min(1, camera.aspect / 0.4875) : clamp(camera.aspect / 1.6, 0.5, 1.08);
    const s = Math.max(halfW, halfH) * 1.4;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  const onVis = () => (document.hidden ? stop() : mount && start());
  document.addEventListener('visibilitychange', onVis);
  let io = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
  canvas.addEventListener('webglcontextrestored', () => mount && start());

  return {
    attach(el, labelApi) {
      mount = el; labels = labelApi;
      el.append(canvas);
      ro = new ResizeObserver(resize); ro.observe(el);
      resize();
      io = new IntersectionObserver(([en]) => {
        // the first report can come before layout settles: double-check before pausing
        const r = el.getBoundingClientRect(), seen = r.bottom > 0 && r.top < innerHeight && r.height > 0;
        if (en.isIntersecting || seen) start(); else stop();
      });
      io.observe(el);
      start();
    },
    detach() {
      stop(); ro?.disconnect(); io?.disconnect();
      canvas.remove(); mount = null; labels = null; hoverI = focusI = selectI = -1; down = null;
    },
    highlight(i, on) { focusI = on ? i : focusI === i ? -1 : focusI; lastActive = performance.now(); },
    reset() { resetting = true; selectI = -1; lastActive = performance.now(); },
    isMoved: () => els.some((e) => e.off.lengthSq() > 1e-4 || Math.abs(e.rot) > 0.01),
    isNarrow: () => narrow,
  };
}
