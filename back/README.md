# BACK — le Worker qui sert l'application

Un seul fichier, `index.ts`, et il ne fait qu'une chose : servir les
fichiers construits par Vite.

Ce dossier a porté une API de sauvegarde et de partage de palettes
(`api.ts`, `validate.ts`, un namespace KV, une variante Pages dans
`functions/`). Les liens de partage ont été retirés de l'outil, et tout
cela avec eux.

Conséquence : **rien ne quitte le navigateur**. Le moteur colorimétrique
a toujours tourné côté client ; il n'y a désormais plus aucune route
capable de recevoir quoi que ce soit.
