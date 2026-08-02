# Nuancier

Atelier de couleur pour graphistes — palettes fonctionnelles, lisibles,
responsables, harmonieuses, suffisamment contrastées et suffisamment fournies.

## Où est le front, où est le back

```
LES DEUX FICHIERS À COPIER-COLLER dans tes Workers « Hello World » :
  front.js   → à coller dans le Worker du FRONT (sert l'application complète)
  back.js    → à coller dans le Worker du BACK (l'API de sauvegarde/partage)

Leur code source :
  front/     interface Svelte + moteur colorimétrique (100 % client)
  back/      logique d'API (validation, sauvegarde, lecture) + enrobages
  functions/ variante optionnelle : même API intégrée à Cloudflare Pages
             (ce nom exact est imposé par Cloudflare, sinon il s'appellerait back aussi)

AUTRES
  index.html, dist/                 page d'entrée et build du front
  brief-outil-palette-couleurs.md   le brief technique, source de vérité
  NOTES.md                          journal des décisions
```

Chaque dossier contient son propre petit README qui rappelle son rôle.
`front.js` et `back.js` sont régénérés par `npm run build:colle`.

## Commandes

```bash
npm install
npm run dev      # développement front seul (Vite)
npm run dev:full # front + back ensemble (wrangler dev, KV simulé en local)
npm test         # recette du moteur + validation du back (Vitest)
npm run check    # svelte-check + TypeScript strict (front et back)
npm run build    # build de production du front
npm run deploy   # build + déploiement Cloudflare (front + back)
```

## Déploiement à la main via le dashboard Cloudflare (sans wrangler)

Deux Workers créés depuis le template « Hello World » — un **front**, un
**back** — plus un namespace **KV** pour la base. Tout se fait en
copiant-collant `front.js` et `back.js` et en cliquant dans le dashboard.
Le moteur colorimétrique reste entièrement côté client ; le back ne fait
que la sauvegarde/partage.

### 1. Le BACK — Worker + fichier `back.js`

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → onglet
   **Workers** → template **Hello World** → nom : `nuancier-back` →
   **Deploy**.
2. Sur la page du Worker : **Edit code**.
3. **Supprimer tout le contenu** du fichier et coller à la place
   l'intégralité de [`back.js`](./back.js)
   (ouvrir le fichier sur GitHub → bouton « Copy raw file »).
4. **Deploy** (en haut à droite de l'éditeur).
5. Vérifier : `https://nuancier-back.<ton-compte>.workers.dev/api/health`
   doit répondre `{"ok":true,"service":"nuancier"}`.

### 2. La BASE — namespace KV relié au back

1. Dashboard → **Storage & Databases** → **KV** → **Create a namespace**
   → nom libre, ex. `nuancier-palettes`.
2. Worker `nuancier-back` → **Settings** → **Bindings** (ou « Variables »)
   → **Add** → type **KV namespace** :
   - **Variable name** : `NUANCIER_KV` (exactement, majuscules comprises)
   - **KV namespace** : `nuancier-palettes`
3. **Save**.

### 3. Le FRONT — Worker + fichier `front.js`

1. **Workers & Pages** → **Create** → onglet **Workers** → template
   **Hello World** → nom : `nuancier` (ce nom sera dans l'adresse du
   site) → **Deploy**.
2. **Edit code** → supprimer tout → coller l'intégralité de
   [`front.js`](./front.js) → **Deploy**.
3. Relier le back : Worker `nuancier` → **Settings** → **Bindings** →
   **Add** → type **Service binding** :
   - **Variable name** : `BACK` (exactement)
   - **Service** : `nuancier-back`
4. **Save**.

### 4. Vérifier

1. Ouvre `https://nuancier.<ton-compte>.workers.dev` : l'application
   complète se charge.
2. Onglet « Construire une palette » → **Créer un lien de partage** → un
   lien apparaît ; ouvre-le dans un onglet privé : la palette se recharge.
3. Curieuse ? **Storage & Databases → KV → nuancier-palettes → View** :
   une clé `palette:…` par lien créé.

Si le partage répond « Back non relié », c'est le binding `BACK` de
l'étape 3.3 ; s'il répond « stockage non configuré », c'est le binding
`NUANCIER_KV` de l'étape 2.

### Mise à jour

Les Workers collés à la main ne se mettent pas à jour tout seuls : quand
`front.js` ou `back.js` changent dans le dépôt (régénérés par
`npm run build:colle` à chaque évolution), recoller le contenu dans
l'éditeur du Worker concerné et **Deploy**. En pratique le front bougera
à chaque phase du produit ; le back, rarement.

> Alternative sans copier-coller : un projet **Cloudflare Pages** connecté
> à ce dépôt Git redéploie le front automatiquement à chaque poussée
> (build `npm run build`, dossier `dist`), et le dossier `functions/` y
> embarque la même API — il suffit d'ajouter le binding KV `NUANCIER_KV`
> au projet Pages. Les deux chemins partagent le même code.

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

Pour qui préfère wrangler, `back/index.ts` + `wrangler.jsonc` déploient
front et API en un seul Worker : `npx wrangler kv namespace create
NUANCIER_KV`, coller l'id dans `wrangler.jsonc`, puis `npm run deploy`.
La logique d'API est partagée (`back/api.ts`) : tous les modes restent
identiques.

## Déploiement automatique (le mode en service)

C'est le mode réellement utilisé aujourd'hui. **Tout commit poussé sur la
branche par défaut part en ligne**, via `.github/workflows/deploy.yml`.

En ligne : <https://nuancier.seedtobloom.workers.dev>

Le workflow enchaîne installation, contrôle de types, tests, construction,
publication — dans cet ordre. La publication est la dernière étape : si un
test tombe, **rien ne part en production**.

### Ce dont il a besoin

Deux secrets de dépôt (*Settings → Secrets and variables → Actions*) :

| Secret | Où le trouver |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → Mon profil → Jetons d'API, permission *Workers Scripts: Edit* |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard Cloudflare, page Workers, colonne de droite |

L'identifiant du namespace KV, lui, vit dans `wrangler.jsonc`. Ce n'est
pas un secret : c'est une référence, pas une clé d'accès.

### Remplacer le jeton Cloudflare

Un jeton se remplace sans rien casser, à condition de respecter l'ordre —
sinon le déploiement échoue entre les deux étapes.

1. Cloudflare → Mon profil → Jetons d'API → menu `⋯` → **Roll**. Le jeton
   garde son nom et ses permissions, seule sa valeur change ; l'ancienne
   est invalidée immédiatement. La nouvelle ne s'affiche qu'une fois.
2. GitHub → le secret `CLOUDFLARE_API_TOKEN` → **Update secret**.

Rien d'autre ne bouge : ni le Worker, ni le KV, ni le site en ligne. Un
jeton ne sert qu'à s'authentifier auprès de l'API Cloudflare.

### Revenir à un déploiement manuel

Supprimer le bloc `push:` de `.github/workflows/deploy.yml`. Il ne reste
alors que `workflow_dispatch`, c'est-à-dire le bouton « Run workflow » de
l'onglet Actions.

## Architecture

`front/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2 (bloquant) + APCA (signal), simulations de
daltonisme Machado 2009 avec sévérité, et la couche `explain/` qui fait
produire au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`front/App.svelte`, `front/lib/`) ne fait qu'afficher.
