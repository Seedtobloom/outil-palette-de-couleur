/**
 * Production des diagnostics explicables.
 *
 * C'est ici que la pédagogie devient systémique : chaque règle du moteur
 * produit un objet `Diagnostic` complet — valeur, seuil, règle nommée,
 * explication en français courant, pourquoi le seuil existe, et remèdes
 * exécutables. L'interface ne rédige rien elle-même.
 * On explique aussi ce qui va bien (prompt §2.4).
 */
import type { Diagnostic, PairUsage } from '../types';
import { evaluatePair, type PairEvaluation } from '../contrast/matrix';
import { contrastRemedies, type NamedColor } from './remedies';
import { findCvdCollisions, DISTINGUISHABILITY_THRESHOLD, type CvdType } from '../contrast/cvd';

const USAGE_LABELS: Record<PairUsage, string> = {
  'body-text': 'texte courant',
  'large-text': 'grand texte (titres)',
  'ui-component': 'composant d’interface (icône, bordure)',
  'focus-ring': 'anneau de focus',
  surface: 'séparation de surfaces',
  decorative: 'élément décoratif ou désactivé',
};

const CVD_LABELS: Record<CvdType, string> = {
  deutan: 'deutéranopie (déficience sur le vert, la plus fréquente)',
  protan: 'protanopie (déficience sur le rouge)',
  tritan: 'tritanopie (déficience sur le bleu, rare)',
  achromatopsia: 'achromatopsie (vision monochrome)',
};

function fmtRatio(r: number): string {
  return `${(Math.floor(r * 100) / 100).toFixed(2).replace('.', ',')}:1`;
}

const WHY_CONTRAST: Record<PairUsage, string> = {
  'body-text':
    'Il faut 4,5:1 (AA) pour que le texte reste lisible par une personne dont la vue baisse, ' +
    'sur un écran de mauvaise qualité ou en plein soleil. 7:1 (AAA) donne une marge confortable.',
  'large-text':
    'Un texte grand et gras est lisible avec moins de contraste : la norme demande 3:1 (AA) ' +
    'à partir de 24 px (ou 18,66 px en gras), et 4,5:1 pour AAA.',
  'ui-component':
    'Une bordure de champ ou une icône porteuse de sens doit se détacher du fond (3:1) ' +
    'pour être repérable, notamment par une personne malvoyante.',
  'focus-ring':
    'L’anneau de focus est le seul repère visuel des personnes qui naviguent au clavier : ' +
    's’il ne se détache pas du fond (3:1), la navigation devient impossible.',
  surface:
    'Aucune norme ne couvre la séparation fond/fond ; en dessous d’environ 1,2:1, ' +
    'deux surfaces voisines (une carte sur une page) ne se distinguent plus.',
  decorative:
    'Les éléments purement décoratifs et les états désactivés sont exemptés par la norme — ' +
    'mais un texte désactivé illisible reste une gêne réelle : à signaler, pas à ignorer.',
};

/**
 * Diagnostic complet d'une paire de couleurs pour un usage donné.
 * WCAG 2.2 décide du statut ; APCA n'est qu'un signal secondaire.
 */
export function diagnoseContrast(fg: NamedColor, bg: NamedColor, usage: PairUsage): Diagnostic {
  const evaluation = evaluatePair(fg, bg, usage);
  const { wcag, apca } = evaluation;
  const fgLabel = fg.label ?? fg.id;
  const bgLabel = bg.label ?? bg.id;
  const usageLabel = USAGE_LABELS[usage];
  const ratioText = fmtRatio(wcag.ratio);
  const technical =
    `Ratio WCAG ${wcag.ratio.toFixed(4)} — ${wcag.thresholds.rule}` +
    ` · APCA Lc ${apca.lc.toFixed(1)}${apca.target !== null ? ` (cible indicative ${apca.target})` : ''}` +
    ' — APCA est un signal qualité, pas une conformité.';

  const base = {
    id: `contrast:${usage}:${fg.id}:${bg.id}`,
    value: wcag.ratio,
    threshold: wcag.thresholds.aa ?? 0,
    rule: wcag.thresholds.rule,
    affected: [fg.id, bg.id],
    technical,
  };

  if (wcag.level === 'exempt') {
    return {
      ...base,
      status: 'pass',
      plain:
        `Contraste ${ratioText} entre « ${fgLabel} » et « ${bgLabel} » — usage ${usageLabel} : ` +
        'la norme n’exige aucun seuil ici.',
      why: WHY_CONTRAST[usage],
      remedies: [],
    };
  }

  if (!wcag.passesAA) {
    const remedies = contrastRemedies(fg, bg, usage);
    return {
      ...base,
      status: wcag.thresholds.advisory ? 'warn' : 'fail',
      plain:
        `Contraste ${ratioText} — insuffisant pour du ${usageLabel}. ` +
        `Il faut au moins ${fmtRatio(base.threshold)} pour que « ${fgLabel} » reste ` +
        `lisible sur « ${bgLabel} ».`,
      why: WHY_CONTRAST[usage],
      remedies,
    };
  }

  const levelText = wcag.level === 'AAA' ? 'AAA (confort maximal)' : 'AA (le minimum légal)';
  if (evaluation.status === 'warn') {
    // Conforme WCAG, mais perceptuellement faible selon APCA.
    return {
      ...base,
      status: 'warn',
      plain:
        `Contraste ${ratioText} — la paire « ${fgLabel} » sur « ${bgLabel} » passe la norme ` +
        `(${levelText}), mais reste perceptuellement inconfortable, surtout sur fond sombre ` +
        'ou en petit corps. La norme est une porte, pas un objectif de confort.',
      why:
        WHY_CONTRAST[usage] +
        ' La formule WCAG surévalue les paires sombres : un signal perceptuel complémentaire ' +
        '(APCA) aide à repérer les paires « conformes mais pénibles ».',
      remedies: contrastRemedies(fg, bg, usage, (wcag.thresholds.aaa ?? base.threshold + 2.5)),
    };
  }

  return {
    ...base,
    status: 'pass',
    plain:
      `Contraste ${ratioText} — « ${fgLabel} » sur « ${bgLabel} » atteint ${levelText} ` +
      `pour du ${usageLabel}. L’écart de clarté entre les deux couleurs fait le travail : ` +
      'c’est lui, pas la teinte, qui rend un texte lisible.',
    why: WHY_CONTRAST[usage],
    remedies: [],
  };
}

