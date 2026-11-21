/*
 * 3D stage for Nomad Sculpt models (.glb with painted vertex colours).
 * One WebGL view per stage; models load on demand and are cached.
 *
 *   createStage({ glass })            → { el, show(models, opts), onReady }
 *   models: [{ src, x?, glass? }]      several models stand in a row when x is given
 *   glass:  'smoke' (dark tinted glass, the elders) | 'soft' (milky, the jellyfish)
 *
 * Blocks built on it:
 *   { type: 'diorama', places: [{ key, label, model, poster, text }] }   tabs over one stage
 *   { type: 'gacha', friends: [{ key, name, model, image }] }            draw a friend at random
 *   { type: 'lineup', models: [...], caption }                            several models in a row
 */
import { h, hasWebGL, prefersReducedMotion } from '../lib/util.js';

let threeP = null;
const loadThree = () => (threeP ||= Promise.all([
  import('three'),
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/controls/OrbitControls.js'),
  import('three/addons/environments/RoomEnvironment.js'),
]).then(([THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }]) => ({ THREE, GLTFLoader, OrbitControls, RoomEnvironment })));
const cache = new Map();

/* Models are stored as .gltf.json with the binary embedded as base64 (the host serves no .glb).
   The page fetches the JSON itself and rebuilds a GLB in memory, so nothing loads from a data: URL. */
async function fetchModel(url, onProgress) {
  if (!/\.gltf\.json$/.test(url)) return (await fetch(url)).arrayBuffer();
  const res = await fetch(url);
  const total = +res.headers.get('content-length') || 0;
  let text;
  if (res.body && total && onProgress) {
    const reader = res.body.getReader(); const parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onProgress({ loaded: got, total }); }
    const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    text = new TextDecoder().decode(all);
  } else text = await res.text();
  const j = JSON.parse(text);
  const b64 = j.buffers[0].uri.slice(j.buffers[0].uri.indexOf(',') + 1);
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  delete j.buffers[0].uri;
  let js = new TextEncoder().encode(JSON.stringify(j));
  const jpad = (4 - (js.length % 4)) % 4, bpad = (4 - (bin.length % 4)) % 4;
  const total2 = 12 + 8 + js.length + jpad + 8 + bin.length + bpad;
  const out = new ArrayBuffer(total2); const dv = new DataView(out); const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total2, true);
  dv.setUint32(12, js.length + jpad, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(js, 20); u8.fill(0x20, 20 + js.length, 20 + js.length + jpad);
  const bo = 20 + js.length + jpad; dv.setUint32(bo, bin.length + bpad, true); dv.setUint32(bo + 4, 0x004e4942, true); u8.set(bin, bo + 8);
  return out;
}

