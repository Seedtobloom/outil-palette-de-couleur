/**
 * Les réglages d'harmonie : quatre curseurs qui écrivent DIRECTEMENT
 * dans le nuancier, sans bouton de validation.
 *
 * Tout tient dans une idée : les curseurs ne décrivent pas une suite de
 * modifications, ils décrivent une TRANSFORMATION appliquée à un état
 * figé — la « base ».
 *
 * Sans cette base, deux pièges se referment :
 *
 * 1. les réglages se composeraient sur eux-mêmes. Tirer la saturation à
 *    −50, relâcher, la retirer à −50 donnerait −75 % au total, et le
 *    curseur afficherait −50. On ne saurait plus ce qu'on regarde ;
 * 2. l'annulation deviendrait inutilisable : un cran d'historique par
 *    pixel de glissement, soit des centaines d'entrées pour un geste.
 *
 * La base est donc capturée au premier mouvement, et tout se recalcule
 * depuis elle. L'historique reçoit UNE entrée par séance de réglage.
 */
import { analyzeHarmony, appliqueReglages, reglagesNeutres, type SchemaVise } from '../engine';
import { settings, type PaletteEntry } from './state.svelte';
import { journal } from './journal.svelte';

/** Le schéma détecté, traduit vers celui que comprennent les réglages. */
const DEPUIS_ANALYSE: Record<string, Exclude<SchemaVise, 'auto'> | null> = {
  monochrome: 'mono',
  analogous: 'analogue',
  complementary: 'complementaire',
  'split-complementary': 'split',
  triadic: 'triadique',
  libre: null,
};

/**
 * Quand l'analyse ne reconnaît AUCUNE structure (« libre »), il n'y a
 * pas de schéma vers lequel tirer. Sans repli, la force d'harmonisation
 * ne ferait alors strictement rien — un curseur qui ne répond pas.
 * L'analogue est le repli utile : c'est le geste « resserre-moi ces
 * teintes », celui qu'on attend quand une palette part dans tous les
 * sens.
 */
const REPLI_SANS_STRUCTURE: Exclude<SchemaVise, 'auto'> = 'analogue';

type Cle = 'force' | 'temperature' | 'saturation' | 'luminosite';

class Harmonie {
  /** L'état du nuancier au moment où la séance de réglage a commencé. */
  #base = $state<PaletteEntry[] | null>(null);

  get actif(): boolean {
    return !reglagesNeutres(settings.harmonie);
  }

  /** Les couleurs de référence : la base si on règle, sinon le nuancier. */
  get source(): PaletteEntry[] {
    return this.#base ?? settings.colors;
  }

  /**
   * Le schéma effectivement visé : celui qu'on a choisi, celui que
   * l'analyse a reconnu, ou le repli.
   */
  get schemaVise(): Exclude<SchemaVise, 'auto'> {
    if (settings.harmonie.schema !== 'auto') return settings.harmonie.schema;
    return DEPUIS_ANALYSE[analyzeHarmony(this.source).scheme] ?? REPLI_SANS_STRUCTURE;
  }

  /**
   * ⚠ LE CAS QUI FAISAIT CROIRE À UNE PANNE.
   *
   * En mode automatique, le schéma visé est celui que l'analyse vient de
   * reconnaître DANS la palette. Les teintes sont donc déjà posées sur
   * leurs pôles, et l'harmonisation n'a presque rien à déplacer : on
   * tire le curseur à fond, et rien ne bouge.
   *
   * Ce n'est pas un défaut de calcul — c'est la bonne réponse à
   * « aligne-toi sur ce que tu es déjà ». Mais rien ne le disait, et un
   * curseur muet passe pour un curseur cassé. D'où ce drapeau, que le
   * panneau affiche en clair.
   */
  get harmonisationSansEffet(): boolean {
    if (settings.harmonie.force === 0) return false;
    const base = this.source;
    const avec = appliqueReglages(base, settings.harmonie, this.schemaVise);
    const sans = appliqueReglages(base, { ...settings.harmonie, force: 0 }, this.schemaVise);
    return avec.every((hex, i) => hex === sans[i]);
  }

  /**
   * Déplace un curseur et réécrit le nuancier dans la foulée.
   *
   * La première fois, on fige la base ET on pose un point d'annulation.
   * Les suivantes écrivent sans créer d'entrée : tout le glissement ne
   * coûte qu'un seul Ctrl+Z.
   */
  regle(cle: Cle, valeur: number): void {
    if (!this.#base) {
      const base = settings.colors.map((c) => ({ ...c }));
      journal.agis('Réglage d’harmonie', () => {
        this.#base = base;
        settings.harmonie[cle] = valeur;
        this.#ecris();
      });
      return;
    }
    settings.harmonie[cle] = valeur;
    this.#ecris();
  }

  /** Change le schéma visé, en amorçant la force si elle dort. */
  choisitSchema(schema: SchemaVise, forceAmorcee: number): void {
    const amorce = schema !== 'auto' && settings.harmonie.force === 0;
    if (!this.#base) {
      const base = settings.colors.map((c) => ({ ...c }));
      journal.agis('Réglage d’harmonie', () => {
        this.#base = base;
        settings.harmonie.schema = schema;
        if (amorce) settings.harmonie.force = forceAmorcee;
        this.#ecris();
      });
      return;
    }
    settings.harmonie.schema = schema;
    if (amorce) settings.harmonie.force = forceAmorcee;
    this.#ecris();
  }

  /** Revient à la base et referme la séance. */
  reinitialise(): void {
    const base = this.#base;
    settings.harmonie.schema = 'auto';
    settings.harmonie.force = 0;
    settings.harmonie.temperature = 0;
    settings.harmonie.saturation = 0;
    settings.harmonie.luminosite = 0;
    if (base) settings.colors = base.map((c) => ({ ...c }));
    this.#base = null;
  }

  /**
   * Referme la séance en GARDANT le résultat : ce qui est à l'écran
   * devient la nouvelle référence. À appeler quand on quitte l'étape ou
   * qu'on touche une couleur à la main — sinon le prochain mouvement de
   * curseur repartirait d'une base périmée et effacerait la retouche.
   */
  fige(): void {
    if (!this.#base) return;
    this.#base = null;
    settings.harmonie.force = 0;
    settings.harmonie.temperature = 0;
    settings.harmonie.saturation = 0;
    settings.harmonie.luminosite = 0;
  }

  /** Combien de couleurs diffèrent de la base. */
  get nbModifiees(): number {
    const base = this.#base;
    if (!base) return 0;
    return settings.colors.filter((c, i) => c.hex !== base[i]?.hex).length;
  }

  #ecris(): void {
    const base = this.#base;
    if (!base) return;
    const cibles = appliqueReglages(base, settings.harmonie, this.schemaVise);
    settings.colors = base.map((c, i) => ({ ...c, hex: cibles[i] as string }));
  }
}

export const harmonie = new Harmonie();
