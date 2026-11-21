import { h, prefersReducedMotion } from '../lib/util.js';
import { openModel } from './stage.js';

/* Eco Harmony with Shu — the research, laid out from the original PDF. All wording comes from that PDF. */

// Gods and ghosts: the pointed deity boards are kept, the ghosts are burned in place.
export function createShuBoards(cfg, src) {
  const gods = h('ul', { class: 'sb__boards' }, cfg.boards.map((f, i) => h('li', { style: { '--i': i } },
    h('img', { src: src(f), alt: 'Deity board', loading: 'lazy', decoding: 'async', draggable: 'false' }))));
  // each board burns from its foot upward at its own pace, then leaves only a little smoke
  const order = [3, 0, 5, 2, 4, 1];
  const ghosts = h('ul', { class: 'sb__ghosts' }, cfg.ghosts.map((f, i) => h('li', { style: { '--d': `${(order[i] ?? i) * 0.22 + (i % 2) * 0.09}s`, '--t': `${2.6 + (i % 3) * 0.35}s` } },
    h('img', { src: src(f), alt: 'Ghost board', loading: 'lazy', decoding: 'async', draggable: 'false' }),
    h('span', { class: 'sb__smoke', 'aria-hidden': 'true' }))));
  let burnt = false;
  const btn = h('button', { type: 'button', class: 'sb__burn mono', onclick: () => {
    burnt = !burnt;
    root.classList.remove('is-burnt', 'is-back'); void root.offsetWidth;
    root.classList.add(burnt ? 'is-burnt' : 'is-back');
    btn.textContent = burnt ? 'Set them up again' : 'Burn the ghost boards';
  } }, 'Burn the ghost boards');
  const root = h('div', { class: 'sb' },
    h('div', { class: 'sb__side sb__side--gods' },
      h('h4', { class: 'sb__h' }, 'Gods'),
      h('p', { class: 'sb__p' }, cfg.gods),
      gods,
      h('p', { class: 'sb__fate mono' }, cfg.fateGods)),
    h('div', { class: 'sb__side sb__side--ghosts' },
      h('h4', { class: 'sb__h' }, 'Ghosts'),
      h('p', { class: 'sb__p' }, cfg.ghostsText),
      ghosts,
      h('div', { class: 'sb__row' }, h('p', { class: 'sb__fate mono' }, cfg.fateGhosts), btn)));
  return root;
}

