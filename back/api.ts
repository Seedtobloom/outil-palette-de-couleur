/**
 * Logique de l'API de persistance, partagée entre les deux modes de
 * déploiement : Pages Functions (dashboard Cloudflare, sans wrangler)
 * et Worker unique (wrangler). Une seule implémentation, deux enrobages.
 */
import { MAX_BODY_BYTES, generateId, validatePalette } from './validate';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function apiError(status: number, message: string): Response {
  return json({ error: message }, status);
}

export const ID_RE = /^[0-9a-z]{16}$/;

/** Interface minimale du stockage (KVNamespace la satisfait). */
export type PaletteStore = {
  put(key: string, value: string): Promise<void>;
  get(key: string, type: 'text'): Promise<string | null>;
};

export function healthResponse(): Response {
  return json({ ok: true, service: 'nuancier' });
}

/** POST /api/palettes — valide la recette et la sauvegarde. */
export async function savePalette(request: Request, store: PaletteStore): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return apiError(415, 'Corps JSON attendu.');
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return apiError(413, 'Recette trop volumineuse.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return apiError(400, 'JSON illisible.');
  }
  const palette = validatePalette(parsed, new Date());
  if (!palette) {
    return apiError(422, 'Recette de palette invalide.');
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = generateId(bytes);

  await store.put(`palette:${id}`, JSON.stringify(palette));
  return json({ id }, 201);
}

/** GET /api/palettes/:id — relit une recette sauvegardée. */
export async function readPalette(id: string, store: PaletteStore): Promise<Response> {
  if (!ID_RE.test(id)) return apiError(400, 'Identifiant invalide.');
  const stored = await store.get(`palette:${id}`, 'text');
  if (stored === null) return apiError(404, 'Palette introuvable.');
  return new Response(stored, { headers: JSON_HEADERS });
}
