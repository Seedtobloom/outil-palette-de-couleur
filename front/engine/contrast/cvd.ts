/**
 * Simulation des déficiences de vision des couleurs (CVD).
 *
 * Matrices pré-calculées de Machado, Oliveira & Fernandes (2009), publiées
 * par les auteurs pour des sévérités de 0.0 à 1.0 par pas de 0.1 (données
 * reprises du paquet colour-science, BSD-3-Clause — voir NOTES.md).
 * Les matrices s'appliquent en RGB LINÉAIRE ; une sévérité intermédiaire
 * est obtenue par interpolation linéaire entre les deux matrices voisines,
 * comme le font les auteurs.
 *
 * Piège évité (brief §3.4) : simuler uniquement à 100 % fait rater les
 * formes partielles (anomalies), bien plus fréquentes que les dichromaties.
 * D'où le paramètre de sévérité 0–100 partout.
 */
import matrices from '../../data/machado2009.json';
import { parseToOklch, oklchToLinearRgb, rgbToHex } from '../color/space';
import { deltaE00 } from '../color/distance';

export type CvdType = 'protan' | 'deutan' | 'tritan' | 'achromatopsia';

export const CVD_TYPES: { type: CvdType; label: string }[] = [
  { type: 'deutan', label: 'Deutéranopie (vert)' },
  { type: 'protan', label: 'Protanopie (rouge)' },
  { type: 'tritan', label: 'Tritanopie (bleu)' },
  { type: 'achromatopsia', label: 'Achromatopsie (monochrome)' },
];

type Matrix9 = number[];

function machadoMatrix(type: 'protan' | 'deutan' | 'tritan', severity: number): Matrix9 {
  const table = matrices[type] as Record<string, number[]>;
  const s = Math.min(1, Math.max(0, severity));
  const lowKey = (Math.floor(s * 10) / 10).toFixed(1);
  const highKey = (Math.ceil(s * 10) / 10).toFixed(1);
  const low = table[lowKey];
  const high = table[highKey];
  if (!low || !high) throw new Error(`Matrice Machado absente pour la sévérité ${s}`);
  if (lowKey === highKey) return low;
  const t = (s * 10 - Math.floor(s * 10)) / (Math.ceil(s * 10) - Math.floor(s * 10)) || 0;
  return low.map((v, i) => v + ((high[i] as number) - v) * t);
}

/** Transfert sRGB inverse (linéaire → gamma), borné à [0,1]. */
function delinearize(c: number): number {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

/**
 * Simule l'apparence d'une couleur pour un type de CVD à une sévérité
 * donnée (0–100). Retourne un hex sRGB.
 */
export function simulateCvd(color: string, type: CvdType, severity: number): string {
  const oklch = parseToOklch(color);
  if (!oklch) throw new Error(`Couleur illisible : « ${color} »`);
  const { r, g, b } = oklchToLinearRgb(oklch);
  const s = Math.min(100, Math.max(0, severity)) / 100;

  if (type === 'achromatopsia') {
    // Gris de même luminance (Y linéaire), interpolé selon la sévérité.
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mix = (c: number) => c + (y - c) * s;
    return rgbToHex(delinearize(mix(r)), delinearize(mix(g)), delinearize(mix(b)));
  }

  const m = machadoMatrix(type, s);
  const r2 = (m[0] as number) * r + (m[1] as number) * g + (m[2] as number) * b;
  const g2 = (m[3] as number) * r + (m[4] as number) * g + (m[5] as number) * b;
  const b2 = (m[6] as number) * r + (m[7] as number) * g + (m[8] as number) * b;
  return rgbToHex(delinearize(r2), delinearize(g2), delinearize(b2));
}

/** Conversion en niveaux de gris perceptuels (identique à l'achromatopsie 100 %). */
export function toGrayscale(color: string): string {
  return simulateCvd(color, 'achromatopsia', 100);
}

export type CvdCollision = {
  a: string;
  b: string;
  type: CvdType;
  severity: number;
  /** ΔE00 entre les deux couleurs après simulation. */
  deltaE: number;
  /** ΔE00 entre les deux couleurs en vision typique. */
  deltaEOriginal: number;
};

/**
 * Seuil de distinguabilité (brief §2.4) : deux couleurs d'une palette
 * catégorielle doivent rester à ΔE00 ≥ 10, y compris après simulation.
 */
export const DISTINGUISHABILITY_THRESHOLD = 10;

/**
 * Cherche les paires de couleurs qui deviennent indistinguables
 * (ΔE00 < seuil) sous un type et une sévérité de CVD donnés.
 */
export function findCvdCollisions(
  colors: { id: string; hex: string }[],
  type: CvdType,
  severity: number,
  threshold: number = DISTINGUISHABILITY_THRESHOLD,
): CvdCollision[] {
  const simulated = colors.map((c) => ({ ...c, sim: simulateCvd(c.hex, type, severity) }));
  const collisions: CvdCollision[] = [];
  for (let i = 0; i < simulated.length; i++) {
    for (let j = i + 1; j < simulated.length; j++) {
      const a = simulated[i]!;
      const b = simulated[j]!;
      const e = deltaE00(a.sim, b.sim);
      if (e < threshold) {
        collisions.push({
          a: a.id,
          b: b.id,
          type,
          severity,
          deltaE: e,
          deltaEOriginal: deltaE00(a.hex, b.hex),
        });
      }
    }
  }
  return collisions;
}
