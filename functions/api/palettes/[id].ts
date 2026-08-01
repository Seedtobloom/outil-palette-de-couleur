/**
 * Pages Function : GET /api/palettes/:id (liens de partage /?p=id).
 */
import { apiError, readPalette } from '../../../shared/api';

type Env = { NUANCIER_KV: KVNamespace };

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.NUANCIER_KV) {
    return apiError(503, 'Stockage non configuré (binding KV NUANCIER_KV absent).');
  }
  const id = context.params.id;
  return readPalette(typeof id === 'string' ? id : '', context.env.NUANCIER_KV);
};
