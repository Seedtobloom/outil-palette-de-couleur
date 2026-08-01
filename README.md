# Nuancier

Atelier de couleur pour graphistes — palettes fonctionnelles, lisibles,
responsables, harmonieuses, suffisamment contrastées et suffisamment fournies.

## Où est le front, où est le back

```
FRONT  (l'application dans le navigateur — déployée sur Cloudflare Pages)
  front/            interface Svelte + moteur colorimétrique (100 % client)
  index.html        page d'entrée
  dist/             résultat du build (npm run build) — c'est lui que Pages publie

BACK   (l'API de sauvegarde/partage — un Worker Cloudflare + stockage KV)
  back-a-coller.js  LE FICHIER À COLLER dans le Worker « Hello World » du dashboard
  back/             son code source : logique d'API + enrobages Worker
  functions/        variante optionnelle : même API intégrée à Pages
                    (ce nom exact est imposé par Cloudflare, sinon il s'appellerait back aussi)

AUTRES
  brief-outil-palette-couleurs.md   le brief technique, source de vérité
  NOTES.md                          journal des décisions
```

Chaque dossier contient son propre petit README qui rappelle son rôle.

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

Trois briques, toutes créées en cliquant dans le dashboard :
le **front** sur Pages, le **back** en Worker créé depuis le template
« Hello World », et le **stockage** en KV. Le moteur colorimétrique reste
entièrement côté client ; le back ne fait que la sauvegarde/partage.

### 1. Le FRONT — projet Pages

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → onglet
   **Pages** → **Connect to Git**.
2. Choisir ce dépôt GitHub et la branche à déployer.
3. Réglages de build :
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
4. **Save and Deploy** → le site est en ligne sur `https://….pages.dev`.

### 2. Le BACK — Worker créé depuis « Hello World »

1. **Workers & Pages** → **Create** → onglet **Workers** → template
   **Hello World** → nom : `nuancier-api` → **Deploy**.
2. Sur la page du Worker : **Edit code** (l'éditeur en ligne s'ouvre sur
   le hello world).
3. **Supprimer tout le contenu** du fichier et coller à la place
   l'intégralité de [`back-a-coller.js`](./back-a-coller.js)
   (ouvrir le fichier sur GitHub → bouton « Copy raw file »).
4. **Deploy** (en haut à droite de l'éditeur).
5. Vérifier : `https://nuancier-api.<ton-compte>.workers.dev/api/health`
   doit répondre `{"ok":true,"service":"nuancier"}`.

À ce stade l'API répond mais dit « stockage non configuré » sur le
partage : il lui faut sa base.

### 3. La BASE — namespace KV + binding

1. Dashboard → **Storage & Databases** → **KV** → **Create a namespace**
   → nom libre, ex. `nuancier-palettes`.
2. Retour sur le Worker `nuancier-api` → **Settings** → **Bindings**
   (ou « Variables ») → **Add** → type **KV namespace** :
   - **Variable name** : `NUANCIER_KV` (exactement, majuscules comprises)
   - **KV namespace** : `nuancier-palettes`
3. **Save** (le Worker redémarre avec sa base).

### 4. Relier le front au back

Le front doit connaître l'adresse du Worker :

1. Projet Pages → **Settings** → **Environment variables** → **Add** :
   - **Variable name** : `VITE_API_BASE`
   - **Value** : `https://nuancier-api.<ton-compte>.workers.dev`
   - à ajouter pour **Production** (et Preview si tu veux le partage sur
     les URL d'aperçu).
2. C'est une variable **de build** : relancer un déploiement
   (**Deployments** → **⋯** → **Retry deployment**).
3. Tester : sur le site, « Créer un lien de partage » doit produire un
   lien, et l'ouvrir doit recharger la palette.

> Alternative sans Worker séparé : le dossier `functions/` embarque la
> même API directement dans Pages — il suffit alors d'ajouter le binding
> KV `NUANCIER_KV` au **projet Pages** (Settings → Bindings) et de ne PAS
> définir `VITE_API_BASE`. Les deux chemins partagent le même code.

### Mise à jour du back

Le Worker collé à la main ne se met pas à jour tout seul : quand
`back-a-coller.js` change dans le dépôt (le commit le régénère via
`npm run build:worker`), recoller son contenu dans l'éditeur du Worker et
**Deploy**. Le front, lui, se redéploie automatiquement à chaque poussée.

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

## Architecture

`front/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2 (bloquant) + APCA (signal), simulations de
daltonisme Machado 2009 avec sévérité, et la couche `explain/` qui fait
produire au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`front/App.svelte`, `front/lib/`) ne fait qu'afficher.
