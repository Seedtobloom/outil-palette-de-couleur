/**
 * Mode inversé (approche Leonardo) : au lieu de choisir une couleur puis de
 * mesurer son contraste, on part du contraste voulu et on génère la couleur.
 */
import { contrastRatio, findLightnessForRatio } from '../contrast/wcag';
import { relativeLuminance } from '../contrast/wcag';
import type { OklchColor } from '../types';
import { parseToOklch } from '../color/space';
import type { Ramp, RampStep } from './generate';

export type InverseResult = {
  /** Le pas existant de la rampe qui atteint la cible (le plus proche du seuil). */
  step: RampStep | null;
  /**
   * La couleur exacte (même teinte/intensité que la rampe à cette clarté)
   * qui atteint précisément le ratio demandé.
   */
  exact: { color: OklchColor; hex: string; ratio: number } | null;
};

/**
 * « Génère le pas qui atteint exactement `ratio` sur ce fond. »
 * Retourne à la fois le pas de rampe le plus économique qui passe, et la
 * couleur exacte au seuil (pour un ajustement fin).
 */
export function stepForContrast(ramp: Ramp, background: string, ratio: number): InverseResult {
  // Pas existant : celui qui passe avec la plus petite marge (le plus
  // proche du seuil = le plus fidèle à l'intention de clarté).
  let step: RampStep | null = null;
  let bestMargin = Infinity;
  for (const s of ramp.steps) {
    const r = contrastRatio(s.hex, background);
    const margin = r - ratio;
    if (margin >= 0 && margin < bestMargin) {
      bestMargin = margin;
      step = s;
    }
  }

  // Couleur exacte : recherche de la clarté au seuil, en gardant la teinte
  // et l'intensité de la rampe autour de cette clarté.
  const bgLum = relativeLuminance(background);
  const reference = step ?? ramp.steps[Math.floor(ramp.steps.length / 2)]!;
  const direction: 'darker' | 'lighter' =
    (parseToOklch(background)?.l ?? bgLum) >= reference.color.l ? 'darker' : 'lighter';
  const found = findLightnessForRatio(background, ratio, {
    c: reference.color.c,
    h: reference.color.h,
    direction,
  });
  const exact = found
    ? {
        color: { l: found.l, c: reference.color.c, h: reference.color.h },
        hex: found.hex,
        ratio: found.ratio,
      }
    : null;

  return { step, exact };
}
