/**
 * Génère `front.js` : le fichier à coller dans un Worker « Hello World »
 * du dashboard Cloudflare. C'est le chemin de secours, pour remettre le
 * site en ligne sans GitHub Actions ni wrangler.
 *
 * Principe : on prend le build Vite (dist/) et on inline tout — HTML, CSS,
 * JavaScript — dans un seul Worker qui sert la page. L'outil tourne
 * entièrement dans le navigateur : il n'y a plus d'API à relayer depuis
 * que le partage de palette a été retiré.
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
// Nuancier, page unique : tout est inliné, rien n'est appelé au serveur.
const PAGE = ${JSON.stringify(html)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
