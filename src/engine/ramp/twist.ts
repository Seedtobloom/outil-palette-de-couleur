/**
 * Torsion de teinte : dérive contrôlée de la teinte le long de la rampe
 * (quelques degrés entre l'extrémité claire et l'extrémité sombre), pour
 * compenser les décalages perçus (Bezold–Brücke, Abney) ou installer une
 * ambiance (chaud vers le clair = solaire, froid vers le sombre = profond).
 * La torsion est linéaire et ancrée sur le pas de base : la couleur de
 * marque n'est jamais altérée.
 */
import { normalizeHue } from '../color/space';

/**
 * Teinte du pas `index` pour une torsion totale de `degrees`
 * (positif = la teinte augmente vers le sombre).
 */
export function twistedHue(
  baseHue: number,
  index: number,
  baseIndex: number,
  stepCount: number,
  degrees: number,
): number {
  if (stepCount < 2) return normalizeHue(baseHue);
  return normalizeHue(baseHue + (degrees * (index - baseIndex)) / (stepCount - 1));
}
