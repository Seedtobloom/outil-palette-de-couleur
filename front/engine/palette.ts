/**
 * Assemblage d'une palette complète à partir d'une seule couleur de marque :
 * 3 teintes de marque (schéma d'harmonie sur la roue choisie), une famille
 * de neutres teintés, 4 teintes sémantiques — chacune en rampe complète —
 * puis attribution des rôles en thèmes clair et sombre.
 *
 * Tout ce que l'outil ajoute est expliqué (champ `explanations`) : si
 * l'utilisateur ne fournit qu'une couleur, il repart en sachant ce qui a
 * été construit autour et pourquoi.
 */
import type { GamutName, OklchColor } from './types';
import { parseToOklch } from './color/space';
import { gamutMap, maxChroma } from './color/gamut';
import { generateRamp, type Ramp, type RampOptions } from './ramp/generate';
import { generateNeutralRamp } from './ramp/neutrals';
import type { ChromaCurveParams } from './ramp/curves';
import { schemeByName, schemeHues, type SchemeName } from './harmony/schemes';
import type { WheelName } from './harmony/wheels';
import { buildTheme, type Theme } from './semantic/theme';
import type { PaletteRamps } from './semantic/roles';

export type PaletteOptions = {
  scheme?: SchemeName;
  wheel?: WheelName;
  /** Influence de la marque sur les neutres, 0–1. */
  neutralInfluence?: number;
  /** Intensité générale : multiplicateur de chroma, 0.5–1.2. */
  intensity?: number;
  hueTorsion?: number;
  chromaCurve?: ChromaCurveParams;
  gamut?: GamutName;
  stepCount?: number;
};

export type GeneratedPalette = {
  ramps: PaletteRamps;
  themes: { light: Theme; dark: Theme };
  options: Required<Pick<PaletteOptions, 'scheme' | 'wheel' | 'neutralInfluence' | 'intensity'>>;
  /** Ce que l'outil a ajouté et pourquoi, en français courant. */
  explanations: string[];
};

/**
 * Teintes sémantiques de référence (OKLCH). Les clartés de succès et
 * d'erreur sont volontairement écartées (0,64 vs 0,55) : la clarté survit
 * au daltonisme, la teinte non — c'est elle qui garantit la
 * distinguabilité succès/erreur en deutéranopie.
 */
const SEMANTIC_SEEDS: Record<'success' | 'warning' | 'error' | 'info', OklchColor> = {
  // Le vert de succès tire vers le turquoise (h 168, comme le vert bleuté
  // d'Okabe-Ito) : l'axe bleu-jaune survit aux daltonismes rouge-vert, ce
  // qui maintient l'écart succès/erreur là où un vert franc s'effondre.
  success: { l: 0.64, c: 0.13, h: 168 },
  warning: { l: 0.74, c: 0.15, h: 82 },
  error: { l: 0.55, c: 0.19, h: 27 },
  info: { l: 0.58, c: 0.12, h: 237 },
};

