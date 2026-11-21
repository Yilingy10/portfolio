/* Small helpers shared by every view. */

/** h('div', {class:'x', onclick: fn}, child, 'text', [more]) → HTMLElement */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.entries(v).forEach(([sk, sv]) => (sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv)));
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => window.matchMedia('(hover: none)').matches;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Image path helper.
 *  'install-01'          → assets/work/<slug>/install-01-lg.webp (or -sm)
 *  'photo.jpg'           → assets/work/<slug>/photo.jpg
 *  'assets/x.jpg' / URL  → used as is
 */
export function media(slug, ref, size = 'lg') {
  if (!ref) return '';
  if (/^(https?:|\/|assets\/)/.test(ref)) return ref;
  if (/\.[a-z0-9]{2,4}$/i.test(ref)) return `assets/work/${slug}/${ref}`;
  // one file per image keeps the site under the host's file limit; the large version serves every size
  return `assets/work/${slug}/${ref}-lg.webp`;
}

/** Normalise an image entry: 'name' or {src, caption} → {src, caption} */
export const imgEntry = (e) => (typeof e === 'string' ? { src: e, caption: '' } : e);

/**
 * Split a word into letter spans and stretch each letter's width
 * (Anybody's wdth axis) according to how close the pointer is.
 */
export function stretchyType(el, { min = 70, max = 125, base = 100, radius = 220 } = {}) {
  const text = el.textContent;
  el.textContent = '';
  el.append(h('span', { class: 'sr-only' }, text));
  const spans = [];
  text.split(' ').forEach((word, wi) => {
    if (wi) el.append(' ');
    const w = h('span', { style: { whiteSpace: 'nowrap' }, 'aria-hidden': 'true' });
    for (const ch of word) { const s = h('span', { class: 'l' }, ch); w.append(s); spans.push(s); }
    el.append(w);
  });
  if (prefersReducedMotion() || isTouch()) return () => {};
  let raf = 0, px = -9999, py = -9999;
  const update = () => {
    raf = 0;
    for (const s of spans) {
      const r = s.getBoundingClientRect();
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      const k = clamp(1 - d / radius, 0, 1);
      const w = base + (k * k) * (max - base);
      s.style.fontVariationSettings = `'wdth' ${w.toFixed(1)}`;
    }
  };
  const move = (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(update); };
  const leave = () => { px = py = -9999; if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  return () => { window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
}

/** Test for WebGL without keeping a context around. */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch { return false; }
}