/**
 * Diagnostic de distinguabilité d'une palette sous simulation CVD.
 * Deux couleurs qui se confondent (ΔE00 < 10) après simulation sont un
 * échec bloquant, indépendamment du contraste (brief §3.4).
 */
export function diagnoseCvd(
  colors: NamedColor[],
  type: CvdType,
  severity: number,
): Diagnostic {
  const collisions = findCvdCollisions(colors, type, severity);
  const label = CVD_LABELS[type];
  const base = {
    id: `cvd:${type}:${severity}`,
    threshold: DISTINGUISHABILITY_THRESHOLD,
    rule: 'Distinguabilité CVD — matrices Machado 2009, seuil ΔE00 ≥ 10',
    why:
      'Environ 8 % des hommes perçoivent mal certaines couleurs. Une palette dont deux ' +
      'couleurs se confondent pour eux fait porter une information par la couleur seule — ' +
      'ce que la norme interdit par ailleurs (WCAG 2.2 SC 1.4.1, niveau A).',
  };

  if (collisions.length === 0) {
    return {
      ...base,
      status: 'pass',
      value: DISTINGUISHABILITY_THRESHOLD,
      plain:
        `En ${label} à ${severity} % de sévérité, toutes les couleurs de la palette restent ` +
        'distinguables entre elles : leurs écarts de clarté et de teinte résistent à la simulation.',
      affected: colors.map((c) => c.id),
      remedies: [],
      technical: `${colors.length} couleurs, ${(colors.length * (colors.length - 1)) / 2} paires testées, aucune sous ΔE00 ${DISTINGUISHABILITY_THRESHOLD}.`,
    };
  }

  const worst = collisions.reduce((a, b) => (a.deltaE < b.deltaE ? a : b));
  const pairsText = collisions
    .map((c) => `« ${c.a} » et « ${c.b} » (écart résiduel ${c.deltaE.toFixed(1)})`)
    .join(', ');
  return {
    ...base,
    status: 'fail',
    value: worst.deltaE,
    plain:
      `En ${label} à ${severity} % de sévérité, ces couleurs deviennent difficiles à ` +
      `distinguer : ${pairsText}. Une personne concernée ne pourra pas s’appuyer sur ` +
      'cette différence de couleur.',
    affected: [...new Set(collisions.flatMap((c) => [c.a, c.b]))],
    // Le remède automatique (écarter les clartés) arrive avec les rampes en
    // Phase 1 ; en Phase 0 le moteur nomme précisément le levier à actionner.
    remedies: [
      {
        id: 'cvd-spread-lightness',
        label:
          'Écarter la clarté des couleurs concernées (la clarté survit à toutes les ' +
          'formes de daltonisme, contrairement à la teinte)',
        change: [],
        achieves: `ΔE00 ≥ ${DISTINGUISHABILITY_THRESHOLD} après simulation`,
      },
    ],
    technical: collisions
      .map((c) => `${c.a}/${c.b} : ΔE00 ${c.deltaE.toFixed(2)} (vision typique : ${c.deltaEOriginal.toFixed(2)})`)
      .join(' · '),
  };
}

export type { PairEvaluation };
