/**
 * Tons directs.
 *
 * Décision de conception (validée) : AUCUN nuancier commercial n'est
 * embarqué. Il n'existe pas de source de correspondances à la fois libre,
 * fiable et maintenue ; les relevés qui circulent divergent de plusieurs
 * unités ΔE et les valeurs restent propriétaires. Le principe de justesse
 * tranche : si le moteur ne peut pas répondre précisément, il se tait.
 *
 * Ce module fait donc deux choses, toutes deux exactes :
 * 1. il accueille la référence que la graphiste LIT sur son nuancier
 *    physique (référence + Lab), et calcule l'écart réel avec la couleur
 *    écran qu'elle veut reproduire ;
 * 2. il détecte les couleurs de la palette qui ne seront pas
 *    distinguables une fois imprimées en ton direct — un simple ΔE entre
 *    deux couleurs, qui ne demande aucune donnée commerciale.
 */
import { deltaE00Lab, deltaE00 } from '../color/distance';
import { oklchToLab, parseToOklch } from '../color/space';

/** Ce que la graphiste saisit depuis son nuancier physique. */
export type SpotEntry = {
  /** Identifiant de la couleur de palette concernée. */
  colorId: string;
  /** Référence telle qu'elle est imprimée sur le nuancier (texte libre). */
  reference: string;
  /** Valeur Lab lue sur le nuancier (D50, comme les nuanciers print). */
  lab: { l: number; a: number; b: number };
};

export type SpotMatch = {
  entry: SpotEntry;
  /** Écart entre la couleur écran et l'encre réelle. */
  deltaE: number;
  status: 'exact' | 'proche' | 'visible' | 'différent';
  /** Phrase en français courant. */
  verdict: string;
};

/** Interprétation des seuils ΔE00 (brief §6.2). */
export function interpretDeltaE(e: number): { status: SpotMatch['status']; verdict: string } {
  if (e < 1) {
    return { status: 'exact', verdict: 'Écart imperceptible : l’encre rend exactement votre couleur.' };
  }
  if (e < 2) {
    return {
      status: 'proche',
      verdict: 'Écart perceptible à l’examen attentif, côte à côte. Sans risque pour un client.',
    };
  }
  if (e < 3.5) {
    return {
      status: 'visible',
      verdict: 'Écart perceptible d’un coup d’œil. À montrer au client avant validation.',
    };
  }
  return {
    status: 'différent',
    verdict:
      'Ce sont deux couleurs différentes : cette encre ne rend pas votre couleur. ' +
      'Cherchez une autre référence, ou acceptez la couleur de l’encre comme couleur de marque.',
  };
}

/** Compare une couleur écran à l'encre réelle saisie depuis le nuancier. */
export function matchSpot(hex: string, entry: SpotEntry): SpotMatch | null {
  const oklch = parseToOklch(hex);
  if (!oklch) return null;
  const lab = oklchToLab(oklch);
  const deltaE = deltaE00Lab(lab, entry.lab);
  const { status, verdict } = interpretDeltaE(deltaE);
  return { entry, deltaE, status, verdict };
}

export type SpotCollision = {
  a: string;
  b: string;
  deltaE: number;
  message: string;
};

/**
 * Seuil de distinguabilité en ton direct. En dessous, deux couleurs
 * tombent sur la même encre : le client paie deux passages pour une seule
 * couleur perçue.
 */
export const SPOT_DISTINCT_THRESHOLD = 3.5;

/**
 * Repère les couleurs de la palette qui ne seront pas distinguables une
 * fois imprimées en ton direct. Ne demande AUCUNE référence commerciale :
 * c'est un écart entre deux couleurs de la palette.
 */
export function findSpotCollisions(
  colors: { id: string; hex: string; label?: string }[],
  threshold = SPOT_DISTINCT_THRESHOLD,
): SpotCollision[] {
  const out: SpotCollision[] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i]!;
      const b = colors[j]!;
      const e = deltaE00(a.hex, b.hex);
      if (e < threshold) {
        out.push({
          a: a.id,
          b: b.id,
          deltaE: e,
          message:
            `« ${a.label ?? a.id} » et « ${b.label ?? b.id} » ne seront pas distinguables ` +
            'en ton direct : elles tomberaient sur la même encre. Deux passages machine ' +
            'pour une seule couleur perçue — soit vous les écartez, soit vous n’en gardez qu’une.',
        });
      }
    }
  }
  return out;
}

export const SPOT_NOTE =
  'Aucun nuancier commercial n’est embarqué dans l’outil : les correspondances qui circulent ' +
  'ne sont ni officielles ni fiables, et un ton direct est une encre sur un papier, jamais une ' +
  'valeur écran. Lisez la référence sur votre nuancier physique et saisissez sa valeur Lab : ' +
  'l’outil vous dira l’écart réel avec votre couleur.';
