/**
 * Construction des thèmes clair et sombre.
 *
 * Le mode sombre n'est PAS une inversion de rampe : c'est une réattribution
 * complète des rôles vers d'autres pas, suivie d'une revérification de
 * toute la matrice des paires réellement utilisées (brief §10.1).
 *
 * Garantie par construction : chaque rôle soumis à un seuil WCAG est choisi
 * en scannant sa rampe jusqu'à ce que TOUTES ses paires passent. La recette
 * (« toute palette générée par défaut passe AA sans intervention ») découle
 * de cette mécanique, et les tests la vérifient sur des marques très
 * différentes.
 */
import type { PairUsage } from '../types';
import { contrastRatio } from '../contrast/wcag';
import { evaluatePair, type PairEvaluation } from '../contrast/matrix';
import type { Ramp, RampStep } from '../ramp/generate';
import {
  SEMANTIC_RAMPS,
  type PaletteRamps,
  type RampName,
  type RoleName,
  type TokenRef,
} from './roles';

export type ThemeMode = 'light' | 'dark';

export type AuditedPair = {
  fg: RoleName;
  bg: RoleName;
  usage: PairUsage;
  evaluation: PairEvaluation;
};

export type Theme = {
  mode: ThemeMode;
  tokens: Record<RoleName, TokenRef>;
  /** Toutes les paires réellement utilisées, évaluées. */
  audit: AuditedPair[];
  /** Vrai si aucune paire normée n'échoue à AA. */
  passes: boolean;
};

function ref(ramps: PaletteRamps, ramp: RampName, step: number): TokenRef {
  const found = ramps[ramp].steps.find((s) => s.step === step);
  if (!found) throw new Error(`Pas ${step} absent de la rampe ${ramp}`);
  return { ramp, step, hex: found.hex };
}

function stepsOf(ramps: PaletteRamps, ramp: RampName): RampStep[] {
  return ramps[ramp].steps;
}

/**
 * Cherche, dans une rampe, le pas le plus proche de `prefer` qui satisfait
 * toutes les contraintes de contraste données. Retourne null si aucun.
 */
function pickStep(
  ramps: PaletteRamps,
  ramp: RampName,
  prefer: number,
  constraints: { against: string; min: number }[],
): TokenRef | null {
  const steps = [...stepsOf(ramps, ramp)].sort(
    (a, b) => Math.abs(a.step - prefer) - Math.abs(b.step - prefer),
  );
  for (const s of steps) {
    if (constraints.every((c) => contrastRatio(s.hex, c.against) >= c.min)) {
      return { ramp, step: s.step, hex: s.hex };
    }
  }
  return null;
}

/**
 * Choisit le contenu (« on- ») le plus lisible sur un aplat : le pas le plus
 * clair ou le plus sombre des neutres, selon ce qui contraste le mieux.
 */
function pickOnColor(ramps: PaletteRamps, solidHex: string): TokenRef {
  const neutral = stepsOf(ramps, 'neutral');
  const lightest = neutral.reduce((a, b) => (a.color.l > b.color.l ? a : b));
  const darkest = neutral.reduce((a, b) => (a.color.l < b.color.l ? a : b));
  const light = contrastRatio(lightest.hex, solidHex);
  const dark = contrastRatio(darkest.hex, solidHex);
  const chosen = light >= dark ? lightest : darkest;
  return { ramp: 'neutral', step: chosen.step, hex: chosen.hex };
}

/**
 * Choisit un aplat de marque : ≥ 3:1 face aux fonds (composant, SC 1.4.11)
 * ET porteur d'un contenu lisible à 4,5:1 (le pas « piège » de luminance
 * moyenne, illisible en blanc comme en noir, est ainsi évité d'office).
 */
function pickSolid(
  ramps: PaletteRamps,
  ramp: RampName,
  prefer: number,
  backgrounds: string[],
): TokenRef {
  const steps = [...stepsOf(ramps, ramp)].sort(
    (a, b) => Math.abs(a.step - prefer) - Math.abs(b.step - prefer),
  );
  for (const s of steps) {
    const componentOk = backgrounds.every((bg) => contrastRatio(s.hex, bg) >= 3);
    if (!componentOk) continue;
    const on = pickOnColor(ramps, s.hex);
    if (contrastRatio(on.hex, s.hex) >= 4.5) {
      return { ramp, step: s.step, hex: s.hex };
    }
  }
  // Dernier recours : le pas au meilleur compromis (ne devrait pas arriver
  // avec les profils par défaut — l'audit le signalera s'il échoue).
  const fallback = steps[steps.length - 1] as RampStep;
  return { ramp, step: fallback.step, hex: fallback.hex };
}

