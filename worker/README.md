# BACK — le Worker (API de sauvegarde/partage)

Ce dossier est le **back** en version « Worker autonome ».

- `standalone.ts` — la source du Worker à créer **à la main dans le
  dashboard Cloudflare** (template Hello World) : `npm run build:worker`
  la compile en **`worker-dashboard.js`** (à la racine du dépôt), le
  fichier unique à coller dans l'éditeur en ligne.
- `index.ts` — variante pour un déploiement en ligne de commande
  (wrangler), non nécessaire si tu passes par le dashboard.

La logique réelle (validation, sauvegarde, lecture) vit dans `shared/` —
ces fichiers ne sont que des enrobages.
