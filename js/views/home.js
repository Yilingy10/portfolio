/* HOME — the playground: a work table where the name is cut out of the work, and the pieces can be pushed around. */
import { projects, bySlug } from '../data/projects.js';
import { collage } from '../data/playground.js';
import { site } from '../data/site.js';
import { h, media, hasWebGL, prefersReducedMotion, clamp, isTouch } from '../lib/util.js';
import { footer } from './about.js';

let pg = null;          // the 3D scene survives navigation, so it only boots once
let pgFailed = false;

export function renderHome(root) {
  const items = collage.map((o, i) => ({ ...o, index: i, project: bySlug[o.project] })).filter((o) => o.project);
  const years = projects.map((p) => p.year);

  /* ---- the poster ---- */
  const canvasMount = h('div', { class: 'poster__canvas', 'aria-hidden': 'true' });
  const labelLayer = h('div', { class: 'poster__labels', 'aria-hidden': 'true' });
  const name = h('h1', { class: 'sr-only' }, 'Yiling Yang');
  const kicker = h('p', { class: 'poster__kicker mono' }, `Graphic design, type, books, objects, installations · ${Math.min(...years)}–${Math.max(...years)}`);

  const resetBtn = h('button', { class: 'poster__btn mono', type: 'button' }, 'Reset');
  const hint = h('p', { class: 'poster__hint mono' }, isTouch()
    ? 'Drag a piece sideways · tap to see what it is · tap again to open'
    : 'Drag anything · click to open the project');
  const controls = h('div', { class: 'poster__controls' }, resetBtn);
  const browse = h('a', { class: 'poster__browse', href: '#archive' },
    h('span', { class: 'poster__browse-k mono' }, `${projects.length} works · 2024–2026`),
    h('span', { class: 'poster__browse-t' }, 'Enter the archive'),
    h('span', { class: 'poster__browse-a', 'aria-hidden': 'true' }, '→'));

  // the same pieces as a list, for keyboards and screen readers
  const list = h('ol', { class: 'poster__list' }, items.filter((o, i, a) => a.findIndex((x) => x.project.slug === o.project.slug) === i).map((o) =>
    h('li', {}, h('a', {
      href: `#work-${o.project.slug}`,
      onfocus: () => pg?.highlight(o.index, true),
      onblur: () => pg?.highlight(o.index, false),
    }, o.project.title))));

  const poster = h('section', { class: 'poster', 'aria-label': 'Collage of selected work' },
    name, kicker, canvasMount, labelLayer,
    h('div', { class: 'poster__bar' }, controls, hint, browse),
    h('nav', { class: 'sr-only', 'aria-label': 'Pieces in the collage' }, list));

  resetBtn.addEventListener('click', () => pg?.reset());

  root.append(poster, h('div', { class: 'wrap' }, footer()));

  /* ---- 3D ---- */
  const labelApi = makeLabels(labelLayer, items);
  const fallback = () => renderFlat(canvasMount, items, poster);
  if (pgFailed || !hasWebGL()) fallback();
  else if (pg) pg.attach(canvasMount, labelApi);
  else {
    import('../three/playground.js')
      .then(({ createPlayground }) => {
        if (!canvasMount.isConnected) return;
        pg = createPlayground({ items, reducedMotion: prefersReducedMotion() });
        pg.attach(canvasMount, labelApi);
      })
      .catch((err) => { console.warn('3D collage unavailable, showing flat version', err); pgFailed = true; if (canvasMount.isConnected) fallback(); });
  }

  return () => {
    pg?.detach();
  };
}

/* Hover caption at rest; a label under every piece when the collage is unmade. */
function makeLabels(layer, items) {
  const code = (p) => p.no;
  const tag = h('div', { class: 'ptag' },
    h('span', { class: 'ptag__no mono' }), h('span', { class: 'ptag__title' }), h('span', { class: 'ptag__kind mono' }));
  layer.append(tag);
  const sheet = items.map((o) => {
    const el = h('div', { class: 'plabel' },
      h('span', { class: 'plabel__no mono' }, code(o.project)),
      h('span', { class: 'plabel__title' }, o.label),
      h('span', { class: 'plabel__kind mono' }, o.note || o.kind));
    layer.append(el);
    return el;
  });
  let shown = -1;
  return {
    update(screen, active, unmade, size) {
      sheet.forEach((el, i) => {
        const s = screen[i];
        const on = unmade > 0.6 && s;
        el.classList.toggle('is-on', !!on);
        if (s) el.style.transform = `translate(${s[0]}px, ${s[1] + 10}px) translate(-50%, 0)`;
      });
      if (active !== shown) {
        shown = active;
        if (active >= 0) {
          const o = items[active];
          tag.children[0].textContent = code(o.project);
          tag.children[1].textContent = o.project.shortTitle || o.project.title;
          tag.children[2].textContent = `${o.note || o.kind} · ${isTouch() ? 'tap again to open' : 'click to open'}`;
        }
      }
      const s = active >= 0 ? screen[active] : null;
      tag.classList.toggle('is-on', !!s && unmade < 0.4);
      if (s) {
        const tw = tag.offsetWidth, th = tag.offsetHeight;
        const x = clamp(s[0] + 28, 12, size[0] - tw - 12), y = clamp(s[1] - th - 28, 70, size[1] - th - 70);
        tag.style.transform = `translate(${x}px, ${y}px)`;
      }
    },
  };
}

/* No WebGL: the same pieces as a loose stack of covers. */
function renderFlat(mount, items, poster) {
  mount.removeAttribute('aria-hidden');
  const seen = new Set();
  const uniq = items.filter((o) => !seen.has(o.project.slug) && seen.add(o.project.slug));
  mount.replaceChildren(h('ul', { class: 'poster__flat' }, uniq.map((o, i) =>
    h('li', { style: { '--r': `${((i * 37) % 11) - 5}deg` } }, h('a', { href: `#work-${o.project.slug}` },
      h('img', { src: media(o.project.slug, o.project.cover, 'sm'), alt: '' }),
      h('span', { class: 'mono' }, o.project.shortTitle || o.project.title))))));
  poster.classList.add('is-flat');
}
