#!/usr/bin/env node
// Generator koncepcji wizualnych.
// Czyta zdjęcia z photos/, skaluje je do WebP (sharp) i składa statyczne strony do docs/ (GitHub Pages).
// Runda 1 (A–C): płaska lista zdjęć z photos/work i photos/bridal.
// Runda 2 (D–F): lista kampanii z photos/campaigns — folder to kampania (pierwsze zdjęcie jest wiodące),
// luźny plik to pojedyncze zdjęcie. Kolejność = kolejność alfabetyczna nazw.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'docs');
const IMG = join(OUT, 'img');
// szerokość wariantu → jakość WebP (większe warianty trafiają na ekrany o wysokiej gęstości, więc znoszą mocniejszą kompresję)
const VARIANTS = { 800: 74, 1200: 68, 1600: 62, 2400: 56 };
const LANDSCAPE_RATIO = 1.15;

const FONTS_B = 'family=Instrument+Sans:wght@400;500;600';
const SIZES_B = { full: '100vw', pair: '50vw', trio: '(min-width: 720px) 33vw, 50vw', solo: '50vw' };
// Runda 2 dziedziczy typografię, pasek górny i podstrony z koncepcji B; różni się blokiem kampanii.
const ROUND_2 = { round: 2, chrome: 'b', fonts: FONTS_B, pattern: [2, 3], avoidSolo: true, sizes: SIZES_B, campaigns: true, scripts: ['reveal.js'] };

const CONCEPTS = {
  a: {
    name: 'Editorial',
    round: 1,
    chrome: 'a',
    styles: ['a.css'],
    fonts: 'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500',
    // liczba pionowych zdjęć w kolejnych wierszach (cyklicznie); poziome zawsze dostają własny wiersz
    pattern: [2, 1],
    sizes: {
      full: '(min-width: 1560px) 1400px, 100vw',
      pair: '(min-width: 760px) 55vw, 100vw',
      solo: '(min-width: 760px) 40vw, 100vw',
    },
  },
  b: {
    name: 'Atelier',
    round: 1,
    chrome: 'b',
    styles: ['b.css'],
    fonts: FONTS_B,
    pattern: [2, 3],
    // ścisła siatka: pusta połowa wiersza wygląda jak brakujące zdjęcie, więc grupy dzielimy bez samotnej reszty
    avoidSolo: true,
    sizes: SIZES_B,
  },
  c: {
    name: 'Noir',
    round: 1,
    chrome: 'c',
    styles: ['c.css'],
    fonts: 'family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300..500',
    pattern: [1],
    sizes: {
      full: '(min-width: 900px) 75vw, 100vw',
      solo: '(min-width: 900px) 45vw, 85vw',
    },
  },
  d: { ...ROUND_2, name: 'Lead', block: 'lead', styles: ['b.css', 'r2.css', 'd.css'] },
  e: { ...ROUND_2, name: 'Podmiana', block: 'swap', styles: ['b.css', 'r2.css', 'e.css'], scripts: ['reveal.js', 'swap.js'] },
  f: { ...ROUND_2, name: 'Mozaika', block: 'mosaic', styles: ['b.css', 'r2.css', 'f.css'] },
};

const PAGES = [
  { key: 'work', label: 'Work', path: '', title: 'Kinga Chudzik — Makeup Artist' },
  { key: 'bridal', label: 'Śluby', path: 'sluby/', title: 'Makijaż ślubny — Kinga Chudzik' },
  { key: 'contact', label: 'Kontakt', path: 'kontakt/', title: 'Kontakt — Kinga Chudzik' },
];

const pad = (n) => String(n).padStart(2, '0');
const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name);

// ---------- zdjęcia ----------

// Pamięć podręczna po odcisku pliku źródłowego — zmiana nazwy (czyli kolejności) zdjęcia też wymusza przeliczenie.
const CACHE_FILE = join(IMG, 'cache.json');
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const produced = new Set();

async function resize(src, file, width) {
  const { size, mtimeMs } = statSync(src);
  const stamp = `${size}:${mtimeMs}:${VARIANTS[width]}`;
  const dest = join(IMG, file);
  if (cache[file] !== stamp || !existsSync(dest)) {
    await sharp(src).rotate().resize({ width }).webp({ quality: VARIANTS[width], effort: 5 }).toFile(dest);
    cache[file] = stamp;
  }
  produced.add(file);
}

