/**
 * Conversion RVB → CMJN, arithmétique.
 *
 * ⚠ CE N'EST PAS UNE SÉPARATION D'IMPRESSION.
 * La vraie conversion passe par un profil ICC : elle dépend de l'encre,
 * du papier, du procédé et du rendu choisi. Celle-ci est la formule
 * naïve, la même que celle des convertisseurs en ligne — utile pour
 * donner un ordre de grandeur et remplir une fiche couleur, jamais pour
 * envoyer un fichier à l'impression.
 *
 * Le module d'impression de cet outil (estimation d'encrage, simulation
 * de substrat, tons directs) a été retiré ; il ne reste que cette
 * conversion, et elle s'affiche accompagnée de sa réserve.
 */
import { hexToRgb255 } from './space';

export type Cmjn = { c: number; m: number; j: number; n: number };

export const CMJN_RESERVE =
  'Conversion arithmétique, sans profil ICC : un ordre de grandeur, pas une séparation. ' +
  'À vérifier en profil avant tout BAT.';

/** Composantes en pourcentages entiers, 0 à 100. */
export function rgbToCmjn(hex: string): Cmjn | null {
  const rgb = hexToRgb255(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];

  const n = 1 - Math.max(r, g, b);
  // Noir pur : les trois autres encres n'ont pas de sens (division par 0).
  if (n >= 1) return { c: 0, m: 0, j: 0, n: 100 };

  const pct = (v: number) => Math.round(((1 - v - n) / (1 - n)) * 100);
  return { c: pct(r), m: pct(g), j: pct(b), n: Math.round(n * 100) };
}

/** `C 12 · M 40 · J 78 · N 5`, pour affichage et copie. */
export function formatCmjn(cmjn: Cmjn): string {
  return `C ${cmjn.c} · M ${cmjn.m} · J ${cmjn.j} · N ${cmjn.n}`;
}
