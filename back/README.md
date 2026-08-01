# BACK — l'API de sauvegarde/partage (Worker + KV)

Tout ce dossier est le **back**.

La logique réelle :
- `validate.ts` — validation stricte des recettes de palettes
- `api.ts` — les trois opérations : santé, sauvegarde, lecture

Les enrobages de déploiement :
- `standalone.ts` — le Worker à créer **à la main dans le dashboard
  Cloudflare** (template Hello World) : `npm run build:back` le compile
  en **`back.js`** (à la racine du dépôt), le fichier unique à
  coller dans l'éditeur en ligne.
- `index.ts` — variante pour un déploiement en ligne de commande
  (wrangler), non nécessaire si tu passes par le dashboard.

Voir aussi `functions/` à la racine : la même API en variante intégrée à
Pages (ce dossier-là doit garder son nom, convention Cloudflare).
