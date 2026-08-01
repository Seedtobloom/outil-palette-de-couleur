/**
 * Appartenance au gamut, plafond de chroma, et gamut mapping selon
 * l'algorithme normalisé du CSS Color Module Level 4 (§ css-gamut-map) :
 * réduction du chroma par dichotomie à L et H constants, avec critère
 * d'arrêt ΔEOK < 0.02 contre la version écrêtée (MINDE local).
 */
import { converter } from 'culori';
import type { GamutName, OklchColor } from '../types';
import { normalizeHue, oklchToP3, oklchToRgb } from './space';
import { deltaEOK } from './distance';

const toOklchConv = converter('oklch');

/** Tolérance d'appartenance au gamut (bruit numérique des conversions). */
const GAMUT_EPSILON = 0.000005;
/** « Just noticeable difference » de l'algo CSS Color 4, en ΔEOK. */
const JND = 0.02;
/** Précision de la dichotomie sur le chroma. */
const CHROMA_EPSILON = 0.0001;

function channels(c: OklchColor, gamut: GamutName): { r: number; g: number; b: number } {
  return gamut === 'srgb' ? oklchToRgb(c) : oklchToP3(c);
}

/** La couleur est-elle affichable telle quelle dans ce gamut ? */
export function inGamut(c: OklchColor, gamut: GamutName): boolean {
  const { r, g, b } = channels(c, gamut);
  const lo = -GAMUT_EPSILON;
  const hi = 1 + GAMUT_EPSILON;
  return r >= lo && r <= hi && g >= lo && g <= hi && b >= lo && b <= hi;
}

/** Écrêtage brut canal par canal — uniquement comme étape interne du mapping. */
function clip(c: OklchColor, gamut: GamutName): OklchColor {
  const { r, g, b } = channels(c, gamut);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  // Repasser par l'espace de destination écrêté, puis revenir en OKLCH.
  const clipped =
    gamut === 'srgb'
      ? { mode: 'rgb' as const, r: clamp(r), g: clamp(g), b: clamp(b) }
      : { mode: 'p3' as const, r: clamp(r), g: clamp(g), b: clamp(b) };
  return convertBack(clipped);
}

function convertBack(c: { mode: 'rgb' | 'p3'; r: number; g: number; b: number }): OklchColor {
  const o = toOklchConv(c);
  return { l: o.l, c: o.c, h: normalizeHue(o.h ?? 0) };
}

/**
 * Ramène une couleur dans le gamut cible selon l'algo CSS Color 4 :
 * L et H sont conservés, C est réduit par dichotomie jusqu'à ce que la
 * version écrêtée soit à moins de ΔEOK 0.02 de la version réduite.
 */
export function gamutMap(color: OklchColor, gamut: GamutName): OklchColor {
  if (color.l >= 1) return { l: 1, c: 0, h: color.h };
  if (color.l <= 0) return { l: 0, c: 0, h: color.h };
  if (inGamut(color, gamut)) return color;

  let min = 0;
  let max = color.c;
  let minInGamut = true;
  let current: OklchColor = { ...color };

  while (max - min > CHROMA_EPSILON) {
    const chroma = (min + max) / 2;
    current = { l: color.l, c: chroma, h: color.h };
    if (minInGamut && inGamut(current, gamut)) {
      min = chroma;
    } else {
      const clipped = clip(current, gamut);
      const e = deltaEOK(clipped, current);
      if (e < JND) {
        if (JND - e < CHROMA_EPSILON) return clipped;
        minInGamut = false;
        min = chroma;
      } else {
        max = chroma;
      }
    }
  }
  return clip(current, gamut);
}

/**
 * Plafond de chroma affichable pour un couple (L, H) dans un gamut.
 * C'est la fonction qui rend impossible-à-rater le piège de la « rampe à
 * chroma constant » : le plafond dépend fortement de la teinte et de L.
 */
export function maxChroma(l: number, h: number, gamut: GamutName): number {
  if (l <= 0 || l >= 1) return 0;
  let lo = 0;
  // 0.5 est au-delà de tout chroma atteignable en sRGB comme en P3.
  let hi = 0.5;
  while (hi - lo > CHROMA_EPSILON) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h }, gamut)) lo = mid;
    else hi = mid;
  }
  return lo;
}
