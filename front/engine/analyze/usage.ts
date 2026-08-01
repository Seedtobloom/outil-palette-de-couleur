/**
 * Fiche d'usage d'une couleur : à quoi elle sert, sur quoi on peut la
 * poser, et ce qu'on peut poser dessus — avec les niveaux WCAG atteints.
 *
 * Justesse (brief §3.1) : le niveau A ne porte AUCUN ratio de contraste.
 * Le critère de niveau A (SC 1.4.1) interdit de véhiculer une information
 * par la couleur seule. Il est donc traité ici comme une vérification à
 * confirmer par la graphiste, jamais comme un seuil calculé.
 */
import type { OklchColor } from '../types';
import { parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';
import { apcaLc } from '../contrast/apca';
import { bandOf, type Band } from './coverage';

export type TextTest = {
  /** La couleur du texte. */
  fg: string;
  /** Le fond. */
  bg: string;
  label: string;
  ratio: number;
  lc: number;
  /** Niveau atteint pour du texte courant. */
  body: 'AAA' | 'AA' | null;
  /** Niveau atteint pour du grand texte (≥ 24 px, ou 18,66 px gras). */
  large: 'AAA' | 'AA' | null;
  /** Utilisable pour une icône/bordure porteuse de sens (3:1). */
  ui: boolean;
};

function levels(ratio: number): Pick<TextTest, 'body' | 'large' | 'ui'> {
  return {
    body: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : null,
    large: ratio >= 4.5 ? 'AAA' : ratio >= 3 ? 'AA' : null,
    ui: ratio >= 3,
  };
}

function test(fg: string, bg: string, label: string): TextTest {
  const ratio = contrastRatio(fg, bg);
  return { fg, bg, label, ratio, lc: apcaLc(fg, bg), ...levels(ratio) };
}

export type ColorUsage = {
  hex: string;
  oklch: OklchColor;
  band: Band;
  /** Les quatre tests qui décident de tous les usages courants. */
  tests: {
    /** Texte blanc posé SUR la couleur. */
    whiteOn: TextTest;
    /** Texte noir posé SUR la couleur. */
    blackOn: TextTest;
    /** La couleur utilisée comme texte sur fond blanc. */
    onWhite: TextTest;
    /** La couleur utilisée comme texte sur fond noir. */
    onDark: TextTest;
  };
  /** Rôles conseillés, du plus au moins pertinent. */
  roles: { role: string; why: string; safe: boolean }[];
  /** Phrase de synthèse en français courant. */
  summary: string;
};

/** Noir et blanc de référence pour les tests (pas du #000/#fff pur : les
 * vrais fonds d'interface sont légèrement teintés — on reste honnête en
 * testant sur les extrêmes, qui sont le cas le plus favorable). */
const WHITE = '#ffffff';
const BLACK = '#000000';

export function analyzeUsage(hex: string, dark = BLACK): ColorUsage | null {
  const oklch = parseToOklch(hex);
  if (!oklch) return null;
  const band = bandOf(oklch);

  const tests = {
    whiteOn: test(WHITE, hex, 'Texte blanc dessus'),
    blackOn: test(BLACK, hex, 'Texte noir dessus'),
    onWhite: test(hex, WHITE, 'En texte sur blanc'),
    onDark: test(hex, dark, 'En texte sur fond sombre'),
  };

  const roles: ColorUsage['roles'] = [];

  // Aplat porteur de texte (bouton, bandeau) : il faut un contenu lisible.
  const bestOn = Math.max(tests.whiteOn.ratio, tests.blackOn.ratio);
  const bestOnLabel = tests.whiteOn.ratio >= tests.blackOn.ratio ? 'blanc' : 'noir';
  if (bestOn >= 4.5) {
    roles.push({
      role: 'Aplat avec texte (bouton, bandeau)',
      why: `Le texte ${bestOnLabel} passe dessus (${fmt(bestOn)}).`,
      safe: true,
    });
  } else if (bestOn >= 3) {
    roles.push({
      role: 'Aplat avec GRAND texte seulement',
      why: `Le texte ${bestOnLabel} n’atteint que ${fmt(bestOn)} : réservez-la aux titres ≥ 24 px.`,
      safe: false,
    });
  } else {
    roles.push({
      role: 'Aplat décoratif sans texte',
      why: `Ni le blanc ni le noir ne sont lisibles dessus (au mieux ${fmt(bestOn)}).`,
      safe: false,
    });
  }

  // Texte / icône sur fond clair.
  if (tests.onWhite.body) {
    roles.push({
      role: 'Texte sur fond clair',
      why: `${fmt(tests.onWhite.ratio)} sur blanc — niveau ${tests.onWhite.body}.`,
      safe: true,
    });
  } else if (tests.onWhite.ui) {
    roles.push({
      role: 'Icône ou bordure sur fond clair',
      why: `${fmt(tests.onWhite.ratio)} sur blanc : suffisant pour un pictogramme, pas pour du texte courant.`,
      safe: true,
    });
  }

  // Texte sur fond sombre.
  if (tests.onDark.body) {
    roles.push({
      role: 'Texte en mode sombre',
      why: `${fmt(tests.onDark.ratio)} sur fond sombre — niveau ${tests.onDark.body}.`,
      safe: true,
    });
  }

  // Grandes surfaces.
  if (band === 'light') {
    roles.push({
      role: 'Fond de page ou de carte',
      why: 'Assez claire pour porter du texte sombre sur de grandes surfaces.',
      safe: true,
    });
  }
  if (band === 'dark') {
    roles.push({
      role: 'Fond sombre, titres, filets',
      why: 'Assez foncée pour porter du texte clair et structurer une mise en page.',
      safe: true,
    });
  }

  const summary =
    band === 'light'
      ? `Couleur claire : sa place est dans les fonds. Posez-y du texte ${tests.blackOn.body ? 'sombre' : 'sombre en grand corps'}.`
      : band === 'dark'
        ? `Couleur foncée : sa place est dans les textes et les fonds sombres. Le blanc passe dessus (${fmt(tests.whiteOn.ratio)}).`
        : `Couleur moyenne : c’est une couleur d’aplat. ${
            bestOn >= 4.5
              ? `Le texte ${bestOnLabel} y est lisible.`
              : 'Attention, ni le blanc ni le noir n’y sont vraiment lisibles — c’est le piège classique des couleurs de milieu de gamme.'
          }`;

  return { hex, oklch, band, tests, roles, summary };
}

function fmt(r: number): string {
  return `${(Math.floor(r * 100) / 100).toFixed(2).replace('.', ',')}:1`;
}

/**
 * Le critère de niveau A lié à la couleur (SC 1.4.1) : il ne se calcule
 * pas, il se vérifie. On fournit la question à cocher, pas un verdict.
 */
export const LEVEL_A_CHECK = {
  rule: 'WCAG 2.2 SC 1.4.1 — Utilisation de la couleur (niveau A)',
  question:
    'Une information de votre maquette est-elle portée par la couleur SEULE (lien repéré uniquement par sa couleur, statut signalé par une pastille sans texte, courbe de graphique sans légende) ?',
  why:
    'C’est le seul critère de niveau A qui concerne la couleur, et il n’impose aucun ratio : ' +
    'il exige qu’un deuxième indice (texte, icône, soulignement, motif) accompagne toujours la couleur. ' +
    'Une palette parfaitement contrastée peut échouer ici.',
  fix: 'Ajoutez un libellé, une icône, un soulignement ou un motif en plus de la couleur.',
} as const;