export function createStage({ height = 'clamp(380px, 70svh, 720px)', tilt = 0.32, bare = false, matte = false } = {}) {
  const status = h('span', { class: 'stage__status mono' }, '');
  const hint = h('span', { class: 'stage__hint mono' }, 'Drag to turn');
  const el = h('div', { class: `stage${bare ? ' stage--bare' : ''}`, style: { height } }, status, hint);
  const reduce = prefersReducedMotion();
  let api = null, want = null, visible = false;

  if (!hasWebGL()) { status.textContent = '3D view unavailable on this device'; return { el, show() {} }; }

  async function boot() {
    const { THREE, GLTFLoader, OrbitControls, RoomEnvironment } = await loadThree();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, bare ? 2 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const key = new THREE.DirectionalLight(0xfff1dc, 1.25); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 6;
    scene.add(key, new THREE.HemisphereLight(0xfff6e8, 0x6b5a48, 0.35));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: bare ? 0.18 : 0.28 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const root = new THREE.Group(); scene.add(root);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.7;
    controls.enablePan = false; controls.enableZoom = false;   // the wheel scrolls the page, never the model
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idle); });
    let idle = 0;
    controls.addEventListener('end', () => { clearTimeout(idle); if (!reduce) idle = setTimeout(() => { controls.autoRotate = true; }, 4000); });
    el.prepend(renderer.domElement);

    const smoke = (m) => { m.vertexColors = false; m.color = new THREE.Color(0x2a1c18); m.transmission = 0.55; m.thickness = 0.6; m.roughness = 0.12; m.metalness = 0; m.ior = 1.45; m.attenuationColor = new THREE.Color(0x3b2620); m.attenuationDistance = 0.4; m.specularIntensity = 1; };
    const soft = (m) => { m.transmission = 0.35; m.thickness = 0.8; m.roughness = 0.25; m.metalness = 0; };
    function prep(scene0, glass) {
      scene0.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        // Nomad writes painted colours in sRGB; glTF expects linear, so convert once here
        const col = o.geometry.getAttribute('color');
        if (col && !col.userData?.lin) {
          const c = new THREE.Color(); const out = new Float32Array(col.count * 3);
          for (let i = 0; i < col.count; i++) { c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.convertSRGBToLinear(); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
          const lin = new THREE.Float32BufferAttribute(out, 3); lin.userData = { lin: true }; o.geometry.setAttribute('color', lin);
        }
        const m = o.material;
        if (m.transmission > 0) { if (glass === 'smoke') smoke(m); else if (glass === 'soft') soft(m); else m.transmission = 0; }
        else if (matte) { m.metalness = Math.min(m.metalness, 0.05); m.roughness = Math.max(m.roughness, 0.5); }   // soft vinyl-toy finish
        else if (m.metalness > 0.5 && m.roughness < 0.2) { m.metalness = 0.2; m.roughness = 0.3; }   // Nomad's mirror defaults read as black here
      });
      return scene0;
    }
    const load = (src, glass, onProgress) => {
      const k = `${src}|${glass || ''}|${matte ? 'm' : ''}`;
      if (!cache.has(k)) cache.set(k, fetchModel(src, onProgress).then((buf) => new GLTFLoader().parseAsync(buf, '')).then((g) => prep(g.scene, glass)));
      return cache.get(k);
    };

    let token = 0, popT = 0;
    async function show(models, opts = {}) {
      const t = ++token;
      status.textContent = 'Loading…'; el.classList.add('is-loading');
      try {
        const loaded = await Promise.all(models.map((m) => load(m.src, m.glass, (e) => {
          if (t === token && e.total) status.textContent = `Loading ${Math.round((e.loaded / e.total) * 100)}%`;
        })));
        if (t !== token) return;
        root.clear();
        // normalise each model to unit height, stand it on the floor, place in a row
        loaded.forEach((s, i) => {
          const g = new THREE.Group(); const c = s.clone(); g.add(c);
          c.position.set(0, 0, 0); c.scale.setScalar(1); c.rotation.set(0, models[i].ry || 0, 0);
          const b = new THREE.Box3().setFromObject(c); const sz = b.getSize(new THREE.Vector3());
          const k = (models[i].size || 1) / Math.max(sz.y, sz.x * 0.75, sz.z * 0.75);
          c.scale.setScalar(k);
          const b2 = new THREE.Box3().setFromObject(c); const cen = b2.getCenter(new THREE.Vector3());
          c.position.set(-cen.x, -b2.min.y, -cen.z);
          g.position.x = models[i].x || 0; root.add(g);
        });
        const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3()); const cen = box.getCenter(new THREE.Vector3());
        const r = Math.max(size.x, size.y, size.z) * 0.5;
        floor.scale.setScalar(r * 2.4); floor.position.y = 0.001;
        key.position.set(r * 2.2, r * 4, r * 2.6); key.target.position.copy(cen);
        const sc = key.shadow.camera; sc.left = sc.bottom = -r * 2; sc.right = sc.top = r * 2; sc.near = 0.01; sc.far = r * 12; sc.updateProjectionMatrix();
        controls.target.copy(cen);
        const fit = (opts.distance || 1) * r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
        const az = opts.azimuth ?? 0.55;
        camera.position.set(cen.x + Math.sin(az) * fit * Math.cos(tilt), cen.y + fit * Math.sin(tilt + (opts.lift || 0)), cen.z + Math.cos(az) * fit * Math.cos(tilt));
        camera.near = r / 50; camera.far = r * 40; camera.updateProjectionMatrix();
        controls.minDistance = fit * 0.35; controls.maxDistance = fit * 2.2;
        controls.autoRotate = !reduce;
        popT = opts.pop && !reduce ? performance.now() : 0;
        status.textContent = ''; el.classList.remove('is-loading');
      } catch (err) {
        console.warn('stage: model failed', err);
        if (t === token) status.textContent = 'This model could not be loaded';
      }
    }
    const resize = () => {
      const w = el.clientWidth, hh = el.clientHeight; if (!w) return;
      renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(el); resize();
    renderer.setAnimationLoop(() => {
      if (!el.isConnected) { renderer.setAnimationLoop(null); renderer.dispose(); return; }
      if (!visible) return;
      if (popT) {
        const k = Math.min(1, (performance.now() - popT) / 700); const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
        root.scale.setScalar(Math.max(0.01, e)); root.rotation.y = (1 - k) * -2.4; if (k >= 1) popT = 0;
      } else if (root.scale.x !== 1) { root.scale.setScalar(1); root.rotation.y = 0; }
      controls.update(); renderer.render(scene, camera);
    });
    return { show };
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !api) { api = boot(); api.then((a) => want && a.show(...want)); }
  }, { rootMargin: '300px' }).observe(el);

  return {
    el,
    show(models, opts) { want = [models, opts]; if (api) api.then((a) => a.show(models, opts)); },
  };
}