export function generatePalette(
  base: OklchColor | string,
  options: PaletteOptions = {},
): GeneratedPalette {
  const parsed = typeof base === 'string' ? parseToOklch(base) : base;
  if (!parsed) throw new Error(`Couleur de base illisible : « ${String(base)} »`);
  const gamut = options.gamut ?? 'srgb';
  const primary = gamutMap(parsed, gamut);

  const scheme = options.scheme ?? 'split-complementary';
  const wheel = options.wheel ?? 'ryb';
  const neutralInfluence = options.neutralInfluence ?? 0.5;
  const intensity = Math.min(1.2, Math.max(0.5, options.intensity ?? 1));

  const rampOptions: RampOptions = {
    gamut,
    ...(options.stepCount !== undefined ? { stepCount: options.stepCount } : {}),
    ...(options.hueTorsion !== undefined ? { hueTorsion: options.hueTorsion } : {}),
    ...(options.chromaCurve !== undefined ? { chromaCurve: options.chromaCurve } : {}),
  };

  // — Teintes de marque : la base + le schéma d'harmonie choisi. —
  const hues = schemeHues(primary.h, scheme, wheel);
  const secondaryHue = hues.length > 1 ? (hues[1] as number) : primary.h;
  const accentHue = hues.length > 2 ? (hues[hues.length - 1] as number) : secondaryHue;

  // Clartés volontairement écartées (pas d'isoluminance entre les trois
  // aplats de marque) et chroma hiérarchisé (marque > secondaire).
  const scaled = (c: number) => c * intensity;
  const seed = (l: number, c: number, h: number): OklchColor =>
    gamutMap({ l, c: Math.min(c, 0.95 * maxChroma(l, h, gamut)), h }, gamut);

  const primarySeed = seed(primary.l, scaled(primary.c), primary.h);
  const secondarySeed = seed(
    clamp(primary.l - 0.1, 0.3, 0.85),
    scaled(primary.c * 0.72),
    secondaryHue,
  );
  const accentSeed = seed(clamp(primary.l + 0.07, 0.3, 0.85), scaled(primary.c * 0.9), accentHue);

  const ramps: PaletteRamps = {
    primary: generateRamp(primarySeed, rampOptions),
    secondary: generateRamp(secondarySeed, rampOptions),
    accent: generateRamp(accentSeed, rampOptions),
    neutral: generateNeutralRamp(primary.h, {
      influence: neutralInfluence,
      gamut,
      ...(options.stepCount !== undefined ? { stepCount: options.stepCount } : {}),
    }),
    success: semanticRamp('success', intensity, rampOptions),
    warning: semanticRamp('warning', intensity, rampOptions),
    error: semanticRamp('error', intensity, rampOptions),
    info: semanticRamp('info', intensity, rampOptions),
  };

  const light = buildTheme(ramps, 'light');
  const dark = buildTheme(ramps, 'dark');

  const schemeInfo = schemeByName(scheme);
  const wheelLabel = wheel === 'ryb' ? 'roue des peintres (RYB)' : 'roue des écrans (RGB)';
  const explanations = [
    `Ta couleur est conservée exactement : elle occupe le pas ${ramps.primary.steps[ramps.primary.baseIndex]?.step} de la rampe principale.`,
    `Deux teintes de marque ont été ajoutées en « ${schemeInfo.label.toLowerCase()} » sur la ${wheelLabel} : ${schemeInfo.effect}`,
    `Leurs clartés sont volontairement différentes de la vôtre : deux couleurs de même clarté côte à côte vibrent et deviennent identiques en niveaux de gris.`,
    `Les gris sont légèrement teintés de ta couleur (${Math.round(neutralInfluence * 100)} %) : des gris purs paraîtraient étrangers à la marque.`,
    `Quatre couleurs fonctionnelles (succès, avertissement, erreur, information) complètent la palette ; succès et erreur ont des clartés écartées pour rester distinguables en cas de daltonisme.`,
    `Chaque rôle (texte, fond, bordure, focus…) pointe vers le pas de rampe qui garantit son seuil de contraste, en clair comme en sombre.`,
  ];

  return {
    ramps,
    themes: { light, dark },
    options: { scheme, wheel, neutralInfluence, intensity },
    explanations,
  };
}

function semanticRamp(
  name: keyof typeof SEMANTIC_SEEDS,
  intensity: number,
  rampOptions: RampOptions,
): Ramp {
  const seedColor = SEMANTIC_SEEDS[name];
  const scaled: OklchColor = { ...seedColor, c: seedColor.c * Math.min(intensity, 1) };
  // Les sémantiques gardent la courbe par défaut (pas de torsion héritée de
  // la marque : le rouge d'erreur doit rester un rouge d'erreur).
  const opts: RampOptions = { ...rampOptions };
  delete opts.hueTorsion;
  return generateRamp(gamutMap(scaled, rampOptions.gamut ?? 'srgb'), opts);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
