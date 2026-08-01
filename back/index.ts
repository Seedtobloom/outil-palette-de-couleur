/**
 * Enrobage « Worker unique » de l'API (déploiement via wrangler).
 * Le chemin de déploiement principal du projet est SANS wrangler :
 * Cloudflare Pages + dossier functions/ via le dashboard — voir README.
 * Ce Worker reste disponible pour qui préfère `npm run deploy`.
 * La logique vit dans back/api.ts, identique dans les deux modes.
 */
import { apiError, healthResponse, readPalette, savePalette } from './api';

export interface Env {
  NUANCIER_KV: KVNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) {
      // Ne devrait pas arriver (run_worker_first ne route que /api/*),
      // mais on garde le repli vers les assets par sûreté.
      return env.ASSETS.fetch(request);
    }

    if (pathname === '/api/health' && request.method === 'GET') {
      return healthResponse();
    }
    if (pathname === '/api/palettes' && request.method === 'POST') {
      return savePalette(request, env.NUANCIER_KV);
    }
    const match = pathname.match(/^\/api\/palettes\/([0-9a-z]+)$/);
    if (match && request.method === 'GET') {
      return readPalette(match[1] as string, env.NUANCIER_KV);
    }
    return apiError(404, 'Route inconnue.');
  },
} satisfies ExportedHandler<Env>;
