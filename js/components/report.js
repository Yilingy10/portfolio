/*
 * Report printer: the long receipt, printed in a snake of short columns laid out sideways.
 * The paper runs down one column, turns through a fold, and carries on in the next.
 * It prints itself once it scrolls into view; the strip follows the print head
 * until you drag or scroll it yourself. A console beside it logs what is being printed.
 * Usage: { type: 'report', parts: ['report-1.webp', …], height: 22045, width: 652, log: [[y, 'TEXT', 'hand'|'alert'?], …] }
 *   y is measured in source pixels from the top of the scroll.
 */
import { h, prefersReducedMotion } from '../lib/util.js';

export function createReport(cfg, src) {
  const SW = cfg.width, SH = cfg.height;
  const SEG = cfg.segment || 2000;                 // source px per column
  const N = Math.ceil(SH / SEG);
  const reduced = prefersReducedMotion();

  const lines = h('ol', { class: 'report__log' });
  const meter = h('span', { class: 'mono report__meter' });
  const bar = h('span', { class: 'report__bar' }, h('span'));
  const again = h('button', { class: 'report__again mono', type: 'button' }, 'Print again ↺');
  const dot = h('span', { class: 'report__dot', 'aria-hidden': 'true' });
  const consoleEl = h('div', { class: 'report__console' },
    h('p', { class: 'mono report__title' }, dot, 'Machine analysis · live'),
    lines, h('div', { class: 'report__foot' }, meter, again), bar);

  const strip = h('div', { class: 'report__strip', tabindex: '0', 'aria-label': cfg.alt || 'Printed report' });
  const track = h('div', { class: 'report__track' });
  strip.append(track);
  const svgNS = 'http://www.w3.org/2000/svg';
  const folds = document.createElementNS(svgNS, 'svg');
  folds.setAttribute('class', 'report__folds');
  track.append(folds);

  const cols = [];
  for (let i = 0; i < N; i++) {
    const sheet = h('div', { class: 'report__sheet' }, cfg.parts.map((f, k) => h('img', { src: src(f), alt: '', draggable: 'false', loading: k ? 'lazy' : 'eager', decoding: 'async' })));
    const mask = h('div', { class: 'report__mask' });
    const head = h('div', { class: 'report__head' }, h('i'));
    const segH = Math.min(SEG, SH - i * SEG);
    const col = h('div', { class: 'report__col' }, sheet, mask, head);
    track.append(col);
    cols.push({ col, sheet, mask, head, segH });
  }
  const foldEls = [];
  for (let i = 0; i < N - 1; i++) {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('class', 'report__fold');
    folds.append(p);
    foldEls.push(p);
  }

  const root = h('section', { class: 'report' }, consoleEl, strip);

  let colW = 200, colH = 600, gap = 40, scale = 0.3;
  function layout() {
    colH = strip.clientHeight - 2 * Math.round(strip.clientHeight * 0.09);
    scale = colH / SEG; colW = SW * scale; gap = Math.max(18, colW * 0.16);
    const top = Math.round(strip.clientHeight * 0.09);
    track.style.width = `${N * colW + (N - 1) * gap + 2 * gap}px`;
    track.style.height = `${strip.clientHeight}px`;
    cols.forEach((c, i) => {
      Object.assign(c.col.style, { left: `${gap + i * (colW + gap)}px`, top: `${top}px`, width: `${colW}px`, height: `${c.segH * scale}px` });
      c.sheet.style.width = `${colW}px`;
      c.sheet.style.transform = `translateY(${-i * SEG * scale}px)`;
    });
    folds.setAttribute('width', track.style.width); folds.setAttribute('height', strip.clientHeight);
    foldEls.forEach((p, i) => {
      const x1 = gap + i * (colW + gap) + colW / 2, x2 = x1 + colW + gap, r = (colW + gap) / 2;
      const bottom = i % 2 === 0;
      const y = bottom ? top + colH : top;
      p.setAttribute('d', `M ${x1} ${y} A ${r} ${r} 0 0 ${bottom ? 0 : 1} ${x2} ${y}`);
      p.setAttribute('stroke-width', colW);
      p.style.strokeDasharray = `${Math.PI * r} ${Math.PI * r}`;
    });
    draw();
  }

  const log = (cfg.log || []).slice().sort((a, b) => a[0] - b[0]);
  let printed = 0, shown = 0, raf = 0, last = 0, follow = true, running = false;

  function addLine([, text, kind]) {
    const li = h('li', { class: kind === 'hand' ? 'is-hand' : kind === 'alert' ? 'is-alert' : '' });
    lines.append(li);
    if (reduced) li.textContent = text;
    else { let i = 0; const type = () => { li.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(type, kind === 'hand' ? 38 : 14); }; type(); }
    while (lines.children.length > 6) lines.firstChild.remove();
  }

  function draw() {
    cols.forEach((c, i) => {
      const start = i * SEG, done = Math.max(0, Math.min(c.segH, printed - start));
      const y = done * scale;
      c.mask.style.transform = `translateY(${y}px)`;
      c.head.style.transform = `translateY(${y}px)`;
      c.col.classList.toggle('is-active', done > 0 && done < c.segH);
      c.col.classList.toggle('is-blank', done <= 0);
    });
    foldEls.forEach((p, i) => {
      const end = (i + 1) * SEG, r = (colW + gap) / 2, len = Math.PI * r;
      const k = printed >= end ? 1 : 0;
      p.style.strokeDashoffset = `${len * (1 - k)}`;
    });
    const pct = Math.min(1, printed / SH);
    meter.textContent = pct > 0.995 ? 'Print complete' : `Printing ${String(Math.round(pct * 100)).padStart(2, '0')}%`;
    bar.firstChild.style.transform = `scaleX(${pct})`;
    root.classList.toggle('is-done', pct > 0.995);
    root.classList.toggle('is-printing', running && pct < 0.995);
    while (shown < log.length && log[shown][0] <= printed) addLine(log[shown++]);
  }

  function tick(t) {
    raf = 0;
    if (!root.isConnected) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    printed = Math.min(SH, printed + (reduced ? SH : 1100 * dt));
    draw();
    if (follow) {
      const i = Math.min(N - 1, Math.floor(printed / SEG));
      const x = gap + i * (colW + gap) + colW / 2 - strip.clientWidth / 2;
      strip.scrollLeft += (x - strip.scrollLeft) * Math.min(1, dt * 3);
    }
    if (printed < SH && running) raf = requestAnimationFrame(tick);
    else { running = false; draw(); }
  }
  function start() { if (running || printed >= SH) return; running = true; last = 0; raf = requestAnimationFrame(tick); }

  // you take over the strip as soon as you touch it
  const stopFollow = () => { follow = false; };
  strip.addEventListener('wheel', stopFollow, { passive: true });
  strip.addEventListener('touchstart', stopFollow, { passive: true });
  let drag = null;
  strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; stopFollow(); drag = { x: e.clientX, s: strip.scrollLeft }; strip.setPointerCapture(e.pointerId); strip.classList.add('is-drag'); });
  strip.addEventListener('pointermove', (e) => { if (drag) strip.scrollLeft = drag.s - (e.clientX - drag.x); });
  const end = () => { drag = null; strip.classList.remove('is-drag'); };
  strip.addEventListener('pointerup', end); strip.addEventListener('pointercancel', end);
  strip.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { stopFollow(); strip.scrollLeft += (e.key === 'ArrowRight' ? 1 : -1) * (colW + gap); e.preventDefault(); } });

  again.addEventListener('click', () => {
    printed = 0; shown = 0; lines.replaceChildren(); follow = true; strip.scrollLeft = 0;
    draw(); start();
  });

  new ResizeObserver(layout).observe(strip);
  const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) start(); }, { threshold: 0.35 });
  io.observe(strip);
  requestAnimationFrame(layout);
  return root;
}

