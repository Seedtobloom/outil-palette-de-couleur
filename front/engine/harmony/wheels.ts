/**
 * Les deux roues chromatiques, explicitement étiquetées et jamais
 * confondues (brief §4.1) :
 *
 * - Roue RYB (pigmentaire, Itten) : celle des graphistes. Le complémentaire
 *   du rouge y est le VERT.
 * - Roue RGB (lumière) : celle des écrans. Le complémentaire du rouge y est
 *   le CYAN.
 *
 * Chaque roue est une table de correspondance documentée entre l'angle de
 * roue (0–360) et la teinte OKLCH, par interpolation linéaire entre des
 * ancres. Les ancres sont les teintes OKLCH mesurées de couleurs de
 * référence (primaires/secondaires sRGB pour la roue RGB ; primaires et
 * secondaires pigmentaires pour la roue RYB). Aucun calcul en HSL.
 */
import { normalizeHue } from '../color/space';

export type WheelName = 'ryb' | 'rgb';

type Anchor = { angle: number; hue: number };

/**
 * Roue RGB : angles réguliers des primaires/secondaires lumière.
 * Teintes OKLCH mesurées : #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff.
 */
const RGB_ANCHORS: Anchor[] = [
  { angle: 0, hue: 29.23 }, // rouge
  { angle: 60, hue: 109.77 }, // jaune
  { angle: 120, hue: 142.5 }, // vert
  { angle: 180, hue: 194.77 }, // cyan
  { angle: 240, hue: 264.05 }, // bleu
  { angle: 300, hue: 328.36 }, // magenta
  { angle: 360, hue: 29.23 + 360 },
];

/**
 * Roue RYB (Itten) : rouge, orange, jaune, vert, bleu, violet à 60° d'écart.
 * Teintes OKLCH mesurées des couleurs de référence :
 * #ff0000, #ff8000, #ffff00, #00ff00, #0000ff, #8000ff.
 */
const RYB_ANCHORS: Anchor[] = [
  { angle: 0, hue: 29.23 }, // rouge
  { angle: 60, hue: 52.98 }, // orange
  { angle: 120, hue: 109.77 }, // jaune
  { angle: 180, hue: 142.5 }, // vert
  { angle: 240, hue: 264.05 }, // bleu
  { angle: 300, hue: 293.94 }, // violet
  { angle: 360, hue: 29.23 + 360 },
];

function anchors(wheel: WheelName): Anchor[] {
  return wheel === 'ryb' ? RYB_ANCHORS : RGB_ANCHORS;
}

/** Angle de roue → teinte OKLCH. */
export function wheelToHue(wheel: WheelName, angle: number): number {
  const table = anchors(wheel);
  const a = ((angle % 360) + 360) % 360;
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i] as Anchor;
    const hi = table[i + 1] as Anchor;
    if (a >= lo.angle && a <= hi.angle) {
      const t = (a - lo.angle) / (hi.angle - lo.angle);
      return normalizeHue(lo.hue + t * (hi.hue - lo.hue));
    }
  }
  return normalizeHue((table[0] as Anchor).hue);
}

/** Teinte OKLCH → angle de roue (inverse par interpolation). */
export function hueToWheel(wheel: WheelName, hue: number): number {
  const table = anchors(wheel);
  const first = (table[0] as Anchor).hue;
  // Déplier la teinte dans le domaine croissant de la table.
  let h = normalizeHue(hue);
  if (h < first) h += 360;
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i] as Anchor;
    const hi = table[i + 1] as Anchor;
    if (h >= lo.hue && h <= hi.hue) {
      const t = (h - lo.hue) / (hi.hue - lo.hue);
      return (lo.angle + t * (hi.angle - lo.angle)) % 360;
    }
  }
  return 0;
}

/**
 * Décale une teinte OKLCH d'un delta d'angle SUR LA ROUE choisie.
 * C'est l'opération de base des schémas d'harmonie : +180 sur la roue RYB
 * du rouge donne le vert ; +180 sur la roue RGB donne le cyan.
 */
export function rotateOnWheel(wheel: WheelName, hue: number, delta: number): number {
  return wheelToHue(wheel, hueToWheel(wheel, hue) + delta);
}
