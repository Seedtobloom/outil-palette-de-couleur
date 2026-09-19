/**
 * État partagé de la palette en cours. Tout le parcours lit et écrit ici :
 * changer d'étape ne perd jamais le travail.
 */
import type { SchemaVise, SchemeName, ThemeMode, WheelName } from '../engine';

export type StartMode = 'color' | 'mood' | 'palette' | 'image';

/** Les quatre rôles de l'étape « Attribuer les rôles ». */
export type RoleCouleur = 'hero' | 'accent' | 'neutre-claire' | 'neutre-foncee';

export const LIBELLES_ROLE: Record<RoleCouleur, string> = {
  hero: 'Dominante',
  accent: 'Accent',
  'neutre-claire': 'Neutre claire',
  'neutre-foncee': 'Neutre foncée',
};

// Le schéma visé vient du moteur : l'état ne fait que le transporter.
export type { SchemaVise };

/**
 * Une couleur du nuancier de travail (éditable par la graphiste).
 *
 * `verrou` n'est pas qu'un cadenas d'affichage : une couleur verrouillée
 * est exclue de l'ajustement automatique des contrastes (voir
 * `corrigeTout`). C'est ce qui permet de figer une couleur imposée — un
 * logo déposé, une teinte déjà imprimée — et de laisser l'outil corriger
 * tout le reste autour d'elle.
 */
export type PaletteEntry = {
  id: string;
  hex: string;
  label: string;
  verrou?: boolean;
  /**
   * Référence de ton direct SAISIE par la graphiste, d'après son propre
   * nuancier papier. L'outil ne fournit aucune bibliothèque Pantone : le
   * brief §5.4 rappelle que republier les valeurs Lab d'un nuancier
   * déposé expose juridiquement — Adobe a retiré le support natif
   * Pantone de ses applications pour cette raison.
   */
  reference?: string;
};

export const settings = $state({
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
  /**
   * Les associations de contraste retenues, sous la forme
   * `idTexte|idFond`. Elles déverrouillent la suite du parcours et
   * disent quelles paires seront réellement employées.
   */
  pairings: [] as string[],
  /** Rôle attribué à chaque couleur, par identifiant. */
  roles: {} as Record<string, RoleCouleur>,
  /** Réglages d'harmonie appliqués à l'ensemble de la palette. */
  harmonie: {
    schema: 'auto' as SchemaVise,
    force: 0,
    temperature: 0,
    saturation: 0,
    luminosite: 0,
  },
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
