/* ABOUT + shared footer. */
import { site } from '../data/site.js';
import { h, stretchyType } from '../lib/util.js';

export function footer() {
  const links = [
    site.email && h('a', { href: `mailto:${site.email}` }, site.email),
    site.instagram && h('a', { href: site.instagram, target: '_blank', rel: 'noopener' }, 'Instagram'),
    site.linkedin && h('a', { href: site.linkedin, target: '_blank', rel: 'noopener' }, 'LinkedIn'),
  ].filter(Boolean);
  return h('footer', { class: 'foot mono' },
    h('span', {}, `© ${new Date().getFullYear()} ${site.name}`),
    links.length ? h('span', { style: { display: 'flex', gap: '18px' } }, links) : h('a', { href: '#about' }, 'About & contact'),
  );
}

export function renderAbout(root) {
  const title = h('h1', {}, 'About');
  const contact = [
    site.email && h('li', {}, h('a', { href: `mailto:${site.email}` }, site.email)),
    site.email2 && h('li', {}, h('a', { href: `mailto:${site.email2}` }, site.email2)),
    site.phone && h('li', {}, h('a', { href: `tel:${site.phone.replace(/\s/g, '')}` }, site.phone)),
    site.instagram && h('li', {}, h('a', { href: site.instagram, target: '_blank', rel: 'noopener' }, 'Instagram')),
    site.linkedin && h('li', {}, h('a', { href: site.linkedin, target: '_blank', rel: 'noopener' }, 'LinkedIn')),
  ].filter(Boolean);
  root.append(h('div', { class: 'wrap page-top' },
    h('div', { class: 'archive-head' }, title, h('div', { class: 'count mono' }, h('b', {}, site.name), site.location)),
    h('div', { class: 'about' },
      h('aside', { class: 'about__side' },
        h('div', {}, h('h2', { class: 'mono' }, 'Education'), h('ul', { class: 'about__edu' }, (site.education || []).map((e) => h('li', {}, h('b', {}, e.degree), h('span', {}, e.school), h('span', { class: 'about__place' }, [e.place, e.years].filter(Boolean).join(' · ')))))),
        h('div', {}, h('h2', { class: 'mono' }, 'Practice'), h('ul', {}, site.disciplines.map((d) => h('li', {}, d)))),
        contact.length ? h('div', {}, h('h2', { class: 'mono' }, 'Contact'), h('ul', {}, contact)) : null,
      ),
      h('div', { class: 'about__text' }, site.about.map((t) => h('p', {}, t)),
        h('p', {}, h('a', { class: 'btn', href: '#archive', style: { marginTop: '12px' } }, 'See the work', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')))),
      site.photo ? h('figure', { class: 'about__photo' }, h('img', { src: site.photo, alt: 'Yiling Yang', decoding: 'async' })) : null,
    ),
    footer()));
  return stretchyType(title, { base: 100, max: 150, radius: 300 });
}