/* Tabs over one stage: the town, then each building. */
export function createDiorama(cfg, src) {
  const stage = createStage({ height: 'clamp(420px, 74svh, 780px)' });
  const title = h('h3', { class: 'dio__title' }), text = h('p', { class: 'dio__text' });
  const thumbs = cfg.places.map((p, i) => h('button', { class: 'dio__tab', type: 'button', 'aria-pressed': String(i === 0), onclick: () => pick(i) },
    h('img', { src: src(p.poster), alt: '', loading: 'lazy' }), h('span', { class: 'mono' }, p.label)));
  const el = h('div', { class: 'dio' }, stage.el, h('div', { class: 'dio__side' }, h('div', { class: 'dio__copy' }, title, text), h('div', { class: 'dio__tabs' }, thumbs)));
  function pick(i) {
    const p = cfg.places[i];
    thumbs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    title.textContent = p.label; text.textContent = p.text;
    stage.show([{ src: src(p.model), glass: p.glass }], { distance: p.distance || 0.95, azimuth: p.azimuth, lift: p.lift });
  }
  pick(0);
  return el;
}

/* The Imaginary Friend Factory: draw a friend at random, collect all six. */
export function createGacha(cfg, src) {
  const F = cfg.friends;
  const stage = createStage({ height: 'clamp(240px, 38svh, 380px)', tilt: 0.14, bare: true, matte: true });
  const name = h('p', { class: 'gacha__name' }, h('span', { class: 'mono' }, 'Draw a friend to begin'));
  const got = new Set(); let last = -1;
  const slots = F.map((f, i) => h('button', { class: 'gacha__slot', type: 'button', disabled: true, 'aria-label': f.name, title: f.name, onclick: () => view(i, false) },
    h('img', { src: src(f.image), alt: '', loading: 'lazy' })));
  const count = h('span', { class: 'mono gacha__count' }, `0 / ${F.length}`);
  const lever = h('button', { class: 'gacha__lever', type: 'button', onclick: draw }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'mono' }, 'Draw a friend'));
  const el = h('div', { class: 'gacha is-empty' },
    h('div', { class: 'gacha__stage' }, stage.el, h('div', { class: 'gacha__capsule', 'aria-hidden': 'true' })),
    name,
    h('div', { class: 'gacha__bar' }, lever, h('div', { class: 'gacha__shelf' }, slots), count));
  function view(i, pop) {
    const f = F[i];
    name.replaceChildren(h('span', { class: 'mono' }, pop ? 'You drew' : 'Friend'), h('strong', {}, f.name));
    slots.forEach((s, k) => s.classList.toggle('is-on', k === i));
    stage.show([{ src: src(f.model), glass: f.glass }], { pop, distance: 1.25, azimuth: 0.15, lift: -0.05 });
    el.classList.remove('is-empty');
  }
  function draw() {
    lever.classList.remove('is-pull'); void lever.offsetWidth; lever.classList.add('is-pull');
    const pool = F.map((_, i) => i).filter((i) => !got.has(i));
    const choices = (pool.length ? pool : F.map((_, i) => i)).filter((i) => i !== last);
    const i = choices[Math.floor(Math.random() * choices.length)] ?? 0; last = i;
    got.add(i); slots[i].disabled = false; slots[i].classList.add('is-got');
    count.textContent = `${got.size} / ${F.length}`;
    view(i, true);
  }
  return el;
}

/* One pop-up stage per look (plain, or the matte toy finish), shared by every block on the page. */
const modals = new Map();
function openModel({ title, src, distance = 1.1, glass, matte = false }) {
  let m = modals.get(matte);
  if (!m) {
    const stage = createStage({ height: 'min(78svh, 760px)', matte, tilt: matte ? 0.16 : 0.32 });
    const t = h('p', { class: 'town__modal-t' });
    const el = h('div', { class: 'town__modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === el) closeModels(); } },
      h('div', { class: 'town__modal-box' }, t, h('button', { class: 'town__close mono', type: 'button', onclick: closeModels }, 'Close ✕'), stage.el));
    document.body.append(el);
    m = { el, stage, t }; modals.set(matte, m);
  }
  m.t.textContent = title;
  m.el.classList.add('is-open'); document.documentElement.style.overflow = 'hidden';
  m.stage.show([{ src, glass }], { distance, azimuth: matte ? 0.15 : undefined });
}
function closeModels() { modals.forEach((m) => m.el.classList.remove('is-open')); document.documentElement.style.overflow = ''; }
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModels(); });
function dropModelsWhenGone(el) {
  const mo = new MutationObserver(() => { if (!el.isConnected) { closeModels(); modals.forEach((m) => m.el.remove()); modals.clear(); mo.disconnect(); } });
  mo.observe(document.body, { childList: true, subtree: true });
}

