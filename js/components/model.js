/*
 * GLB / GLTF viewer for project pages.
 * Usage in projects.js:  { type: 'model', src: 'assets/models/my-sculpture.glb', poster: 'photo-01' }
 * Drag to orbit, scroll / pinch to zoom. Three.js loads only when this block scrolls into view.
 */
import { h, hasWebGL, prefersReducedMotion } from '../lib/util.js';

export function createModelViewer({ src, posterSrc, caption = '' }) {
  const box = h('div', { class: 'model', role: 'img', 'aria-label': caption || '3D model' },
    posterSrc ? h('img', { src: posterSrc, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain' } }) : null,
    h('span', { class: 'mono' }, 'Loading 3D model…'),
  );
  if (!hasWebGL()) { box.querySelector('.mono').textContent = '3D view unavailable on this device'; return box; }

  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);

      const gltf = await new GLTFLoader().loadAsync(src);
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const sizeV = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      scene.add(model);
      const radius = sizeV.length() / 2;
      camera.position.set(radius * 1.6, radius * 0.9, radius * 2.6);
      camera.near = radius / 100; camera.far = radius * 50; camera.updateProjectionMatrix();

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = !prefersReducedMotion();
      controls.autoRotateSpeed = 0.8;
      controls.minDistance = radius * 0.8; controls.maxDistance = radius * 6;
      controls.addEventListener('start', () => { controls.autoRotate = false; });

      box.replaceChildren(renderer.domElement, h('span', { class: 'mono' }, 'Drag to turn · Scroll to zoom'));
      const resize = () => {
        const w = box.clientWidth, hh = box.clientHeight;
        renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(box); resize();
      renderer.setAnimationLoop(() => {
        if (!box.isConnected) { renderer.setAnimationLoop(null); renderer.dispose(); return; }
        controls.update(); renderer.render(scene, camera);
      });
    } catch (err) {
      console.warn('Model viewer failed', err);
      box.querySelector('.mono').textContent = '3D model could not be loaded';
    }
  }, { rootMargin: '200px' });
  io.observe(box);
  return box;
}

/*
 * Object viewer: shows one of the playground objects (e.g. the STL spiral book)
 * on its own stage. Usage: { type: 'object', shape: 'spiralbook', cover: '…stl', back: '…stl', page: 'page-01.webp' }
 */
