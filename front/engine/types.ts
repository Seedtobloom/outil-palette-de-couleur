/**
 * Types partagés du moteur.
 *
 * Règle structurante du projet : aucune fonction du moteur ne retourne un
 * simple booléen ou un simple nombre pour un verdict. Elle retourne un
 * `Diagnostic` : la valeur, le seuil, la règle, l'explication en français
 * courant, et des corrections applicables en un clic.
 */

/** Couleur pivot du moteur : OKLCH, toujours. */
export type OklchColor = {
  /** Clarté perceptuelle, 0–1 */
  l: number;
  /** Chroma (intensité), ≥ 0 */
  c: number;
  /** Teinte en degrés, 0–360. Vaut 0 par convention pour les achromatiques. */
  h: number;
  alpha?: number;
};

export type GamutName = 'srgb' | 'p3';

export type DiagnosticStatus = 'pass' | 'warn' | 'fail';

/**
 * Une correction applicable en un clic. Objet de données pur (sérialisable,
 * compatible Web Worker) : c'est l'interface qui exécute le remplacement.
 */
export type Remedy = {
  id: string;
  /** Action en français courant, ex. « Assombrir le texte (#5c5c5c → #3a3a3a) » */
  label: string;
  /** Remplacement de couleur à effectuer. */
  change: {
    /** Identifiant de la couleur à remplacer dans la palette. */
    target: string;
    from: string;
    to: string;
  }[];
  /** Ce que la correction obtient, ex. « contraste 5.9:1 ». */
  achieves: string;
};

export type Diagnostic = {
  id: string;
  status: DiagnosticStatus;
  value: number;
  threshold: number;
  /** Règle de référence, ex. "WCAG 2.2 SC 1.4.3". */
  rule: string;
  /** Explication en français courant — jamais vide. */
  plain: string;
  /** Pourquoi ce seuil existe. */
  why: string;
  /** Identifiants des couleurs concernées. */
  affected: string[];
  /** Corrections applicables en un clic. Au moins une quand status ≠ pass. */
  remedies: Remedy[];
  /** Détail technique, affiché seulement en mode « valeurs techniques ». */
  technical?: string;
};

/**
 * Types d'usage d'une paire de couleurs, qui déterminent les seuils WCAG.
 * Voir brief §3.5 : la matrice est typée par usage, pas seulement texte/fond.
 */
export type PairUsage =
  | 'body-text' /* texte courant */
  | 'large-text' /* grand texte : ≥ 24 px normal ou ≥ 18,66 px gras */
  | 'ui-component' /* icône, bordure de champ, composant */
  | 'focus-ring' /* anneau de focus sur fond adjacent */
  | 'surface' /* séparation fond/fond — pas de norme, cible indicative */
  | 'decorative'; /* décoratif / désactivé — exempté, mais signalé */

export type WcagLevel = 'AA' | 'AAA';
