/**
 * État partagé de la palette en cours. Tout le parcours lit et écrit ici :
 * changer d'étape ne perd jamais le travail.
 */
import type { SchemeName, ThemeMode, WheelName } from '../engine';

export type UsageContext = 'web' | 'identity' | 'print' | 'dataviz';
export type StartMode = 'color' | 'mood' | 'palette' | 'image';

/** Une couleur du nuancier de travail (éditable par la graphiste). */
export type PaletteEntry = { id: string; hex: string; label: string };

export const settings = $state({
  usage: 'identity' as UsageContext,
  baseColor: '#2563eb',
  scheme: 'split-complementary' as SchemeName,
  wheel: 'ryb' as WheelName,
  intensity: 1,
  neutralInfluence: 50,
  hueTorsion: 0,
  previewMode: 'light' as ThemeMode,
  /** Le nuancier de travail : rempli depuis la palette générée, puis
   * librement modifiable (ajout, retrait, renommage). */
  colors: [] as PaletteEntry[],
  /** Vérification manuelle du critère WCAG de niveau A (SC 1.4.1). */
  levelAConfirmed: false,
  printProcess: 'uncoated',
  substrate: 'uncoated-white',
});

/** Remplit le nuancier de travail depuis une palette générée. */
export function fillColorsFrom(entries: PaletteEntry[]): void {
  settings.colors = entries;
}

/**
 * Correspondances « ambiance → couleur de départ », explicites et
 * documentées (pas de magie) : une teinte, une intensité et une clarté
 * de départ par ambiance, modifiables ensuite librement.
 */
export const MOODS = [
  { id: 'vegetal', label: 'Végétal, apaisant', hue: 150, c: 0.11, l: 0.6, why: 'verts moyens' },
  { id: 'mineral', label: 'Minéral, posé', hue: 235, c: 0.055, l: 0.55, why: 'bleus-gris' },
  { id: 'solaire', label: 'Solaire, chaleureux', hue: 70, c: 0.14, l: 0.72, why: 'jaunes-orangés' },
  { id: 'terre', label: 'Terreux, artisanal', hue: 55, c: 0.09, l: 0.55, why: 'ocres doux' },
  { id: 'pop', label: 'Vif, pop', hue: 340, c: 0.2, l: 0.6, why: 'roses francs' },
  { id: 'nocturne', label: 'Profond, nocturne', hue: 270, c: 0.12, l: 0.42, why: 'violets sombres' },
] as const;
