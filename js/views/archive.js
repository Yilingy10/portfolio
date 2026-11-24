/* ARCHIVE — the 2D catalogue with category filters.
   Covers keep their own proportions: each row is scaled so its images share one height
   and together fill the line exactly (a justified grid), so nothing gets cropped. */
import { projects, CATEGORIES, SELECTED, bySlug } from '../data/projects.js';
import { h, media, stretchyType, prefersReducedMotion } from '../lib/util.js';
import { footer } from './about.js';

const ratios = new Map(); // slug → cover width / height, measured once

function measure(p) {
  if (ratios.has(p.slug)) return Promise.resolve();
  return new Promise((res) => {
    const im = new Image();
    const done = () => { ratios.set(p.slug, im.naturalWidth ? im.naturalWidth / im.naturalHeight : 4 / 3); res(); };
    im.onload = done; im.onerror = done;
    setTimeout(done, 2500);
    im.src = media(p.slug, p.cover, 'sm');
  });
}

export function renderArchive(root, initial = '') {
  let current = ['Selected', ...CATEGORIES].find((c) => c.toLowerCase() === initial.toLowerCase()) || 'All';
  let list = [];
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, projects.filter((p) => p.categories.includes(c)).length]));

  const title = h('h1', {}, 'Archive');
  const countEl = h('b', {});
  const head = h('div', { class: 'archive-head' }, title,
    h('div', { class: 'count mono' }, countEl, h('span', {}, 'works shown')));

  const chips = ['All', 'Selected', ...CATEGORIES].map((c) => h('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(c === current),
    onclick: () => setFilter(c),
  }, c, h('sup', {}, c === 'All' ? projects.length : c === 'Selected' ? SELECTED.filter((x) => bySlug[x]).length : counts[c])));
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by category' },
    h('span', { class: 'filters__label mono' }, 'Show'), chips);

  const grid = h('ol', { class: 'jgrid', 'aria-live': 'polite' });

  const STILL = new Set(['mammals-with-headgear', 'puhpowee', 'frozen-flow', 'the-spiritual-journey', 'we-refuse-to-be-comfortable', 'hurricanes', 'i-think-i-understand-you', 'between-museum-and-park', 'rhythm-of-solar-term', 'eco-harmony-with-shu', 'trail-of-shu', 'a-day-in-dongba']);

  // a few images from inside the project, for the hover scrub
  function previews(p) {
    if (p.previews) return p.previews.slice(0, 6).map((r) => media(p.slug, r, 'sm'));
    const out = [p.cover];
    for (const b of p.blocks || []) {
      const list = b.src ? [b.src] : b.images || [];
      for (const e of list) { const ref = typeof e === 'string' ? e : e.src; if (ref && !out.includes(ref)) out.push(ref); }
      if (out.length >= 5) break;
    }
    return out.slice(0, 5).map((r) => media(p.slug, r, 'sm'));
  }

  // Two stacked images per card: the back one fades in over the front for the slow auto-cycle.
  function card(p) {
    const imgs = previews(p);
    const A = h('img', { src: imgs[0], alt: '', loading: 'lazy', decoding: 'async', class: 'card__img is-front' });
    const B = h('img', { alt: '', decoding: 'async', class: 'card__img' });
    const ticks = h('div', { class: 'card__ticks', 'aria-hidden': 'true' }, imgs.map((_, i) => h('span', { class: i ? '' : 'is-on' })));
    const media_ = h('div', { class: 'card__media' }, A, B, imgs.length > 1 ? ticks : null,
      h('div', { class: 'card__layer' }, h('p', {}, p.medium), h('span', { class: 'mono', 'aria-hidden': 'true' }, 'Open →')));
    let shown = 0, front = A, back = B, hovering = false;
    const mark = (i) => ticks.querySelectorAll('span').forEach((t, k) => t.classList.toggle('is-on', k === i));
    const show = (i, fade) => {
      if (i === shown) return;
      shown = i; mark(i);
      if (!fade) { front.src = imgs[i]; return; }
      back.src = imgs[i];
      const swap = () => { back.classList.add('is-front'); front.classList.remove('is-front'); [front, back] = [back, front]; };
      back.complete && back.naturalWidth ? swap() : back.addEventListener('load', swap, { once: true });
    };
    const li = h('li', { class: 'card', style: { '--accent': p.color || 'var(--blue)' } },
      h('a', { href: `#work-${p.slug}` },
        media_,
        h('div', { class: 'card__meta mono' }, h('span', {}, p.no), h('span', {}, p.year)),
        h('h2', { class: 'card__title' }, p.title),
        h('div', { class: 'card__cats mono' }, p.categories.map((c) => h('span', {}, c))),
        p.summary ? h('p', { class: 'card__summary' }, p.summary) : null,
        p.credits ? h('p', { class: 'card__credit mono' }, p.credits) : null,
      ));
    if (imgs.length > 1) {
      media_.addEventListener('pointerenter', () => { hovering = true; imgs.forEach((u) => { new Image().src = u; }); });
      media_.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = media_.getBoundingClientRect();
        show(Math.min(imgs.length - 1, Math.floor(((e.clientX - r.left) / r.width) * imgs.length)), false);
      });
      // these covers stay on their first image; they only scrub under the mouse
      const still = STILL.has(p.slug);
      media_.addEventListener('pointerleave', () => { hovering = false; if (still) show(0, false); });
      if (!still) li._advance = () => { if (!hovering) show((shown + 1) % imgs.length, true); };
    }
    return li;
  }

  function layout() {
    const W = grid.clientWidth;
    if (!W) return;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 24;
    const narrow = W < 560;
    const target = narrow ? 200 : W < 1000 ? 300 : Math.min(470, W / 3.1);
    const perWide = W < 1000 ? 2 : 3;
    const cards = [...grid.children];
    // group into rows per year, then justify each row to the full width
    const groups = [[]];
    cards.forEach((el) => {
      if (el.classList.contains('year-break')) {
        if (groups[groups.length - 1].length) groups.push([]);
        groups[groups.length - 1].sel = el.classList.contains('year-break--sel');
        return;
      }
      const ratio = Math.min(3.1, Math.max(0.6, ratios.get(el.dataset.slug) || 4 / 3));
      groups[groups.length - 1].push({ el, ratio });
    });
    groups.forEach((items) => {
      // phones: selected works one per row, everything else two per row
      const per = narrow ? (items.sel ? 1 : 2) : perWide;
      const rows = [[]];
      items.forEach((it) => {
        const row = rows[rows.length - 1];
        row.push(it);
        // wide screens: always three to a row (two on tablets), however wide the covers are
        if (per) { if (row.length === per) rows.push([]); return; }
        const sum = row.reduce((s, r) => s + r.ratio, 0);
        if (sum * target + gap * (row.length - 1) >= W) rows.push([]);
      });
      if (!rows[rows.length - 1].length) rows.pop();
      // never leave one lonely card at the end of a year
      if (!per && rows.length > 1 && rows[rows.length - 1].length === 1 && !narrow) rows[rows.length - 2].push(...rows.pop());
      let prev = target;
      rows.forEach((row, ri) => {
        const sum = row.reduce((s, r) => s + r.ratio, 0);
        let hgt = (W - gap * (row.length - 1)) / sum;
        // a short last row keeps the height of the row above instead of blowing up
        if (ri === rows.length - 1 && per && row.length < per) hgt = Math.min(hgt, prev);
        else if (ri === rows.length - 1 && hgt > target * 1.3) hgt = target;
        prev = hgt;
        if (narrow && per === 2) {
          const cw = Math.floor((W - gap) / 2);
          row.forEach((r) => { r.el.style.width = `${cw}px`; r.el.querySelector('.card__media').style.height = `${Math.floor(cw * 0.8)}px`; });
          return;
        }
        if (per === 1) hgt = W / Math.min(1.8, Math.max(1.15, row[0].ratio));
        row.forEach((r) => { if (per === 1) { r.el.style.width = `${Math.floor(W)}px`; r.el.querySelector('.card__media').style.height = `${Math.floor(hgt)}px`; return; } r.el.style.width = `${Math.floor(r.ratio * hgt)}px`; r.el.querySelector('.card__media').style.height = `${Math.floor(hgt)}px`; });
      });
    });
  }

  async function setFilter(c) {
    current = c;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.firstChild.textContent === c)));
    list = c === 'All' ? projects : c === 'Selected' ? SELECTED.map((x) => bySlug[x]).filter(Boolean) : projects.filter((p) => p.categories.includes(c));
    await Promise.all(list.map(measure));
    // "All" opens with the selected works, then everything else by year
    const groups = [];
    let rest = list;
    if (c === 'Selected') {
      groups.push({ label: 'Selected', note: `${list.length} works`, items: list, sel: true });
      rest = [];
    } else if (c === 'All') {
      const sel = SELECTED.map((s) => bySlug[s]).filter(Boolean);
      groups.push({ label: 'Selected', note: `${sel.length} works`, items: sel, sel: true });
      rest = list.filter((p) => !SELECTED.includes(p.slug));
    }
    [...new Set(rest.map((p) => p.year))].forEach((y) => {
      const items = rest.filter((p) => p.year === y);
      groups.push({ label: String(y), note: `${items.length} work${items.length > 1 ? 's' : ''}`, items });
    });
    const items = [];
    let i = 0;
    groups.forEach((g) => {
      items.push(h('li', { class: `year-break${g.sel ? ' year-break--sel' : ''}`, 'aria-hidden': 'true' },
        h('span', { class: 'year-break__y' }, g.label), h('span', { class: 'mono' }, g.note)));
      g.items.forEach((p) => {
        const el = card(p);
        el.dataset.slug = p.slug;
        el.classList.add('is-entering');
        el.style.animationDelay = `${Math.min(i++, 10) * 35}ms`;
        items.push(el);
      });
    });
    grid.replaceChildren(...items);
    layout();
    countEl.textContent = String(list.length).padStart(2, '0');
    const hash = c === 'All' ? '#archive' : `#archive-${c.toLowerCase()}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  root.append(h('div', { class: 'wrap page-top' }, head, filters, grid, footer()));
  // slow auto-cycle: every few seconds one visible cover crossfades to its next image
  const onScreen = new Set();
  const seen = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target))), { threshold: 0.4 });
  new MutationObserver(() => { seen.disconnect(); onScreen.clear(); grid.querySelectorAll('.card').forEach((c) => seen.observe(c)); }).observe(grid, { childList: true });
  let turn = 0;
  const timer = prefersReducedMotion() ? null : setInterval(() => {
    if (document.hidden) return;
    const cards = [...grid.querySelectorAll('.card')].filter((c) => onScreen.has(c) && c._advance);
    if (!cards.length) return;
    cards[turn++ % cards.length]._advance();
  }, 1600);
  const ro = new ResizeObserver(layout);
  ro.observe(grid);
  const unstretch = stretchyType(title, { base: 100, max: 150, radius: 300 });
  setFilter(current);
  return () => { unstretch(); ro.disconnect(); seen.disconnect(); if (timer) clearInterval(timer); };
}
