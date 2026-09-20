/**
 * L'ambiance : le fond de page se teinte de la palette en cours.
 *
 * C'est l'idée maîtresse de l'outil de référence, et celle qui se voit
 * le plus : quatre halos géants posés dans les coins, dont les couleurs
 * sont reprises de la palette qu'on est en train de fabriquer, et qui
 * se fondent en 0,6 s à chaque changement. On travaille littéralement
 * *dans* sa palette.
 *
 * Trois précautions, qui sont la raison d'être de ce module :
 *
 * 1. seules les couleurs FRANCHES sont retenues, triées par intensité.
 *    Prendre les premières de la liste donnerait des halos gris dès que
 *    la palette commence par ses neutres ;
 * 2. les halos sont très dilués et posés HORS du cadre. Le centre de
 *    l'écran reste neutre — c'est là que se trouvent les cartes
 *    blanches où les couleurs sont jugées (règle des deux zones,
 *    brief §9.1). Un fond trop présent fausserait la lecture ;
 * 3. palette vide, on retombe sur les couleurs de la marque.
 */
import { parseToOklch } from '../engine';
import { settings } from './state.svelte';

/** Les teintes de repli : celles de Seed to Bloom. */
const REPLI = ['#412f21', '#f2e5c2', '#e4d1fe', '#f2e5c2'];

/** En dessous, la couleur est un neutre : elle ne teinterait rien. */
const SEUIL_FRANCHE = 0.04;

/** `#412f21` → `65, 47, 33`, la forme qu'attend `rgba()` en CSS. */
function composantes(hex: string): string {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/(.)/g, '$1$1') : v, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Les quatre couleurs d'ambiance, dans l'ordre des coins. Exportée pour
 * être testable : c'est du calcul, pas de l'affichage.
 */
export function couleursAmbiance(hexes: readonly string[]): string[] {
  const franches = hexes
    .map((hex) => ({ hex, o: parseToOklch(hex) }))
    .filter((x) => x.o !== null && x.o.c >= SEUIL_FRANCHE)
    .sort((a, b) => b.o!.c - a.o!.c)
    .map((x) => x.hex);

  const source = franches.length > 0 ? franches : REPLI;
  // Repli circulaire : trois couleurs franches suffisent à peupler
  // quatre coins, la première revient au quatrième.
  return [0, 1, 2, 3].map((i) => source[i % source.length] as string);
}

/**
 * Écrit les variables d'ambiance sur `<html>`. À appeler depuis un
 * effet : la fonction ne touche qu'au DOM, jamais à l'état réactif —
 * un effet qui réécrirait l'état se relancerait lui-même.
 */
export function appliqueAmbiance(): void {
  if (typeof document === 'undefined') return;
  const couleurs = couleursAmbiance(settings.colors.map((c) => c.hex));
  const racine = document.documentElement;
  couleurs.forEach((hex, i) => {
    racine.style.setProperty(`--amb-${i + 1}`, composantes(hex));
  });
}
