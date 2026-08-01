/**
 * Neutres teintés. Les gris purs (C = 0) sont morts : on injecte une pointe
 * de la teinte de marque (0,005 à 0,02 de chroma) pour que les fonds, textes
 * et bordures appartiennent à la même famille que la marque.
 */
import type { GamutName, OklchColor } from '../types';
import { NEUTRAL_L_PROFILE, resampleProfile, stepLabels } from './curves';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex } from '../color/space';
import type { Ramp, RampStep } from './generate';

export type NeutralOptions = {
  /** Influence de la marque sur les neutres, 0–1 (0 = gris pur). Défaut 0.5. */
  influence?: number;
  stepCount?: number;
  gamut?: GamutName;
};

/** Chroma maximal d'un neutre teinté à influence 1. */
const MAX_TINT_CHROMA = 0.02;

/**
 * Génère la famille de neutres à partir de la teinte de marque.
 * Le chroma est quasi constant (légèrement réduit aux extrêmes, où le gamut
 * se referme de toute façon).
 */
export function generateNeutralRamp(brandHue: number, options: NeutralOptions = {}): Ramp {
  const influence = Math.min(1, Math.max(0, options.influence ?? 0.5));
  const gamut = options.gamut ?? 'srgb';
  const targets = resampleProfile(
    NEUTRAL_L_PROFILE,
    options.stepCount ?? NEUTRAL_L_PROFILE.length,
  );
  const labels = stepLabels(targets.length);
  const tint = influence * MAX_TINT_CHROMA;

  const steps: RampStep[] = targets.map((l, i) => {
    const c = Math.min(tint, 0.9 * maxChroma(l, brandHue, gamut));
    const color: OklchColor = { l, c, h: brandHue };
    return {
      step: labels[i] as number,
      color,
      hex: oklchToHex(gamutMap(color, 'srgb')),
      isBase: false,
    };
  });

  return { steps, baseIndex: Math.floor(targets.length / 2), gamut };
}
