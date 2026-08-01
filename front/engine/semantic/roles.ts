/**
 * Taxonomie des rôles (brief §4.4). Un rôle est un token : il pointe vers
 * un pas de rampe, jamais vers une valeur en dur, et il est réattribué en
 * mode sombre (jamais « inversé »).
 */
import type { Ramp } from '../ramp/generate';

export type PaletteRamps = {
  primary: Ramp;
  secondary: Ramp;
  accent: Ramp;
  neutral: Ramp;
  success: Ramp;
  warning: Ramp;
  error: Ramp;
  info: Ramp;
};

export type RampName = keyof PaletteRamps;
export const SEMANTIC_RAMPS = ['success', 'warning', 'error', 'info'] as const;
export type SemanticName = (typeof SEMANTIC_RAMPS)[number];

export type RoleName =
  // Marque (aplats de référence)
  | 'primary'
  | 'secondary'
  | 'accent'
  // Surfaces
  | 'background'
  | 'surface'
  | 'surface-raised'
  | 'surface-sunken'
  | 'overlay'
  // Contenu
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'text-disabled'
  | 'on-primary'
  | 'on-secondary'
  | 'on-accent'
  // Structure
  | 'border-subtle'
  | 'border-default'
  | 'border-strong'
  | 'divider'
  // Interaction
  | 'focus-ring'
  | 'hover'
  | 'active'
  | 'selected'
  | 'visited'
  // Sémantique (× surface / bordure / contenu)
  | `${SemanticName}-surface`
  | `${SemanticName}-border`
  | `${SemanticName}-content`;

/** Référence de token : rampe + pas + valeur résolue. */
export type TokenRef = {
  ramp: RampName;
  step: number;
  hex: string;
};

export const ROLE_LABELS: Record<string, string> = {
  primary: 'couleur principale',
  secondary: 'couleur secondaire',
  accent: 'accent',
  background: 'fond de page',
  surface: 'surface (carte)',
  'surface-raised': 'surface surélevée',
  'surface-sunken': 'surface en creux',
  overlay: 'voile (modales)',
  'text-primary': 'texte principal',
  'text-secondary': 'texte secondaire',
  'text-muted': 'texte atténué',
  'text-disabled': 'texte désactivé',
  'on-primary': 'texte sur couleur principale',
  'on-secondary': 'texte sur couleur secondaire',
  'on-accent': 'texte sur accent',
  'border-subtle': 'bordure discrète',
  'border-default': 'bordure standard',
  'border-strong': 'bordure de champ',
  divider: 'filet séparateur',
  'focus-ring': 'anneau de focus',
  hover: 'survol',
  active: 'appui',
  selected: 'sélection',
  visited: 'lien visité',
  'success-surface': 'fond de succès',
  'success-border': 'bordure de succès',
  'success-content': 'texte de succès',
  'warning-surface': 'fond d’avertissement',
  'warning-border': 'bordure d’avertissement',
  'warning-content': 'texte d’avertissement',
  'error-surface': 'fond d’erreur',
  'error-border': 'bordure d’erreur',
  'error-content': 'texte d’erreur',
  'info-surface': 'fond d’information',
  'info-border': 'bordure d’information',
  'info-content': 'texte d’information',
};
