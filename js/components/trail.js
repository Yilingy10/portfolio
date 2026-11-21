/* TRAIL OF SHU — the disc case that holds the film, the picture book as a spread viewer,
   and a sheet of character stickers you can move around. */
import { h, prefersReducedMotion, clamp } from '../lib/util.js';

/* The film, shown straight away and playing (muted) as soon as it is on screen. The disc case
   sits against its corner: the disc spins while the film plays, and clicking it plays or pauses. */
export function createDisc(b, src) {
  const caseArt = src(b.case);
  const video = h('video', { class: 'cd__video', src: `${src(b.src)}#t=${b.at ?? 2}`, playsinline: true, controls: true, muted: true, preload: 'metadata' });
  video.muted = true;
  const disc = h('button', { type: 'button', class: 'cd__disc', 'aria-label': 'Play or pause the film' },
    h('i', { class: 'cd__label', style: { backgroundImage: `url("${caseArt}")` } }), h('i', { class: 'cd__hole' }));
  const box = h('div', { class: 'cd__case', 'aria-hidden': 'true' }, h('img', { src: caseArt, alt: '', draggable: 'false' }));
  const sound = h('button', { type: 'button', class: 'cd__sound mono' }, 'Sound on');
  const el = h('section', { class: 'cd', 'aria-label': 'Film' },
    h('div', { class: 'cd__stage' }, h('div', { class: 'cd__screen' }, video, sound),
      h('div', { class: 'cd__foot' }, h('div', { class: 'cd__kit' }, disc, box), b.hint ? h('p', { class: 'cd__hint mono' }, b.hint) : null)));

  const toggle = () => (video.paused ? video.play() : video.pause())?.catch?.(() => {});
  disc.addEventListener('click', toggle);
  sound.addEventListener('click', () => { video.muted = !video.muted; if (!video.muted && video.paused) video.play().catch(() => {}); });
  video.addEventListener('volumechange', () => { sound.textContent = video.muted ? 'Sound on' : 'Sound off'; });
  video.addEventListener('play', () => el.classList.add('is-spinning'));
  video.addEventListener('pause', () => el.classList.remove('is-spinning'));
  // start playing (muted) the first time the film comes into view; pause when it leaves
  let started = false;
  if (!prefersReducedMotion()) {
    const io = new IntersectionObserver(([e]) => {
      if (!el.isConnected) { io.disconnect(); return; }
      if (e.isIntersecting && !started) { started = true; video.play().catch(() => {}); }
      else if (!e.isIntersecting && !video.paused) video.pause();
    }, { threshold: 0.35 });
    io.observe(el);
  }
  return el;
}

/* The picture book: each spread is two halves of one sprite cell; turning a page lifts the
   right (or left) half over the spine. The English text of the spread sits underneath. */
