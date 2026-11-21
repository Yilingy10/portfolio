/*
 * Flip book. Give it a list of single page images (cover first).
 * Click / tap the right page to turn forward, the left page to go back.
 * Arrow keys work when the book has focus; swipe works on touch.
 */
import { h, clamp } from '../lib/util.js';
import { openLightbox } from './lightbox.js';

export function createBook(pages, { title = 'Book' } = {}) {
  const leaves = [];
  const leafCount = Math.ceil(pages.length / 2);
  let flipped = 0; // number of leaves turned
  const inner = h('div', { class: 'book__inner' });
  const stage = h('div', { class: 'book__stage', tabindex: '0', role: 'group', 'aria-roledescription': 'book', 'aria-label': `${title}. Use the arrow keys to turn pages.` }, inner);
  const count = h('span', { class: 'book__count mono', 'aria-live': 'polite' });
  const prev = h('button', { class: 'icon-btn', 'aria-label': 'Previous page', onclick: () => turn(-1) }, '←');
  const next = h('button', { class: 'icon-btn', 'aria-label': 'Next page', onclick: () => turn(1) }, '→');
  const all = h('button', { class: 'btn btn--ghost', onclick: () => openLightbox(pages.map((src, i) => ({ src, caption: `Page ${i + 1}` })), pageIndex()) }, 'View pages full size');

  for (let k = 0; k < leafCount; k++) {
    const front = pages[2 * k], back = pages[2 * k + 1];
    const leaf = h('div', { class: 'leaf' },
      h('div', { class: 'leaf__face leaf__face--front' }, h('img', { src: front, alt: `Page ${2 * k + 1}`, loading: k < 2 ? 'eager' : 'lazy', decoding: 'async', draggable: 'false' })),
      h('div', { class: 'leaf__face leaf__face--back' }, back ? h('img', { src: back, alt: `Page ${2 * k + 2}`, loading: 'lazy', decoding: 'async', draggable: 'false' }) : null),
    );
    leaf.addEventListener('click', () => turn(leaf.classList.contains('is-flipped') ? -1 : 1));
    leaves.push(leaf);
    inner.append(leaf);
  }

  function pageIndex() { return clamp(flipped * 2 - 1, 0, pages.length - 1); }
  function layout() {
    leaves.forEach((leaf, k) => {
      const isF = k < flipped;
      leaf.classList.toggle('is-flipped', isF);
      leaf.style.zIndex = isF ? String(k + 1) : String(leafCount - k + 1);
    });
    // closed book sits centred; open book centres on the spine
    const shift = flipped === 0 ? '-25%' : flipped === leafCount && pages.length % 2 === 0 ? '25%' : '0%';
    inner.style.transform = `translateX(${shift})`;
    prev.disabled = flipped === 0; next.disabled = flipped === leafCount;
    const l = flipped * 2, r = flipped * 2 + 1;
    count.textContent = flipped === 0 ? `Cover · ${pages.length} pages`
      : r <= pages.length ? `Pages ${l}–${Math.min(r, pages.length)} of ${pages.length}` : `Back cover`;
  }
  function turn(d) { flipped = clamp(flipped + d, 0, leafCount); layout(); }

  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
  });
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (sx != null && Math.abs(e.clientX - sx) > 40) turn(e.clientX < sx ? 1 : -1);
    sx = null;
  });

  // size: pages fit the available width and ~70% of the viewport height
  const img0 = new Image();
  img0.src = pages[0];
  function size() {
    const ratio = (img0.naturalHeight / img0.naturalWidth) || 1.5;
    const w = stage.clientWidth || window.innerWidth;
    const maxH = window.innerHeight * 0.7;
    const pw = Math.floor(Math.min((w - 40) / 2, maxH / ratio, 520));
    inner.style.setProperty('--pw', pw + 'px');
    inner.style.setProperty('--ratio', ratio);
  }
  img0.onload = size;
  const ro = new ResizeObserver(size);
  ro.observe(stage);
  layout();

  return h('div', { class: 'book' }, stage, h('div', { class: 'book__ctrl' }, prev, count, next), all);
}
