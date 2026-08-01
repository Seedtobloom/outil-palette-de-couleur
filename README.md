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
npm run dev      # développement front seul (Vite)
npm run dev:full # front + back ensemble (wrangler dev, KV simulé en local)
npm test         # recette du moteur + validation du back (Vitest)
npm run check    # svelte-check + TypeScript strict (front et worker)
npm run build    # build de production du front
npm run deploy   # build + déploiement Cloudflare (front + back)
```

## Déploiement Cloudflare (front + back)

L'application est un **seul Worker** : le front (`dist/`) est servi en assets
statiques, le back (`worker/`) ne reçoit que les routes `/api/*`
(sauvegarde et partage de palettes en KV). Le moteur colorimétrique reste
entièrement côté client.

Première mise en place :

```bash
npx wrangler login
npx wrangler kv namespace create NUANCIER_KV
# → coller l'id retourné dans wrangler.jsonc (kv_namespaces[0].id)
npm run deploy
```

API du back :

| Route | Méthode | Rôle |
|---|---|---|
| `/api/health` | GET | état du service |
| `/api/palettes` | POST | sauvegarde une recette de palette → `{ id }` |
| `/api/palettes/:id` | GET | relit une recette (liens de partage `/?p=id`) |

On ne stocke jamais la palette générée : seulement la **recette** (couleur
de base + réglages), validée et bornée côté serveur — le front régénère la
palette à l'identique à l'ouverture du lien.

## Architecture

`src/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2 (bloquant) + APCA (signal), simulations de
daltonisme Machado 2009 avec sévérité, et la couche `explain/` qui fait
produire au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`src/App.svelte`, `src/lib/`) ne fait qu'afficher.
