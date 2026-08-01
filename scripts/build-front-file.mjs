/**
 * Génère `front.js` : LE fichier à coller dans le Worker « front » créé
 * depuis le template Hello World du dashboard Cloudflare.
 *
 * Principe : on prend le build Vite (dist/) et on inline tout — HTML, CSS,
 * JavaScript — dans un seul Worker qui sert la page. Les routes /api/*
 * sont relayées au Worker « back » via un service binding nommé BACK
 * (à ajouter dans le dashboard : Settings → Bindings → Service binding).
 *
 * Usage : npm run build:front  (fait le build Vite puis ce script)
 */
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('dist/index.html', 'utf8');

// Inline du JS (en échappant </script> pour survivre à l'inclusion HTML).
html = html.replace(
  /<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"[^>]*><\/script>/,
  (_m, path) => {
    const js = readFileSync(`dist/${path}`, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script type="module">${js}</script>`;
  },
);

// Inline du CSS.
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/, (_m, path) => {
  const css = readFileSync(`dist/${path}`, 'utf8');
  return `<style>${css}</style>`;
});

// Les préchargements n'ont plus de sens une fois tout inliné.
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

if (html.includes('src="/assets/') || html.includes('href="/assets/')) {
  throw new Error('Des assets n’ont pas été inlinés — vérifier les motifs du script.');
}

const worker = `// Généré par 'npm run build:front' — ne pas éditer à la main.
// FRONT de Nuancier : à coller dans un Worker créé depuis le template Hello World.
// Relier le back : Settings → Bindings → Service binding, nom de variable « BACK »,
// service = le Worker du back (celui où back.js est collé).
const PAGE = ${JSON.stringify(html)};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (env.BACK) return env.BACK.fetch(request);
      return new Response(
        JSON.stringify({
          error:
            'Back non relié : ajouter un binding « Service » nommé BACK vers le Worker du back.',
        }),
        { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
      );
    }
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
    return new Response(PAGE, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
};
`;

writeFileSync('front.js', worker);
const kb = Math.round(Buffer.byteLength(worker) / 1024);
console.log(`front.js généré (${kb} Ko)`);