async function prepare(src, id) {
  const { width: w, height: h } = await sharp(src).metadata();
  const widths = Object.keys(VARIANTS).map(Number).filter((x, i) => i === 0 || x <= w);
  const variants = [];
  for (const width of widths) {
    const file = `${id}-${width}.webp`;
    await resize(src, file, width);
    variants.push({ w: width, file });
  }
  const largest = variants.at(-1);
  return { id, w: largest.w, h: Math.round((largest.w * h) / w), orient: w / h > LANDSCAPE_RATIO ? 'l' : 'p', variants };
}

async function loadSet(name) {
  const dir = join(ROOT, 'photos', name);
  const photos = [];
  for (const [i, f] of readdirSync(dir).filter(isImage).sort().entries()) {
    photos.push({ ...(await prepare(join(dir, f), `${name}-${pad(i + 1)}`)), index: i });
  }
  return photos;
}

async function loadEntries(name) {
  const dir = join(ROOT, 'photos', 'campaigns', name);
  const entries = [];
  let index = 0;
  for (const entry of readdirSync(dir).filter((n) => !n.startsWith('.')).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const infoFile = join(full, 'info.json');
      const info = existsSync(infoFile) ? JSON.parse(readFileSync(infoFile, 'utf8')) : {};
      const photos = [];
      for (const [i, f] of readdirSync(full).filter(isImage).sort().entries()) {
        photos.push({ ...(await prepare(join(full, f), `c-${name}-${entry}-${pad(i + 1)}`)), index: index++ });
      }
      entries.push({ type: 'campaign', title: info.title ?? entry, meta: info.meta ?? '', photos });
    } else if (isImage(entry)) {
      const id = `c-${name}-${entry.replace(/\.\w+$/, '')}`;
      entries.push({ type: 'single', photo: { ...(await prepare(full, id)), index: index++ } });
    }
  }
  return entries;
}

// ---------- układ ----------

function rows(photos, { pattern, avoidSolo = false }) {
  const out = [];
  let step = 0;
  let i = 0;
  while (i < photos.length) {
    if (photos[i].orient === 'l') {
      out.push({ type: 'full', items: [photos[i++]] });
      continue;
    }
    let run = 0;
    while (i + run < photos.length && photos[i + run].orient === 'p') run++;
    let want = Math.min(pattern[step++ % pattern.length], run);
    if (avoidSolo && run - want === 1) want = want === 3 ? 2 : want + 1;
    out.push({ type: ['solo', 'pair', 'trio'][want - 1], items: photos.slice(i, i + want) });
    i += want;
  }
  // co drugi wiersz danego typu dostaje lustrzany wariant
  const seen = {};
  for (const row of out) {
    seen[row.type] = (seen[row.type] ?? 0) + 1;
    row.flip = seen[row.type] % 2 === 0;
  }
  return out;
}

const srcset = (photo, root) => photo.variants.map((v) => `${root}img/${v.file} ${v.w}w`).join(', ');

