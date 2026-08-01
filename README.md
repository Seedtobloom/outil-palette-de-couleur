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

## Déploiement à la main via le dashboard Cloudflare (sans wrangler)

Le front (SPA dans `dist/`) est servi par **Cloudflare Pages** ; le back est
le dossier **`functions/`** (Pages Functions), détecté et déployé
automatiquement — aucune ligne de commande Cloudflare n'est nécessaire.
Le moteur colorimétrique reste entièrement côté client ; le back ne fait
que la sauvegarde/partage de palettes en KV.

### 1. Créer le projet Pages (une seule fois)

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → onglet
   **Pages** → **Connect to Git**.
2. Choisir ce dépôt GitHub et la branche à déployer.
3. Réglages de build :
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
4. **Save and Deploy** — le site est en ligne, le dossier `functions/` est
   pris en compte automatiquement.

### 2. Brancher le stockage KV (pour le partage de palettes)

1. Dashboard → **Storage & Databases** → **KV** → **Create a namespace**
   (nom libre, ex. `nuancier`).
2. Projet Pages → **Settings** → **Bindings** (ou *Functions*) →
   **Add binding** → type **KV namespace** :
   - **Variable name** : `NUANCIER_KV` (exactement)
   - **KV namespace** : celui créé à l'étape 1.
3. Relancer un déploiement (**Deployments** → **Retry deployment**, ou
   pousser un commit).

Sans ce binding, le site fonctionne entièrement — seul le bouton « Créer un
lien de partage » répond que le stockage n'est pas configuré.

Ensuite, **chaque poussée sur la branche redéploie tout automatiquement**
(front + API), et chaque pull request reçoit une URL d'aperçu.

### API du back

| Route | Méthode | Rôle |
|---|---|---|
| `/api/health` | GET | état du service |
| `/api/palettes` | POST | sauvegarde une recette de palette → `{ id }` |
| `/api/palettes/:id` | GET | relit une recette (liens de partage `/?p=id`) |

On ne stocke jamais la palette générée : seulement la **recette** (couleur
de base + réglages, < 1 Ko, versionnée), validée et bornée côté serveur —
le front régénère la palette à l'identique à l'ouverture du lien.

### Variante en ligne de commande (optionnelle)

Pour qui préfère wrangler, `worker/` + `wrangler.jsonc` déploient la même
API en Worker unique : `npx wrangler kv namespace create NUANCIER_KV`,
coller l'id dans `wrangler.jsonc`, puis `npm run deploy`. La logique d'API
est partagée (`shared/api.ts`) : les deux modes restent identiques.

## Architecture

`src/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2 (bloquant) + APCA (signal), simulations de
daltonisme Machado 2009 avec sévérité, et la couche `explain/` qui fait
produire au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`src/App.svelte`, `src/lib/`) ne fait qu'afficher.
