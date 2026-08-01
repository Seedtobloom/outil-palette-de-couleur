/**
 * Contraste WCAG 2.2 — le verrou de conformité, bloquant.
 *
 * Rappel de justesse (brief §3.1) : il n'existe AUCUN niveau A pour le
 * contraste. 4.5:1 = AA (SC 1.4.3), 7:1 = AAA (SC 1.4.6), 3:1 non textuel
 * = AA (SC 1.4.11). Ce module ne mentionne donc jamais de « niveau A ».
 */
import type { PairUsage, WcagLevel } from '../types';
import { parseToOklch, oklchToRgb, oklchToHex } from '../color/space';
import { gamutMap } from '../color/gamut';

/**
 * Luminance relative selon la formule WCAG 2.x (seuil 0.03928 de la spec,
 * identique à WebAIM). Entrée : hex ou toute couleur CSS sRGB.
 */
export function relativeLuminance(color: string): number {
  const oklch = parseToOklch(color);
  if (!oklch) throw new Error(`Couleur illisible : « ${color} »`);
  const { r, g, b } = oklchToRgb(oklch);
  const lin = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ratio de contraste WCAG, symétrique, dans [1, 21]. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagThresholds = {
  /** Seuil AA, ou null si l'usage est exempté (décoratif/désactivé). */
  aa: number | null;
  /** Seuil AAA, ou null si la norme n'en définit pas pour cet usage. */
  aaa: number | null;
  /** Critère de succès applicable, ex. "WCAG 2.2 SC 1.4.3". */
  rule: string;
  /** Vrai si le seuil est indicatif (aucune norme), ex. fond/fond. */
  advisory: boolean;
};

/** Seuils par type d'usage — matrice typée du brief §3.5. */
export function wcagThresholds(usage: PairUsage): WcagThresholds {
  switch (usage) {
    case 'body-text':
      return { aa: 4.5, aaa: 7, rule: 'WCAG 2.2 SC 1.4.3 / 1.4.6', advisory: false };
    case 'large-text':
      return { aa: 3, aaa: 4.5, rule: 'WCAG 2.2 SC 1.4.3 / 1.4.6', advisory: false };
    case 'ui-component':
      return { aa: 3, aaa: null, rule: 'WCAG 2.2 SC 1.4.11', advisory: false };
    case 'focus-ring':
      return { aa: 3, aaa: null, rule: 'WCAG 2.2 SC 1.4.11', advisory: false };
    case 'surface':
      // Aucune norme pour la séparation de surfaces : cible indicative 1.2:1.
      return { aa: 1.2, aaa: null, rule: 'aucune norme — cible indicative', advisory: true };
    case 'decorative':
      return { aa: null, aaa: null, rule: 'WCAG 2.2 — exempté (décoratif/désactivé)', advisory: false };
  }
}

export type WcagResult = {
  ratio: number;
  usage: PairUsage;
  thresholds: WcagThresholds;
  /** Conformité atteinte : 'AAA', 'AA', null (échec), ou 'exempt'. */
  level: WcagLevel | 'exempt' | null;
  passesAA: boolean;
  passesAAA: boolean;
};

/** Évalue une paire pour un usage donné. */
export function wcagCheck(fg: string, bg: string, usage: PairUsage): WcagResult {
  const ratio = contrastRatio(fg, bg);
  const thresholds = wcagThresholds(usage);
  if (thresholds.aa === null) {
    return { ratio, usage, thresholds, level: 'exempt', passesAA: true, passesAAA: true };
  }
  const passesAA = ratio >= thresholds.aa;
  const passesAAA = thresholds.aaa !== null && ratio >= thresholds.aaa;
  const level: WcagLevel | null = passesAAA ? 'AAA' : passesAA ? 'AA' : null;
  return { ratio, usage, thresholds, level, passesAA, passesAAA };
}

/**
 * Recherche la clarté (L OKLCH) qui atteint exactement un ratio cible sur un
 * fond donné, à chroma et teinte constants. Socle du « mode inversé » de la
 * Phase 1, utilisé dès la Phase 0 par les remèdes.
 * Retourne null si le ratio est inatteignable dans cette direction.
 */
export function findLightnessForRatio(
  reference: string,
  targetRatio: number,
  { c, h, direction }: { c: number; h: number; direction: 'darker' | 'lighter' },
): { l: number; hex: string; ratio: number } | null {
  const ratioAt = (l: number): { hex: string; ratio: number } => {
    const mapped = gamutMap({ l, c, h }, 'srgb');
    const hex = oklchToHex(mapped);
    return { hex, ratio: contrastRatio(hex, reference) };
  };
  // Bornes : vers le sombre L→0, vers le clair L→1.
  const extreme = direction === 'darker' ? 0 : 1;
  if (ratioAt(extreme).ratio < targetRatio) return null;

  let lo = 0;
  let hi = 1;
  // Invariant : le ratio croît en s'approchant de `extreme`.
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const { ratio } = ratioAt(mid);
    const needMore = ratio < targetRatio;
    if (direction === 'darker') {
      if (needMore) hi = mid;
      else lo = mid;
    } else {
      if (needMore) lo = mid;
      else hi = mid;
    }
  }
  // Prendre le côté qui garantit le seuil.
  const l = direction === 'darker' ? lo : hi;
  const { hex, ratio } = ratioAt(l);
  if (ratio < targetRatio) return null;
  return { l, hex, ratio };
}