function image(photo, sizes, root, alt) {
  const loading = photo.index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<img src="${root}img/${photo.variants[0].file}" srcset="${srcset(photo, root)}" sizes="${sizes}" width="${photo.w}" height="${photo.h}" alt="${alt} ${pad(photo.index + 1)}" ${loading} decoding="async">`;
}

function figure(photo, sizes, total, root, alt, extraClass = '') {
  return `      <figure class="ph ph--${photo.orient}${extraClass}">
        <a href="${root}img/${photo.variants.at(-1).file}" data-lightbox>
          ${image(photo, sizes, root, alt)}
        </a>
        <figcaption><span>${pad(photo.index + 1)}</span> / ${total}</figcaption>
      </figure>`;
}

function rowsHtml(photos, concept, total, root, alt) {
  return rows(photos, concept)
    .map((row) => {
      const figures = row.items.map((p) => figure(p, concept.sizes[row.type], total, root, alt)).join('\n');
      return `    <div class="row row--${row.type}${row.flip ? ' is-flip' : ''}">\n${figures}\n    </div>`;
    })
    .join('\n');
}

function stream(photos, concept, root, alt) {
  return `  <section class="stream" aria-label="Portfolio">\n${rowsHtml(photos, concept, pad(photos.length), root, alt)}\n  </section>`;
}

// ---------- runda 2: kampanie ----------

const SIZES_LEAD = { p: '(min-width: 720px) 55vw, 100vw', l: '100vw' };
const SIZES_THUMB = '(min-width: 720px) 25vw, 50vw';

function campaignBlock(camp, no, concept, total, root, alt) {
  const [lead, ...rest] = camp.photos;
  const n = rest.length;
  // kampania dziedziczy orientację po zdjęciu wiodącym
  const classes = `camp camp--${lead.orient}${no % 2 === 0 ? ' is-flip' : ''}`;
  const caption = `<header class="camp-cap">
          <span class="camp-no">${pad(no)}</span>
          <h2>${camp.title}</h2>${camp.meta ? `\n          <p>${camp.meta}</p>` : ''}
        </header>`;

  if (concept.block === 'swap') {
    const slides = camp.photos
      .map((p, i) => `        <a href="${root}img/${p.variants.at(-1).file}" data-lightbox${i === 0 ? ' class="is-active"' : ''}>${image(p, SIZES_LEAD[lead.orient], root, alt)}</a>`)
      .join('\n');
    const thumbs = camp.photos
      .map((p, i) => `          <button class="thumb${i === 0 ? ' is-active' : ''}" type="button" aria-pressed="${i === 0}" aria-label="Pokaż zdjęcie ${i + 1} z ${camp.photos.length}"><img src="${root}img/${p.variants[0].file}" width="${p.w}" height="${p.h}" alt="" loading="lazy" decoding="async"></button>`)
      .join('\n');
    return `    <article class="${classes}" style="--count: ${camp.photos.length}" data-swap>
      <div class="camp-stage" style="--ratio: ${lead.w} / ${lead.h}">
${slides}
      </div>
      <div class="camp-side">
        ${caption}
        <div class="camp-thumbs" role="group" aria-label="Zdjęcia kampanii">
${thumbs}
        </div>
      </div>
    </article>`;
  }

  // D: podpis zajmuje jedno pole siatki miniatur, gdy miniatur jest nieparzyście wiele (domyka prostokąt), inaczej cały wiersz.
  // F: podpis wypełnia resztę ostatniego wiersza czterokolumnowej mozaiki (zdjęcie wiodące zajmuje 4 pola).
  const capLead = lead.orient === 'l' ? 1 : n % 2 === 1 ? 1 : 2;
  const capMosaic = 1 + ((4 - ((4 + n + 1) % 4)) % 4);
  // w siatce dwukolumnowej (telefon) podpis przy nieparzystej liczbie miniatur zajmuje wolne pole na końcu
  const capPair = n % 2 === 1 ? { span: 1, order: 1 } : { span: 2, order: -1 };
  const thumbs = rest.map((p) => figure(p, SIZES_THUMB, total, root, alt)).join('\n');
  return `    <article class="${classes}" style="--n: ${n}; --cols: ${n + 1}; --cap-lead: ${capLead}; --cap-mosaic: ${capMosaic}; --cap-pair: ${capPair.span}; --cap-pair-order: ${capPair.order}">
${figure(lead, SIZES_LEAD[lead.orient], total, root, alt, ' camp-lead')}
      <div class="camp-thumbs">
        ${caption}
${thumbs}
      </div>
    </article>`;
}

function campaignStream(entries, concept, root, alt) {
  const total = pad(entries.reduce((sum, e) => sum + (e.type === 'campaign' ? e.photos.length : 1), 0));
  const blocks = [];
  let loose = [];
  let no = 0;
  // kolejne pojedyncze zdjęcia łączymy w gęste wiersze jak w koncepcji B
  const flush = () => {
    if (!loose.length) return;
    blocks.push(`    <div class="loose">\n${rowsHtml(loose, concept, total, root, alt)}\n    </div>`);
    loose = [];
  };
  for (const entry of entries) {
    if (entry.type === 'single') {
      loose.push(entry.photo);
      continue;
    }
    flush();
    blocks.push(campaignBlock(entry, ++no, concept, total, root, alt));
  }
  flush();
  return `  <section class="stream" aria-label="Portfolio">\n${blocks.join('\n')}\n  </section>`;
}

// ---------- szablony ----------

const navLinks = (page, base) =>
  PAGES.map((p) => `<a href="${base}${p.path}"${p.key === page ? ' aria-current="page"' : ''}>${p.label}</a>`).join('\n      ');

const LANG = '<span class="lang" aria-label="Język"><b>PL</b><span>EN</span></span>';

const CHROME = {
  a: (page, base) => `  <header class="masthead">
    <a class="brand" href="${base}"><span class="brand-name">Kinga Chudzik</span></a>
    <p class="brand-role">Makeup Artist — Kraków</p>
  </header>
  <nav class="site-nav" aria-label="Główna">
      ${navLinks(page, base)}
      ${LANG}
  </nav>`,
  b: (page, base) => `  <header class="topbar">
    <a class="brand" href="${base}">Kinga Chudzik <span>Makeup Artist</span></a>
    <nav class="site-nav" aria-label="Główna">
      ${navLinks(page, base)}
      ${LANG}
    </nav>
  </header>`,
  c: (page, base) => `  <aside class="sidebar">
    <a class="brand" href="${base}"><span class="brand-name">Kinga <em>Chudzik</em></span><span class="brand-role">Makeup Artist — Kraków</span></a>
    <nav class="site-nav" aria-label="Główna">
      ${navLinks(page, base)}
      ${LANG}
    </nav>
  </aside>`,
};

const bridalIntro = (base) => `  <section class="intro">
    <h1>Makijaż <em>ślubny</em></h1>
    <div class="intro-body">
      <p>Trwały, fotogeniczny makijaż, w którym nadal wyglądasz jak Ty — od makijażu próbnego po dzień ślubu. Dojeżdżam na miejsce przygotowań w Krakowie i okolicach.</p>
      <a class="cta" href="${base}kontakt/?typ=slub">Zapytaj o termin</a>
    </div>
  </section>`;

const contact = (root, portrait) => `  <section class="contact">
    <figure class="contact-photo">
      <img src="${root}img/${portrait.variants[0].file}" srcset="${srcset(portrait, root)}" sizes="(min-width: 760px) 50vw, 100vw" width="${portrait.w}" height="${portrait.h}" alt="Kinga Chudzik przy pracy">
    </figure>
    <div class="contact-body">
      <h1>Kontakt</h1>
      <p class="bio">Kinga Chudzik — makijażystka z Krakowa. Pracuję przy kampaniach beauty, sesjach editorialowych i z twórczyniami internetowymi. Wykonuję również makijaże ślubne.</p>
      <dl class="clients">
        <dt>Wybrani klienci</dt>
        <dd>Marka 01 · Marka 02 · Magazyn 03 · Agencja 04 · Marka 05</dd>
      </dl>
      <form class="form" action="#" method="post" onsubmit="event.preventDefault(); this.querySelector('.form-note').hidden = false;">
        <div class="field"><label for="f-name">Imię i nazwisko</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>
        <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="f-type">Rodzaj zapytania</label>
          <select id="f-type" name="typ">
            <option value="kampania">Kampania / sesja</option>
            <option value="slub">Ślub</option>
            <option value="inne">Inne</option>
          </select>
        </div>
        <div class="field field--date"><label for="f-date">Data ślubu</label><input id="f-date" name="date" type="date"></div>
        <div class="field"><label for="f-msg">Wiadomość</label><textarea id="f-msg" name="message" rows="4" required></textarea></div>
        <p class="consent">Wysyłając formularz, akceptujesz <span class="fake-link">politykę prywatności</span>.</p>
        <button class="btn" type="submit">Wyślij zapytanie</button>
        <p class="form-note" hidden>To tylko koncepcja — formularz jeszcze niczego nie wysyła.</p>
      </form>
      <ul class="direct">
        <li><a href="https://www.instagram.com/kingachudzik.makeup/" rel="noopener">Instagram</a></li>
        <li><a href="mailto:kontakt@kingachudzik.com">kontakt@kingachudzik.com</a></li>
        <li>Kraków</li>
      </ul>
    </div>
  </section>
  <script>
    { const typ = new URLSearchParams(location.search).get('typ'); const select = document.getElementById('f-type'); if (typ && select) select.value = typ; }
  </script>`;

const footer = (key) => `  <footer class="site-footer">
    <p>© 2026 Kinga Chudzik</p>
    <ul>
      <li><a href="https://www.instagram.com/kingachudzik.makeup/" rel="noopener">Instagram</a></li>
      <li><a href="mailto:kontakt@kingachudzik.com">kontakt@kingachudzik.com</a></li>
      <li><span class="fake-link">Polityka prywatności</span></li>
    </ul>
    <p class="note">Koncepcja ${key.toUpperCase()} · zdjęcia zastępcze: Unsplash</p>
  </footer>`;

const LIGHTBOX = `  <dialog class="lb" aria-label="Podgląd zdjęcia" tabindex="-1">
    <img class="lb-img" alt="" draggable="false">
    <button class="lb-close" type="button">Zamknij</button>
    <button class="lb-prev" type="button" aria-label="Poprzednie zdjęcie">←</button>
    <button class="lb-next" type="button" aria-label="Następne zdjęcie">→</button>
    <p class="lb-count" aria-live="polite"></p>
  </dialog>`;

// przełącznik pokazuje tylko koncepcje z tej samej rundy
const switcher = (key, root, path) => `  <nav class="cswitch" aria-label="Przełącz koncepcję">
    <a href="${root}">Koncepcje</a>
    ${Object.entries(CONCEPTS)
      .filter(([, c]) => c.round === CONCEPTS[key].round)
      .map(([k]) => `<a href="${root}${k}/${path}"${k === key ? ' aria-current="true"' : ''}>${k.toUpperCase()}</a>`)
      .join('\n    ')}
  </nav>`;

function page(key, concept, def, main) {
  const base = def.path ? '../' : './';
  const root = def.path ? '../../' : '../';
  const styles = ['base.css', ...concept.styles].map((f) => `  <link rel="stylesheet" href="${root}assets/${f}">`).join('\n');
  const scripts = ['lightbox.js', ...(concept.scripts ?? [])].map((f) => `  <script src="${root}assets/${f}" defer></script>`).join('\n');
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${def.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${concept.fonts}&display=swap">
${styles}${concept.round === 2 ? "\n  <script>document.documentElement.classList.add('js');</script>" : ''}
</head>
<body class="page-${def.key} v-${key}${concept.round === 2 ? ' v2' : ''}">
${CHROME[concept.chrome](def.key, base)}
  <main>
${main({ base, root })}
  </main>
${footer(key)}
${LIGHTBOX}
${switcher(key, root, def.path)}
${scripts}
</body>
</html>
`;
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// ---------- budowanie ----------

mkdirSync(IMG, { recursive: true });
const flat = { work: await loadSet('work'), bridal: await loadSet('bridal') };
const campaigns = { work: await loadEntries('work'), bridal: await loadEntries('bridal') };
const portrait = await prepare(join(ROOT, 'photos', 'portrait.jpg'), 'portrait');

for (const file of readdirSync(IMG)) if (file.endsWith('.webp') && !produced.has(file)) rmSync(join(IMG, file));
writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([file]) => produced.has(file))), null, 2));

for (const [key, concept] of Object.entries(CONCEPTS)) {
  const streamOf = (set, root, alt) =>
    concept.campaigns ? campaignStream(campaigns[set], concept, root, alt) : stream(flat[set], concept, root, alt);
  const mains = {
    work: ({ root }) => `  <h1 class="sr-only">Portfolio</h1>\n${streamOf('work', root, 'Makijaż beauty — praca')}`,
    bridal: ({ base, root }) => `${bridalIntro(base)}\n${streamOf('bridal', root, 'Makijaż ślubny — praca')}`,
    contact: ({ root }) => contact(root, portrait),
  };
  for (const def of PAGES) write(join(OUT, key, def.path, 'index.html'), page(key, concept, def, mains[def.key]));
}

mkdirSync(join(OUT, 'assets'), { recursive: true });
for (const file of readdirSync(join(ROOT, 'src'))) {
  const dest = file === 'index.html' ? join(OUT, file) : join(OUT, 'assets', file);
  copyFileSync(join(ROOT, 'src', file), dest);
}
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`Gotowe: ${Object.keys(CONCEPTS).length} koncepcji, ${produced.size} plików zdjęć → docs/`);