/* The Imaginary Friend Factory: the friends come off a conveyor belt, freshly made.
   They drop onto the belt one by one, then idle; click one to hold it in 3D. */
export function createFactory(cfg, src) {
  const F = cfg.friends;
  const items = F.map((f, i) => h('li', { class: 'fac__item', style: { '--i': i, '--d': `${(i * 0.37) % 1.3}s` } },
    h('button', { class: 'fac__toy', type: 'button', 'aria-label': `${f.name}: turn it in 3D`,
      onclick: () => openModel({ title: f.name, src: src(f.model), glass: f.glass, matte: true, distance: 1.3 }) },
      h('span', { class: 'fac__puff', 'aria-hidden': 'true' }),
      h('img', { src: src(f.image), alt: f.name, loading: 'lazy', draggable: 'false' })),
    h('span', { class: 'fac__tag mono' }, h('b', {}, `No. ${String(i + 1).padStart(2, '0')}`), f.name)));
  const el = h('div', { class: 'fac' },
    h('ol', { class: 'fac__line' }, items),
    h('div', { class: 'fac__belt', 'aria-hidden': 'true' }, h('i', { class: 'fac__roller' }), h('i', { class: 'fac__roller' })),
    h('p', { class: 'fac__hint mono' }, 'Click a friend to turn it in 3D'));
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { el.classList.add('is-on'); io.disconnect(); } }, { threshold: 0.3 }).observe(el);
  dropModelsWhenGone(el);
  return el;
}

/* The town, laid out like the final board: the map in the middle, four places around it,
   each with its note and a line to where it sits on the map. Click a place to turn it in 3D. */
