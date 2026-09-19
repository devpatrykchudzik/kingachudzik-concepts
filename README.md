# Kinga Chudzik — koncepcje strony

Trzy robocze koncepcje wizualne strony-portfolio (A — Editorial, B — Atelier, C — Noir).
To materiał do wyboru kierunku, nie docelowa strona. Zdjęcia są zastępcze (Unsplash), teksty przykładowe.

## Podgląd

Wygenerowane strony leżą w `docs/` i są serwowane przez GitHub Pages.

## Podmiana zdjęć

1. Wrzuć zdjęcia do `photos/work/` (strumień główny) i `photos/bridal/` (śluby). `photos/portrait.jpg` to zdjęcie na stronie kontaktu.
2. Kolejność w strumieniu = kolejność alfabetyczna nazw plików (`01.jpg`, `02.jpg`, …).
3. Przebuduj i wypchnij:

```bash
npm install      # tylko za pierwszym razem
npm run build
git add -A && git commit -m "Podmiana zdjęć" && git push
```

## Jak powstaje układ

Układu nie ustawia się ręcznie. `build.mjs` czyta listę zdjęć i na podstawie ich orientacji składa wiersze:
poziome kadry dostają pełną szerokość, pionowe są grupowane według wzorca danej koncepcji
(A: para / pojedyncze, B: para / trójka bez samotnych kafli, C: pojedynczo, na przemian z lewej i prawej).
Docelowa strona ma działać tak samo — w panelu ustawia się tylko kolejność zdjęć.

## Struktura

- `build.mjs` — generator (Node + sharp): skaluje zdjęcia do WebP i składa HTML
- `src/` — style koncepcji (`a.css`, `b.css`, `c.css`), wspólna baza, lightbox, strona wyboru
- `photos/` — zdjęcia źródłowe
- `docs/` — wynik builda (nie edytować ręcznie)
