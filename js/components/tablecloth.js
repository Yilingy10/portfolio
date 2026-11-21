/*
 * "A Dish & A Memory": the order-slip probe as a toy.
 * Stamp boxes on the slip with one of the five flower stamps → the matching embroidered moment
 * is stitched onto the blue tablecloth. Draw in the sketch box and sew your drawing on too.
 */
import { h, prefersReducedMotion } from '../lib/util.js';
import { openLightbox } from './lightbox.js';

// five stamps, after the real ones (colour + flower)
const STAMPS = [
  { id: 'pink', color: '#f0566a', svg: '<path d="M12 2.5c1.6 0 2.4 2 2 4.3 1.9-1.4 4.1-1.5 4.9 0 .8 1.4-.6 3.1-2.8 3.9 2.2.8 3.6 2.5 2.8 3.9-.8 1.5-3 1.4-4.9 0 .4 2.3-.4 4.3-2 4.3s-2.4-2-2-4.3c-1.9 1.4-4.1 1.5-4.9 0-.8-1.4.6-3.1 2.8-3.9C5.7 9.9 4.3 8.2 5.1 6.8c.8-1.5 3-1.4 4.9 0-.4-2.3.4-4.3 2-4.3z" fill="currentColor"/><circle cx="12" cy="10.7" r="1.6" fill="#fff"/>' },
  { id: 'blue', color: '#2f5fe0', svg: '<g fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="6.2" rx="2.4" ry="4"/><ellipse cx="12" cy="17.8" rx="2.4" ry="4"/><ellipse cx="6.2" cy="12" rx="4" ry="2.4"/><ellipse cx="17.8" cy="12" rx="4" ry="2.4"/><circle cx="12" cy="12" r="1.4"/></g>' },
  { id: 'red', color: '#e8352a', svg: '<g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="5.8" r="3.6"/><circle cx="18" cy="10.3" r="3.6"/><circle cx="15.7" cy="17.4" r="3.6"/><circle cx="8.3" cy="17.4" r="3.6"/><circle cx="6" cy="10.3" r="3.6"/></g><circle cx="12" cy="12" r="1.5" fill="currentColor"/>' },
  { id: 'purple', color: '#9a52c4', svg: '<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="5.3" r="2.6"/><circle cx="18.4" cy="10" r="2.6"/><circle cx="16" cy="17.5" r="2.6"/><circle cx="8" cy="17.5" r="2.6"/><circle cx="5.6" cy="10" r="2.6"/></g>' },
  { id: 'green', color: '#2c8a43', svg: '<g fill="currentColor"><circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="5.4" r="2.4"/><circle cx="18.2" cy="9.6" r="2.4"/><circle cx="16" cy="17" r="2.4"/><circle cx="8" cy="17" r="2.4"/><circle cx="5.8" cy="9.6" r="2.4"/></g>' },
];
const stampSvg = (s) => `<svg viewBox="0 0 24 24" aria-hidden="true" style="color:${s.color}">${s.svg}</svg>`;

// slip sections → which embroidered moment each box calls up (stitch-NN.webp)
const SLIP = [
  ['Items', [['Rice', 7], ['Noodles', 4], ['Soup', 1], ['Tea', 6], ['Meat / roast', 10], ['Drink', 13]]],
  ['Party', [['Alone', 9], ['Family', 12], ['Friend', 11], ['Partner', 7], ['Coworker', 13], ['Classmate', 3]]],
];
const CAPTIONS = {
  1: 'Hot water, comfort', 2: 'Our time', 3: 'Talk longer', 4: 'Good noodles', 5: 'Flowers on the table', 6: 'Water rings',
  7: 'Share', 8: 'Every Saturday', 9: 'Office cat', 10: 'Fluency', 11: 'Laughter, chop, music', 12: 'Eat slowly, very hot',
  13: 'After lunch, rest', 14: 'Belonging, in many languages',
};
// fixed places on the cloth (percent): a loose 5 × 3 grid, so the cloth fills like the real one
const SPOTS = Array.from({ length: 15 }, (_, i) => {
  const r = Math.floor(i / 5), c = i % 5;
  return [6 + c * 18.6 + ((i * 37) % 5) - 2, 7 + r * 31 + ((i * 53) % 5) - 2, ((i * 29) % 9) - 4];
});

