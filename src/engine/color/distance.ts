/**
 * Métriques de différence perceptuelle.
 * - ΔE2000 : référence pour la tolérance print et l'écart écran/papier.
 * - ΔEOK : distance euclidienne en OKLab — rapide, utilisée par le gamut
 *   mapping et les tests de distinguabilité.
 */
import { differenceCiede2000 } from 'culori';
import type { OklchColor } from '../types';
import { oklchToOklab, parseToOklch } from './space';

const ciede2000 = differenceCiede2000();

type ColorInput = OklchColor | string;

function asOklch(c: ColorInput): OklchColor {
  if (typeof c !== 'string') return c;
  const parsed = parseToOklch(c);
  if (!parsed) throw new Error(`Couleur illisible : « ${c} »`);
  return parsed;
}

/** ΔE2000 entre deux couleurs (via CIELab D65). */
export function deltaE00(a: ColorInput, b: ColorInput): number {
  const ca = asOklch(a);
  const cb = asOklch(b);
  return ciede2000(
    { mode: 'oklch', l: ca.l, c: ca.c, h: ca.h },
    { mode: 'oklch', l: cb.l, c: cb.c, h: cb.h },
  );
}

/** ΔEOK : distance euclidienne en OKLab. */
export function deltaEOK(a: ColorInput, b: ColorInput): number {
  const la = oklchToOklab(asOklch(a));
  const lb = oklchToOklab(asOklch(b));
  return Math.sqrt((la.l - lb.l) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

/** ΔE2000 directement sur des valeurs CIELab (utile pour les tests témoins). */
export function deltaE00Lab(
  a: { l: number; a: number; b: number },
  b: { l: number; a: number; b: number },
): number {
  return ciede2000(
    { mode: 'lab65', l: a.l, a: a.a, b: a.b },
    { mode: 'lab65', l: b.l, a: b.a, b: b.b },
  );
}
