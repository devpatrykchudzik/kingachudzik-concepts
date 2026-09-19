// Koncepcja E: miniatura podmienia duże zdjęcie kampanii (najechanie myszą, tapnięcie albo fokus z klawiatury).
(() => {
  for (const campaign of document.querySelectorAll('[data-swap]')) {
    const slides = [...campaign.querySelectorAll('.camp-stage a')];
    const thumbs = [...campaign.querySelectorAll('.thumb')];

    function activate(n) {
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === n));
      thumbs.forEach((thumb, i) => {
        thumb.classList.toggle('is-active', i === n);
        thumb.setAttribute('aria-pressed', String(i === n));
      });
    }

    thumbs.forEach((thumb, n) => {
      thumb.addEventListener('click', () => activate(n));
      thumb.addEventListener('focus', () => activate(n));
      thumb.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') activate(n);
      });
    });
  }
})();
