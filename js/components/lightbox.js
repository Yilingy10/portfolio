/* Full-screen image viewer: click any project image. Esc closes, arrows step. */
import { h } from '../lib/util.js';

let box = null;

export function openLightbox(items, index = 0) {
  // items: [{ src, caption }]
  close();
  let i = index;
  const returnFocus = document.activeElement;
  const img = h('img', { alt: '' });
  const cap = h('span', { class: 'lightbox__cap mono' });
  const count = h('span', { class: 'mono' });
  const prev = h('button', { class: 'icon-btn', 'aria-label': 'Previous image', onclick: () => go(-1) }, '←');
  const next = h('button', { class: 'icon-btn', 'aria-label': 'Next image', onclick: () => go(1) }, '→');
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close viewer', onclick: close }, '✕');

  box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer' },
    h('div', { class: 'lightbox__bar' }, count, closeBtn),
    h('figure', { class: 'lightbox__fig', onclick: (e) => { if (e.target === e.currentTarget) close(); } }, img),
    h('div', { class: 'lightbox__nav' }, prev, cap, next),
  );

  function show() {
    const it = items[i];
    img.src = it.src;
    img.alt = it.caption || it.alt || '';
    cap.textContent = it.caption || '';
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    prev.disabled = i === 0; next.disabled = i === items.length - 1;
  }
  function go(d) { i = Math.min(items.length - 1, Math.max(0, i + d)); show(); }
  function key(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Tab') { // keep focus inside
      const f = [...box.querySelectorAll('button:not(:disabled)')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  // swipe
  let sx = null;
  box.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  box.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) go(e.clientX < sx ? 1 : -1); sx = null; });

  box._cleanup = () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; returnFocus?.focus?.(); };
  document.addEventListener('keydown', key);
  document.body.style.overflow = 'hidden';
  document.body.append(box);
  show();
  closeBtn.focus();
}

export function close() {
  if (!box) return;
  box._cleanup();
  box.remove();
  box = null;
}