/** Pas adjacent (delta en indices) dans une rampe, borné aux extrémités. */
function adjacentStep(ramps: PaletteRamps, token: TokenRef, delta: number): TokenRef {
  const steps = stepsOf(ramps, token.ramp);
  const index = steps.findIndex((s) => s.step === token.step);
  const target = steps[Math.min(steps.length - 1, Math.max(0, index + delta))] as RampStep;
  return { ramp: token.ramp, step: target.step, hex: target.hex };
}

export function buildTheme(ramps: PaletteRamps, mode: ThemeMode): Theme {
  const neutral = stepsOf(ramps, 'neutral');
  const byStep = (step: number) => ref(ramps, 'neutral', step);
  const first = neutral[0] as RampStep; // le plus clair
  const last = neutral[neutral.length - 1] as RampStep; // le plus sombre

  const tokens = {} as Record<RoleName, TokenRef>;

  // — Surfaces —
  if (mode === 'light') {
    tokens.surface = { ramp: 'neutral', step: first.step, hex: first.hex };
    tokens.background = adjacentStep(ramps, tokens.surface, 1);
    tokens['surface-raised'] = tokens.surface;
    tokens['surface-sunken'] = adjacentStep(ramps, tokens.background, 1);
    tokens.overlay = { ramp: 'neutral', step: last.step, hex: last.hex };
  } else {
    tokens.background = { ramp: 'neutral', step: last.step, hex: last.hex };
    tokens.surface = adjacentStep(ramps, tokens.background, -1);
    tokens['surface-raised'] = adjacentStep(ramps, tokens.surface, -1);
    tokens['surface-sunken'] = tokens.background;
    tokens.overlay = tokens.background;
  }
  const bgs = [tokens.background.hex, tokens.surface.hex];

  // — Contenu neutre —
  if (mode === 'light') {
    tokens['text-primary'] = { ramp: 'neutral', step: last.step, hex: last.hex };
    tokens['text-secondary'] =
      pickStep(ramps, 'neutral', 800, bgs.map((b) => ({ against: b, min: 7 }))) ??
      tokens['text-primary'];
    // « Atténué » = le plus clair possible qui reste AA.
    tokens['text-muted'] =
      pickStep(ramps, 'neutral', 500, bgs.map((b) => ({ against: b, min: 4.5 }))) ??
      tokens['text-secondary'];
    tokens['text-disabled'] = byStep((neutral[4] as RampStep).step);
  } else {
    tokens['text-primary'] = { ramp: 'neutral', step: first.step, hex: first.hex };
    tokens['text-secondary'] =
      pickStep(ramps, 'neutral', 200, bgs.map((b) => ({ against: b, min: 7 }))) ??
      tokens['text-primary'];
    tokens['text-muted'] =
      pickStep(ramps, 'neutral', 500, bgs.map((b) => ({ against: b, min: 4.5 }))) ??
      tokens['text-secondary'];
    tokens['text-disabled'] = byStep((neutral[6] as RampStep).step);
  }

  // — Marque —
  const solidPrefer = mode === 'light' ? 600 : 400;
  tokens.primary = pickSolid(ramps, 'primary', solidPrefer, bgs);
  tokens.secondary = pickSolid(ramps, 'secondary', solidPrefer, bgs);
  tokens.accent = pickSolid(ramps, 'accent', solidPrefer, bgs);
  tokens['on-primary'] = pickOnColor(ramps, tokens.primary.hex);
  tokens['on-secondary'] = pickOnColor(ramps, tokens.secondary.hex);
  tokens['on-accent'] = pickOnColor(ramps, tokens.accent.hex);

  // — Interaction —
  // Le survol s'écarte du fond (plus sombre en clair, plus clair en sombre)
  // en préservant la lisibilité du contenu posé dessus.
  const away = mode === 'light' ? 1 : -1;
  const hoverCandidate = adjacentStep(ramps, tokens.primary, away);
  const activeCandidate = adjacentStep(ramps, tokens.primary, away * 2);
  const onP = tokens['on-primary'].hex;
  tokens.hover =
    contrastRatio(onP, hoverCandidate.hex) >= 4.5
      ? hoverCandidate
      : adjacentStep(ramps, tokens.primary, -away);
  tokens.active =
    contrastRatio(onP, activeCandidate.hex) >= 4.5 ? activeCandidate : tokens.hover;
  const primarySteps = stepsOf(ramps, 'primary');
  const selectedStep = (
    mode === 'light' ? primarySteps[1] : primarySteps[primarySteps.length - 1]
  ) as RampStep;
  tokens.selected = { ramp: 'primary', step: selectedStep.step, hex: selectedStep.hex };
  tokens['focus-ring'] =
    pickStep(
      ramps,
      'primary',
      mode === 'light' ? 600 : 400,
      bgs.map((b) => ({ against: b, min: 3 })),
    ) ?? tokens.primary;
  tokens.visited = pickSolid(ramps, 'accent', solidPrefer, bgs);

  // — Structure —
  tokens['border-subtle'] = byStep((neutral[mode === 'light' ? 2 : 8] as RampStep).step);
  tokens['border-default'] = byStep((neutral[mode === 'light' ? 3 : 7] as RampStep).step);
  tokens['border-strong'] =
    pickStep(
      ramps,
      'neutral',
      mode === 'light' ? 500 : 400,
      [{ against: tokens.surface.hex, min: 3 }, { against: tokens.background.hex, min: 3 }],
    ) ?? tokens['text-muted'];
  tokens.divider = tokens['border-subtle'];

  // — Sémantique —
  // Étages de clarté volontairement distincts entre les quatre contenus :
  // sous simulation de daltonisme, rouge, vert et orange convergent vers
  // des bruns voisins — seule la clarté (et l'axe bleu-jaune) les sépare.
  const contentPrefer: Record<(typeof SEMANTIC_RAMPS)[number], number> =
    mode === 'light'
      ? { success: 950, warning: 700, error: 800, info: 600 }
      : { success: 400, warning: 300, error: 100, info: 200 };
  for (const name of SEMANTIC_RAMPS) {
    const surface =
      mode === 'light'
        ? ref(ramps, name, (stepsOf(ramps, name)[1] as RampStep).step)
        : ref(ramps, name, (stepsOf(ramps, name)[stepsOf(ramps, name).length - 1] as RampStep).step);
    const content =
      pickStep(ramps, name, contentPrefer[name], [
        { against: surface.hex, min: 4.5 },
        { against: tokens.background.hex, min: 4.5 },
        { against: tokens.surface.hex, min: 4.5 },
      ]) ?? (mode === 'light' ? tokens['text-primary'] : tokens['text-primary']);
    const border =
      pickStep(ramps, name, mode === 'light' ? 600 : 400, [
        { against: tokens.background.hex, min: 3 },
        { against: surface.hex, min: 3 },
      ]) ?? content;
    tokens[`${name}-surface`] = surface;
    tokens[`${name}-border`] = border;
    tokens[`${name}-content`] = content;
  }

  // — Revérification complète des paires réellement utilisées —
  const audit = auditTheme(tokens, mode);
  const passes = audit.every(
    (p) => p.usage === 'decorative' || p.usage === 'surface' || p.evaluation.wcag.passesAA,
  );
  return { mode, tokens, audit, passes };
}

