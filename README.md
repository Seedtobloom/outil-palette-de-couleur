# Nuancier

Atelier de couleur pour graphistes — palettes fonctionnelles, lisibles,
responsables, harmonieuses, suffisamment contrastées et suffisamment fournies.

**État : Phase 0** — le moteur qui ne ment pas, avec son interface minimale :
coller des couleurs, lire la matrice de contraste expliquée, corriger en un clic.

- `brief-outil-palette-couleurs.md` — le brief technique, source de vérité.
- `NOTES.md` — journal des décisions, alternatives écartées, incertitudes.

## Commandes

```bash
npm install
npm run dev      # développement
npm test         # recette du moteur (Vitest)
npm run check    # svelte-check + TypeScript strict
npm run build    # build de production
```

## Architecture

`src/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2 (bloquant) + APCA (signal), simulations de
daltonisme Machado 2009 avec sévérité, et la couche `explain/` qui fait
produire au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`src/App.svelte`, `src/lib/`) ne fait qu'afficher.
