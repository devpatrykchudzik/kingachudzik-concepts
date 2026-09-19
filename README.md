# Kinga Chudzik — koncepcje strony

Robocze koncepcje wizualne strony-portfolio. Runda 1: A — Editorial, B — Atelier, C — Noir.
Runda 2 (na bazie B, z blokami kampanii): D — Lead, E — Podmiana, F — Mozaika.
To materiał do wyboru kierunku, nie docelowa strona. Zdjęcia są zastępcze (Unsplash), teksty przykładowe.

## Podgląd

Wygenerowane strony leżą w `docs/` i są serwowane przez GitHub Pages.

## Podmiana zdjęć

1. Runda 2 (D–F) czyta `photos/campaigns/work/` i `photos/campaigns/bridal/`:
   - **folder = kampania** (np. `01-zapach/`), pierwsze zdjęcie w folderze jest wiodące; opcjonalny `info.json` z polami `title` i `meta` daje podpis,
   - **luźny plik = pojedyncze zdjęcie**; kolejne pojedyncze zdjęcia łączą się w gęste wiersze.
   Runda 1 (A–C) czyta płaskie `photos/work/` i `photos/bridal/`. `photos/portrait.jpg` to zdjęcie na stronie kontaktu.
2. Kolejność = kolejność alfabetyczna nazw (`01-…`, `02-…`, `03.jpg`, …).
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
- `src/` — style koncepcji (`a.css`–`f.css`, `r2.css` wspólny dla rundy 2), wspólna baza, skrypty (lightbox, odsłanianie, podmiana), strona wyboru
- `photos/` — zdjęcia źródłowe
- `docs/` — wynik builda (nie edytować ręcznie)
