/**
 * Réglages d'harmonie : quatre curseurs qui transforment TOUTE la
 * palette d'un coup, plus un schéma de teintes visé.
 *
 * C'est l'outil de mise au point qui manquait : jusqu'ici on corrigeait
 * couleur par couleur. Ici, on tire sur un curseur et l'ensemble se
 * déplace en gardant ses écarts relatifs.
 *
 * Tout se fait en OKLCH, et c'est ce qui rend l'opération honnête :
 * - la saturation agit sur le chroma, donc une couleur claire et une
 *   couleur foncée se désaturent du même montant perçu ;
 * - la luminosité agit sur L, sans toucher la teinte ;
 * - l'harmonisation fait tourner la teinte vers un pôle, sans toucher
 *   ni la clarté ni l'intensité.
 * En HSL, chacune de ces trois opérations déplacerait les deux autres.
 *
 * Les couleurs VERROUILLÉES ne bougent jamais : elles servent au
 * contraire de référence pour placer les pôles de teinte.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch } from '../color/space';

export type SchemaVise = 'auto' | 'analogue' | 'complementaire' | 'split' | 'triadique' | 'mono';

export type Reglages = {
  schema: SchemaVise;
  /** 0 → aucune harmonisation, 100 → teintes posées exactement sur les pôles. */
  force: number;
  /** −100 (froid) à +100 (chaud). */
  temperature: number;
  /** −100 (gris) à +100 (saturé). */
  saturation: number;
  /** −100 (sombre) à +100 (clair). */
  luminosite: number;
};

export const REGLAGES_NEUTRES: Reglages = {
  schema: 'auto',
  force: 0,
  temperature: 0,
  saturation: 0,
  luminosite: 0,
};

/** Écarts de teinte, en degrés, qui définissent chaque schéma. */
export const POLES: Record<Exclude<SchemaVise, 'auto'>, number[]> = {
  analogue: [-30, 0, 30],
  complementaire: [0, 180],
  split: [0, 150, 210],
  triadique: [0, 120, 240],
  mono: [0],
};

/** L'axe chaud et l'axe froid, en teinte OKLCH. */
const AXE_CHAUD = 70;
const AXE_FROID = 250;

/**
 * Les trois coefficients qui rendent ces curseurs utilisables.
 *
 * Aucun ne va « à fond » : un curseur qui pose exactement la teinte sur
 * le pôle, ou qui tire la clarté jusqu'au blanc, détruit la palette
 * avant d'arriver en butée. On ne parcourt qu'une fraction du chemin.
 */
const PART_HARMONISATION = 0.9; // à 100 %, 90 % du chemin vers le pôle
const PART_TEMPERATURE = 0.5; // à 100 %, la moitié du chemin vers l'axe
const AMPLITUDE_CLARTE = 0.16; // à 100 %, ±0,16 de clarté OKLCH

/** En dessous, la couleur est un neutre : on ne lui impose pas de teinte. */
const SEUIL_NEUTRE = 0.03;

export const LIBELLES_SCHEMA: Record<SchemaVise, string> = {
  auto: 'Automatique',
  analogue: 'Analogue',
  complementaire: 'Complémentaire',
  split: 'Split-complémentaire',
  triadique: 'Triadique',
  mono: 'Monochrome',
};

/** Écart signé le plus court entre deux teintes, en degrés (−180..180). */
function ecartSigne(de: number, vers: number): number {
  return ((((vers - de) % 360) + 540) % 360) - 180;
}

/** La teinte de référence : la couleur la plus franche de la palette. */
function teinteReference(couleurs: readonly OklchColor[]): number | null {
  let meilleure: OklchColor | null = null;
  for (const c of couleurs) {
    if (c.c < SEUIL_NEUTRE) continue;
    if (!meilleure || c.c > meilleure.c) meilleure = c;
  }
  return meilleure ? meilleure.h : null;
}

/** Le pôle du schéma le plus proche d'une teinte donnée. */
function poleLePlusProche(teinte: number, reference: number, ecarts: number[]): number {
  let meilleur = teinte;
  let distance = Infinity;
  for (const ecart of ecarts) {
    const pole = ((reference + ecart) % 360 + 360) % 360;
    const d = Math.abs(ecartSigne(teinte, pole));
    if (d < distance) {
      distance = d;
      meilleur = pole;
    }
  }
  return meilleur;
}