// The five Shu: pick an egg, meet the Shu of that direction and see what it restores in the website.
export function createShuFive(cfg, src) {
  const order = cfg.shu;
  let cur = order.findIndex((s) => s.key === (cfg.start || 'center'));
  if (cur < 0) cur = 0;
  const eggs = order.map((s, i) => h('button', { type: 'button', class: 'sf__egg', 'aria-pressed': 'false', 'aria-label': s.label, onclick: () => show(i) },
    h('img', { class: 'sf__icon', src: src(s.icon), alt: '', decoding: 'async', draggable: 'false' }),
    s.elem ? h('span', { class: 'sf__elem', 'aria-hidden': 'true', style: { backgroundImage: `url("${src(cfg.elems || 'elems.webp')}")`, backgroundPosition: `${['east', 'south', 'center', 'west', 'north'].indexOf(s.key) * 25}% 0` } }) : null));
  const figA = h('img', { class: 'sf__render', alt: '', decoding: 'async', draggable: 'false' });
  const figB = h('img', { class: 'sf__render', alt: '', decoding: 'async', draggable: 'false' });
  const portrait = h('img', { class: 'sf__portrait', alt: '', decoding: 'async', draggable: 'false' });
  const label = h('p', { class: 'sf__label mono' });
  const caption = h('h4', { class: 'sf__caption' });
  const before = h('figure', { class: 'sf__shot sf__shot--before' }, h('img', { alt: '', decoding: 'async' }), h('figcaption', { class: 'mono' }, 'Before'));
  const after = h('figure', { class: 'sf__shot' }, h('img', { alt: '', decoding: 'async' }), h('figcaption', { class: 'mono' }, 'With Shu'));
  const stage = h('div', { class: 'sf__stage' }, h('div', { class: 'sf__glow', 'aria-hidden': 'true' }), figA, figB);
  let front = figA, back = figB, swapToken = 0;

  // plays through the five on its own; pauses while the pointer is on it, restarts the count after a click
  const STEP = cfg.every || 5200;
  let timer = 0, paused = false;
  const tick = () => { clearTimeout(timer); if (!root.isConnected && started) return; timer = setTimeout(() => { if (!root.isConnected) return; if (!paused && !document.hidden) show((cur + 1) % order.length, false); else tick(); }, STEP); };
  let started = false;
  function show(i, user = true) {
    if (user) root.classList.add('is-touched');
    root.classList.remove('is-ticking'); void root.offsetWidth; root.classList.add('is-ticking');
    tick();
    cur = i; const s = order[i];
    eggs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    root.style.setProperty('--shu', s.color);
    // only the latest request may swap, so quick changes never leave a stale or blank figure
    const t = ++swapToken;
    const next = new Image(); next.src = src(s.render);
    const swap = () => { if (t !== swapToken) return; back.src = next.src; back.alt = `${s.label} Shu`; back.classList.add('is-on'); front.classList.remove('is-on'); [front, back] = [back, front]; };
    next.complete && next.naturalWidth ? swap() : (next.onload = swap);
    portrait.src = src(s.portrait); portrait.alt = `${s.label} Shu, illustration`;
    label.textContent = s.label;
    caption.textContent = s.caption;
    after.querySelector('img').src = src(s.after); after.querySelector('img').alt = s.caption;
    before.hidden = !s.before;
    if (s.before) before.querySelector('img').src = src(s.before);
  }

  const root = h('div', { class: 'sf' },
    h('div', { class: 'sf__head' },
      h('h4', { class: 'sf__title' }, 'The five elements of Shu'),
      h('p', { class: 'sf__p' }, cfg.text)),
    h('p', { class: 'sf__ask' }, h('span', { class: 'sf__ask-n mono' }, '↓'), cfg.ask || 'Pick an egg to call the Shu of that direction.'),
    h('div', { class: 'sf__eggs', role: 'group', 'aria-label': 'Choose a Shu' }, eggs),
    h('div', { class: 'sf__body' },
      stage,
      h('div', { class: 'sf__info' },
        label, caption,
        h('div', { class: 'sf__shots' }, before, after),
        portrait)));
  order.forEach((s) => { const im = new Image(); im.src = src(s.render); });
  root.style.setProperty('--step', `${STEP}ms`);
  // pause only while the pointer is on the eggs themselves
  const row = root.querySelector('.sf__eggs');
  row.addEventListener('pointerenter', () => { paused = true; root.classList.add('is-paused'); });
  row.addEventListener('pointerleave', () => { paused = false; root.classList.remove('is-paused'); tick(); });
  show(cur, false);
  started = true;
  return root;
}

// A row of short texts, each under its own heading (the research pages of the PDF).
export function createEssay(cfg) {
  const body = h('div', { class: `essay${cfg.wide ? ' essay--wide' : ''}` },
    cfg.title ? h('h4', { class: 'essay__title' }, cfg.title) : null,
    h('div', { class: 'essay__cols' }, cfg.items.map((it) => h('section', { class: 'essay__item' },
      it.title ? h('h5', { class: 'mono' }, it.title) : null,
      ...(Array.isArray(it.body) ? it.body : [it.body]).map((t) => h('p', {}, t))))));
  if (!cfg.fold) return body;
  // folded: only the headings show until the reader opens it
  const first = [].concat(cfg.items[0].body)[0];
  const heads = cfg.items.map((it) => it.title).filter(Boolean).join(' · ') || `${first.split(' ').slice(0, 12).join(' ')}…`;
  return h('details', { class: 'fold' },
    h('summary', { class: 'fold__sum' }, h('span', { class: 'mono fold__k' }, heads || 'Text'), h('span', { class: 'mono fold__btn' }, h('span', { class: 'fold__open' }, 'Read'), h('span', { class: 'fold__close' }, 'Close'))),
    body);
}

// The ritual steps as a numbered list.
export function createSteps(cfg) {
  return h('ol', { class: 'rsteps' }, cfg.steps.map((t, i) => h('li', {},
    h('span', { class: 'rsteps__n' }, String(i + 1)), h('span', { class: 'rsteps__t' }, t))));
}

export const reduce = prefersReducedMotion;