/** La matrice des paires réellement utilisées, typée par usage. */
function auditTheme(tokens: Record<RoleName, TokenRef>, mode: ThemeMode): AuditedPair[] {
  const pair = (fg: RoleName, bg: RoleName, usage: PairUsage): AuditedPair => ({
    fg,
    bg,
    usage,
    evaluation: evaluatePair(
      { id: fg, hex: tokens[fg].hex },
      { id: bg, hex: tokens[bg].hex },
      usage,
    ),
  });

  const pairs: AuditedPair[] = [
    // Texte neutre sur les deux fonds
    pair('text-primary', 'background', 'body-text'),
    pair('text-primary', 'surface', 'body-text'),
    pair('text-secondary', 'background', 'body-text'),
    pair('text-secondary', 'surface', 'body-text'),
    pair('text-muted', 'background', 'body-text'),
    pair('text-muted', 'surface', 'body-text'),
    // Contenu sur aplats de marque, y compris en survol/appui
    pair('on-primary', 'primary', 'body-text'),
    pair('on-primary', 'hover', 'body-text'),
    pair('on-primary', 'active', 'body-text'),
    pair('on-secondary', 'secondary', 'body-text'),
    pair('on-accent', 'accent', 'body-text'),
    // Composants face aux fonds
    pair('primary', 'background', 'ui-component'),
    pair('secondary', 'background', 'ui-component'),
    pair('accent', 'background', 'ui-component'),
    pair('border-strong', 'surface', 'ui-component'),
    pair('border-strong', 'background', 'ui-component'),
    pair('focus-ring', 'background', 'focus-ring'),
    pair('focus-ring', 'surface', 'focus-ring'),
    // Surfaces entre elles (indicatif)
    pair('surface', 'background', 'surface'),
    pair('surface-sunken', 'surface', 'surface'),
    // Exemptés mais signalés
    pair('text-disabled', 'background', 'decorative'),
    pair('border-subtle', 'surface', 'decorative'),
    pair('border-default', 'surface', 'decorative'),
  ];

  for (const name of SEMANTIC_RAMPS) {
    pairs.push(
      pair(`${name}-content`, `${name}-surface`, 'body-text'),
      pair(`${name}-content`, 'background', 'body-text'),
      pair(`${name}-content`, 'surface', 'body-text'),
      pair(`${name}-border`, 'background', 'ui-component'),
      pair(`${name}-border`, `${name}-surface`, 'ui-component'),
    );
  }

  void mode;
  return pairs;
}
