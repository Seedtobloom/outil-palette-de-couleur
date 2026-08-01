/**
 * Courbes des rampes : cibles de clarté et forme de chroma, éditables.
 *
 * Les profils par défaut sont calibrés empiriquement sur la moyenne des
 * 17 échelles chromatiques (et 5 neutres) de Tailwind v4, publiées en OKLCH
 * — un standard de fait dont les pas correspondent aux usages réels.
 * Rien ici n'est « esthétique » : ce sont des données mesurées.
 */

/**
 * Échelle par défaut. Le prompt produit demande « 12 pas » mais liste 11
 * valeurs (50→950) : contradiction signalée dans NOTES.md, tranchée
 * provisoirement en faveur de la liste explicite. Le nombre de pas est de
 * toute façon configurable (8 à 16).
 */
export const DEFAULT_STEPS: number[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Cibles de clarté (L OKLCH) par pas, teintes chromatiques. */
export const CHROMATIC_L_PROFILE: number[] = [
  0.977, 0.95, 0.906, 0.841, 0.754, 0.683, 0.598, 0.515, 0.446, 0.395, 0.278,
];

/**
 * Cibles de clarté pour les neutres : plus contrastées aux extrêmes
 * (un 950 presque noir pour les fonds sombres, un 50 presque blanc).
 */
export const NEUTRAL_L_PROFILE: number[] = [
  0.985, 0.967, 0.928, 0.872, 0.707, 0.551, 0.446, 0.373, 0.278, 0.21, 0.13,
];

/**
 * Forme de la courbe de chroma : cloche asymétrique. `peak` est la position
 * du chroma maximal (0 = pas le plus clair, 1 = le plus sombre) ;
 * les deux `spread` contrôlent la vitesse de retombée de part et d'autre.
 * Défauts ajustés sur le profil moyen mesuré (c_i / c_500).
 */
export type ChromaCurveParams = {
  peak: number;
  spreadLight: number;
  spreadDark: number;
};

export const DEFAULT_CHROMA_CURVE: ChromaCurveParams = {
  peak: 0.5,
  spreadLight: 0.22,
  spreadDark: 0.38,
};

/** Valeur de la cloche asymétrique en t ∈ [0, 1]. */
export function chromaShape(t: number, params: ChromaCurveParams): number {
  const d = t - params.peak;
  const spread = d < 0 ? params.spreadLight : params.spreadDark;
  return Math.exp(-(d * d) / (2 * spread * spread));
}

/**
 * Ré-échantillonne un profil (défini sur ses points d'origine) pour un
 * nombre de pas différent, par interpolation linéaire sur [0, 1].
 */
export function resampleProfile(profile: number[], count: number): number[] {
  if (count === profile.length) return [...profile];
  if (count < 2) throw new Error('Un profil demande au moins 2 pas');
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (profile.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(profile.length - 1, lo + 1);
    const frac = t - lo;
    out.push((profile[lo] as number) * (1 - frac) + (profile[hi] as number) * frac);
  }
  return out;
}

/**
 * Libellés de pas pour un nombre de pas arbitraire (8 à 16) : on garde la
 * convention 50→950 en répartissant régulièrement.
 */
export function stepLabels(count: number): number[] {
  if (count === DEFAULT_STEPS.length) return [...DEFAULT_STEPS];
  const labels: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    labels.push(Math.round((50 + t * 900) / 10) * 10);
  }
  return labels;
}
