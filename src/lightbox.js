// Pełnoekranowy podgląd zdjęć: strzałki, klawiatura, gest przesunięcia. Bez JS link po prostu otwiera duży plik.
(() => {
  const links = [...document.querySelectorAll('a[data-lightbox]')];
  const dialog = document.querySelector('dialog.lb');
  if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;

  const image = dialog.querySelector('.lb-img');
  const count = dialog.querySelector('.lb-count');
  const pad = (n) => String(n).padStart(2, '0');
  const wrap = (n) => (n + links.length) % links.length;
  let current = 0;

  function show(n) {
    current = wrap(n);
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector('img')?.alt ?? '';
    count.textContent = `${pad(current + 1)} / ${pad(links.length)}`;
    for (const k of [current + 1, current - 1]) new Image().src = links[wrap(k)].href;
  }

  links.forEach((link, n) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      show(n);
      dialog.showModal();
      dialog.focus();
    }),
  );

  dialog.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  dialog.querySelector('.lb-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
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