export function createTown(cfg, src) {
  const W = 1600, H = cfg.height || 960;
  const lines = h('div', { class: 'town__lines', 'aria-hidden': 'true' });
  lines.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${cfg.places.map((p) =>
    `<g data-k="${p.key}"><polyline points="${p.line.map((q) => q.join(',')).join(' ')}"/><circle cx="${p.line[0][0]}" cy="${p.line[0][1]}" r="7"/><circle class="end" cx="${p.line.at(-1)[0]}" cy="${p.line.at(-1)[1]}" r="6"/></g>`).join('')}</svg>`;
  const pct = (v, t) => `${(v / t) * 100}%`;
  const place = (p) => {
    const img = h('button', { class: 'town__img', type: 'button', style: { left: pct(p.img[0], W), top: pct(p.img[1], H), width: pct(p.img[2], W) }, 'aria-label': `${p.title}: turn it in 3D`, onclick: () => open(p),
      onmouseenter: () => hi(p.key, true), onmouseleave: () => hi(p.key, false) },
      h('img', { src: src(p.image), alt: p.title, loading: 'lazy' }), null);
    const title = h('h3', { class: 'town__title', style: { left: pct(p.title_at[0], W), top: pct(p.title_at[1], H), textAlign: p.title_at[2] || 'left' } }, p.title);
    const note = h('p', { class: 'town__note', style: { left: pct(p.note[0], W), top: pct(p.note[1], H), width: pct(p.note[2], W) } }, p.text);
    return [img, title, note];
  };
  const logo = cfg.logo ? h('figure', { class: 'town__logo', style: { left: pct(cfg.logo[0], W), top: pct(cfg.logo[1], H) } }, h('img', { src: src(cfg.logo[2]), alt: 'Game logo' }), h('figcaption', { class: 'mono' }, 'Game logo')) : null;
  const board = h('div', { class: 'town' }, lines, ...cfg.places.flatMap(place), ...(logo ? [logo] : []));
  const hi = (k, on) => { board.classList.toggle('is-hi', on); board.querySelectorAll(`[data-k="${k}"]`).forEach((g) => g.classList.toggle('is-on', on)); };
  const open = (p) => p.model && openModel({ title: p.title, src: src(p.model), distance: p.distance || 1.1 });
  const wrap = h('div', { class: 'town-wrap' },
    h('p', { class: 'town__hint' }, h('i', { 'aria-hidden': 'true' }, '↻'), h('span', {}, 'Every place is a 3D model.', h('br'), h('em', {}, 'Click one to turn it around.'))), board);
  dropModelsWhenGone(wrap);
  return wrap;
}

/* A short looping sequence, like a gif: the protagonist changing from grey to colour.
   frames: ['name' | { src, glow }] — glow is the colour of the soft light behind that frame. */
export function createFlip(cfg, src) {
  const F = cfg.frames.map((f) => (typeof f === 'string' ? { src: f } : f));
  const frames = F.map((f, i) => h('img', { class: `flip__f${i === 0 ? ' is-on' : ''}`, src: src(f.src), alt: '', loading: 'lazy' }));
  const glow = h('div', { class: 'flip__glow', 'aria-hidden': 'true' });
  // on the last frame, their imaginary friends circle around them
  const orbit = cfg.orbit ? h('div', { class: 'flip__orbit', 'aria-hidden': 'true' },
    cfg.orbit.map((o, i) => h('span', { style: { '--k': String(i / cfg.orbit.length) } }, h('img', { src: src(o), alt: '' })))) : null;
  const el = h('figure', { class: 'flip' }, h('div', { class: 'flip__box' }, glow, ...(orbit ? [orbit] : []), ...frames), cfg.caption ? h('figcaption', { class: 'mono' }, cfg.caption) : null);
  const last = F.length - 1;
  const show = (i) => { frames.forEach((f, k) => f.classList.toggle('is-on', k === i)); el.style.setProperty('--glow', F[i].glow || 'rgba(242,162,92,.5)'); el.classList.toggle('is-last', i === last); };
  show(0);
  if (prefersReducedMotion()) { show(last); return el; }
  let i = 0, vis = false;
  const step = () => {
    if (!el.isConnected) return;
    if (vis) { i = (i + 1) % frames.length; show(i); }
    setTimeout(step, i === last ? (cfg.hold || 3200) : (cfg.ms || 1500));
  };
  setTimeout(step, cfg.ms || 1500);
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(el);
  return el;
}

/* Several models in a row on one stage. */
export function createLineup(cfg, src) {
  const stage = createStage({ height: cfg.height || 'clamp(360px, 62svh, 640px)', tilt: 0.12 });
  const gap = cfg.gap || 0.9; const n = cfg.models.length;
  stage.show(cfg.models.map((m, i) => ({ src: src(m.src), glass: m.glass, x: (i - (n - 1) / 2) * gap, ry: m.ry })), { distance: cfg.distance || 0.8, azimuth: 0.0, lift: -0.05 });
  return h('figure', { class: 'lineup' }, ...[stage.el, cfg.caption ? h('figcaption', { class: 'mono' }, cfg.caption) : null].filter(Boolean));
}

/* Healing: the grey protagonist fills with colour from the hollow in their chest outward. */
export function createHeal(cfg, src) {
  const grey = h('img', { class: 'heal__img', src: src(cfg.grey), alt: 'The protagonist, grey, with a hollow in their chest' });
  const colour = h('img', { class: 'heal__img heal__colour', src: src(cfg.colour), alt: 'The protagonist, healed, in full colour' });
  const range = h('input', { class: 'heal__range', type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Heal them' });
  const pct = h('span', { class: 'mono heal__pct' }, '0%');
  const steps = (cfg.steps || []).map((s) => h('li', { class: 'mono' }, s));
  const el = h('div', { class: 'heal' },
    h('div', { class: 'heal__fig' }, grey, colour),
    h('div', { class: 'heal__side' }, h('p', { class: 'heal__k mono' }, 'Drag to heal them'), range, pct, h('ol', { class: 'heal__steps' }, steps)));
  const set = (v) => {
    el.style.setProperty('--r', `${v * 1.25}%`);
    grey.style.opacity = String(Math.min(1, Math.max(0, (100 - v) / 35)));   // the grey body fades once colour has taken over
    pct.textContent = `${Math.round(v)}%`;
    steps.forEach((s, i) => s.classList.toggle('is-on', v >= ((i + 1) / steps.length) * 100 - 1));
  };
  range.addEventListener('input', () => set(+range.value));
  // first time it comes into view, heal them once on its own
  let played = false;
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || played || prefersReducedMotion()) return; played = true;
    const t0 = performance.now();
    const step = (t) => { if (range.matches(':active')) return; const k = Math.min(1, (t - t0) / 2600); const v = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; range.value = String(v * 100); set(v * 100); if (k < 1) requestAnimationFrame(step); };
    setTimeout(() => requestAnimationFrame(step), 500);
  }, { threshold: 0.5 }).observe(el);
  set(0);
  return el;
}
export { openModel };
