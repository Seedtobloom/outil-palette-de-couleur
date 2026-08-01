# FRONT — l'application dans le navigateur

Tout ce dossier est le **front** : l'interface Svelte et le moteur
colorimétrique (qui tourne côté client, jamais sur le serveur).

- `engine/` — le moteur : couleur, contraste, rampes, palette, exports
- `lib/` — les composants d'interface
- `App.svelte`, `main.ts`, `styles/` — l'app elle-même

Déployé par **Cloudflare Pages** : build `npm run build` → dossier `dist/`.
