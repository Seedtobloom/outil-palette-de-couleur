/**
 * Schémas d'harmonie classiques, exprimés en décalages d'angle de roue
 * (RYB ou RGB, au choix explicite de l'utilisateur).
 */
import { rotateOnWheel, type WheelName } from './wheels';

export type SchemeName =
  | 'monochrome'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'tetradic';

export type Scheme = {
  name: SchemeName;
  label: string;
  /** Décalages en degrés de roue pour les teintes secondaires. */
  offsets: number[];
  /** Une phrase, en français courant, sur l'effet du schéma. */
  effect: string;
};

export const SCHEMES: Scheme[] = [
  {
    name: 'monochrome',
    label: 'Monochrome',
    offsets: [],
    effect: 'Une seule teinte, déclinée en clartés : sobre et sûr, hiérarchie à construire par la clarté seule.',
  },
  {
    name: 'analogous',
    label: 'Analogue',
    offsets: [-30, 30],
    effect: 'Teintes voisines : naturel et cohérent, mais peu de tension — l’accent devra venir de la clarté.',
  },
  {
    name: 'complementary',
    label: 'Complémentaire',
    offsets: [180],
    effect: 'Opposition maximale : très vivant, à doser (une dominante, un accent), sinon ça vibre.',
  },
  {
    name: 'split-complementary',
    label: 'Complémentaire divisé',
    offsets: [150, 210],
    effect: 'La tension de la complémentaire, sans l’affrontement frontal : le meilleur rapport tension/confort.',
  },
  {
    name: 'triadic',
    label: 'Triadique',
    offsets: [120, 240],
    effect: 'Trois teintes équidistantes : riche et vivant, exige une hiérarchie de clartés très nette.',
  },
  {
    name: 'tetradic',
    label: 'Tétradique',
    offsets: [90, 180, 270],
    effect: 'Quatre teintes : le plus difficile à équilibrer — réserver deux teintes aux petites touches.',
  },
];

export function schemeByName(name: SchemeName): Scheme {
  const s = SCHEMES.find((x) => x.name === name);
  if (!s) throw new Error(`Schéma inconnu : ${name}`);
  return s;
}

/**
 * Teintes OKLCH produites par un schéma sur une roue donnée, à partir
 * d'une teinte de base. La base est toujours la première de la liste.
 */
export function schemeHues(baseHue: number, scheme: SchemeName, wheel: WheelName): number[] {
  const s = schemeByName(scheme);
  return [baseHue, ...s.offsets.map((offset) => rotateOnWheel(wheel, baseHue, offset))];
}
