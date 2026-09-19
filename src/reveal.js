// Odsłanianie przy przewijaniu: elementy, które wchodzą w kadr razem, dostają kaskadowe opóźnienie (--d).
(() => {
  // scena koncepcji E ma clip-path na sobie, więc obserwujemy jej kampanię, a klasę dostaje scena
  const pairs = [...document.querySelectorAll('.v2 .ph, .v2 .camp-stage, .v2 .camp-cap')].map((el) => ({
    watch: el.classList.contains('camp-stage') ? el.parentElement : el,
    mark: el,
  }));
  if (!('IntersectionObserver' in window)) {
    for (const { mark } of pairs) mark.classList.add('is-in');
    return;
  }
  const marks = new Map(pairs.map(({ watch, mark }) => [watch, mark]));
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, order) => {
          const mark = marks.get(entry.target);
          mark.style.setProperty('--d', `${order * 90}ms`);
          mark.classList.add('is-in');
          observer.unobserve(entry.target);
        });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const { watch } of pairs) observer.observe(watch);
})();
