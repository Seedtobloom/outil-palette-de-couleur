/**
 * Entrée « Worker autonome » : la version du back destinée à être créée
 * À LA MAIN dans le dashboard Cloudflare à partir du template Hello World.
 *
 * `npm run build:back` bundle ce fichier (avec back/api.ts) en un seul
 * fichier `back.js` à coller tel quel dans l'éditeur en ligne.
 * Ne pas éditer back.js directement : modifier back/api.ts
 * ou ce fichier, puis regénérer.
 *
 * Différences avec worker/index.ts (variante wrangler) :
 * - pas d'assets : ce Worker ne sert QUE l'API, le front vit sur Pages ;
 * - CORS ouvert : le front peut appeler ce Worker depuis un autre domaine
 *   (*.pages.dev → *.workers.dev). Les données ne sont pas sensibles et
 *   aucune session n'existe, donc « * » est approprié.
 */
import { apiError, healthResponse, readPalette, savePalette } from './api';

export interface Env {
  NUANCIER_KV: KVNamespace;
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) {
      return withCors(
        new Response(
          'API Nuancier — le front est servi séparément (Cloudflare Pages). Essayez /api/health.',
          { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
        ),
      );
    }

    if (!env.NUANCIER_KV) {
      return withCors(apiError(503, 'Stockage non configuré (binding KV NUANCIER_KV absent).'));
    }

    if (pathname === '/api/health' && request.method === 'GET') {
      return withCors(healthResponse());
    }
    if (pathname === '/api/palettes' && request.method === 'POST') {
      return withCors(await savePalette(request, env.NUANCIER_KV));
    }
    const match = pathname.match(/^\/api\/palettes\/([0-9a-z]+)$/);
    if (match && request.method === 'GET') {
      return withCors(await readPalette(match[1] as string, env.NUANCIER_KV));
    }
    return withCors(apiError(404, 'Route inconnue.'));
  },
} satisfies ExportedHandler<Env>;
