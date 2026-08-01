/**
 * Générateur de rampes. Une rampe = une teinte déclinée en pas réguliers,
 * du presque blanc au presque noir, avec :
 * - des cibles de clarté éditables (profil calibré par défaut) ;
 * - une courbe de chroma éditable (cloche asymétrique ou multiplicateurs
 *   explicites), TOUJOURS bornée par le plafond de gamut — une rampe à
 *   chroma constant est physiquement impossible (brief §2.2) ;
 * - une torsion de teinte optionnelle ;
 * - la couleur de base reproduite EXACTEMENT sur son pas (fidélité marque).
 */
import type { GamutName, OklchColor } from '../types';
import { gamutMap, inGamut, maxChroma } from '../color/gamut';
import { oklchToHex } from '../color/space';
import {
  CHROMATIC_L_PROFILE,
  DEFAULT_CHROMA_CURVE,
  DEFAULT_STEPS,
  chromaShape,
  resampleProfile,
  stepLabels,
  type ChromaCurveParams,
} from './curves';
import { twistedHue } from './twist';

/** Marge sous le plafond de gamut (évite de camper sur la frontière). */
const GAMUT_HEADROOM = 0.98;

export type RampOptions = {
  /** Nombre de pas (8 à 16). Ignoré si `lightnessTargets` est fourni. */
  stepCount?: number;
  /** Gamut cible pour le plafond de chroma. Défaut : sRGB. */
  gamut?: GamutName;
  /** Cibles de clarté explicites (une par pas, décroissantes). */
  lightnessTargets?: number[];
  /** Paramètres de la cloche de chroma (défaut calibré). */
  chromaCurve?: ChromaCurveParams;
  /** Multiplicateurs de chroma explicites (un par pas, relatifs à la base). */
  chromaMultipliers?: number[];
  /** Torsion de teinte totale en degrés, clair → sombre. Défaut : 0. */
  hueTorsion?: number;
  /**
   * Force le pas (libellé : 500, 600…) qui portera la couleur de base.
   * Par défaut : le pas dont la cible de clarté est la plus proche.
   */
  baseStep?: number;
  /**
   * Ancrer la couleur de base : son pas le plus proche la reproduit
   * exactement et les clartés voisines glissent en douceur. Défaut : vrai.
   */
  anchorBase?: boolean;
};

export type RampStep = {
  /** Libellé du pas (50, 100, … 950). */
  step: number;
  color: OklchColor;
  hex: string;
  /** Vrai pour le pas qui porte exactement la couleur de base. */
  isBase: boolean;
};

export type Ramp = {
  steps: RampStep[];
  baseIndex: number;
  gamut: GamutName;
};

/**
 * Génère une rampe complète à partir d'une couleur de base.
 * La base est supposée dans le gamut cible (sinon elle est d'abord mappée).
 */
export function generateRamp(base: OklchColor, options: RampOptions = {}): Ramp {
  const gamut = options.gamut ?? 'srgb';
  const safeBase = inGamut(base, gamut) ? base : gamutMap(base, gamut);

  const targets =
    options.lightnessTargets ??
    resampleProfile(CHROMATIC_L_PROFILE, options.stepCount ?? DEFAULT_STEPS.length);
  const n = targets.length;
  if (n < 2) throw new Error('Une rampe demande au moins 2 pas');
  if (options.chromaMultipliers && options.chromaMultipliers.length !== n) {
    throw new Error('chromaMultipliers doit avoir un multiplicateur par pas');
  }
  const labels = stepLabels(n);

  // Pas de base : imposé par l'option, sinon celui dont la cible de
  // clarté est la plus proche.
  let baseIndex = 0;
  if (options.baseStep !== undefined) {
    baseIndex = labels.indexOf(options.baseStep);
    if (baseIndex === -1) throw new Error(`Pas ${options.baseStep} absent de l'échelle`);
  } else {
    for (let i = 1; i < n; i++) {
      if (
        Math.abs((targets[i] as number) - safeBase.l) <
        Math.abs((targets[baseIndex] as number) - safeBase.l)
      ) {
        baseIndex = i;
      }
    }
  }

  const anchor = options.anchorBase ?? true;
  const delta = anchor ? safeBase.l - (targets[baseIndex] as number) : 0;
  const maxDist = Math.max(baseIndex, n - 1 - baseIndex, 1);
  const curve = options.chromaCurve ?? DEFAULT_CHROMA_CURVE;
  const tBase = baseIndex / (n - 1);
  const shapeBase = chromaShape(tBase, curve);
  const torsion = options.hueTorsion ?? 0;

  const steps: RampStep[] = [];
  for (let i = 0; i < n; i++) {
    if (anchor && i === baseIndex) {
      steps.push({
        step: labels[i] as number,
        color: safeBase,
        hex: oklchToHex(gamutMap(safeBase, 'srgb')),
        isBase: true,
      });
      continue;
    }
    const w = 1 - Math.abs(i - baseIndex) / maxDist;
    const l = clamp01((targets[i] as number) + delta * w, 0.02, 0.995);
    const h = twistedHue(safeBase.h, i, baseIndex, n, torsion);
    const multiplier =
      options.chromaMultipliers?.[i] ?? chromaShape(i / (n - 1), curve) / shapeBase;
    const ceiling = GAMUT_HEADROOM * maxChroma(l, h, gamut);
    const c = Math.min(safeBase.c * multiplier, ceiling);
    const color: OklchColor = { l, c, h };
    steps.push({
      step: labels[i] as number,
      color,
      hex: oklchToHex(gamutMap(color, 'srgb')),
      isBase: false,
    });
  }

  return { steps, baseIndex, gamut };
}

function clamp01(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Le pas d'une rampe dont la clarté est la plus proche d'une cible. */
export function nearestStepByLightness(ramp: Ramp, l: number): RampStep {
  let best = ramp.steps[0]!;
  for (const s of ramp.steps) {
    if (Math.abs(s.color.l - l) < Math.abs(best.color.l - l)) best = s;
  }
  return best;
}
