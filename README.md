# Nuancier

Atelier de couleur pour graphistes — palettes fonctionnelles, lisibles,
responsables, harmonieuses, suffisamment contrastées et suffisamment fournies.

## Où est le front, où est le back

```
  front/     interface Svelte + moteur colorimétrique (100 % client)
  back/      le Worker Cloudflare — il ne fait que servir les fichiers
  front.js   chemin de secours : l'application entière inlinée dans un
             seul Worker, à coller dans le dashboard si le déploiement
             automatique est indisponible (npm run build:front)

AUTRES
  index.html, dist/                 page d'entrée et build du front
  brief-outil-palette-couleurs.md   le brief technique, source de vérité
  NOTES.md                          journal des décisions
```

Chaque dossier contient son propre petit README qui rappelle son rôle.

**Rien ne quitte le navigateur.** Tout le calcul est côté client, et il
n'existe aucune route serveur capable de recevoir des données : l'API de
partage de palettes a été retirée en même temps que les liens de partage.

## Commandes

```bash
npm install
npm run dev      # développement front seul (Vite)
npm run dev:full # l'application servie par le Worker (wrangler dev)
npm test         # recette du moteur (Vitest)
npm run check    # svelte-check + TypeScript strict
npm run build    # build de production du front
npm run deploy   # build + déploiement Cloudflare
npm run build:front # régénère front.js (le Worker de secours à coller)
```

## Chemin de secours : coller `front.js` dans un Worker

À n'utiliser que si le déploiement automatique est cassé (jeton expiré,
GitHub Actions indisponible).

1. Dashboard Cloudflare → **Workers & Pages** → le Worker
   `front-outil-palette-de-couleurs` → **Edit code**.
2. Supprimer tout le contenu, coller l'intégralité de
   [`front.js`](./front.js) (ouvrir le fichier sur GitHub → « Copy raw
   file ») → **Deploy**.

`front.js` est régénéré par `npm run build:front`. Il contient l'HTML, le
CSS et le JavaScript inlinés : aucun fichier externe, aucune API.

⚠ Un Worker modifié à la main sera écrasé au prochain push. C'est voulu :
le dépôt reste la source de vérité.

## Déploiement automatique (le mode en service)

C'est le mode réellement utilisé aujourd'hui. **Tout commit poussé sur la
branche par défaut part en ligne**, via `.github/workflows/deploy.yml`.

En ligne : <https://front-outil-palette-de-couleurs.seedtobloom.workers.dev>

> **Le nom du Worker est l'adresse du site.** Il est fixé par le champ
> `name` de `wrangler.jsonc`. Il a valu `nuancier` pendant quatre
> déploiements : chacun a réussi, mais publiait un SECOND Worker à une
> autre adresse, pendant que l'adresse réellement consultée continuait
> d'afficher le `front.js` collé à la main. Rien ne signale cette
> situation — le déploiement est vert des deux côtés. Si un jour le site
> ne bouge plus malgré des workflows au vert, c'est la première chose à
> vérifier.

Le workflow enchaîne installation, contrôle de types, tests, construction,
publication — dans cet ordre. La publication est la dernière étape : si un
test tombe, **rien ne part en production**.

### Ce dont il a besoin

Deux secrets de dépôt (*Settings → Secrets and variables → Actions*) :

| Secret | Où le trouver |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → Mon profil → Jetons d'API, permission *Workers Scripts: Edit* |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard Cloudflare, page Workers, colonne de droite |

Il n'y a rien d'autre à configurer : plus de namespace KV, plus de
binding, le Worker ne sert que des fichiers.

### Remplacer le jeton Cloudflare

Un jeton se remplace sans rien casser, à condition de respecter l'ordre —
sinon le déploiement échoue entre les deux étapes.

1. Cloudflare → Mon profil → Jetons d'API → menu `⋯` → **Roll**. Le jeton
   garde son nom et ses permissions, seule sa valeur change ; l'ancienne
   est invalidée immédiatement. La nouvelle ne s'affiche qu'une fois.
2. GitHub → le secret `CLOUDFLARE_API_TOKEN` → **Update secret**.

Rien d'autre ne bouge : ni le Worker, ni le site en ligne. Un jeton ne
sert qu'à s'authentifier auprès de l'API Cloudflare.

### Revenir à un déploiement manuel

Supprimer le bloc `push:` de `.github/workflows/deploy.yml`. Il ne reste
alors que `workflow_dispatch`, c'est-à-dire le bouton « Run workflow » de
l'onglet Actions.

## Architecture

`front/engine/` est du TypeScript pur, sans le moindre import d'interface,
entièrement testé : conversions OKLCH (pivot), gamut mapping CSS Color 4,
ΔE2000/ΔEOK, contraste WCAG 2.2, et la couche `explain/` qui fait produire
au moteur des diagnostics rédigés et des remèdes applicables.
L'interface Svelte (`front/App.svelte`, `front/lib/`) ne fait qu'afficher.

Le parcours compte **six étapes** : Départ, Nuancier, Harmonie, Rôles,
Contraste, Livraison. Il en a compté onze — un choix de projet, une
sélection de couleur de base, une génération de rampes, un module
d'impression (CMJN, taux d'encrage, substrat) et une déclinaison réseaux
sociaux. Ces étapes ont été retirées, avec la simulation de daltonisme,
l'APCA, la vérification du SC 1.4.1, les liens de partage et les exports
Tailwind / DTCG / SCSS, pour ramener l'outil au périmètre de l'outil de
référence. Le brief (§5 print, §6 éco-conception) décrit donc des modules
qui ne sont plus implémentés.

Une chose n'a **pas** été alignée sur la référence : celle-ci étiquette
un contraste de 3:1 « niveau A ». Il n'existe pas de niveau A de
contraste — c'est le §3.1 du brief. Les verdicts restent AA, AAA et
« grand texte ».
