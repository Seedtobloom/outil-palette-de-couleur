/**
 * L'aperçu des réglages d'harmonie, partagé entre les deux colonnes.
 *
 * Les curseurs sont à droite, les couleurs à gauche : pour que le
 * réglage se voie SUR les couleurs, les deux composants doivent lire le
 * même calcul. D'où ce module.
 *
 * ⚠ Tout est en GETTER, rien n'est écrit.
 *
 * La tentation était d'avoir un effet qui calcule l'aperçu et le range
 * dans un état partagé. C'est précisément la forme qui se relance
 * elle-même — on l'a déjà payée une fois, avec une pile de messages qui
 * recouvrait l'écran. Ici, l'aperçu est une vue dérivée de l'état : le
 * nuancier n'est modifié qu'au moment où l'on clique « Appliquer ».
 */
import { analyzeHarmony, appliqueReglages, reglagesNeutres, type SchemaVise } from '../engine';
import { settings } from './state.svelte';

/** Le schéma détecté, traduit vers celui que comprennent les réglages. */
const DEPUIS_ANALYSE: Record<string, Exclude<SchemaVise, 'auto'> | null> = {
  monochrome: 'mono',
  analogous: 'analogue',
  complementary: 'complementaire',
  'split-complementary': 'split',
  triadic: 'triadique',
  libre: null,
};

class Harmonie {
  /** Vrai dès qu'un curseur a bougé : c'est ce qui fait basculer la
   *  grille en mode aperçu. */
  get actif(): boolean {
    return !reglagesNeutres(settings.harmonie);
  }

  /** Les couleurs telles qu'elles seraient si on appliquait. */
  get apercu(): string[] {
    const detecte = DEPUIS_ANALYSE[analyzeHarmony(settings.colors).scheme] ?? null;
    return appliqueReglages(settings.colors, settings.harmonie, detecte);
  }

  /** Combien de couleurs changeraient réellement. */
  get nbModifiees(): number {
    const vue = this.apercu;
    return vue.filter((hex, i) => hex !== settings.colors[i]?.hex).length;
  }

  /** Remet les quatre curseurs à zéro, en gardant le schéma choisi. */
  reinitialise(): void {
    settings.harmonie.force = 0;
    settings.harmonie.temperature = 0;
    settings.harmonie.saturation = 0;
    settings.harmonie.luminosite = 0;
  }
}

export const harmonie = new Harmonie();
