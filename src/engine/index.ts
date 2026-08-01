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
export { apcaLc, apcaAssess, apcaTargetFor, APCA_GUIDELINES, type ApcaAssessment } from './contrast/apca';
export {
  simulateCvd,
  toGrayscale,
  findCvdCollisions,
  CVD_TYPES,
  DISTINGUISHABILITY_THRESHOLD,
  type CvdType,
  type CvdCollision,
} from './contrast/cvd';
export {
  evaluatePair,
  contrastMatrix,
  type PaletteColor,
  type PairEvaluation,
  type ContrastMatrix,
} from './contrast/matrix';

export { diagnoseContrast, diagnoseCvd } from './explain/diagnostics';
export { contrastRemedies, type NamedColor } from './explain/remedies';
export { GLOSSARY, glossaryEntry, type GlossaryEntry } from './explain/glossary';
