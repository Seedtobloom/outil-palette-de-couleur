/**
 * Enrobage « Worker unique » de l'API (déploiement via wrangler).
 * Le chemin de déploiement principal du projet est SANS wrangler :
 * Cloudflare Pages + dossier functions/ via le dashboard — voir README.
 * Ce Worker reste disponible pour qui préfère `npm run deploy`.
 * La logique vit dans back/api.ts, identique dans les deux modes.
 */
import { apiError, healthResponse, readPalette, savePalette } from './api';

export interface Env {
  /**
   * Optionnel à dessein. Le stockage ne sert QU'aux liens de partage :
   * tout le reste de l'outil tourne dans le navigateur. Exiger un
   * namespace KV pour déployer bloquerait la mise en ligne pour une
   * fonction annexe — le Worker se déploie donc sans, et seules les
   * routes de partage répondent alors qu'elles ne sont pas configurées.
   */
  NUANCIER_KV?: KVNamespace;
  ASSETS: Fetcher;
}

const SANS_STOCKAGE =
  'Le partage de palette n’est pas activé sur ce déploiement : il demande ' +
  'un namespace KV nommé NUANCIER_KV. Tout le reste de l’outil fonctionne.';

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
      if (!env.NUANCIER_KV) return apiError(503, SANS_STOCKAGE);
      return savePalette(request, env.NUANCIER_KV);
    }
    const match = pathname.match(/^\/api\/palettes\/([0-9a-z]+)$/);
    if (match && request.method === 'GET') {
      if (!env.NUANCIER_KV) return apiError(503, SANS_STOCKAGE);
      return readPalette(match[1] as string, env.NUANCIER_KV);
    }
    return apiError(404, 'Route inconnue.');
  },
} satisfies ExportedHandler<Env>;
