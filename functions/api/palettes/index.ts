/**
 * Pages Function : POST /api/palettes.
 * Nécessite le binding KV « NUANCIER_KV » (dashboard → projet Pages →
 * Settings → Bindings → KV namespace).
 */
import { apiError, savePalette } from '../../../shared/api';

type Env = { NUANCIER_KV: KVNamespace };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.NUANCIER_KV) {
    return apiError(503, 'Stockage non configuré (binding KV NUANCIER_KV absent).');
  }
  return savePalette(context.request, context.env.NUANCIER_KV);
};
