/* PROJECT — one template for every project; blocks decide the layout. */
import { projects } from '../data/projects.js';
import { h, media, imgEntry, stretchyType, prefersReducedMotion, clamp, isTouch } from '../lib/util.js';
import { openLightbox } from '../components/lightbox.js';
import { createBook } from '../components/book.js';
import { createModelViewer, createObjectViewer } from '../components/model.js';
import { createTablecloth } from '../components/tablecloth.js';
import { createReport, createMelt, createLeafType, createTurntable } from '../components/report.js';
import { createDiorama, createGacha, createLineup, createHeal, createTown, createFlip, createFactory } from '../components/stage.js';
import { createShuBoards, createShuFive, createEssay, createSteps, createCollage, createPortrayal, createFoldRow } from '../components/shu.js';
import { createStripZine } from '../components/zine.js';
import { createDisc, createSpreads, createStickers } from '../components/trail.js';
import { footer } from './about.js';
import { storms as STORMS } from '../data/storms.js';

const SECTIONS = [['overview', 'Overview'], ['concept', 'Concept'], ['process', 'Process'], ['outcome', 'Outcome']];

export function renderProject(root, p) {
  const src = (ref, size) => media(p.slug, ref, size);
  const gallery = []; // every image on the page, in order, for the lightbox
  const cleanups = [];

  function img(entry, size = 'lg', eager = false) {
    const e = imgEntry(entry);
    const idx = gallery.push({ src: src(e.src, 'lg'), caption: e.caption || '' }) - 1;
    const el = h('img', { src: src(e.src, size), alt: e.caption || `${p.title}, image ${idx + 1}`, loading: eager ? 'eager' : 'lazy', decoding: 'async', draggable: 'false' });
    el.addEventListener('click', () => { if (!el.dataset.dragged) openLightbox(gallery, idx); });
    el.tabIndex = 0;
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') openLightbox(gallery, idx); });
    return el;
  }
  function fig(entry, cls = '', size = 'lg') {
    const e = imgEntry(entry);
    return h('figure', { class: `fig ${cls}` }, img(e, size), e.caption ? h('figcaption', { class: 'mono' }, e.caption) : null);
  }
  function equalHeights(row) {
    row.querySelectorAll('img').forEach((im) => {
      const set = () => { im.closest('.fig').style.flex = `${im.naturalWidth / im.naturalHeight} 1 0`; };
      im.complete && im.naturalWidth ? set() : im.addEventListener('load', set, { once: true });
    });
    return row;
  }

  /* header */
  const title = h('h1', { class: 'p-title', 'data-len': p.title.length > 34 ? 'long' : 'short' }, p.title);
  const meta = h('dl', { class: 'p-meta' },
    h('div', {}, h('dt', { class: 'mono' }, 'Year'), h('dd', {}, p.year)),
    h('div', {}, h('dt', { class: 'mono' }, 'Category'), h('dd', {}, p.categories.join(', '))),
    h('div', {}, h('dt', { class: 'mono' }, 'Medium'), h('dd', {}, p.medium || '—')),
    h('div', {}, h('dt', { class: 'mono' }, p.link ? 'Live work' : 'Index'),
      h('dd', {}, p.link ? h('a', { href: p.link.url, target: '_blank', rel: 'noopener' }, p.link.label || p.link.url) : `${p.no}`)),
  );
  const head = h('header', {},
    h('div', { class: 'crumbs mono' }, h('a', { href: '#archive' }, '← Archive'), h('a', { href: '#' }, 'Playground')),
    h('div', { class: 'p-head' }, h('div', { class: 'p-no mono' }, `${p.no} · ${p.year}`), title, p.subtitle ? h('p', { class: 'p-sub' }, p.subtitle) : null, p.credits ? h('p', { class: 'p-credit mono' }, p.credits) : null, meta));

  /* hero: full-bleed cover (skipped when the page opens with a book, which is its own hero) */
  const firstType = p.blocks?.[0]?.type;
  // a page that opens with the disc case uses it as its hero
  const hero = firstType === 'book' ? null
    : firstType === 'disc' ? createDisc(p.blocks[0], (f) => src(f))
    : h('div', { class: 'p-hero bleed' }, img(p.cover, 'lg', true));

  /* text */
  const textFor = (o, cls = 'p-text') => {
    const secs = SECTIONS.filter(([k]) => o[k] && o[k].trim());
    const sec = ([k, label], i) =>
      h('section', { class: 'p-sec' }, h('h2', { class: 'mono' }, h('span', {}, `0${i + 1}`), label), h('div', { class: 'p-sec__body' }, o[k].split(/\n\s*\n/).map((para) => h('p', {}, para.trim()))));
    // only the overview is open; concept, process and outcome wait behind "Read more"
    const rest = secs.slice(1);
    return secs.length ? h('div', { class: cls }, sec(secs[0], 0),
      rest.length ? h('details', { class: 'p-more' },
        h('summary', { class: 'p-more__sum mono' }, h('span', { class: 'p-more__open' }, `Read more · ${rest.map(([, l]) => l).join(', ')}`), h('span', { class: 'p-more__close' }, 'Close')),
        h('div', { class: 'p-more__body' }, rest.map((r, i) => sec(r, i + 1)))) : null) : null;
  };
  const text = textFor(p);

  /* blocks */
  let chapterNo = 0, workNo = 0;
  const blocks = h('div', { class: 'blocks' }, (p.blocks || []).map((b, bi) => {
    switch (b.type) {
      case 'disc': return bi === 0 ? null : createDisc(b, (f) => src(f));
      case 'spreads': return createSpreads(b, (f) => src(f));
      case 'stickers': return createStickers(b, (f) => src(f));
      case 'work': {
        // a project that holds more than one work: a big divider per work, chapters count again inside it
        chapterNo = 0;
        workNo++;
        return h('section', { class: 'p-work' },
          h('div', { class: 'p-work__head' },
            h('span', { class: 'mono' }, `Work ${String(workNo).padStart(2, '0')}`),
            h('h2', {}, b.title),
            b.medium ? h('p', { class: 'mono' }, b.medium) : null),
          textFor(b, 'p-text p-work__text'));
      }
      case 'chapter':
        chapterNo++;
        return h('div', { class: 'chapter' }, h('span', { class: 'mono' }, `Part ${String(chapterNo).padStart(2, '0')}`),
          h('h3', {}, b.title), b.text ? h('p', {}, b.text) : null);
      case 'image': {
        const cls = { wide: 'fig--wide', centered: 'fig--wide fig--center', inset: 'fig--inset', small: 'fig--small', bleed: 'bleed fig--bleed' }[b.layout] || '';
        return fig(b.src ? { src: b.src, caption: b.caption } : b, cls);
      }
      case 'row':
        return equalHeights(h('div', { class: `row${b.tall ? ' row--tall' : ''}${b.small ? ' row--sm' : ''}${b.fit ? ' row--fit' : ''}` }, b.images.map((e) => fig(e))));
      case 'duo': // one large, one smaller and dropped lower: an asymmetric pair
        return h('div', { class: `duo${b.flip ? ' duo--flip' : ''}` }, fig(b.images[0], 'duo__a'), fig(b.images[1], 'duo__b'));
      case 'mosaic': // one large image beside a stack of smaller ones
        return h('div', { class: 'mosaic' }, fig(b.images[0], 'mosaic__main'),
          h('div', { class: 'mosaic__side' }, b.images.slice(1).map((e) => fig(e, '', 'sm'))));
      case 'grid':
        return h('div', { class: `tiles${b.bare ? ' tiles--bare' : ''}${b.book ? ' tiles--book' : ''}`, style: { '--cols': b.columns || 3 } }, b.images.map((e) => fig(e, '', 'sm')));
      case 'strip': {
        const track = h('div', { class: 'strip__track', tabindex: '0', 'aria-label': 'Scrollable image strip' }, b.images.map((e) => fig(e)));
        const count = h('span', { class: 'mono strip__count' });
        const upd = () => {
          const i = Math.round(track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth) * (b.images.length - 1));
          count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(b.images.length).padStart(2, '0')}`;
        };
        track.addEventListener('scroll', upd, { passive: true }); upd();
        const step = (d) => track.scrollBy({ left: d * track.clientWidth * 0.75, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        return h('div', { class: `strip bleed${b.size === 'sm' ? ' strip--sm' : ''}` }, track, h('div', { class: 'strip__ctrl wrap' }, count,
          h('span', {}, h('button', { class: 'icon-btn', 'aria-label': 'Scroll back', onclick: () => step(-1) }, '←'),
            h('button', { class: 'icon-btn', 'aria-label': 'Scroll forward', onclick: () => step(1) }, '→'))));
      }
      case 'pinboard': return pinboard(b);
      case 'storms': return stormIndex(b);
      case 'board': return gameBoard(b);
      case 'typeset': return typeset(b);
      case 'collage': return collageMixer(b);
      case 'tablecloth': return createTablecloth({ src: (f) => src(f) });
      case 'recompose': return recompose(b);
      case 'melt': return createMelt(b, (f) => src(f));
      case 'report': return createReport(b, (f) => src(f));
      case 'sides': { // a long two-sided piece: flip between faces, drag or scroll along it
        const img = h('img', { src: src(b.sides[0].src), alt: b.sides[0].label, decoding: 'async', draggable: 'false' });
        const track = h('div', { class: 'sides__track', tabindex: '0', 'aria-label': 'Scroll along the piece' }, img);
        const btns = b.sides.map((sd, i) => h('button', { type: 'button', class: 'sides__btn mono', 'aria-pressed': String(!i), onclick: () => {
          btns.forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
          track.classList.add('is-turning');
          setTimeout(() => { img.src = src(sd.src); img.alt = sd.label; track.scrollLeft = 0; track.classList.remove('is-turning'); }, 220);
        } }, sd.label));
        b.sides.forEach((sd) => { new Image().src = src(sd.src); });
        let down = null;
        track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, l: track.scrollLeft }; track.classList.add('is-drag'); });
        window.addEventListener('pointermove', (e) => { if (down) track.scrollLeft = down.l - (e.clientX - down.x); });
        window.addEventListener('pointerup', () => { down = null; track.classList.remove('is-drag'); });
        return h('div', { class: 'sides bleed' }, h('div', { class: 'sides__bar wrap' }, h('div', { class: 'sides__btns' }, btns), h('span', { class: 'mono sides__hint' }, 'Drag to read along →')), track);
      }
      case 'stripzine': return createStripZine(b, (f) => src(f));
      case 'shelf': { // cut-out packaging standing free on the page; they sway, and hop when clicked
        const hop = (e) => { const f = e.currentTarget; f.classList.remove('is-hop'); void f.offsetWidth; f.classList.add('is-hop'); };
        return h('div', { class: 'shelf' }, b.items.map((it, i) => h('figure', { class: 'shelf__item', style: { '--w': `${it.w}%`, '--i': i }, onclick: hop, onanimationend: (e) => { if (e.animationName === 'shelf-hop') e.currentTarget.classList.remove('is-hop'); } },
          h('img', { src: src(it.src), alt: it.alt || '', loading: 'lazy', decoding: 'async', draggable: 'false' }))));
      }
      case 'leaftype': return createLeafType(b, (f) => src(f));
      case 'turntable': return createTurntable(b, (f) => src(f));
      case 'diorama': return createDiorama(b, (f) => (/\.(glb|gltf\.json)$/.test(f) ? f : src(f, 'lg')));
      case 'gacha': return createGacha(b, (f) => (/\.(glb|gltf\.json)$/.test(f) ? f : src(f, 'lg')));
      case 'lineup': return createLineup(b, (f) => f);
      case 'heal': return createHeal(b, (f) => src(f, 'lg'));
      case 'town': return createTown(b, (f) => (/\.(glb|gltf\.json)$/.test(f) ? f : src(f, 'lg')));
      case 'flip': return createFlip(b, (f) => src(f, 'lg'));
      case 'factory': return createFactory(b, (f) => (/\.(glb|gltf\.json)$/.test(f) ? f : src(f, 'lg')));
      case 'shuboards': return createShuBoards(b, (f) => src(f));
      case 'shufive': return createShuFive(b, (f) => src(f));
      case 'essay': return createEssay(b);
      case 'foldrow': return createFoldRow(b);
      case 'portrayal': return createPortrayal(b, (f) => src(f));
      case 'collage-board': return createCollage(b, (f) => (/\.gltf\.json$/.test(f) ? f : src(f)));
      case 'rsteps': return createSteps(b);
      case 'flow': {
        // the game, screen by screen: numbered steps in reading order, arrows between them
        const n0 = b.start || 0;
        const step = (st, i, cls = '') => h('li', { class: `flow__step ${cls}` },
          h('div', { class: 'flow__shot' }, img({ src: st.src, caption: `${String(n0 + i + 1).padStart(2, '0')}  ${st.title}` })),
          h('p', { class: 'flow__t' }, h('span', { class: 'mono' }, String(n0 + i + 1).padStart(2, '0')), st.title));
        const main = b.steps.slice(0, b.steps.length - (b.finale || 0));
        const fin = b.steps.slice(main.length);
        return h('div', { class: `flow${b.cols ? ` flow--c${b.cols}` : ''}` },
          h('ol', { class: 'flow__grid' }, main.map((st, i) => step(st, i))),
          fin.length ? h('ol', { class: 'flow__finale', start: String(main.length + 1) }, fin.map((st, k) => step(st, main.length + k, k === 0 ? 'is-tall' : 'is-wide'))) : null);
      }
      case 'embed': {
        const url = src(b.src);
        return h('figure', { class: 'embed' },
          h('div', { class: 'embed__frame', style: { aspectRatio: b.ratio || '16 / 10' } },
            h('iframe', { src: url, title: b.title || p.title, loading: 'lazy' })),
          h('figcaption', { class: 'mono embed__cap' }, h('span', {}, b.caption || ''), h('a', { href: url, target: '_blank', rel: 'noopener' }, 'Open full screen ↗')));
      }
      case 'blinds': return blinds(b);
      case 'book':
        return createBook(b.pages.map((pg) => src(pg)), { title: b.title || p.title });
      case 'video':
        return h('figure', { class: `fig video${b.bleed ? ' bleed' : ''}` },
          h('video', { src: b.poster ? src(b.src) : `${src(b.src)}#t=${b.at ?? 0.5}`, poster: b.poster ? src(b.poster) : null, controls: true, playsinline: true, preload: b.poster ? 'none' : 'metadata' }),
          b.caption ? h('figcaption', { class: 'mono' }, b.caption) : null);
      case 'model':
        return createModelViewer({ src: b.src, posterSrc: b.poster ? src(b.poster, 'lg') : '', caption: b.caption });
      case 'object':
        return createObjectViewer(b, p, { posterSrc: b.poster ? src(b.poster, 'sm') : '' });
      case 'link':
        return p.link ? h('a', { class: 'linkout', href: p.link.url, target: '_blank', rel: 'noopener' },
          h('span', {}, p.link.label || 'Visit'), h('span', { class: 'mono' }, '↗ New tab')) : null;
      case 'steps':
        chapterNo++;
        return h('section', { class: 'steps' },
          h('div', { class: 'chapter' }, h('span', { class: 'mono' }, `Part ${String(chapterNo).padStart(2, '0')}`), h('h3', {}, b.title)),
          h('ol', { class: 'steps__list' }, b.items.map(([t, d], i) => h('li', { class: 'step' },
            h('span', { class: 'step__no' }, String(i + 1).padStart(2, '0')),
            h('h4', { class: 'step__t' }, t), h('p', { class: 'step__d' }, d)))));
      case 'text':
        return h('div', { class: 'p-sec' }, h('p', {}, b.body));
      default:
        return null;
    }
  }));

  /* Recompose: the prints as a wall that re-lays itself on every click; drag one onto another to swap. */
  function recompose(b) {
    const tints = b.tints || ['#FBF7C9', '#E3FBFF', '#F9E2B0', '#E2F0CF', '#FCE3D6'];
    let order = b.images.map((_, i) => i), count = 1, H = 0, tint = 0;
    const rots = b.images.map(() => 0);
    const counter = h('span', { class: 'mono recomp__no' });
    const btn = h('button', { class: 'recomp__btn mono', type: 'button' }, 'Recompose ↻');
    const stage = h('div', { class: 'recomp__stage' });
    const tiles = b.images.map((e) => {
      const im = img(e, 'sm');
      const t = h('figure', { class: 'recomp__tile' }, im);
      t._im = im; t._r = 1;
      const set = () => { t._r = im.naturalWidth / im.naturalHeight || 1; layout(); };
      im.complete && im.naturalWidth ? (t._r = im.naturalWidth / im.naturalHeight) : im.addEventListener('load', set, { once: true });
      stage.append(t);
      return t;
    });
    const shuffle = () => {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const W = stage.clientWidth || 1000;
      const lo = W < 700 ? 90 : 150, hi = W < 700 ? 170 : 300;
      H = lo + Math.random() * (hi - lo);
      rots.forEach((_, i) => { rots[i] = (Math.random() * 2 - 1) * 2.2; });
      tint = (tint + 1 + Math.floor(Math.random() * (tints.length - 1))) % tints.length;
      count++;
    };
    function layout() {
      const W = stage.clientWidth; if (!W) return;
      if (!H) H = W < 700 ? 130 : 220;
      const pad = W < 700 ? 14 : 28, gap = W < 700 ? 10 : 18, inner = W - pad * 2;
      let y = pad, row = [];
      const place = (items, hgt, last) => {
        const total = items.reduce((s, t) => s + t._r * hgt, 0) + gap * (items.length - 1);
        let x = pad + (last ? (inner - total) / 2 : 0);
        items.forEach((t) => {
          const w = t._r * hgt;
          Object.assign(t.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hgt}px` });
          x += w + gap;
        });
        y += hgt + gap;
      };
      order.forEach((i) => {
        row.push(tiles[i]);
        const sum = row.reduce((s, t) => s + t._r, 0);
        if (sum * H + gap * (row.length - 1) >= inner) {
          place(row, (inner - gap * (row.length - 1)) / sum, false); row = [];
        }
      });
      if (row.length) place(row, H, true);
      stage.style.height = `${y - gap + pad}px`;
      stage.style.background = tints[tint];
      tiles.forEach((t, i) => { if (t !== drag?.t) t.style.transform = `rotate(${rots[i]}deg)`; });
      counter.textContent = `Arrangement No. ${String(count).padStart(3, '0')}`;
    }
    let drag = null;
    tiles.forEach((t, i) => {
      t.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        drag = { t, i, x: ev.clientX, y: ev.clientY, moved: false };
        t.setPointerCapture(ev.pointerId);
      });
      t.addEventListener('pointermove', (ev) => {
        if (!drag || drag.t !== t) return;
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; t.classList.add('is-drag'); }
        if (drag.moved) t.style.transform = `translate(${dx}px, ${dy}px) rotate(${rots[i] * 2}deg) scale(1.05)`;
      });
      const end = (ev) => {
        if (!drag || drag.t !== t) return;
        const moved = drag.moved; drag = null;
        t.classList.remove('is-drag');
        if (moved) {
          t._im.dataset.dragged = '1'; setTimeout(() => { delete t._im.dataset.dragged; }, 50);
          t.style.visibility = 'hidden';
          const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.recomp__tile');
          t.style.visibility = '';
          const j = tiles.indexOf(under);
          if (j >= 0 && j !== i) {
            const a = order.indexOf(i), c = order.indexOf(j);
            [order[a], order[c]] = [order[c], order[a]];
            count++;
          }
        }
        layout();
      };
      t.addEventListener('pointerup', end);
      t.addEventListener('pointercancel', end);
    });
    btn.addEventListener('click', () => { shuffle(); layout(); });
    stage.addEventListener('dblclick', (ev) => { if (ev.target === stage) { shuffle(); layout(); } });
    const ro = new ResizeObserver(() => layout()); ro.observe(stage);
    cleanups.push(() => ro.disconnect());
    requestAnimationFrame(layout);
    return h('section', { class: 'recomp' },
      h('div', { class: 'recomp__bar' }, counter, h('span', { class: 'mono recomp__hint' }, 'Drag one print onto another to swap'), btn),
      stage);
  }

  /* Deck: images stacked like prints on a table. Flick or click the top one away to see the next. */
  function pinboard(b) {
    const n = b.images.length;
    const entries = b.images.map(imgEntry);
    let top = 0;                       // index of the card on top
    const cards = entries.map((e, i) => {
      const el = h('div', { class: 'deck__card', style: { '--r': `${((i * 37) % 9) - 4}deg`, '--x': `${((i * 53) % 7) - 3}px` } }, img(e));
      return el;
    });
    const stage = h('div', { class: 'deck__stage', tabindex: '0', role: 'group', 'aria-roledescription': 'stack of images', 'aria-label': 'Image stack. Use the arrow keys to go through it.' }, cards);
    const count = h('span', { class: 'mono deck__count', 'aria-live': 'polite' });
    const thumbs = h('div', { class: 'deck__thumbs' }, entries.map((e, i) =>
      h('button', { type: 'button', class: 'deck__thumb', 'aria-label': `Show image ${i + 1}`, onclick: () => go(i) },
        h('img', { src: src(e.src, 'sm'), alt: '', loading: 'lazy' }))));
    function layout() {
      cards.forEach((c, i) => {
        const depth = (i - top + n) % n;                 // 0 = on top
        c.style.zIndex = String(n - depth);
        c.dataset.depth = String(Math.min(depth, 4));
        c.classList.toggle('is-top', depth === 0);
      });
      [...thumbs.children].forEach((t, i) => t.classList.toggle('is-on', i === top));
      count.textContent = `${String(top + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    }
    function go(i, dir = 1) {
      const leaving = cards[top];
      if (i === top) return;
      if (!prefersReducedMotion()) {
        leaving.classList.remove('fly-l', 'fly-r');
        void leaving.offsetWidth;
        leaving.classList.add(dir > 0 ? 'fly-l' : 'fly-r');
        setTimeout(() => leaving.classList.remove('fly-l', 'fly-r'), 520);
      }
      top = (i + n) % n; layout();
    }
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(top + 1, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(top - 1, -1); }
    });
    // flick the top card: drag it sideways past a threshold
    let start = null;
    stage.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.deck__card.is-top'); if (!c) return;
      start = { x: e.clientX, y: e.clientY, c, moved: false };
      c.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 6) return;
      start.moved = true;
      start.c.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 25}deg)`;
    });
    const end = (e) => {
      if (!start) return;
      const { c, moved, x } = start; start = null;
      c.style.transform = '';
      const im = c.querySelector('img');
      if (moved) { im.dataset.dragged = '1'; setTimeout(() => delete im.dataset.dragged, 50); }
      const dx = (e.clientX ?? x) - x;
      if (moved && Math.abs(dx) > 80) go(top + 1, dx < 0 ? 1 : -1);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    layout();
    return h('div', { class: 'deck' },
      h('div', { class: 'deck__main' }, stage,
        h('div', { class: 'deck__ctrl' },
          h('button', { class: 'icon-btn', 'aria-label': 'Previous image', onclick: () => go(top - 1, -1) }, '←'),
          count,
          h('button', { class: 'icon-btn', 'aria-label': 'Next image', onclick: () => go(top + 1, 1) }, '→')),
        h('p', { class: 'mono deck__hint' }, b.text || 'Flick the top print away, or pick one below')),
      thumbs);
  }

  /* Collage mixer: each collage is cut into paper scraps (same cut pattern for all five, since they
     share one size). Click a scrap and it is replaced by the matching scrap from another collage:
     layering, replacing, juxtaposing, the way the collages were made. */
  function collageMixer(b) {
    const n = b.images.length;
    const urls = b.images.map((r) => src(r, 'lg'));
    // guillotine cuts: split rectangles until ~10 scraps, with uneven proportions
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let rects = [[0, 0, 1, 1]];
    while (rects.length < 10) {
      rects.sort((a, z) => z[2] * z[3] - a[2] * a[3]);
      const [x, y, w, hh] = rects.shift();
      const f = 0.32 + rnd() * 0.36;
      if (hh * 1.55 > w) rects.push([x, y, w, hh * f], [x, y + hh * f, w, hh * (1 - f)]);
      else rects.push([x, y, w * f, hh], [x + w * f, y, w * (1 - f), hh]);
    }
    const state = b.images.map(() => rects.map((_, k) => null)); // null = own piece, else source index
    const boards = b.images.map((ref, ci) => {
      const board = h('div', { class: 'cm__board' });
      rects.forEach(([x, y, w, hh], k) => {
        const piece = h('button', { type: 'button', class: 'cm__piece', 'aria-label': `Swap scrap ${k + 1} of collage ${ci + 1}`,
          style: { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${hh * 100}%`,
            backgroundImage: `url("${urls[ci]}")`, backgroundSize: `${100 / w}% ${100 / hh}%`,
            backgroundPosition: `${w < 1 ? (x / (1 - w)) * 100 : 0}% ${hh < 1 ? (y / (1 - hh)) * 100 : 0}%`,
            '--rot': `${(rnd() - 0.5) * 3}deg` } });
        piece.addEventListener('click', () => {
          const cur = state[ci][k] ?? ci;
          let next = (cur + 1 + Math.floor(rnd() * (n - 1))) % n;
          if (next === cur) next = (next + 1) % n;
          setPiece(ci, k, next === ci ? null : next);
        });
        board.append(piece);
      });
      return h('figure', { class: 'cm__fig' }, board, h('figcaption', { class: 'mono' }, `Collage ${String(ci + 1).padStart(2, '0')}`));
    });
    function setPiece(ci, k, from) {
      state[ci][k] = from;
      const el = boards[ci].querySelectorAll('.cm__piece')[k];
      el.style.backgroundImage = `url("${urls[from ?? ci]}")`;
      el.classList.toggle('is-swapped', from !== null);
      el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
      count();
    }
    const status = h('span', { class: 'mono cm__status', 'aria-live': 'polite' });
    function count() {
      const c = state.flat().filter((v) => v !== null).length;
      status.textContent = c ? `${c} scrap${c > 1 ? 's' : ''} moved between collages` : 'Every scrap in its own collage';
    }
    const shuffle = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => {
      state.forEach((row, ci) => row.forEach((_, k) => setPiece(ci, k, rnd() < 0.45 ? (ci + 1 + Math.floor(rnd() * (n - 1))) % n : null)));
    } }, 'Shuffle all');
    const reset = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => state.forEach((row, ci) => row.forEach((_, k) => setPiece(ci, k, null))) }, 'Restore originals');
    const view = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => openLightbox(urls.map((u, i) => ({ src: u, caption: `Collage ${String(i + 1).padStart(2, '0')}` })), 0) }, 'View originals');
    count();
    return h('div', { class: 'cm' }, h('div', { class: 'cm__row' }, boards), h('div', { class: 'cm__ctrl' }, shuffle, reset, view, status));
  }

  /* Typeset: words set in the project's own typeface (one image per letter, A–Z). */
  function typeset(b) {
    const out = h('div', { class: 'ts__lines', 'aria-hidden': 'true' });
    const label = h('p', { class: 'sr-only' });
    const input = h('input', { class: 'ts__input', id: `ts-${p.slug}`, type: 'text', maxlength: '40', value: b.lines.join(' / '), autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Type a phrase to set it in the typeface' });
    let sheet = null; // { W, H, g: { A: [x, w], … } }
    function render() {
      const text = input.value.toUpperCase().replace(/[^A-Z /]/g, '');
      label.textContent = text.replace(/\//g, ' ');
      out.replaceChildren(...text.split('/').map((line) => line.trim()).filter(Boolean).map((line, li) =>
        h('div', { class: 'ts__line' }, [...line].map((ch, i) => ch === ' '
          ? h('span', { class: 'ts__space' })
          : h('span', { class: 'ts__g', style: glyphStyle(ch, i, li) })))));
    }
    // size letters so the longest line fits on one row (letter widths from widths.json, in letter heights)
    let widths = null;
    function glyphStyle(ch, i, li) {
      const st = { '--r': `${(((i + li * 3) * 37) % 9) - 4}deg`, '--y': `${(((i + li) * 53) % 7) - 3}%`, '--d': `${i * 40}ms` };
      if (!sheet || !sheet.g[ch]) return st;
      const [x, w] = sheet.g[ch];
      return { ...st, '--ar': w / sheet.H, backgroundImage: `url("${src(`${b.glyphs}.webp`)}")`,
        backgroundSize: `${(sheet.W / w) * 100}% 100%`, backgroundPosition: `${(x / (sheet.W - w)) * 100}% 0` };
    }
    fetch(src(`${b.glyphs}.json`)).then((r) => r.json()).then((m) => {
      sheet = m; widths = Object.fromEntries(Object.entries(m.g).map(([c, [, w]]) => [c, w / m.H]));
      render(); fit();
    }).catch(() => {});
    function fit() {
      if (!widths) return;
      const W = out.clientWidth || 800;
      const lines = input.value.toUpperCase().replace(/[^A-Z /]/g, '').split('/').map((l) => l.trim()).filter(Boolean);
      let worst = 0;
      lines.forEach((line, li) => {
        const em = [...line].reduce((s, ch) => s + (ch === ' ' ? 0.35 : (widths[ch] || 0.8)), 0);
        const indent = li % 2 ? Math.min(220, W * 0.12) : 0;
        worst = Math.max(worst, em / Math.max(1, W - indent));
      });
      const hgt = Math.max(28, Math.min(150, worst ? 0.94 / worst : 150));
      out.style.setProperty('--gh', `${hgt}px`);
    }
    new ResizeObserver(fit).observe(out);
    input.addEventListener('input', () => { render(); fit(); });
    render();
    return h('div', { class: 'ts' }, out, label,
      h('div', { class: 'ts__ctrl' }, h('label', { class: 'mono', for: `ts-${p.slug}` }, 'Set your own'), input,
        h('span', { class: 'mono ts__note' }, 'A–Z · use / for a new line')));
  }

  /* Game board: every leaf tile has a grey (polluted) back and a coloured (restored) front.
     Drag "game progress" and the mycelium network spreads from the centre outward. */
  function gameBoard(b) {
    const stage = h('div', { class: 'gb__board' }, h('img', { class: 'gb__base', src: src(b.base), alt: 'Puhpowee game board', draggable: 'false' }));
    const wrap = h('div', { class: 'gb__tilt' }, stage);
    const range = h('input', { type: 'range', min: '0', max: '100', value: String(b.start ?? 0), id: `gb-${p.slug}`, class: 'gb__range', 'aria-label': 'Game progress' });
    const pct = h('span', { class: 'mono gb__pct' });
    const state = h('span', { class: 'mono gb__state' });
    const play = h('button', { class: 'btn btn--ghost', type: 'button' }, 'Play a game');
    const box = h('div', { class: 'gb' }, wrap, h('div', { class: 'gb__ctrl' },
      h('label', { class: 'mono', for: `gb-${p.slug}` }, 'Polluted'), range, h('span', { class: 'mono' }, 'Restored'), pct, play), state);
    let tiles = [];
    fetch(src(b.data)).then((r) => r.json()).then((d) => {
      const cx = d.W / 2, cy = d.H / 2;
      const flip = d.tiles.filter((t) => t.k === 'tile');
      // order: centre first, outward, with a little scatter
      flip.forEach((t) => { t.r = Math.hypot(t.x + t.w / 2 - cx, t.y + t.h / 2 - cy) + ((t.i * 53) % 17) * 6; });
      const order = [...flip].sort((a, z) => a.r - z.r);
      // every tile face lives in one of two sprite sheets (front = restored, back = polluted)
      const sprite = (sheet, t) => ({
        backgroundImage: `url("${src(sheet)}")`,
        backgroundSize: `${(d.AW / t.aw) * 100}% ${(d.AH / t.ah) * 100}%`,
        backgroundPosition: `${(t.ax / Math.max(1, d.AW - t.aw)) * 100}% ${(t.ay / Math.max(1, d.AH - t.ah)) * 100}%`,
      });
      d.tiles.forEach((t) => {
        const st = { left: `${(t.x / d.W) * 100}%`, top: `${(t.y / d.H) * 100}%`, width: `${(t.aw / d.W) * 100}%`, height: `${(t.ah / d.H) * 100}%` };
        if (t.k !== 'tile') { stage.append(h('span', { class: 'gb__fixed', style: { ...st, ...sprite('tiles-front.webp', t) } })); return; }
        const el = h('button', { type: 'button', class: 'gb__tile', style: { ...st, '--d': `${(order.indexOf(t) % 12) * 25}ms` }, 'aria-label': 'Flip tile' },
          h('span', { class: 'gb__face gb__face--front', style: sprite('tiles-front.webp', t) }),
          h('span', { class: 'gb__face gb__face--back', style: sprite('tiles-back.webp', t) }));
        el.addEventListener('click', () => el.classList.toggle('is-up'));
        stage.append(el);
        tiles[order.indexOf(t)] = el;
      });
      apply();
    });
    function apply() {
      const v = +range.value, n = Math.round((v / 100) * tiles.length);
      tiles.forEach((el, i) => el.classList.toggle('is-up', i < n));
      pct.textContent = `${String(v).padStart(3, ' ')}%`;
      state.textContent = v === 0 ? 'Start of the game: every tile shows its polluted side.'
        : v < 100 ? `${n} of ${tiles.length} tiles restored through the mycelium network.` : 'Everyone wins together: the land is alive again.';
    }
    range.addEventListener('input', apply);
    let timer = null;
    play.addEventListener('click', () => {
      if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play a game'; return; }
      if (+range.value >= 100) range.value = '0';
      play.textContent = 'Pause';
      timer = setInterval(() => {
        range.value = String(Math.min(100, +range.value + 3)); apply();
        if (+range.value >= 100) { clearInterval(timer); timer = null; play.textContent = 'Play again'; }
      }, prefersReducedMotion() ? 30 : 140);
    });
    cleanups.push(() => timer && clearInterval(timer));
    return box;
  }

  /* Storm index: the landfall map, the 22 sculptures and a 1992–2024 year line, all linked. */
  function stormIndex(b) {
    // all 22 sculpture cards live in one sprite (6 × 4, each 361 × 412), cropped square like before
    const sheet = src('storms.webp');
    const spr = (i, cls) => {
      const c = i % 6, r = Math.floor(i / 6), th = 412 / 361;
      return h('i', { class: `storm-spr ${cls || ''}`, style: {
        backgroundImage: `url("${sheet}")`, backgroundSize: `600% ${400 * th}%`,
        backgroundPosition: `${c * 20}% ${((r * th + (th - 1) / 2) / (4 * th - 1)) * 100}%` } });
    };
    // panel
    const pImg = h('i', { class: 'storm-spr', role: 'img' });
    const pName = h('h4', { class: 'storm-panel__name' });
    const pYear = h('span', { class: 'mono storm-panel__year' });
    const pTrait = h('p', { class: 'storm-panel__trait' });
    const pNo = h('span', { class: 'mono' });
    const panel = h('div', { class: 'storm-panel', 'aria-live': 'polite' }, h('div', { class: 'storm-panel__img' }, pImg),
      h('div', { class: 'storm-panel__meta' }, pNo, pYear), pName, pTrait);
    // map with hit areas over her name circles
    const pins = STORMS.map((st, i) => h('button', {
      type: 'button', class: 'storm-pin', style: { left: `${st.x}%`, top: `${st.y}%` },
      'aria-label': `${st.name}, ${st.year}`, onclick: () => pick(i, true), onmouseenter: () => pick(i), onfocus: () => pick(i),
    }));
    const map = h('div', { class: 'storm-map' }, h('img', { src: src('map', 'lg'), alt: 'Map of the 22 hurricanes and where they made landfall', loading: 'lazy' }), pins);
    // year line
    const years = [];
    for (let y = 1992; y <= 2024; y++) years.push(y);
    const byYear = {};
    STORMS.forEach((st, i) => { (byYear[st.year] = byYear[st.year] || []).push(i); });
    const chips = [];
    const line = h('div', { class: 'storm-line' }, years.map((y) => {
      const list = byYear[y] || [];
      return h('div', { class: `storm-year${list.length ? ' has' : ''}` },
        h('div', { class: 'storm-year__stack' }, list.map((i) => {
          const c = h('button', { type: 'button', class: 'storm-chip', 'aria-label': `${STORMS[i].name}, ${y}`, onclick: () => pick(i, true), onmouseenter: () => pick(i), onfocus: () => pick(i) },
            spr(i), h('span', { class: 'mono' }, STORMS[i].name));
          chips[i] = c; return c;
        })),
        h('span', { class: 'mono storm-year__label' }, list.length ? String(y) : ''));
    }));
    let cur = -1;
    function pick(i, scroll) {
      if (i === cur) return;
      cur = i;
      const st = STORMS[i];
      const fresh = spr(i); pImg.style.backgroundPosition = fresh.style.backgroundPosition; pImg.style.backgroundImage = fresh.style.backgroundImage; pImg.style.backgroundSize = fresh.style.backgroundSize; pImg.setAttribute('aria-label', `${st.name} sculpture`);
      pName.textContent = st.name; pYear.textContent = st.year; pTrait.textContent = st.trait;
      pNo.textContent = `${String(i + 1).padStart(2, '0')} / ${STORMS.length}`;
      pins.forEach((p, k) => p.classList.toggle('is-on', k === i));
      chips.forEach((c, k) => c && c.classList.toggle('is-on', k === i));
      if (scroll) chips[i]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    const prev = h('button', { class: 'icon-btn', 'aria-label': 'Previous storm', onclick: () => pick((cur - 1 + STORMS.length) % STORMS.length, true) }, '←');
    const next = h('button', { class: 'icon-btn', 'aria-label': 'Next storm', onclick: () => pick((cur + 1) % STORMS.length, true) }, '→');
    panel.append(h('div', { class: 'storm-panel__ctrl' }, prev, next));
    pick(STORMS.findIndex((s) => s.name === (b.start || 'Katrina')));
    return h('div', { class: 'storms' },
      h('div', { class: 'storms__top' }, map, panel),
      h('div', { class: 'storm-line__wrap', tabindex: '0', 'aria-label': 'Storms by year, 1992 to 2024' }, line));
  }

  /* Blinds: the invitation's louvred window. Slats turn to show the other place. */
  function blinds(b) {
    const [l, t, w, hh] = b.window;
    const n = b.slats || 8;
    const win = h('div', { class: 'blinds__win', style: { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${hh}%` } });
    for (let i = 0; i < n; i++) {
      const pos = `0 ${(i / (n - 1)) * 100}%`;
      const size = `100% ${n * 100}%`;
      const slat = h('div', { class: 'slat', style: { '--d': `${i * 45}ms` } },
        h('span', { class: 'slat__f', style: { backgroundImage: `url("${src(b.front)}")`, backgroundPosition: pos, backgroundSize: size } }),
        h('span', { class: 'slat__b', style: { backgroundImage: `url("${src(b.back)}")`, backgroundPosition: pos, backgroundSize: size } }));
      win.append(slat);
    }
    const card = h('div', { class: 'blinds__card' }, h('img', { src: src(b.card), alt: 'Invitation to the Fusion Market', draggable: 'false' }), win);
    const btn = h('button', { class: 'btn btn--ghost', type: 'button', 'aria-pressed': 'false' }, 'Turn the blinds');
    const toggle = () => { const on = card.classList.toggle('is-turned'); btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Back to the museum' : 'Turn the blinds'; };
    btn.addEventListener('click', toggle);
    card.addEventListener('click', toggle);
    if (!isTouch()) {
      card.addEventListener('mouseenter', () => card.classList.add('is-turned'));
      card.addEventListener('mouseleave', () => { card.classList.remove('is-turned'); btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Turn the blinds'; });
    }
    return h('div', { class: 'blinds' }, card, h('div', { class: 'blinds__side' },
      h('p', { class: 'mono' }, 'Museum side'), h('p', { class: 'mono blinds__arrow' }, '↕'), h('p', { class: 'mono' }, 'Park side'), btn));
  }

  /* next */
  const i = projects.indexOf(p);
  const nx = projects[(i + 1) % projects.length];
  const next = h('a', { class: 'next', href: `#work-${nx.slug}` },
    h('span', { class: 'mono' }, h('span', {}, 'Next in the archive'), h('span', {}, nx.no)),
    h('strong', {}, nx.shortTitle || nx.title));

  root.append(h('article', { class: 'wrap page-top project' }, head, hero, text, blocks, next, footer()));
  cleanups.push(stretchyType(title, { base: 88, max: 128, radius: 240 }));
  return () => cleanups.forEach((f) => f());
}
