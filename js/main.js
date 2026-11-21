/*
 * Router. Every page is a hash so the site works on any static host:
 *   #               → Playground (home)
 *   #archive        → Archive   (#archive-objects etc. pre-selects a filter)
 *   #work-<slug>    → a project
 *   #about          → About
 */
import { projects, bySlug } from './data/projects.js';
import { prefersReducedMotion } from './lib/util.js';
import { renderHome } from './views/home.js';
import { renderArchive } from './views/archive.js';
import { renderProject } from './views/project.js';
import { renderAbout } from './views/about.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const wipe = document.getElementById('wipe');
document.getElementById('nav-count').textContent = projects.length;

let cleanup = null;
let first = true;

function parse() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hash.startsWith('work-') && bySlug[hash.slice(5)]) return { name: 'project', slug: hash.slice(5) };
  if (hash === 'archive' || hash.startsWith('archive-')) return { name: 'archive', filter: hash.slice(8) };
  if (hash === 'about') return { name: 'about' };
  if (hash === 'view') return null; // skip link
  return { name: 'home' };
}

function label(route) {
  if (route.name === 'project') { const p = bySlug[route.slug]; return [p.no, p.shortTitle || p.title]; }
  if (route.name === 'archive') return ['Index', 'Archive'];
  if (route.name === 'about') return ['About', 'Yiling Yang'];
  return ['Playground', 'Yiling Yang'];
}

function render(route) {
  cleanup?.();
  cleanup = null;
  view.replaceChildren();
  window.scrollTo(0, 0);
  if (route.name === 'project') cleanup = renderProject(view, bySlug[route.slug]);
  else if (route.name === 'archive') cleanup = renderArchive(view, route.filter);
  else if (route.name === 'about') cleanup = renderAbout(view);
  else cleanup = renderHome(view);
  document.documentElement.classList.toggle('theme-dark', true);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0D0D0E');

  document.querySelectorAll('.nav__links a').forEach((a) => {
    a.toggleAttribute('aria-current', a.dataset.route === route.name);
    if (a.dataset.route === route.name) a.setAttribute('aria-current', 'page');
  });
  const [, title] = label(route);
  document.title = route.name === 'home' ? 'Yiling Yang' : `${title} — Yiling Yang`;
  if (!first) view.focus({ preventScroll: true });
  first = false;
  onScroll();
}

async function go() {
  const route = parse();
  if (!route) return;
  if (first || prefersReducedMotion()) { render(route); return; }
  // blue sheet slides in, page swaps underneath, sheet slides out
  const [no, title] = label(route);
  wipe.querySelector('.wipe__no').textContent = no;
  wipe.querySelector('.wipe__label').textContent = title;
  const ease = 'cubic-bezier(.7,0,.2,1)';
  await wipe.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: 380, easing: ease, fill: 'forwards' }).finished;
  render(route);
  await new Promise((r) => setTimeout(r, 120));
  await wipe.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: 420, easing: ease, fill: 'forwards' }).finished;
  wipe.animate([{ transform: 'translateX(-101%)' }], { duration: 0, fill: 'forwards' });
}

function onScroll() {
  nav.classList.toggle('is-solid', window.scrollY > 40 || parse()?.name !== 'home');
}

window.addEventListener('hashchange', go);
window.addEventListener('scroll', onScroll, { passive: true });
go();
