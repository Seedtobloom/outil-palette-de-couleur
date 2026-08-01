/**
 * État partagé de la palette en cours — la règle du prompt §3.2 :
 * on passe du mode guidé au mode atelier à tout moment SANS perdre son
 * travail. Les deux modes lisent et écrivent le même état.
 */
import type { SchemeName, ThemeMode, WheelName } from '../engine';

export type UsageContext = 'web' | 'identity' | 'print' | 'dataviz';
export type StartMode = 'color' | 'mood' | 'surprise';

export const settings = $state({
  /** Étape 1 du guidé : à quoi sert la palette. */
  usage: 'web' as UsageContext,
  baseColor: '#2563eb',
  scheme: 'split-complementary' as SchemeName,
  wheel: 'ryb' as WheelName,
  /** Intensité générale, 0.5–1.2. */
  intensity: 1,
  /** Chaleur des gris, 0–100. */
  neutralInfluence: 50,
  /** Torsion de teinte, degrés. */
  hueTorsion: 0,
  /** Thème d'aperçu. */
  previewMode: 'light' as ThemeMode,
});

/**
 * Correspondances « ambiance → couleur de départ », explicites et
 * documentées (pas de magie, prompt §3.1) : une teinte, une intensité et
 * une clarté de départ par ambiance, modifiables ensuite librement.
 */
export const MOODS = [
  {
    id: 'vegetal',
    label: 'Végétal, apaisant',
    hue: 150,
    c: 0.11,
    l: 0.6,
    why: 'verts moyens, ni acides ni sombres',
  },
  {
    id: 'mineral',
    label: 'Minéral, posé',
    hue: 235,
    c: 0.055,
    l: 0.55,
    why: 'bleus-gris peu saturés',
  },
  {
    id: 'solaire',
    label: 'Solaire, chaleureux',
    hue: 70,
    c: 0.14,
    l: 0.72,
    why: 'jaunes-orangés clairs',
  },
  {
    id: 'terre',
    label: 'Terreux, artisanal',
    hue: 55,
    c: 0.09,
    l: 0.55,
    why: 'ocres et bruns doux',
  },
  { id: 'pop', label: 'Vif, pop', hue: 340, c: 0.2, l: 0.6, why: 'roses francs très saturés' },
  {
    id: 'nocturne',
    label: 'Profond, nocturne',
    hue: 270,
    c: 0.12,
    l: 0.42,
    why: 'violets sombres',
  },
] as const;
