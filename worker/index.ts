/**
 * Back Nuancier — API de persistance des palettes sur Cloudflare Workers.
 *
 * Le front (dist/) est servi en assets statiques par la plateforme ;
 * seules les routes /api/* atteignent ce code (run_worker_first).
 *
 * Endpoints :
 *   GET  /api/health         → état du service
 *   POST /api/palettes       → sauvegarde une recette de palette, retourne { id }
 *   GET  /api/palettes/:id   → relit une recette (lien de partage)
 */
import { MAX_BODY_BYTES, generateId, validatePalette } from './validate';

export interface Env {
  NUANCIER_KV: KVNamespace;
  ASSETS: Fetcher;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

const ID_RE = /^[0-9a-z]{16}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      // Ne devrait pas arriver (run_worker_first ne route que /api/*),
      // mais on garde le repli vers les assets par sûreté.
      return env.ASSETS.fetch(request);
    }

    if (pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true, service: 'nuancier' });
    }

    if (pathname === '/api/palettes' && request.method === 'POST') {
      return savePalette(request, env);
    }

    const match = pathname.match(/^\/api\/palettes\/([0-9a-z]+)$/);
    if (match && request.method === 'GET') {
      return readPalette(match[1] as string, env);
    }

    return error(404, 'Route inconnue.');
  },
} satisfies ExportedHandler<Env>;

async function savePalette(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return error(415, 'Corps JSON attendu.');
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return error(413, 'Recette trop volumineuse.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return error(400, 'JSON illisible.');
  }
  const palette = validatePalette(parsed, new Date());
  if (!palette) {
    return error(422, 'Recette de palette invalide.');
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = generateId(bytes);

  await env.NUANCIER_KV.put(`palette:${id}`, JSON.stringify(palette));
  return json({ id }, 201);
}

async function readPalette(id: string, env: Env): Promise<Response> {
  if (!ID_RE.test(id)) return error(400, 'Identifiant invalide.');
  const stored = await env.NUANCIER_KV.get(`palette:${id}`, 'text');
  if (stored === null) return error(404, 'Palette introuvable.');
  return new Response(stored, { headers: JSON_HEADERS });
}