export function createTablecloth({ src }) {
  let stamp = STAMPS[1];
  const placed = new Map();          // patch number → element on the cloth
  const votes = new Map();           // patch number → how many boxes call it
  let free = SPOTS.map((_, i) => i);

  /* ── the cloth ── */
  const cloth = h('div', { class: 'tc__cloth', role: 'region', 'aria-label': 'Tablecloth' },
    h('p', { class: 'tc__empty mono' }, 'Stamp a box on the slip to stitch a moment here'));
  const count = h('span', { class: 'mono tc__count', 'aria-live': 'polite' }, '0 / 15 moments on the table');
  const update = () => {
    count.textContent = `${placed.size} / 15 moments on the table`;
    cloth.classList.toggle('has-patches', placed.size > 0);
  };
  // all 14 embroideries live in one 4 × 4 sprite (stitches.webp, 480 px cells)
  const SHEET = src('stitches.webp');
  const face = (n) => ({ backgroundImage: `url("${SHEET}")`, backgroundSize: '400% 400%',
    backgroundPosition: `${((n - 1) % 4) * 100 / 3}% ${Math.floor((n - 1) / 4) * 100 / 3}%` });
  function crop(n) { // one embroidery as its own image, for the lightbox
    return new Promise((res) => {
      const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 480;
        c.getContext('2d').drawImage(im, ((n - 1) % 4) * 480, Math.floor((n - 1) / 4) * 480, 480, 480, 0, 0, 480, 480);
        res(c.toDataURL('image/jpeg', 0.9));
      }; im.src = SHEET;
    });
  }
  function sew(key, imgSrc, caption) {
    if (placed.has(key) || !free.length) return;
    const slot = free.splice(Math.floor(((typeof key === 'number' ? key : key.length) * 7) % free.length), 1)[0];
    const [x, y, r] = SPOTS[slot];
    const art = typeof key === 'number'
      ? h('span', { class: 'tc__art', style: face(key) })
      : h('img', { src: imgSrc, alt: '', draggable: 'false' });
    const el = h('button', { type: 'button', class: 'tc__patch', 'aria-label': caption,
      style: { left: `${x}%`, top: `${y}%`, '--r': `${r}deg` } }, art, h('span', { class: 'tc__thread' }));
    el.dataset.slot = slot;
    el.addEventListener('click', async () => openLightbox([{ src: typeof key === 'number' ? await crop(key) : imgSrc, caption }], 0));
    cloth.append(el);
    placed.set(key, el);
    if (prefersReducedMotion()) el.classList.add('is-in'); else requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    update();
  }
  function unsew(key) {
    const el = placed.get(key); if (!el) return;
    free.push(+el.dataset.slot);
    el.classList.remove('is-in'); el.classList.add('is-out');
    setTimeout(() => el.remove(), prefersReducedMotion() ? 0 : 350);
    placed.delete(key); update();
  }

  /* ── the slip ── */
  const stampBar = h('div', { class: 'tc__stamps', role: 'radiogroup', 'aria-label': 'Choose a stamp' }, STAMPS.map((s, i) => {
    const b = h('button', { type: 'button', class: 'tc__stamp', role: 'radio', 'aria-checked': String(s === stamp), 'aria-label': `${s.id} flower stamp`, html: stampSvg(s) });
    b.addEventListener('click', () => { stamp = s; [...stampBar.children].forEach((x, k) => x.setAttribute('aria-checked', String(k === i))); pen.color = s.color; });
    return b;
  }));
  const sections = SLIP.map(([title, opts]) => h('div', { class: 'tc__sec' },
    h('div', { class: 'tc__sec-h' }, title),
    h('div', { class: 'tc__opts' }, opts.map(([label, n]) => {
      const box = h('span', { class: 'tc__box' });
      const b = h('button', { type: 'button', class: 'tc__opt', 'aria-pressed': 'false' }, h('span', {}, label), box);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on) {
          box.innerHTML = stampSvg(stamp);
          box.firstChild.style.transform = `rotate(${Math.round(Math.random() * 60 - 30)}deg)`;
          votes.set(n, (votes.get(n) || 0) + 1);
          sew(n, null, CAPTIONS[n]);
        } else {
          box.innerHTML = '';
          votes.set(n, (votes.get(n) || 1) - 1);
          if (!votes.get(n)) unsew(n);
        }
      });
      return b;
    }))));

  /* ── sketch box: draw with a zigzag stitch, then sew it on ── */
  const cv = h('canvas', { class: 'tc__canvas', width: '600', height: '240', 'aria-label': 'Sketch area: draw with the stitch' });
  const ctx = cv.getContext('2d');
  const pen = { color: stamp.color, last: null, dist: 0, side: 1, drawn: false };
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pen.last = pt(e); pen.dist = 0; });
  cv.addEventListener('pointermove', (e) => {
    if (!pen.last) return;
    const p = pt(e), [lx, ly] = pen.last, dx = p[0] - lx, dy = p[1] - ly, d = Math.hypot(dx, dy);
    if (d < 5) return;
    const nx = -dy / d, ny = dx / d, amp = 4.5;
    ctx.strokeStyle = pen.color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(lx + nx * amp * pen.side, ly + ny * amp * pen.side);
    pen.side *= -1;
    ctx.lineTo(p[0] + nx * amp * pen.side, p[1] + ny * amp * pen.side); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(p[0] + nx * amp * pen.side - 0.8, p[1] + ny * amp * pen.side - 0.8, 1.6, 1.6); // needle holes
    pen.last = p; pen.drawn = true; sewBtn.disabled = false;
  });
  const end = () => { pen.last = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const clearSketch = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); pen.drawn = false; sewBtn.disabled = true; };
  let mine = 0;
  const sewBtn = h('button', { type: 'button', class: 'btn tc__sew', disabled: true, onclick: () => {
    if (!pen.drawn) return;
    const sq = document.createElement('canvas'); sq.width = sq.height = 360;
    const c2 = sq.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, 360, 360);
    c2.drawImage(cv, 0, 0, 600, 240, 0, 108, 360, 144);   // whole sketch, centred on a square patch
    mine += 1;
    sew(`mine-${mine}`, sq.toDataURL('image/png'), 'Your sketch');
    clearSketch();
  } }, 'Sew it onto the cloth');
  clearSketch();

  const slip = h('div', { class: 'tc__slip' },
    h('div', { class: 'tc__head' }, h('div', { class: 'tc__title' }, "Today's special"), h('div', { class: 'tc__sub' }, 'A Dish & A Memory')),
    h('p', { class: 'tc__note' }, 'Please leave a trace of this meal.'),
    h('div', { class: 'tc__stampbar' }, h('span', { class: 'mono' }, 'Stamp'), stampBar),
    sections,
    h('div', { class: 'tc__sec' }, h('div', { class: 'tc__sec-h tc__sec-h--row' }, 'Sketch', h('span', { class: 'tc__hint' }, 'Draw what feels familiar at this table.')), cv,
      h('div', { class: 'tc__sketchctrl' }, sewBtn, h('button', { type: 'button', class: 'tc__link', onclick: clearSketch }, 'Clear'))),
  );

  const reset = h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => {
    [...placed.keys()].forEach(unsew); votes.clear();
    slip.querySelectorAll('.tc__opt').forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.querySelector('.tc__box').innerHTML = ''; });
  } }, 'Clear the table');

  return h('div', { class: 'tc' }, slip, h('div', { class: 'tc__right' }, cloth, h('div', { class: 'tc__ctrl' }, count, reset)));
}
