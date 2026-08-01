# BACK — variante Pages Functions (optionnelle)

Même API que le Worker (le code vient de `back/api.ts`), mais intégrée au
projet **Cloudflare Pages** : si un binding KV `NUANCIER_KV` est ajouté au
projet Pages, ces routes répondent directement sur le domaine du front
(`/api/…`) sans créer de Worker séparé.

⚠ Ce dossier doit s'appeler exactement `functions/` — c'est la convention
Cloudflare Pages, il ne peut pas être renommé en `back/`.

Si tu utilises le Worker créé à la main (voir `back/`), tu peux ignorer ce
dossier — il ne gêne pas.