// A composed board, laid out like the original PDF page: every piece placed in a W×H frame.
// Pieces with a model open the 3D viewer when clicked.
export function createCollage(cfg, src) {
  const [W, H] = cfg.frame;
  const pct = (v, of) => `${(v / of) * 100}%`;
  const items = cfg.items.map((it) => {
    const el = h(it.model ? 'button' : 'div', {
      class: `cg__it${it.model ? ' cg__it--3d' : ''}${it.still ? '' : ' cg__it--lift'}`,
      style: { left: pct(it.x, W), top: pct(it.y, H), width: pct(it.w, W), zIndex: it.z || 1, '--r': `${it.r || 0}deg` },
      ...(it.model ? { type: 'button', 'aria-label': `${it.label}: open the 3D model`, onclick: () => openModel({ title: it.label, src: it.model, distance: it.distance || 1.15 }) } : {}),
    }, it.crop
      // a piece cut from a larger photo: crop = [x, y, w, h] as fractions of that photo
      ? h('span', { class: 'cg__crop', role: 'img', 'aria-label': it.label || '', style: { aspectRatio: String(it.crop[2] * (it.ar || 1) / it.crop[3]), backgroundImage: `url("${src(it.src)}")`, backgroundSize: `${100 / it.crop[2]}% ${100 / it.crop[3]}%`, backgroundPosition: `${it.crop[0] / (1 - it.crop[2]) * 100}% ${it.crop[1] / (1 - it.crop[3]) * 100}%` } })
      : h('img', { src: src(it.src), alt: it.label || '', loading: 'lazy', decoding: 'async', draggable: 'false' }),
      it.model ? h('span', { class: 'cg__tag mono' }, it.label) : null);
    return el;
  });
  return h('div', { class: `cg${cfg.paper ? ' cg--paper' : ''}` },
    cfg.hint ? h('p', { class: 'cg__hint' }, cfg.hint) : null,
    h('div', { class: 'cg__frame', style: { aspectRatio: `${W} / ${H}` } },
      cfg.glow ? h('div', { class: 'cg__glow', 'aria-hidden': 'true', style: { left: pct(cfg.glow[0], W), top: pct(cfg.glow[1], H), width: pct(cfg.glow[2], W) } }) : null,
      items));
}

// The illustrations, without a board behind them: the five Shu in a row, a procession of animals, and the ghosts.
export function createPortrayal(cfg, src) {
  const pic = (f, cls, alt = '') => h('img', { class: cls, src: src(f), alt, loading: 'lazy', decoding: 'async', draggable: 'false' });
  const shu = h('ul', { class: 'pt__shu' }, cfg.shu.map((s, i) => h('li', { style: { '--i': i } }, pic(s.src, '', `${s.label} Shu`), h('span', { class: 'mono' }, s.label))));
  // every animal gets the same area, so long fish and tall goats read as one family
  const even = (img) => { const set = () => img.style.setProperty('--k', String(img.naturalHeight / 300)); img.complete && img.naturalWidth ? set() : img.addEventListener('load', set, { once: true }); return img; };
  // each picture is nudged so the body, not the bounding box, sits on the shared midline
  const shift = (f) => (cfg.animalShift || [])[cfg.animals.indexOf(f)] || 0;
  const lane = (list) => h('div', { class: 'pt__lane' }, [...list, ...list].map((f, i) => { const im = even(pic(f, '', i < list.length ? 'Animal' : '')); im.style.setProperty('--dy', String(shift(f))); return im; }));
  const half = Math.ceil(cfg.animals.length / 2);
  const animals = h('div', { class: 'pt__animals', 'aria-label': 'Animals' }, lane(cfg.animals.slice(0, half)), lane(cfg.animals.slice(half)));
  const ghosts = h('ul', { class: 'pt__ghosts' }, cfg.ghosts.map((f, i) => h('li', { style: { '--i': i } }, pic(f, '', 'Ghost'))));
  return h('div', { class: 'pt' },
    shu,
    h('p', { class: 'pt__h mono' }, 'Animals'), animals,
    h('p', { class: 'pt__h mono' }, 'Ghosts'), ghosts);
}

// Several folded texts side by side on one line.
export function createFoldRow(cfg) {
  const folds = cfg.items.map((it) => h('details', { class: 'fold fold--col' },
    h('summary', { class: 'fold__sum' }, h('span', { class: 'fold__t' }, it.title), h('span', { class: 'mono fold__btn' }, h('span', { class: 'fold__open' }, 'Read'), h('span', { class: 'fold__close' }, 'Close'))),
    h('div', { class: 'fold__body' }, it.items.map((x) => h('section', { class: 'essay__item' },
      x.title ? h('h5', { class: 'mono' }, x.title) : null,
      ...[].concat(x.body).map((t) => h('p', {}, t)))))));
  return h('div', { class: 'foldrow' }, folds);
}
