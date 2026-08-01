/**
 * Score de contraintes — PAS un score de beauté (brief §4.3).
 * Chaque point retiré nomme sa règle, explique en français courant et,
 * quand c'est possible, propose un remède. Entièrement auditable.
 */
import type { Diagnostic } from '../types';
import { deltaE00 } from '../color/distance';
import { findCvdCollisions } from '../contrast/cvd';
import { toGrayscale } from '../contrast/cvd';
import { contrastRatio } from '../contrast/wcag';
import type { GeneratedPalette } from '../palette';
import { ROLE_LABELS, SEMANTIC_RAMPS } from './../semantic/roles';

export type ConstraintReport = {
  /** 100 − pénalités, plancher 0. */
  score: number;
  diagnostics: Diagnostic[];
};

const PENALTIES = {
  contrastFailure: 15,
  cvdOpposedCollision: 12,
  cvdSemanticProximity: 4,
  brandIsoluminance: 6,
  pureGrayNeutrals: 4,
  flatChromaHierarchy: 5,
  grayscaleCollision: 6,
} as const;

export function scorePalette(palette: GeneratedPalette): ConstraintReport {
  const diagnostics: Diagnostic[] = [];
  let penalty = 0;

  // 1. Violations de contraste dans les deux thèmes (bloquant).
  for (const theme of [palette.themes.light, palette.themes.dark]) {
    for (const pair of theme.audit) {
      if (pair.usage === 'decorative' || pair.usage === 'surface') continue;
      if (!pair.evaluation.wcag.passesAA) {
        penalty += PENALTIES.contrastFailure;
        diagnostics.push({
          id: `constraint:contrast:${theme.mode}:${pair.fg}:${pair.bg}`,
          status: 'fail',
          value: pair.evaluation.wcag.ratio,
          threshold: pair.evaluation.wcag.thresholds.aa ?? 0,
          rule: pair.evaluation.wcag.thresholds.rule,
          plain: `En thème ${theme.mode === 'light' ? 'clair' : 'sombre'}, « ${ROLE_LABELS[pair.fg] ?? pair.fg} » sur « ${ROLE_LABELS[pair.bg] ?? pair.bg} » n'atteint pas son seuil.`,
          why: 'Une seule paire réellement utilisée sous le seuil suffit à rendre un écran illisible pour quelqu’un.',
          affected: [pair.fg, pair.bg],
          remedies: [
            {
              id: 'regenerate',
              label: 'Écarter la clarté des deux rôles (le générateur choisit les pas — signaler ce cas)',
              change: [],
              achieves: 'seuil AA',
            },
          ],
        });
      }
    }
  }

  // 2. Collisions CVD entre couleurs sémantiques (bloquant).
  const semanticSolids = SEMANTIC_RAMPS.map((name) => ({
    id: name,
    hex: palette.themes.light.tokens[`${name}-content`].hex,
  }));
  for (const type of ['deutan', 'protan'] as const) {
    for (const collision of findCvdCollisions(semanticSolids, type, 100)) {
      // Succès/erreur sont sémantiquement opposés : leur confusion est un
      // échec bloquant (brief §3.4). Les autres proximités sont signalées.
      const opposed =
        (collision.a === 'success' && collision.b === 'error') ||
        (collision.a === 'error' && collision.b === 'success');
      penalty += opposed ? PENALTIES.cvdOpposedCollision : PENALTIES.cvdSemanticProximity;
      const typeLabel = type === 'deutan' ? 'deutéranopie' : 'protanopie';
      diagnostics.push({
        id: `constraint:cvd:${type}:${collision.a}:${collision.b}`,
        status: opposed ? 'fail' : 'warn',
        value: collision.deltaE,
        threshold: 10,
        rule: 'Distinguabilité CVD — Machado 2009, ΔE00 ≥ 10',
        plain: opposed
          ? `« ${collision.a} » et « ${collision.b} » se confondent en ${typeLabel} : un succès et une erreur doivent rester différenciables sans la couleur exacte.`
          : `« ${collision.a} » et « ${collision.b} » se rapprochent en ${typeLabel} : prévoir un second indice (icône, libellé) quand ces deux états cohabitent.`,
        why: 'Environ 8 % des hommes sont concernés ; deux états sémantiques qui se confondent font porter l’information par la couleur seule (ce que WCAG SC 1.4.1 interdit par ailleurs).',
        affected: [collision.a, collision.b],
        remedies: [
          {
            id: 'spread-lightness',
            label: 'Écarter les clartés des deux couleurs sémantiques',
            change: [],
            achieves: 'ΔE00 ≥ 10 après simulation',
          },
        ],
      });
    }
  }

  // 3. Isoluminance entre les couleurs de marque (avertissement).
  //    On compare les couleurs de base des rampes — l'identité perçue de la
  //    palette — et non les aplats de thème, dont les pas sont choisis par
  //    les contraintes de contraste.
  const brand = (['primary', 'secondary', 'accent'] as const).map((r) => ({
    role: r,
    hex: palette.ramps[r].steps[palette.ramps[r].baseIndex]!.hex,
  }));
  for (let i = 0; i < brand.length; i++) {
    for (let j = i + 1; j < brand.length; j++) {
      const a = brand[i]!;
      const b = brand[j]!;
      const grayRatio = contrastRatio(toGrayscale(a.hex), toGrayscale(b.hex));
      if (grayRatio < 1.15 && deltaE00(a.hex, b.hex) > 5) {
        penalty += PENALTIES.brandIsoluminance;
        diagnostics.push({
          id: `constraint:isoluminance:${a.role}:${b.role}`,
          status: 'warn',
          value: grayRatio,
          threshold: 1.15,
          rule: 'Harmonie — écart de clarté minimal entre couleurs voisines',
          plain: `« ${ROLE_LABELS[a.role]} » et « ${ROLE_LABELS[b.role]} » ont presque la même clarté : côte à côte, elles vibrent, et en niveaux de gris elles deviennent identiques.`,
          why: 'Deux couleurs de même clarté ne se distinguent que par la teinte — ce qui disparaît en photocopie, en niveaux de gris et pour une partie des daltoniens.',
          affected: [a.role, b.role],
          remedies: [
            {
              id: 'shift-lightness',
              label: `Assombrir ou éclaircir « ${ROLE_LABELS[b.role]} » d'un pas`,
              change: [],
              achieves: 'écart de clarté visible en niveaux de gris',
            },
          ],
        });
      }
    }
  }

  // 4. Neutres teintés (avertissement pédagogique si gris purs).
  const neutralMid = palette.ramps.neutral.steps[Math.floor(palette.ramps.neutral.steps.length / 2)];
  if (neutralMid && neutralMid.color.c < 0.002) {
    penalty += PENALTIES.pureGrayNeutrals;
    diagnostics.push({
      id: 'constraint:pure-gray-neutrals',
      status: 'warn',
      value: neutralMid.color.c,
      threshold: 0.005,
      rule: 'Harmonie — neutres teintés par la marque',
      plain: 'Les gris de la palette sont parfaitement neutres : ils paraîtront étrangers à la marque, surtout en grandes surfaces.',
      why: 'Une pointe de la teinte de marque (0,005 à 0,02 d’intensité) suffit à raccorder les gris au reste sans qu’on les perçoive comme colorés.',
      affected: ['neutral'],
      remedies: [
        {
          id: 'tint-neutrals',
          label: 'Monter l’influence de la marque sur les neutres (réglage « chaleur des gris »)',
          change: [],
          achieves: 'gris raccordés à la marque',
        },
      ],
    });
  }

  // 5. Hiérarchie de chroma : marque > neutres (avertissement).
  const primaryBase = palette.ramps.primary.steps[palette.ramps.primary.baseIndex];
  if (primaryBase && neutralMid && primaryBase.color.c < neutralMid.color.c * 2) {
    penalty += PENALTIES.flatChromaHierarchy;
    diagnostics.push({
      id: 'constraint:chroma-hierarchy',
      status: 'warn',
      value: primaryBase.color.c,
      threshold: neutralMid.color.c * 2,
      rule: 'Harmonie — chroma décroissant selon le rôle',
      plain: 'La couleur de marque est à peine plus intense que les gris : la hiérarchie visuelle repose alors uniquement sur la clarté.',
      why: 'Marque > accent > surfaces > neutres : sans cette décroissance d’intensité, rien ne guide l’œil.',
      affected: ['primary', 'neutral'],
      remedies: [
        {
          id: 'raise-intensity',
          label: 'Monter l’intensité générale, ou partir d’une couleur de marque plus saturée',
          change: [],
          achieves: 'hiérarchie d’intensité lisible',
        },
      ],
    });
  }

  // 6. La palette reste lisible en niveaux de gris : les aplats sémantiques
  //    doivent garder un écart perceptible une fois désaturés (avertissement).
  for (let i = 0; i < semanticSolids.length; i++) {
    for (let j = i + 1; j < semanticSolids.length; j++) {
      const a = semanticSolids[i]!;
      const b = semanticSolids[j]!;
      const e = deltaE00(toGrayscale(a.hex), toGrayscale(b.hex));
      if (e < 5) {
        penalty += PENALTIES.grayscaleCollision;
        diagnostics.push({
          id: `constraint:grayscale:${a.id}:${b.id}`,
          status: 'warn',
          value: e,
          threshold: 5,
          rule: 'Harmonie — test niveaux de gris systématique',
          plain: `Imprimés en noir et blanc, « ${a.id} » et « ${b.id} » deviennent presque identiques.`,
          why: 'Une palette qui ne fonctionne pas en niveaux de gris échouera à la photocopie, au fax médical, et pour les achromates.',
          affected: [a.id, b.id],
          remedies: [
            {
              id: 'spread-lightness-grayscale',
              label: 'Écarter les clartés des deux couleurs',
              change: [],
              achieves: 'écart visible en noir et blanc',
            },
          ],
        });
      }
    }
  }

  return { score: Math.max(0, 100 - penalty), diagnostics };
}
