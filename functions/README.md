# BACK — variante Pages Functions (optionnelle)

Même API que le Worker, mais intégrée au projet **Cloudflare Pages** :
si un binding KV `NUANCIER_KV` est ajouté au projet Pages, ces routes
répondent directement sur le domaine du front (`/api/…`) sans créer de
Worker séparé.

Si tu utilises le Worker créé à la main (voir `worker/`), tu peux ignorer
ce dossier — il ne gêne pas.
