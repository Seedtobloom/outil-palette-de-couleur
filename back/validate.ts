/**
 * Validation du contenu sauvegardé. On ne stocke JAMAIS la palette
 * générée : seulement les paramètres d'entrée (recette reproductible par
 * le moteur côté client). Tout champ inconnu est rejeté, toute valeur est
 * bornée — le KV ne doit contenir que des données saines.
 */

export type StoredPalette = {
  version: 1;
  baseColor: string;
  options: {
    scheme: string;
    wheel: 'ryb' | 'rgb';
    intensity: number;
    neutralInfluence: number;
    hueTorsion: number;
  };
  created: string;
};

const SCHEMES = [
  'monochrome',
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'tetradic',
];

const HEX_RE = /^#[0-9a-f]{6}$/;
/** Taille maximale du corps accepté (les recettes font < 1 Ko). */
export const MAX_BODY_BYTES = 4096;

function isFinite01(x: unknown, min: number, max: number): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
}

/**
 * Valide et normalise une recette de palette. Retourne null si invalide.
 * Ne conserve QUE les champs connus (aucune donnée arbitraire en KV).
 */
export function validatePalette(input: unknown, now: Date): StoredPalette | null {
  if (typeof input !== 'object' || input === null) return null;
  const o = input as Record<string, unknown>;
  if (typeof o.baseColor !== 'string' || !HEX_RE.test(o.baseColor)) return null;
  const opts = o.options;
  if (typeof opts !== 'object' || opts === null) return null;
  const op = opts as Record<string, unknown>;
  if (typeof op.scheme !== 'string' || !SCHEMES.includes(op.scheme)) return null;
  if (op.wheel !== 'ryb' && op.wheel !== 'rgb') return null;
  if (!isFinite01(op.intensity, 0.5, 1.2)) return null;
  if (!isFinite01(op.neutralInfluence, 0, 1)) return null;
  if (!isFinite01(op.hueTorsion, -30, 30)) return null;

  return {
    version: 1,
    baseColor: o.baseColor,
    options: {
      scheme: op.scheme,
      wheel: op.wheel,
      intensity: op.intensity,
      neutralInfluence: op.neutralInfluence,
      hueTorsion: op.hueTorsion,
    },
    created: now.toISOString(),
  };
}

/** Identifiant court non devinable (base36, ~62 bits). */
export function generateId(randomBytes: Uint8Array): string {
  let id = '';
  for (const b of randomBytes) id += (b % 36).toString(36);
  return id;
}
