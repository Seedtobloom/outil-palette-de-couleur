# BACK — logique partagée de l'API

Le vrai code du back : validation stricte des recettes de palettes
(`validate.ts`) et les trois opérations de l'API (`api.ts` : santé,
sauvegarde, lecture). Utilisé à l'identique par le Worker (`worker/`) et
par les Pages Functions (`functions/`) — une seule implémentation.