export function createObjectViewer(cfg, project, { posterSrc = '' } = {}) {
  const label = h('span', { class: 'mono' }, 'Loading 3D object…');
  const hint = cfg.hint || (cfg.shape === 'spiralbook' ? 'Drag to turn · Scroll to zoom · Hover to open the cover' : 'Drag to turn · Scroll to zoom');
  const box = h('div', { class: 'model model--object', role: 'img', 'aria-label': `${project.title}, 3D object`, style: cfg.aspect ? { aspectRatio: cfg.aspect } : null },
    posterSrc ? h('img', { src: posterSrc, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 } }) : null, label);
  if (!hasWebGL()) { label.textContent = '3D view unavailable on this device'; return box; }

  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    try {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const { buildShape } = await import('../three/shapes.js');
      const { media } = await import('../lib/util.js');
      const { storms } = cfg.storms ? await import('../data/storms.js') : { storms: [] };

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
      const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.5);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(-2, 4, 2.5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
      sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
      scene.add(sun);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.35 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

      const loader = new THREE.TextureLoader();
      const shape = buildShape(cfg, {
        project, storms,
        tex: (file) => { const t = loader.load(media(project.slug, file)); t.colorSpace = THREE.SRGBColorSpace; return t; },
        onLoad: () => { label.textContent = hint; frame(); if (shape.timeline) buildTimeline(shape.timeline); if (shape.flows) buildFlows(shape.flows); },
      });
      scene.add(shape.object);
      // frame whatever was loaded: centre it and back the camera off to fit
      let overview = null, camGoal = null;   // camera tour (Hurricanes)
      function frame() {
        const bb = new THREE.Box3().setFromObject(shape.object);
        if (bb.isEmpty()) return;
        const c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() / 2;
        controls.target.copy(c);
        const dir = new THREE.Vector3(0.45, 0.42, 1).normalize();
        const d = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * (cfg.zoom || 0.9);
        camera.position.copy(c).addScaledVector(dir, d);
        overview = { pos: camera.position.clone(), tgt: c.clone() };
        controls.minDistance = d * 0.2; controls.maxDistance = d * 2.5;
        Object.assign(sun.shadow.camera, { left: -r * 1.5, right: r * 1.5, top: r * 1.5, bottom: -r * 1.5, far: r * 20 });
        sun.position.set(c.x - r * 2, c.y + r * 4, c.z + r * 2.5); sun.target.position.copy(c); scene.add(sun.target);
        sun.shadow.camera.updateProjectionMatrix();
        controls.update();
      }

      /* year line under the hurricanes: drag or play, storms arrive in order */
      function buildTimeline(tl) {
        const ys = tl.years;
        const out = h('span', { class: 'tl__now' }, '');
        const range = h('input', { type: 'range', min: '0', max: String(ys.length), step: '1', value: String(ys.length), 'aria-label': 'Year' });
        const playBtn = h('button', { type: 'button', class: 'tl__play mono', 'aria-label': 'Play the years' }, 'Play');
        let timer = null;
        const sheet = media(project.slug, 'storms.webp');
        const spr = (i) => {
          const c = i % 6, r = Math.floor(i / 6), th = 412 / 361;
          return h('i', { class: 'storm-spr', style: { backgroundImage: `url("${sheet}")`, backgroundSize: `600% ${400 * th}%`,
            backgroundPosition: `${c * 20}% ${((r * th + (th - 1) / 2) / (4 * th - 1)) * 100}%` } });
        };
        const card = h('div', { class: 'tour-card' });
        box.append(card);
        const v = new THREE.Vector3();
        const flyTo = (idx) => {   // frame this year's storms, low and close
          const tgt = new THREE.Vector3();
          idx.forEach((i) => tgt.add(shape.stormWorld(i, v)));
          tgt.divideScalar(idx.length);
          let spread = 0; idx.forEach((i) => { spread = Math.max(spread, shape.stormWorld(i, v).distanceTo(tgt)); });
          const rw = shape.stormRadiusWorld();
          const dist = Math.max(rw * 17, spread * 3.6);
          const ang = Math.atan2(camera.position.x - tgt.x, camera.position.z - tgt.z);
          const pos = new THREE.Vector3(tgt.x + Math.sin(ang) * dist * 0.8, tgt.y + dist * 0.55, tgt.z + Math.cos(ang) * dist * 0.8);
          camGoal = { pos, tgt: tgt.clone().setY(tgt.y + rw * 0.8) };
        };
        const show = (k, fly) => {
          range.value = String(k);
          if (k >= ys.length) {
            tl.setYear(9999); out.innerHTML = `<b>${ys[0]}–${ys[ys.length - 1]}</b> All storms on the print`;
            card.classList.remove('is-on'); if (fly && overview) camGoal = { ...overview };
            return;
          }
          const names = tl.setYear(ys[k]);
          out.innerHTML = `<b>${ys[k]}</b> ${names.join(' · ')}`;
          const idx = tl.indicesOf(ys[k]);
          card.replaceChildren(h('div', { class: 'tour-card__y mono' }, String(ys[k])), ...idx.map((i) => {
            const st = shape.stormInfo(i);
            return h('div', { class: 'tour-card__s' }, h('div', { class: 'tour-card__img' }, spr(st.index)), h('div', {}, h('b', {}, st.name), h('span', {}, st.trait)));
          }));
          card.classList.add('is-on');
          if (fly) flyTo(idx);
        };
        const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = 'Play'; };
        playBtn.addEventListener('click', () => {
          if (timer) { stop(); return; }
          controls.autoRotate = false;
          let k = +range.value >= ys.length ? 0 : +range.value;
          show(k, true); playBtn.textContent = 'Pause';
          timer = setInterval(() => { k += 1; show(k, true); if (k >= ys.length) stop(); }, 900);
        });
        range.addEventListener('input', () => { stop(); show(+range.value, true); });
        const ticks = h('div', { class: 'tl__ticks mono' }, h('span', {}, String(ys[0])), h('span', {}, String(ys[ys.length - 1])), h('span', {}, 'All'));
        box.after(h('div', { class: 'tl' }, playBtn, h('div', { class: 'tl__track' }, range, ticks), out));
        show(ys.length);
      }

      /* Euplectella: four sensors → four toggles */
      function buildFlows(fl) {
        const info = { water: ['Water', 'passes through'], nutrients: ['Nutrients', 'slowly gather inside'], particles: ['Particles', 'are filtered out'], organism: ['Organism', 'the shrimp light up'] };
        const btns = fl.modes.map((k) => {
          const b = h('button', { type: 'button', class: `flow-btn flow-btn--${k}`, 'aria-pressed': 'false' },
            h('span', { class: 'flow-btn__dot' }), h('span', { class: 'flow-btn__t' }, info[k][0]), h('span', { class: 'flow-btn__d mono' }, info[k][1]));
          b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(fl.toggle(k))); });
          return b;
        });
        box.after(h('div', { class: 'flows' }, h('span', { class: 'flows__l mono' }, 'Touch a sensor'), ...btns));
      }

      const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
      camera.position.set(0.9, 1.5, 2.2);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.3, 0);
      controls.enableDamping = true;
      controls.autoRotate = !prefersReducedMotion();
      controls.autoRotateSpeed = 0.7;
      controls.minDistance = 0.8; controls.maxDistance = 5;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.addEventListener('start', () => { controls.autoRotate = false; camGoal = null; });

      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      /* Hurricanes: point at a storm to name it, click to lift it off the map */
      const tag = h('span', { class: 'storm3d-tag mono' }, '');
      const card = h('div', { class: 'storm3d-card' });
      let downAt = null, hoverI = -1, selI = -1;
      const sheet = cfg.storms ? media(project.slug, 'storms.webp') : '';
      const spr = (i) => {
        const c = i % 6, r = Math.floor(i / 6), th = 412 / 361;
        return h('i', { class: 'storm-spr', style: { backgroundImage: `url("${sheet}")`, backgroundSize: `600% ${400 * th}%`,
          backgroundPosition: `${c * 20}% ${((r * th + (th - 1) / 2) / (4 * th - 1)) * 100}%` } });
      };
      const pickStorm = (e) => {
        if (!shape.stormMesh) return -1;
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(shape.stormMesh, false)[0];
        return hit ? shape.stormAt(hit) : -1;
      };
      const select = (i) => {
        selI = i; shape.selectStorm(i);
        if (i < 0) { card.classList.remove('is-on'); return; }
        const st = shape.stormInfo(i);
        card.replaceChildren(
          h('button', { type: 'button', class: 'storm3d-card__x mono', 'aria-label': 'Close', onclick: (ev) => { ev.stopPropagation(); select(-1); } }, '✕'),
          h('div', { class: 'storm3d-card__img' }, spr(st.index)),
          h('div', { class: 'storm3d-card__meta mono' }, h('span', {}, `No. ${String(st.index + 1).padStart(2, '0')}`), h('span', {}, String(st.year))),
          h('h4', {}, st.name), h('p', {}, st.trait));
        card.classList.add('is-on');
        controls.autoRotate = false;
      };
      if (cfg.storms && cfg.pick) {
        renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
        renderer.domElement.addEventListener('pointerup', (e) => {
          if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
          const i = pickStorm(e);
          select(i === selI ? -1 : i);
        });
        renderer.domElement.addEventListener('pointermove', (e) => {
          if (e.buttons) { tag.classList.remove('is-on'); return; }
          const i = pickStorm(e);
          if (i !== hoverI) { hoverI = i; shape.hoverStorm?.(i); }
          renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
          if (i < 0) { tag.classList.remove('is-on'); return; }
          const st = shape.stormInfo(i), r = box.getBoundingClientRect();
          tag.textContent = `${st.name} · ${st.year}`;
          tag.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top - 28}px)`;
          tag.classList.add('is-on');
        });
        renderer.domElement.addEventListener('pointerleave', () => { tag.classList.remove('is-on'); hoverI = -1; shape.hoverStorm?.(-1); });
      }

      // Frozen Flow: move over the shell to thaw it
      renderer.domElement.addEventListener('pointermove', (e) => {
        if (!shape.thaw || !shape.thawMesh) return;
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(shape.thawMesh, false)[0];
        if (hit) { shape.thaw(hit.point); controls.autoRotate = false; }
      });

      let hover = 0, target = 0, light = 1, lightTarget = 1;
      renderer.domElement.addEventListener('pointerenter', () => { target = 1; });
      renderer.domElement.addEventListener('pointerleave', () => { target = 0; });
      renderer.domElement.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') target = target ? 0 : 1; });

      const kids = [renderer.domElement, label, ...(cfg.storms ? [tag, card] : [])];
      if (cfg.glow && cfg.lightsButton) {
        // glow-in-the-dark: switch the room lights off
        const btn = h('button', { class: 'lights-btn mono', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'lights-btn__dot' }), 'Lights off');
        let off = false;
        btn.addEventListener('click', () => {
          off = !off;
          btn.setAttribute('aria-pressed', String(off));
          btn.lastChild.textContent = off ? 'Lights on' : 'Lights off';
          box.classList.toggle('is-dark', off);
          shape.setDark(off);
          lightTarget = off ? 0.04 : 1;
        });
        kids.push(btn);
      }
      box.replaceChildren(...kids);
      const resize = () => {
        const w = box.clientWidth, hh = box.clientHeight;
        renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(box); resize();
      const clock = new THREE.Clock();
      // only draw while the viewer is on screen and the tab is visible
      let visible = true;
      const vis = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) clock.getDelta(); });
      vis.observe(box);
      renderer.setAnimationLoop(() => {
        if (!box.isConnected) { renderer.setAnimationLoop(null); vis.disconnect(); renderer.dispose(); return; }
        if (!visible || document.hidden) return;
        const dt = clock.getDelta();
        hover += (target - hover) * Math.min(1, dt * 5);
        shape.update(clock.elapsedTime, dt, hover);
        if (Math.abs(light - lightTarget) > 0.001) {
          light += (lightTarget - light) * Math.min(1, dt * 2.5);
          sun.intensity = 2.2 * light; hemi.intensity = 0.5 * light;
        }
        if (camGoal) {
          const e = Math.min(1, dt * 4.5);
          camera.position.lerp(camGoal.pos, e); controls.target.lerp(camGoal.tgt, e);
          if (camera.position.distanceTo(camGoal.pos) < 0.002) camGoal = null;
        }
        controls.update(); renderer.render(scene, camera);
      });
    } catch (err) {
      console.warn('Object viewer failed', err);
      label.textContent = '3D object could not be loaded';
    }
  }, { rootMargin: '200px' });
  io.observe(box);
  return box;
}
