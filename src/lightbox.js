// Pełnoekranowy podgląd zdjęć: strzałki, klawiatura, gest przesunięcia. Bez JS link po prostu otwiera duży plik.
// Tam, gdzie przeglądarka zna View Transitions, miniatura płynnie „rozrasta się" do podglądu i wraca na miejsce przy zamknięciu.
(() => {
  const links = [...document.querySelectorAll('a[data-lightbox]')];
  const dialog = document.querySelector('dialog.lb');
  if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;

  const image = dialog.querySelector('.lb-img');
  const count = dialog.querySelector('.lb-count');
  const pad = (n) => String(n).padStart(2, '0');
  const wrap = (n) => (n + links.length) % links.length;
  const canMorph =
    typeof document.startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MORPH = 'lb-photo';
  let current = 0;

  function show(n) {
    current = wrap(n);
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector('img')?.alt ?? '';
    count.textContent = `${pad(current + 1)} / ${pad(links.length)}`;
    for (const k of [current + 1, current - 1]) new Image().src = links[wrap(k)].href;
  }

  // przejście między dwoma elementami: nazwę dostaje najpierw źródło, a po zmianie widoku — cel
  function morph(from, to, update) {
    if (!canMorph || !from || !to) return update();
    from.style.viewTransitionName = MORPH;
    const transition = document.startViewTransition(async () => {
      from.style.viewTransitionName = '';
      to.style.viewTransitionName = MORPH;
      await update();
    });
    transition.finished.finally(() => {
      to.style.viewTransitionName = '';
    });
  }

  function open(n) {
    morph(links[n].querySelector('img'), image, async () => {
      show(n);
      dialog.showModal();
      dialog.focus();
      await image.decode().catch(() => {});
    });
  }

  function close() {
    const link = links[current];
    const thumb = link.querySelector('img');
    // w koncepcji E nieaktywne slajdy są ukryte — wtedy zamykamy bez przejścia
    const visible = thumb && getComputedStyle(link).opacity !== '0';
    morph(image, visible ? thumb : null, () => {
      dialog.close();
      thumb?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }

  links.forEach((link, n) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      open(n);
    }),
  );

  dialog.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  dialog.querySelector('.lb-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  let startX = null;
  dialog.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
  });
  dialog.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) > 50) show(current + (delta < 0 ? 1 : -1));
  });
})();
