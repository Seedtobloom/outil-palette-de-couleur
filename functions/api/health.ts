/**
 * Pages Function : GET /api/health.
 * Déploiement « à la main » via le dashboard Cloudflare (Pages + Git) —
 * ce dossier functions/ est détecté et déployé automatiquement.
 */
import { healthResponse } from '../../shared/api';

export const onRequestGet: PagesFunction = async () => healthResponse();
