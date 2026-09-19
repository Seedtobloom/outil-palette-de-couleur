/**
 * Nommer une couleur en français, d'un ou deux mots.
 *
 * « Couleur 3 » ne dit rien. Un nom — « Ocre », « Bleu nuit », « Rose
 * poudré » — se retient, se discute avec un client et se retrouve dans
 * un export. C'est le seul endroit de l'outil où l'on invente quelque
 * chose plutôt que de le mesurer, donc c'est fait de façon lisible et
 * révisable : une table de teintes, une table de clartés, une règle pour
 * les gris.
 *
 * Le nommage se fait en OKLCH, pas en HSL : les frontières de teinte y
 * correspondent à ce que l'œil voit. En HSL, le jaune occupe une bande
 * minuscule et le vert une bande énorme — les noms tomberaient à côté.
 */
import type { OklchColor } from '../types';
import { parseToOklch } from './space';

/**
 * Familles de teinte, en degrés OKLCH. Les bornes sont posées à l'oreille
 * du vocabulaire courant : ce qu'une graphiste appellerait spontanément
 * « orange » plutôt qu'au découpage régulier du cercle.
 */
const TEINTES: { max: number; nom: string }[] = [
  { max: 20, nom: 'Rouge' },
  { max: 45, nom: 'Terracotta' },
  { max: 70, nom: 'Orange' },
  { max: 95, nom: 'Ocre' },
  { max: 115, nom: 'Jaune' },
  { max: 140, nom: 'Citron' },
  { max: 165, nom: 'Vert' },
  { max: 190, nom: 'Sauge' },
  { max: 210, nom: 'Émeraude' },
  { max: 235, nom: 'Turquoise' },
  { max: 260, nom: 'Cyan' },
  { max: 285, nom: 'Bleu' },
  { max: 310, nom: 'Indigo' },
  { max: 330, nom: 'Violet' },
  { max: 350, nom: 'Prune' },
  { max: 360, nom: 'Rose' },
];

/** Qualificatif de clarté, du plus foncé au plus clair. */
const CLARTES: { max: number; nom: string }[] = [
  { max: 0.18, nom: 'nuit' },
  { max: 0.32, nom: 'profond' },
  { max: 0.45, nom: 'foncé' },
  { max: 0.62, nom: '' },
  { max: 0.75, nom: 'clair' },
  { max: 0.88, nom: 'pâle' },
  { max: 1.01, nom: 'poudré' },
];

/**
 * Les gris ne portent pas de nom de teinte : ils portent leur clarté.
 *
 * ⚠ Les bornes sont en clarté OKLCH, qui n'est PAS la valeur RVB. Le
 * gris moyen #808080 vaut L ≈ 0,60, pas 0,50 — une table calée sur les
 * pourcentages RVB l'aurait appelé « Galet ». C'est le genre d'écart
 * qu'on ne voit qu'en écrivant le test.
 */
const GRIS: { max: number; nom: string }[] = [
  { max: 0.16, nom: 'Encre' },
  { max: 0.32, nom: 'Ardoise' },
  { max: 0.48, nom: 'Graphite' },
  { max: 0.66, nom: 'Gris' },
  { max: 0.78, nom: 'Galet' },
  { max: 0.88, nom: 'Perle' },
  { max: 0.97, nom: 'Craie' },
  { max: 1.01, nom: 'Blanc cassé' },
];

/** En dessous, l'œil ne lit plus de teinte : c'est un neutre. */
const SEUIL_NEUTRE = 0.035;
/** Au-dessus, la couleur est franche ; en dessous, elle est rabattue. */
const SEUIL_RABATTU = 0.075;

function dans<T extends { max: number; nom: string }>(table: T[], valeur: number): string {
  for (const entree of table) if (valeur < entree.max) return entree.nom;
  return (table[table.length - 1] as T).nom;
}

/** Le nom d'une couleur, sans tenir compte de ce qui l'entoure. */
export function nommeCouleur(hex: string): string {
  const c: OklchColor | null = parseToOklch(hex);
  if (!c) return 'Couleur';

  if (c.c < SEUIL_NEUTRE) return dans(GRIS, c.l);

  const teinte = dans(TEINTES, ((c.h % 360) + 360) % 360);
  const clarte = dans(CLARTES, c.l);

  // Une couleur peu saturée mais pas neutre : « rabattu » dit exactement
  // ce qu'une graphiste voit — la teinte est là, elle est juste sourde.
  if (c.c < SEUIL_RABATTU) {
    return clarte === '' ? `${teinte} rabattu` : `${teinte} ${clarte}`;
  }
  return clarte === '' ? teinte : `${teinte} ${clarte}`;
}

/**
 * Nomme une liste de couleurs en évitant les doublons : deux couleurs
 * qui tombent sur le même nom reçoivent un suffixe numéroté. Perdre la
 * distinction serait pire qu'un nom un peu lourd.
 */
export function nommePalette(hexes: readonly string[]): string[] {
  const vus = new Map<string, number>();
  return hexes.map((hex) => {
    const base = nommeCouleur(hex);
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  });
}
