/**
 * APCA — signal qualité perceptuel, strictement informatif.
 *
 * Position normative (brief §3.3) : APCA a été retiré du working draft de
 * WCAG 3 en 2023 et ne confère AUCUNE conformité. Dans tout le moteur :
 * WCAG 2.2 = verrou bloquant, APCA = indication de qualité. Une paire qui
 * échoue WCAG 2.2 est refusée même si son Lc est excellent.
 */
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { hexToRgb255 } from '../color/space';
import type { PairUsage } from '../types';

/**
 * Score Lc APCA (texte sur fond). Signé : positif = texte sombre sur fond
 * clair, négatif = texte clair sur fond sombre. Asymétrique, contrairement
 * au ratio WCAG.
 */
export function apcaLc(text: string, background: string): number {
  const txt = hexToRgb255(text);
  const bg = hexToRgb255(background);
  if (!txt || !bg) throw new Error(`Couleur illisible : « ${text} » ou « ${background} »`);
  const lc = APCAcontrast(sRGBtoY(txt), sRGBtoY(bg));
  return typeof lc === 'string' ? Number(lc) : lc;
}

/** Seuils indicatifs Lc (annexe B du brief). */
export const APCA_GUIDELINES = [
  { lc: 90, usage: 'Texte fin ou petit corps' },
  { lc: 75, usage: 'Corps de texte, niveau préféré' },
  { lc: 60, usage: 'Texte courant' },
  { lc: 45, usage: 'Grand texte / gros titres' },
  { lc: 30, usage: 'Minimum absolu pour du texte' },
  { lc: 15, usage: 'Minimum non textuel' },
] as const;

/** Lc indicatif minimal pour un usage de paire donné. */
export function apcaTargetFor(usage: PairUsage): number | null {
  switch (usage) {
    case 'body-text':
      return 60;
    case 'large-text':
      return 45;
    case 'ui-component':
    case 'focus-ring':
      return 15;
    case 'surface':
    case 'decorative':
      return null;
  }
}

export type ApcaAssessment = {
  lc: number;
  /** |Lc| comparé à la cible indicative. */
  target: number | null;
  /** 'comfortable' | 'limit' | 'weak' — qualitatif, jamais une conformité. */
  quality: 'comfortable' | 'limit' | 'weak' | 'n/a';
};

/** Lecture qualitative du Lc pour un usage. Jamais bloquant. */
export function apcaAssess(text: string, background: string, usage: PairUsage): ApcaAssessment {
  const lc = apcaLc(text, background);
  const target = apcaTargetFor(usage);
  if (target === null) return { lc, target, quality: 'n/a' };
  const abs = Math.abs(lc);
  const quality = abs >= target + 15 ? 'comfortable' : abs >= target ? 'limit' : 'weak';
  return { lc, target, quality };
}