/*
 * Melt: Frozen Flow prints with their melting-trace overlay.
 * The sprite holds 9 raw photos (left 3 columns) and the same 9 with the overlay (right 3 columns).
 * The overlay is shown by default. Modes: traces on / raw / traces only.
 * Drag across a print to thaw it locally; it slowly refreezes. Tap a print to toggle just that one.
 * Usage: { type: 'melt', sprite: 'melt-sprite.webp', tw: 600, th: 808, count: 9 }
 */

const MW = 150, MH = 202;              // mask resolution per print
const INK = [13, 13, 14];

export function createMelt(cfg, src) {
  const { tw = 600, th = 808, count = 9 } = cfg;
  const reduced = prefersReducedMotion();

  const modes = [
    ['on', 'Traces on'],
    ['off', 'Raw photo'],
    ['only', 'Traces only'],
  ];
  const btns = modes.map(([k, label]) => h('button', { class: 'melt__mode mono', type: 'button', 'data-mode': k, 'aria-pressed': k === 'on' ? 'true' : 'false' }, label));
  const status = h('span', { class: 'melt__status mono', 'aria-live': 'polite' });
  const grid = h('div', { class: 'melt__grid' });
  const root = h('section', { class: 'melt is-loading' },
    h('div', { class: 'melt__bar' },
      h('div', { class: 'melt__modes', role: 'group', 'aria-label': 'Overlay' }, btns),
      h('span', { class: 'melt__hint mono' }, 'Drag across a print to thaw it. Tap to switch one print.'),
      status),
    grid);

  const tiles = [];
  for (let i = 0; i < count; i++) {
    const cv = h('canvas', { width: tw, height: th, 'aria-label': `Print ${i + 1}` });
    const fig = h('figure', { class: 'melt__tile' }, cv, h('figcaption', { class: 'mono' }, h('span', {}, `No. ${String(i + 1).padStart(2, '0')}`), h('span', { class: 'melt__state' }, 'frozen')));
    grid.append(fig);
    tiles.push({ i, cv, ctx: cv.getContext('2d'), fig, vis: 1, target: 1, thaw: new Float32Array(MW * MH), dirty: true });
  }

  let mode = 'on', only = 0, onlyTarget = 0, raf = 0, ready = false;
  const maskCv = document.createElement('canvas'); maskCv.width = MW; maskCv.height = MH;
  const maskCtx = maskCv.getContext('2d');
  const maskImg = maskCtx.createImageData(MW, MH);
  const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th;
  const tctx = tmp.getContext('2d');

  // value noise for the melt order: top first, dripping downward
  function field(seed) {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const g = (gw, gh) => { const a = new Float32Array((gw + 1) * (gh + 1)); for (let k = 0; k < a.length; k++) a[k] = rnd(); return { a, gw, gh }; };
    const o1 = g(6, 8), o2 = g(18, 24);
    const sample = ({ a, gw, gh }, u, v) => {
      const x = u * gw, y = v * gh, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), W = gw + 1;
      const p = (xx, yy) => a[Math.min(gh, yy) * W + Math.min(gw, xx)];
      return (p(x0, y0) * (1 - sx) + p(x0 + 1, y0) * sx) * (1 - sy) + (p(x0, y0 + 1) * (1 - sx) + p(x0 + 1, y0 + 1) * sx) * sy;
    };
    const f = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const u = x / MW, v = y / MH;
      // streaks: columns melt at different speeds, like drips
      const col = sample(o1, u, 0.1) * 0.35;
      f[y * MW + x] = Math.min(1, Math.max(0, v * 0.55 + col + sample(o1, u, v) * 0.25 + sample(o2, u, v) * 0.12 - 0.08));
    }
    return f;
  }

  const img = new Image();
  img.decoding = 'async';
  img.src = src(cfg.sprite);
  img.onload = () => {
    const small = document.createElement('canvas'); small.width = MW; small.height = MH;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    tiles.forEach((t) => {
      const col = t.i % 3, row = Math.floor(t.i / 3);
      const raw = document.createElement('canvas'); raw.width = tw; raw.height = th;
      raw.getContext('2d').drawImage(img, col * tw, row * th, tw, th, 0, 0, tw, th);
      const ov = document.createElement('canvas'); ov.width = tw; ov.height = th;
      ov.getContext('2d').drawImage(img, (col + 3) * tw, row * th, tw, th, 0, 0, tw, th);
      sctx.drawImage(raw, 0, 0, MW, MH); const a = sctx.getImageData(0, 0, MW, MH).data;
      sctx.drawImage(ov, 0, 0, MW, MH); const b = sctx.getImageData(0, 0, MW, MH).data;
      const m = new Float32Array(MW * MH);
      for (let k = 0, p = 0; k < m.length; k++, p += 4) {
        const d = Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]));
        m[k] = Math.min(1, Math.max(0, (d - 14) / 40));
      }
      Object.assign(t, { raw, ov, m, f: field(t.i + 3), dirty: true });
    });
    ready = true;
    root.classList.remove('is-loading');
    kick();
  };

  function render(t) {
    const { ctx, raw, ov, m, f, thaw, vis } = t;
    const d = maskImg.data;
    const v = only > 0.5 ? 1 : vis;
    for (let k = 0, p = 0; k < m.length; k++, p += 4) {
      const e = (v * 1.12 - f[k]) * 9;              // melt front
      let a = m[k] * Math.min(1, Math.max(0, e + 0.5));
      a *= 1 - thaw[k];
      d[p + 3] = a * 255;
    }
    maskCtx.putImageData(maskImg, 0, 0);
    // base
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${INK})`; ctx.fillRect(0, 0, tw, th);
    ctx.globalAlpha = 1 - only; ctx.drawImage(raw, 0, 0);
    // traces
    tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1;
    tctx.clearRect(0, 0, tw, th);
    tctx.drawImage(ov, 0, 0);
    if (only > 0) { tctx.globalAlpha = only; tctx.fillStyle = '#F2F4F7'; tctx.fillRect(0, 0, tw, th); tctx.globalAlpha = 1; }
    tctx.globalCompositeOperation = 'destination-in';
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(maskCv, 0, 0, tw, th);
    ctx.globalAlpha = 1;
    ctx.drawImage(tmp, 0, 0);
    t.dirty = false;
  }

  let last = 0;
  function tick(now) {
    raf = 0;
    if (!root.isConnected) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    let busy = false;
    const sp = reduced ? 99 : 0.9;
    if (Math.abs(only - onlyTarget) > 0.001) { only += Math.sign(onlyTarget - only) * Math.min(Math.abs(onlyTarget - only), dt * 2.2 * (reduced ? 50 : 1)); tiles.forEach((t) => (t.dirty = true)); busy = true; }
    tiles.forEach((t) => {
      if (Math.abs(t.vis - t.target) > 0.001) { t.vis += Math.sign(t.target - t.vis) * Math.min(Math.abs(t.target - t.vis), dt * sp); t.dirty = true; busy = true; }
      if (t.thawing) {
        let any = false;
        if (!t.held) {
          for (let k = 0; k < t.thaw.length; k++) if (t.thaw[k] > 0) { t.thaw[k] = Math.max(0, t.thaw[k] - dt * 0.22); any = true; }
          if (!any) t.thawing = false;
        }
        t.dirty = true; busy = true;
      }
      if (t.dirty && ready && t.visible !== false) render(t);
      const shown = (only > 0.5 ? 1 : t.vis) > 0.5;
      t.fig.querySelector('.melt__state').textContent = only > 0.5 ? 'traces' : shown ? 'frozen' : 'melted';
    });
    const n = tiles.filter((t) => t.target > 0.5).length;
    status.textContent = onlyTarget ? 'Traces extracted from all 9 prints' : `${n} of ${count} prints with traces`;
    if (busy) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  function setMode(k) {
    mode = k;
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === k)));
    onlyTarget = k === 'only' ? 1 : 0;
    const v = k === 'off' ? 0 : 1;
    tiles.forEach((t, i) => { t.target = v; if (!reduced) t.vis = Math.min(1, Math.max(0, t.vis + (v ? -1 : 1) * i * 0.0)); t.thaw.fill(0); t.thawing = false; t.dirty = true; });
    kick();
  }
  btns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // brush: thaw where the pointer drags
  tiles.forEach((t) => {
    let down = null;
    const at = (e) => {
      const r = t.cv.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * MW, ((e.clientY - r.top) / r.height) * MH];
    };
    const brush = (x, y) => {
      const R = 16, R2 = R * R;
      for (let yy = Math.max(0, Math.floor(y - R)); yy < Math.min(MH, y + R); yy++)
        for (let xx = Math.max(0, Math.floor(x - R)); xx < Math.min(MW, x + R); xx++) {
          const d2 = (xx - x) ** 2 + (yy - y) ** 2; if (d2 > R2) continue;
          const k = yy * MW + xx, s = 1 - d2 / R2;
          t.thaw[k] = Math.min(1, t.thaw[k] + s * 0.5);
        }
      t.thawing = true; t.dirty = true; kick();
    };
    t.cv.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      down = { x: e.clientX, y: e.clientY, moved: false };
      t.cv.setPointerCapture(e.pointerId);
      t.held = true;
    });
    t.cv.addEventListener('pointermove', (e) => {
      if (!down) { // hover thaws gently on mouse
        if (e.pointerType === 'mouse' && e.buttons === 0 && only < 0.5 && t.vis > 0.5) { const [x, y] = at(e); brushSoft(x, y); }
        return;
      }
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
      if (down.moved) { const [x, y] = at(e); brush(x, y); }
    });
    const brushSoft = (x, y) => {
      const R = 10, R2 = R * R;
      for (let yy = Math.max(0, Math.floor(y - R)); yy < Math.min(MH, y + R); yy++)
        for (let xx = Math.max(0, Math.floor(x - R)); xx < Math.min(MW, x + R); xx++) {
          const d2 = (xx - x) ** 2 + (yy - y) ** 2; if (d2 > R2) continue;
          const k = yy * MW + xx; t.thaw[k] = Math.min(1, t.thaw[k] + (1 - d2 / R2) * 0.12);
        }
      t.thawing = true; t.dirty = true; kick();
    };
    const up = () => {
      if (!down) return;
      t.held = false;
      if (!down.moved && only < 0.5) { t.target = t.target > 0.5 ? 0 : 1; t.thaw.fill(0); kick(); }
      down = null; kick();
    };
    t.cv.addEventListener('pointerup', up);
    t.cv.addEventListener('pointercancel', up);
    t.cv.addEventListener('pointerleave', () => { t.held = false; kick(); });
  });

  // only render prints that are on screen
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    const t = tiles.find((x) => x.fig === en.target); if (!t) return;
    t.visible = en.isIntersecting; if (t.visible) { t.dirty = true; kick(); }
  }), { rootMargin: '200px' });
  tiles.forEach((t) => io.observe(t.fig));

  return root;
}

/*
 * Leaf type (Spring Mix): a type tester set in the lettuce-and-spinach letters,
 * cut glyph by glyph from the original specimen, plus the full character set.
 * Usage: { type: 'leaftype', sprite: 'glyphs.webp', glyphs: { A: [x, y, w, h, top, advance], … }, text: 'ORGANIC' }
 *   top is the glyph tile's top edge relative to the baseline (source px); tiles carry 10px padding.
 */
const LT_PAD = 10, LT_CAP = 112, LT_TRACK = 8, LT_SPACE = 46;
export function createLeafType(cfg, src) {
  const G = cfg.glyphs;
  const sprite = new Image();
  const reduce = prefersReducedMotion();
  let mode = 'lt', ground = 'paper', seed = 1, text = cfg.text || 'ORGANIC';
  const born = new Map();                     // letter index -> time it was typed, for the drop-in

  const canvas = h('canvas', { class: 'lt__canvas', 'aria-hidden': 'true' });
  const input = h('input', { class: 'lt__input', type: 'text', value: text, maxlength: '48', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Type to set text in Spring Mix' });
  const pick = (t) => { input.value = t; setText(t, true); };
  const chips = (cfg.presets || ['ORGANIC', 'Fresh picked', 'All natural?!', 'Spring Mix']).map((t) => h('button', { class: 'lt__chip mono', type: 'button', onclick: () => pick(t) }, t));
  const seg = (label, opts, get, set) => h('span', { class: 'melt__modes', role: 'group', 'aria-label': label }, opts.map(([k, l]) => {
    const b = h('button', { class: 'melt__mode mono', type: 'button', 'aria-pressed': String(get() === k), onclick: () => { set(k); b.parentNode.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); paintSet(); } }, l);
    return b;
  }));
  const toss = h('button', { class: 'melt__mode mono lt__toss', type: 'button', onclick: () => { seed++; born.clear(); const now = performance.now(); [...input.value].forEach((_, i) => born.set(i, now + i * 18)); loop(); } }, 'Toss ↻');
  const stage = h('div', { class: 'lt__stage' }, canvas, input);
  const bar = h('div', { class: 'lt__bar' },
    h('div', { class: 'lt__chips' }, chips),
    h('div', { class: 'lt__opts' },
      seg('Letter style', [['lt', 'Leaf'], ['cut', 'Cut-out']], () => mode, (v) => { mode = v; }),
      seg('Ground', [['paper', 'Paper'], ['soil', 'Soil']], () => ground, (v) => { ground = v; root.classList.toggle('is-soil', v === 'soil'); }),
      toss));

  /* the character set */
  const order = Object.keys(G);
  const cells = order.map((c) => {
    const cv = h('canvas', { 'aria-hidden': 'true' });
    return { c, cv, el: h('li', { class: 'lt__cell', title: c, onclick: () => { input.value = (input.value + c).slice(-48); setText(input.value, true); input.focus({ preventScroll: true }); } }, cv, h('span', { class: 'mono' }, c)) };
  });
  const set = h('div', { class: 'lt__set' },
    h('p', { class: 'lt__set-h mono' }, h('span', {}, `Character set · ${order.length} glyphs`), h('span', {}, 'Click a letter to add it')),
    h('ul', { class: 'lt__grid' }, cells.map((x) => x.el)));
  const root = h('div', { class: 'lt is-loading' }, bar, stage, set);

  const rand = (i) => { const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  const glyphOf = (ch) => G[ch] || G[ch.toUpperCase()] || G[ch.toLowerCase()] || null;
  const tint = document.createElement('canvas'); const tctx = tint.getContext('2d');
  function drawGlyph(ctx, g, x, y, s, rot) {
    const [sx, sy, w, hh] = g;
    ctx.save(); ctx.translate(x + (w * s) / 2, y + (hh * s) / 2); ctx.rotate(rot);
    if (mode === 'lt') ctx.drawImage(sprite, sx, sy, w, hh, (-w * s) / 2, (-hh * s) / 2, w * s, hh * s);
    else {
      tint.width = w; tint.height = hh; tctx.clearRect(0, 0, w, hh);
      tctx.globalCompositeOperation = 'source-over'; tctx.drawImage(sprite, sx, sy, w, hh, 0, 0, w, hh);
      tctx.globalCompositeOperation = 'source-in'; tctx.fillStyle = ground === 'soil' ? '#EDEAE2' : '#1C2A12'; tctx.fillRect(0, 0, w, hh);
      ctx.drawImage(tint, (-w * s) / 2, (-hh * s) / 2, w * s, hh * s);
    }
    ctx.restore();
  }

  function layout(str, maxW) {
    // words -> lines at native size
    const words = str.split(/(\s+)/); const lines = [[]]; let x = 0;
    const wordW = (w) => [...w].reduce((a, ch) => a + (glyphOf(ch) ? glyphOf(ch)[5] + LT_TRACK : 0), 0);
    for (const w of words) {
      if (/^\s+$/.test(w)) { x += LT_SPACE * w.length; lines.at(-1).push({ sp: LT_SPACE * w.length }); continue; }
      const ww = wordW(w);
      if (x > 0 && x + ww > maxW) { lines.push([]); x = 0; }
      lines.at(-1).push({ w }); x += ww;
    }
    return lines.map((l) => { while (l.length && l.at(-1).sp) l.pop(); return l; });
  }

  let raf = 0;
  function draw() {
    const ctx = canvas.getContext('2d');
    const W = stage.clientWidth, H = stage.clientHeight; if (!W) return false;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!sprite.complete || !sprite.naturalWidth) return false;
    const str = input.value || ' ';
    // the largest size at which the text fits in at most 3 lines
    const padX = Math.max(20, W * 0.05), avail = W - padX * 2, availH = H - 90;
    let s = Math.min(1.5, availH / (LT_CAP * 1.5)), lines;
    const lineW = (l) => l.reduce((a, t) => a + (t.sp ?? [...t.w].reduce((q, ch) => q + (glyphOf(ch) ? glyphOf(ch)[5] + LT_TRACK : 0), 0)), 0);
    for (; s > 0.2; s *= 0.94) { lines = layout(str, avail / s); const lh = LT_CAP * 1.42 * s; if (lines.length * lh <= availH && lines.length <= 3 && Math.max(...lines.map(lineW)) * s <= avail) break; }
    const lh = LT_CAP * 1.42 * s;
    const now = performance.now(); let busy = false, idx = 0;
    const top = (H - 50 - lines.length * lh) / 2 + 20;
    lines.forEach((line, li) => {
      const widths = line.map((t) => t.sp ?? [...t.w].reduce((a, ch) => a + (glyphOf(ch) ? glyphOf(ch)[5] + LT_TRACK : 0), 0));
      let x = (W - widths.reduce((a, b) => a + b, 0) * s) / 2;
      const base = top + li * lh + LT_CAP * s * 1.05;
      line.forEach((t, ti) => {
        if (t.sp) { x += t.sp * s; return; }
        for (const ch of t.w) {
          const g = glyphOf(ch); const i = idx++;
          while (/\s/.test(str[idx - 1] ?? '') && idx < str.length) idx++;
          if (!g) continue;
          const t0 = born.get(i); let k = 1;
          if (t0 !== undefined && !reduce) { k = Math.min(1, Math.max(0, (now - t0) / 520)); if (k < 1) busy = true; }
          const e = 1 - Math.pow(1 - k, 3);
          const rot = (rand(i) - 0.5) * 0.12 + (1 - e) * (rand(i + 99) - 0.5) * 1.2;
          const dy = (rand(i + 7) - 0.5) * 6 * s - (1 - e) * 60 * s;
          ctx.globalAlpha = Math.min(1, e * 1.6);
          drawGlyph(ctx, g, x - LT_PAD * s, base + g[4] * s + dy, s, rot);
          ctx.globalAlpha = 1;
          x += (g[5] + LT_TRACK) * s;
        }
      });
      idx++; // the space that broke the line
    });
    return busy;
  }
  function loop() { cancelAnimationFrame(raf); const step = () => { raf = draw() ? requestAnimationFrame(step) : 0; }; step(); }

  function paintSet() {
    if (!sprite.naturalWidth) return;
    cells.forEach(({ c, cv }) => {
      const g = G[c]; const box = 150; const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = box * dpr; cv.height = box * dpr; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = 0.95; const x = (box - g[2] * s) / 2; const y = box * 0.74 + g[4] * s;
      drawGlyph(ctx, g, x, y, s, 0);
    });
  }

  function setText(t, typed) {
    const prev = text; text = t;
    // letters that are new since the last frame drop in
    if (typed) {
      const now = performance.now(); let p = 0;
      while (p < prev.length && p < t.length && prev[p] === t[p]) p++;
      for (const k of [...born.keys()]) if (k >= p) born.delete(k);
      for (let i = p; i < t.length; i++) born.set(i, now + (i - p) * 40);
    }
    loop();
  }
  input.addEventListener('input', () => setText(input.value, true));
  new ResizeObserver(() => { loop(); }).observe(stage);
  sprite.onload = () => { root.classList.remove('is-loading'); const now = performance.now(); [...text].forEach((_, i) => born.set(i, now + 300 + i * 70)); paintSet(); loop(); };
  sprite.src = src(cfg.sprite);
  return root;
}

/*
 * Turntable (Rhythm of Solar Term): the 24 calendar records, four seasons of six.
 * Pick a season sleeve, drop a record on the platter; the arm comes in, the record turns,
 * and the term's sound-pattern blooms behind the deck. Drag the record to spin it by hand.
 * Usage: { type: 'turntable', labels: 'labels.webp', patterns: 'patterns.webp', sleeves: 'sleeves.webp', terms: [{ cn, en, date, ph }, … 24] }
 *   labels / patterns: 6×4 sprites in term order; sleeves: 2×2 sprite (spring, summer, autumn, winter).
 */
const TT_SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const TT_TINT = ['#9FE3C8', '#E6A6DC', '#F0C6A0', '#A9CDF2'];
export function createTurntable(cfg, src) {
  const T = cfg.terms; const reduce = prefersReducedMotion();
  const spriteAt = (el, file, i, cols, rows) => {
    el.style.backgroundImage = `url("${src(file)}")`;
    el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
    el.style.backgroundPosition = `${(i % cols) * 100 / (cols - 1)}% ${Math.floor(i / cols) * 100 / (rows - 1)}%`;
  };
  let season = 0, cur = -1, playing = false, angle = 0, speed = 0, prog = 0, drag = null, raf = 0, lastT = 0, inView = false;

  /* deck */
  const bloom = h('div', { class: 'tt__bloom', 'aria-hidden': 'true' });
  const label = h('div', { class: 'tt__label' });
  const disc = h('div', { class: 'tt__disc' }, h('div', { class: 'tt__grooves' }), label, h('i', { class: 'tt__hole' }));
  const sheen = h('div', { class: 'tt__sheen', 'aria-hidden': 'true' });
  const record = h('div', { class: 'tt__record is-empty' }, disc, sheen);
  const arm = h('div', { class: 'tt__arm', 'aria-hidden': 'true' },
    h('i', { class: 'tt__arm-base' }), h('i', { class: 'tt__arm-rod' }), h('i', { class: 'tt__arm-head' }));
  const platter = h('div', { class: 'tt__platter' }, record, h('i', { class: 'tt__spindle' }));
  const hint = h('p', { class: 'tt__hint mono' }, 'Choose a record →');
  const deck = h('div', { class: 'tt__deck' }, h('div', { class: 'tt__plinth' }, platter, arm, h('i', { class: 'tt__led' })), hint);

  /* now playing */
  const npCn = h('span', { class: 'tt__cn' }), npEn = h('span', { class: 'tt__en' }), npDate = h('span', { class: 'tt__date mono' }), npPh = h('span', { class: 'tt__ph' });
  const btn = (t, l, f) => h('button', { class: 'tt__btn mono', type: 'button', 'aria-label': l, onclick: f }, t);
  const playBtn = btn('▶', 'Play', () => (cur < 0 ? load(season * 6) : setPlaying(!playing)));
  const bar = h('i', { class: 'tt__prog' });
  const now = h('div', { class: 'tt__now', 'aria-live': 'polite' },
    h('p', { class: 'tt__np-k mono' }, h('span', { class: 'tt__np-n' }, '—'), ' / 24'),
    h('p', { class: 'tt__np' }, npCn, npEn), npDate, npPh,
    h('div', { class: 'tt__ctl' }, btn('⏮', 'Previous term', () => load((Math.max(cur, 0) + 23) % 24)), playBtn, btn('⏭', 'Next term', () => load((cur + 1) % 24)), h('span', { class: 'tt__progwrap' }, bar)));

  /* crate */
  const sleeves = TT_SEASONS.map((s, i) => {
    const art = h('span', { class: 'tt__sleeve-art' }); spriteAt(art, cfg.sleeves, i, 2, 2);
    return h('button', { class: 'tt__sleeve', type: 'button', 'aria-pressed': String(i === 0), style: { '--tint': TT_TINT[i] }, onclick: () => showSeason(i) }, art, h('span', { class: 'mono' }, s));
  });
  const shelf = h('ol', { class: 'tt__shelf' });
  const crate = h('div', { class: 'tt__crate' }, h('div', { class: 'tt__sleeves' }, sleeves), shelf);
  const root = h('div', { class: 'tt' }, h('div', { class: 'tt__stage' }, bloom, deck), h('div', { class: 'tt__side' }, now, crate),
    h('p', { class: 'tt__note mono' }, 'The records are silent here — the film below plays them.'));

  function showSeason(s) {
    season = s;
    sleeves.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s)));
    root.style.setProperty('--tint', TT_TINT[s]);
    shelf.replaceChildren(...T.slice(s * 6, s * 6 + 6).map((t, k) => {
      const i = s * 6 + k; const lab = h('span', { class: 'tt__mini-label' }); spriteAt(lab, cfg.labels, i, 6, 4);
      return h('li', {}, h('button', { class: `tt__pick${i === cur ? ' is-on' : ''}`, type: 'button', onclick: () => load(i), 'aria-label': `${t.en}, ${t.date}` },
        h('span', { class: 'tt__mini' }, lab), h('span', { class: 'tt__pick-cn' }, t.cn), h('span', { class: 'tt__pick-en mono' }, t.en), h('span', { class: 'tt__pick-d mono' }, t.date)));
    }));
  }
  function load(i) {
    const swap = cur >= 0;
    cur = i; prog = 0;
    if (Math.floor(i / 6) !== season) showSeason(Math.floor(i / 6)); else shelf.querySelectorAll('.tt__pick').forEach((b, k) => b.classList.toggle('is-on', season * 6 + k === i));
    const t = T[i];
    root.querySelector('.tt__np-n').textContent = String(i + 1).padStart(2, '0');
    npCn.textContent = t.cn; npEn.textContent = t.en; npDate.textContent = `${t.date}, 2025`; npPh.textContent = `“${t.ph}”`;
    root.style.setProperty('--tint', TT_TINT[Math.floor(i / 6)]);
    hint.classList.add('is-off');
    setPlaying(false);
    record.classList.add('is-out');
    setTimeout(() => {
      spriteAt(label, cfg.labels, i, 6, 4); spriteAt(bloom, cfg.patterns, i, 6, 4);
      record.classList.remove('is-empty', 'is-out'); angle = Math.random() * 360;
      setTimeout(() => setPlaying(true), reduce ? 0 : 450);
    }, swap && !reduce ? 380 : 0);
  }
  function setPlaying(on) {
    playing = on && cur >= 0;
    root.classList.toggle('is-playing', playing);
    playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    tick();
  }
  const DUR = 14;   // seconds a record turns before the next term comes round
  function frame(ts) {
    raf = 0;
    const dt = Math.min(0.05, lastT ? (ts - lastT) / 1000 : 0.016); lastT = ts;
    const target = playing && !drag ? 200 : 0;            // ~33⅓ rpm
    speed += (target - speed) * Math.min(1, dt * (playing ? 2.2 : 1.4));
    if (!drag) angle += speed * dt * (reduce ? 0.25 : 1);
    if (playing && !drag) { prog += dt / DUR; if (prog >= 1) { load((cur + 1) % 24); } }
    disc.style.transform = `rotate(${angle}deg)`;
    bar.style.transform = `scaleX(${prog})`;
    // the arm rests at 0°, lands at 27° on the lead-in and travels to 43° by the label
    const a = cur < 0 || (!playing && prog === 0) ? 0 : 27 + prog * 16;
    arm.style.transform = `rotate(${a}deg)`;
    bloom.style.transform = `translate(-50%, -50%) rotate(${angle * 0.08}deg) scale(${0.9 + Math.min(1, speed / 200) * 0.18})`;
    if (inView && (playing || Math.abs(speed) > 0.5 || drag)) tick(); else lastT = 0;
  }
  function tick() { if (!raf) raf = requestAnimationFrame(frame); }

  // spin the record by hand
  const centre = () => { const r = record.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  record.addEventListener('pointerdown', (e) => {
    if (cur < 0) return;
    const [cx, cy] = centre(); drag = { a0: Math.atan2(e.clientY - cy, e.clientX - cx), ang: angle, cx, cy, t: performance.now(), last: angle };
    record.setPointerCapture(e.pointerId); record.classList.add('is-grab'); tick();
  });
  record.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
    const na = drag.ang + (a - drag.a0) * 180 / Math.PI; const t = performance.now();
    speed = (na - drag.last) / Math.max(0.008, (t - drag.t) / 1000); drag.last = na; drag.t = t; angle = na;
    disc.style.transform = `rotate(${angle}deg)`;
  });
  const end = () => { if (!drag) return; drag = null; record.classList.remove('is-grab'); tick(); };
  record.addEventListener('pointerup', end); record.addEventListener('pointercancel', end);

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView) tick(); }).observe(root);
  showSeason(0);
  return root;
}
