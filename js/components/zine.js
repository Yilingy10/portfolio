import { h } from '../lib/util.js';

/* A ring-bound zine whose pages are cut into three strips, shown open as a spread.
 * Each strip row turns on its own (click a strip, or swipe it), so the pages mix;
 * the arrows turn all three rows together. Single pages come from one sprite (cols × rows),
 * page 0 is the front cover (right side only), the last page the back cover (left side only). */
export function createStripZine(cfg, src) {
  const { sheet, pages, cols = 6, rows = 5, ratio = 560 / 794, bands = 3 } = cfg;
  const spreads = Math.floor(pages / 2) + 1;           // spread j: left = 2j-1, right = 2j
  const at = Array(bands).fill(0);
  const slices = bands * rows;
  const paint = (el, page, k) => {
    if (page < 0 || page >= pages) { el.style.backgroundImage = 'none'; el.classList.add('is-empty'); return; }
    el.classList.remove('is-empty');
    const c = page % cols, r = Math.floor(page / cols);
    el.style.backgroundImage = `url("${src(sheet)}")`;
    el.style.backgroundSize = `${cols * 100}% ${slices * 100}%`;
    el.style.backgroundPosition = `${(c / (cols - 1)) * 100}% ${((r * bands + k) / (slices - 1)) * 100}%`;
  };
  const count = h('span', { class: 'zn__count mono' });
  const rowsEl = at.map((_, k) => {
    const L = h('div', { class: 'zn__half zn__half--l' }), R = h('div', { class: 'zn__half zn__half--r' });
    const row = h('div', { class: 'zn__row' }, L, R);
    paint(L, -1, k); paint(R, 0, k);
    let x0 = null, side = 1;
    row.addEventListener('pointerdown', (e) => { x0 = e.clientX; const b = row.getBoundingClientRect(); side = e.clientX > b.left + b.width / 2 ? 1 : -1; });
    row.addEventListener('pointerup', (e) => {
      if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
      turn(k, Math.abs(dx) > 24 ? (dx < 0 ? 1 : -1) : side);
    });
    return { row, L, R };
  });
  function turn(k, d) {
    const j = at[k], n = j + d;
    if (n < 0 || n >= spreads) return;
    const { row, L, R } = rowsEl[k];
    // the leaf that turns: forward it carries the right strip over to the left
    const front = h('div', { class: 'zn__leaf-face' }), back = h('div', { class: 'zn__leaf-face zn__leaf-face--back' });
    const leaf = h('div', { class: `zn__leaf zn__leaf--${d > 0 ? 'fwd' : 'back'}` }, front, back);
    if (d > 0) { paint(front, 2 * j, k); paint(back, 2 * n - 1, k); paint(R, 2 * n, k); }
    else { paint(front, 2 * j - 1, k); paint(back, 2 * n, k); paint(L, 2 * n - 1, k); }
    row.append(leaf);
    at[k] = n;
    setTimeout(() => { if (d > 0) paint(L, 2 * n - 1, k); else paint(R, 2 * n, k); leaf.remove(); }, 640);
    label();
  }
  const all = (d) => at.forEach((_, k) => setTimeout(() => turn(k, d), k * 80));
  const mix = () => at.forEach((v, k) => setTimeout(() => {
    let n = v; while (n === v) n = 1 + Math.floor(Math.random() * (spreads - 2));
    turn(k, n - v);
  }, k * 110));
  function label() {
    const same = at.every((v) => v === at[0]);
    const name = (j) => (j === 0 ? 'Cover' : j === spreads - 1 ? 'Back' : String(j).padStart(2, '0'));
    count.textContent = same ? name(at[0]) : at.map(name).join(' · ');
  }
  label();
  const book = h('div', { class: 'zn__book', style: { '--ratio': String(ratio) } },
    h('div', { class: 'zn__spine', 'aria-hidden': 'true' }, at.map(() => h('span'))),
    rowsEl.map((r) => r.row));
  book.tabIndex = 0;
  book.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') all(1); if (e.key === 'ArrowLeft') all(-1); });
  return h('div', { class: 'zn' },
    h('p', { class: 'zn__hint' }, cfg.hint || 'Every page is cut into three strips. Click or swipe a strip to turn it on its own.'),
    book,
    h('div', { class: 'zn__bar' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous spread', onclick: () => all(-1) }, '←'),
      count,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next spread', onclick: () => all(1) }, '→'),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: mix }, 'Mix the strips')));
}
