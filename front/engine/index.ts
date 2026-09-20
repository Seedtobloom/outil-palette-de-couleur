/**
 * API publique du moteur Nuancier.
 * TypeScript pur, zéro import d'interface — utilisable tel quel dans un
 * Web Worker (tous les résultats sont des objets de données sérialisables).
 */
export type {
  OklchColor,
  GamutName,
  Diagnostic,
  DiagnosticStatus,
  Remedy,
  PairUsage,
  WcagLevel,
} from './types';

export {
  parseToOklch,
  oklchToHex,
  oklchToRgb,
  oklchToLab,
  oklchToP3,
  oklchToOklab,
  formatOklch,
  hexToRgb255,
  normalizeHue,
} from './color/space';
export { inGamut, gamutMap, maxChroma } from './color/gamut';
export { nommeCouleur, nommePalette } from './color/nommage';
export { rgbToCmjn, formatCmjn, CMJN_RESERVE, type Cmjn } from './color/cmjn';
export { deltaE00, deltaEOK, deltaE00Lab } from './color/distance';

export {
  relativeLuminance,
  contrastRatio,
  wcagThresholds,
  wcagCheck,
  findLightnessForRatio,
  type WcagResult,
  type WcagThresholds,
} from './contrast/wcag';
export {
  evaluatePair,
  contrastMatrix,
  type PaletteColor,
  type PairEvaluation,
  type ContrastMatrix,
} from './contrast/matrix';

export { diagnoseContrast } from './explain/diagnostics';
export { contrastRemedies, type NamedColor } from './explain/remedies';
export { GLOSSARY, glossaryEntry, type GlossaryEntry } from './explain/glossary';

export {
  DEFAULT_STEPS,
  CHROMATIC_L_PROFILE,
  NEUTRAL_L_PROFILE,
  DEFAULT_CHROMA_CURVE,
  chromaShape,
  resampleProfile,
  stepLabels,
  type ChromaCurveParams,
} from './ramp/curves';
export { generateRamp, nearestStepByLightness, type Ramp, type RampStep, type RampOptions } from './ramp/generate';
export { generateNeutralRamp, type NeutralOptions } from './ramp/neutrals';
export { twistedHue } from './ramp/twist';
export { stepForContrast, type InverseResult } from './ramp/inverse';

export { wheelToHue, hueToWheel, rotateOnWheel, type WheelName } from './harmony/wheels';
export { SCHEMES, schemeByName, schemeHues, type Scheme, type SchemeName } from './harmony/schemes';
export { scorePalette, type ConstraintReport } from './harmony/constraints';
export {
  appliqueReglages,
  reglagesNeutres,
  libelleTemperature,
  libelleSaturation,
  libelleForce,
  FORCE_AMORCEE,
  libelleLuminosite,
  LIBELLES_SCHEMA,
  POLES,
  REGLAGES_NEUTRES,
  type Reglages,
  type SchemaVise,
  type EntreeReglable,
} from './harmony/reglages';

export {
  SEMANTIC_RAMPS,
  ROLE_LABELS,
  type PaletteRamps,
  type RampName,
  type RoleName,
  type SemanticName,
  type TokenRef,
} from './semantic/roles';
export { buildTheme, type Theme, type ThemeMode, type AuditedPair } from './semantic/theme';

export { generatePalette, type GeneratedPalette, type PaletteOptions } from './palette';
export { exportCss } from './export/css';
export { exportAse } from './export/ase';
export {
  exportPlancheSvg,
  type EntreePlanche,
  type AssociationPlanche,
} from './export/planche';

export {
  construitPalette,
  trieParFamilles,
  libelleTri,
  messageTri,
  type SensTri,
  type EntreeAtelier,
  type CouleurConstruite,
} from './analyze/atelier';
export {
  analyzeCoverage,
  bandOf,
  BAND_LABELS,
  BAND_USES,
  BAND_BOUNDS,
  type Band,
  type Advice,
  type CoverageReport,
  type NamedHex,
} from './analyze/coverage';
export {
  analyzeHarmony,
  SCHEME_LABELS,
  AXIS_LABELS,
  type HarmonyAnalysis,
  type OffNote,
  type SchemeGuess,
  type Axis,
} from './harmony/analysis';
export { analyzeUsage, type ColorUsage, type TextTest } from './analyze/usage';
export { healthScore, type HealthScore, type ScoreComponent } from './score';
export {
  corrigeParClarte,
  evaluePaires,
  SEUILS,
  type Fix,
  type PaireEvaluee,
  type PairUse,
} from './contrast/fix';
export {
  proposeCorrections,
  corrigeTout,
  impactSurPalette,
  usageTenable,
  type Impact,
  MOUVEMENT_DOUX,
  PLANCHER_INTENSITE,
  TOLERANCE_TEINTE,
  type Candidat,
  type Proposition,
  type Verdict,
  type Changement,
  type Restant,
  type Bilan,
} from './contrast/propose';
export {
  kmeansOklab,
  echantillonneRgba,
  type Echantillon,
  type CouleurExtraite,
} from './extract';
