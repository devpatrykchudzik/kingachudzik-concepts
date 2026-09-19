#!/usr/bin/env node
// Generator koncepcji wizualnych.
// Czyta zdjęcia z photos/, skaluje je do WebP (sharp) i składa statyczne strony do docs/ (GitHub Pages).
// Kolejność zdjęć w strumieniu = kolejność alfabetyczna plików. Układ wierszy wynika z orientacji zdjęć.
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

const CONCEPTS = {
  a: {
    name: 'Editorial',
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
    fonts: 'family=Instrument+Sans:wght@400;500;600',
    pattern: [2, 3],
    // ścisła siatka: pusta połowa wiersza wygląda jak brakujące zdjęcie, więc grupy dzielimy bez samotnej reszty
    avoidSolo: true,
    sizes: {
      full: '100vw',
      pair: '50vw',
      trio: '(min-width: 720px) 33vw, 50vw',
      solo: '50vw',
    },
  },
  c: {
    name: 'Noir',
    fonts: 'family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300..500',
    pattern: [1],
    sizes: {
      full: '(min-width: 900px) 75vw, 100vw',
      solo: '(min-width: 900px) 45vw, 85vw',
    },
  },
};

const PAGES = [
  { key: 'work', label: 'Work', path: '', title: 'Kinga Chudzik — Makeup Artist' },
  { key: 'bridal', label: 'Śluby', path: 'sluby/', title: 'Makijaż ślubny — Kinga Chudzik' },
  { key: 'contact', label: 'Kontakt', path: 'kontakt/', title: 'Kontakt — Kinga Chudzik' },
];

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
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const photos = [];
  for (const [i, f] of files.entries()) {
    photos.push({ ...(await prepare(join(dir, f), `${name}-${String(i + 1).padStart(2, '0')}`)), index: i });
  }
  return photos;
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

function figure(photo, sizes, total, root, alt) {
  const largest = photo.variants.at(-1);
  const srcset = photo.variants.map((v) => `${root}img/${v.file} ${v.w}w`).join(', ');
  const number = String(photo.index + 1).padStart(2, '0');
  const loading = photo.index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `      <figure class="ph ph--${photo.orient}">
        <a href="${root}img/${largest.file}" data-lightbox>
          <img src="${root}img/${photo.variants[0].file}" srcset="${srcset}" sizes="${sizes}" width="${photo.w}" height="${photo.h}" alt="${alt} ${number}" ${loading} decoding="async">
        </a>
        <figcaption><span>${number}</span> / ${total}</figcaption>
      </figure>`;
}

function stream(photos, concept, root, alt) {
  const total = String(photos.length).padStart(2, '0');
  const html = rows(photos, concept)
    .map((row) => {
      const figures = row.items.map((p) => figure(p, concept.sizes[row.type], total, root, alt)).join('\n');
      return `    <div class="row row--${row.type}${row.flip ? ' is-flip' : ''}">\n${figures}\n    </div>`;
    })
    .join('\n');
  return `  <section class="stream" aria-label="Portfolio">\n${html}\n  </section>`;
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
      <img src="${root}img/${portrait.variants[0].file}" srcset="${portrait.variants.map((v) => `${root}img/${v.file} ${v.w}w`).join(', ')}" sizes="(min-width: 760px) 50vw, 100vw" width="${portrait.w}" height="${portrait.h}" alt="Kinga Chudzik przy pracy">
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

const switcher = (key, root, path) => `  <nav class="cswitch" aria-label="Przełącz koncepcję">
    <a href="${root}">Koncepcje</a>
    ${Object.keys(CONCEPTS)
      .map((k) => `<a href="${root}${k}/${path}"${k === key ? ' aria-current="true"' : ''}>${k.toUpperCase()}</a>`)
      .join('\n    ')}
  </nav>`;

function page(key, concept, def, main) {
  const base = def.path ? '../' : './';
  const root = def.path ? '../../' : '../';
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
  <link rel="stylesheet" href="${root}assets/base.css">
  <link rel="stylesheet" href="${root}assets/${key}.css">
</head>
<body class="page-${def.key}">
${CHROME[key](def.key, base)}
  <main>
${main({ base, root })}
  </main>
${footer(key)}
${LIGHTBOX}
${switcher(key, root, def.path)}
  <script src="${root}assets/lightbox.js" defer></script>
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
const work = await loadSet('work');
const bridal = await loadSet('bridal');
const portrait = await prepare(join(ROOT, 'photos', 'portrait.jpg'), 'portrait');

for (const file of readdirSync(IMG)) if (file.endsWith('.webp') && !produced.has(file)) rmSync(join(IMG, file));
writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([file]) => produced.has(file))), null, 2));

for (const [key, concept] of Object.entries(CONCEPTS)) {
  const mains = {
    work: ({ root }) => `  <h1 class="sr-only">Portfolio</h1>\n${stream(work, concept, root, 'Makijaż beauty — praca')}`,
    bridal: ({ base, root }) => `${bridalIntro(base)}\n${stream(bridal, concept, root, 'Makijaż ślubny — praca')}`,
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

console.log(`Gotowe: ${work.length} zdjęć Work, ${bridal.length} ślubnych, ${Object.keys(CONCEPTS).length} koncepcje → docs/`);