export type EntreeReglable = { id: string; hex: string; verrou?: boolean };

/**
 * Applique les réglages et rend la liste des hex transformés, dans
 * l'ordre reçu. Fonction pure : elle ne modifie rien.
 */
export function appliqueReglages(
  couleurs: readonly EntreeReglable[],
  reglages: Reglages,
  schemaDetecte: Exclude<SchemaVise, 'auto'> | null = null,
): string[] {
  const analyses = couleurs.map((c) => parseToOklch(c.hex));
  const reference = teinteReference(analyses.filter((c): c is OklchColor => c !== null));

  const schema = reglages.schema === 'auto' ? schemaDetecte : reglages.schema;
  const ecarts = schema ? POLES[schema] : null;
  const force = Math.max(0, Math.min(100, reglages.force)) / 100;

  return couleurs.map((entree, i) => {
    const source = analyses[i];
    // Illisible ou verrouillée : on rend la valeur d'origine, telle quelle.
    if (!source || entree.verrou) return entree.hex;

    let { l, c, h } = source;

    // Teinte, température et saturation ne concernent QUE les couleurs
    // qui ont une teinte. Réchauffer un gris n'a pas de sens ; le
    // saturer non plus. La clarté, elle, s'applique à tout le monde.
    const chromatique = c >= SEUIL_NEUTRE;

    // 1. Harmonisation : rotation de la teinte vers le pôle le plus proche.
    if (ecarts && reference !== null && force > 0 && chromatique) {
      const pole = poleLePlusProche(h, reference, ecarts);
      h = (h + ecartSigne(h, pole) * force * PART_HARMONISATION + 360) % 360;
    }

    // 2. Température : rotation vers l'axe chaud ou l'axe froid.
    const temperature = Math.max(-100, Math.min(100, reglages.temperature)) / 100;
    if (temperature !== 0 && chromatique) {
      const axe = temperature > 0 ? AXE_CHAUD : AXE_FROID;
      h = (h + ecartSigne(h, axe) * Math.abs(temperature) * PART_TEMPERATURE + 360) % 360;
    }

    // 3. Saturation : facteur multiplicatif sur le chroma, de ×0 à ×2.
    const saturation = Math.max(-100, Math.min(100, reglages.saturation)) / 100;
    if (saturation !== 0 && chromatique) c = Math.max(0, c * (1 + saturation));

    // 4. Luminosité : décalage additif, borné loin du blanc et du noir.
    const luminosite = Math.max(-100, Math.min(100, reglages.luminosite)) / 100;
    if (luminosite !== 0) {
      l = Math.max(0.03, Math.min(0.985, l + luminosite * AMPLITUDE_CLARTE));
    }

    c = Math.max(0, Math.min(c, maxChroma(l, h, 'srgb')));
    return oklchToHex(gamutMap({ l, c, h }, 'srgb'));
  });
}

/** Vrai si aucun curseur n'a bougé — pour masquer « Réinitialiser ». */
export function reglagesNeutres(r: Reglages): boolean {
  return (
    r.schema === 'auto' &&
    r.force === 0 &&
    r.temperature === 0 &&
    r.saturation === 0 &&
    r.luminosite === 0
  );
}

/** Le libellé affiché à côté du curseur de température. */
export function libelleTemperature(valeur: number): string {
  if (valeur === 0) return 'neutre';
  return valeur > 0 ? `+${valeur} chaud` : `${Math.abs(valeur)} froid`;
}

export function libelleSaturation(valeur: number): string {
  if (valeur === 0) return '0 %';
  return valeur > 0 ? `+${valeur} %` : `−${Math.abs(valeur)} %`;
}

export function libelleForce(valeur: number): string {
  return `${valeur} %`;
}

/**
 * Choisir un schéma explicite alors que la force est à zéro ne
 * produirait rien de visible. On amorce donc à 65 % : la personne voit
 * immédiatement l'effet de son choix, et peut ensuite doser.
 */
export const FORCE_AMORCEE = 65;

export function libelleLuminosite(valeur: number): string {
  if (valeur === 0) return 'équilibrée';
  return valeur > 0 ? `+${valeur} clair` : `${Math.abs(valeur)} foncé`;
}