export function createSpreads(b, src) {
  const n = b.pages, cols = b.cols, rows = Math.ceil(n / cols);
  const sheet = src(b.sheet);
  const text = b.text || [];
  const half = (i, side) => {
    const c = i % cols, r = Math.floor(i / cols);
    return `${((2 * c + (side === 'r' ? 1 : 0)) / (2 * cols - 1)) * 100}% ${(r / (rows - 1)) * 100}%`;
  };
  const pane = (cls) => h('div', { class: `fb__pane ${cls}`, style: { backgroundImage: `url("${sheet}")`, backgroundSize: `${cols * 200}% ${rows * 100}%` } });
  const L = pane('fb__l'), R = pane('fb__r');
  const front = pane('fb__face fb__front'), back = pane('fb__face fb__back');
  const leaf = h('div', { class: 'fb__leaf' }, front, back);
  const prevHit = h('button', { type: 'button', class: 'fb__hit fb__hit--l', 'aria-label': 'Previous page' });
  const nextHit = h('button', { type: 'button', class: 'fb__hit fb__hit--r', 'aria-label': 'Next page' });
  const book = h('div', { class: 'fb__book', style: { aspectRatio: b.ratio || '1200 / 425' } }, L, R, leaf, h('i', { class: 'fb__spine', 'aria-hidden': 'true' }), prevHit, nextHit,
    h('div', { class: 'fb__load mono' }, 'Opening the book…'));
  const view = h('div', { class: 'fb__view', tabindex: '0', role: 'group', 'aria-roledescription': 'picture book' }, book);
  const count = h('span', { class: 'mono fb__count' });
  const range = h('input', { type: 'range', min: '1', max: String(n), value: '1', class: 'fb__range', 'aria-label': 'Spread' });
  const prev = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous page' }, '←');
  const next = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next page' }, '→');
  const words = h('div', { class: 'fb__text', 'aria-live': 'polite' });
  const el = h('section', { class: 'fb' }, view, h('div', { class: 'fb__ctrl' }, prev, range, next, count), words);

  let cur = 0, busy = false;
  const reduced = prefersReducedMotion();
  const paint = (i) => {
    L.style.backgroundPosition = half(i, 'l');
    R.style.backgroundPosition = half(i, 'r');
    range.value = String(i + 1);
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${n}`;
    view.setAttribute('aria-label', `Spread ${i + 1} of ${n}`);
    words.replaceChildren(...(text[i] || []).map((t) => h('p', {}, t)));
    prev.disabled = i === 0; next.disabled = i === n - 1;
  };
  const turn = (to) => {
    to = clamp(to, 0, n - 1);
    if (to === cur || busy) return;
    if (reduced || Math.abs(to - cur) > 1) { cur = to; paint(cur); return; }
    busy = true;
    const fwd = to > cur;
    // what is revealed underneath, and the two faces of the turning leaf
    if (fwd) R.style.backgroundPosition = half(to, 'r'); else L.style.backgroundPosition = half(to, 'l');
    front.style.backgroundPosition = half(cur, fwd ? 'r' : 'l');
    back.style.backgroundPosition = half(to, fwd ? 'l' : 'r');
    leaf.className = `fb__leaf is-on ${fwd ? 'is-fwd' : 'is-back'}`;
    void leaf.offsetWidth;
    leaf.classList.add('is-turning');
    words.classList.add('is-fading');
    const done = () => {
      clearTimeout(safety);
      cur = to; paint(cur);
      leaf.className = 'fb__leaf';
      words.classList.remove('is-fading');
      busy = false;
    };
    const safety = setTimeout(done, 1100);
    leaf.addEventListener('transitionend', done, { once: true });
  };
  prev.addEventListener('click', () => turn(cur - 1));
  next.addEventListener('click', () => turn(cur + 1));
  prevHit.addEventListener('click', () => turn(cur - 1));
  nextHit.addEventListener('click', () => turn(cur + 1));
  range.addEventListener('input', () => { if (!busy) { cur = +range.value - 1; paint(cur); } });
  view.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { turn(cur + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { turn(cur - 1); e.preventDefault(); }
  });
  let sx = null;
  view.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  view.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) turn(cur + (dx < 0 ? 1 : -1)); });
  // the sheet is large: only fetch it when the book comes near the screen
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const im = new Image();
    im.onload = () => el.classList.add('is-ready');
    im.src = sheet;
  }, { rootMargin: '600px' });
  io.observe(el);
  paint(0);
  return el;
}

/* The sticker pack: nine stickers of the characters. Tap one and it is sent into the chat. */
export function createStickers(b, src) {
  const sheet = src(b.sheet);
  const n = b.count, cols = b.cols, rows = Math.ceil(n / cols);
  const art = (i, cls) => h('i', { class: cls, style: { backgroundImage: `url("${sheet}")`, backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${(i % cols) * (100 / (cols - 1))}% ${(Math.floor(i / cols) / (rows - 1)) * 100}%` } });
  const log = h('div', { class: 'chat__log', 'aria-live': 'polite' });
  const send = (i) => {
    const msg = h('div', { class: 'chat__msg' }, art(i, 'chat__stk'));
    log.querySelector('.chat__empty')?.remove();
    log.append(msg);
    while (log.children.length > 8) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  };
  const tray = h('div', { class: 'chat__tray' }, Array.from({ length: n }, (_, i) =>
    h('button', { type: 'button', class: 'chat__pick', 'aria-label': `Send sticker ${i + 1}${b.names?.[i] ? `, ${b.names[i]}` : ''}`, onclick: () => send(i) }, art(i, 'chat__pick-art'))));
  const phone = h('div', { class: 'chat' },
    h('div', { class: 'chat__head mono' }, h('span', {}, b.title || 'Stickers'), h('span', {}, `${n} stickers`)),
    log, tray);
  const sheetView = h('div', { class: 'chat__sheet' }, Array.from({ length: n }, (_, i) => h('button', { type: 'button', class: 'chat__big', 'aria-label': `Send sticker ${i + 1}`, onclick: () => send(i) }, art(i, 'chat__big-art'))));
  log.append(h('p', { class: 'chat__empty mono' }, 'Tap a sticker to send it'));
  return h('section', { class: 'chat-wrap' }, sheetView, h('div', { class: 'chat__side' }, phone, b.hint ? h('p', { class: 'chat__hint mono' }, b.hint) : null));
}
