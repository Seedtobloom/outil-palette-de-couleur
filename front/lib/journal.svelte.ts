/**
 * L'historique global : une seule pile d'annulation pour tout l'outil.
 *
 * L'étape Contraste avait déjà sa propre pile, locale. C'était une demi-
 * mesure : on corrigeait un contraste, on passait au nuancier, on
 * supprimait une couleur par erreur — et le Ctrl+Z ne rattrapait rien
 * parce qu'on avait changé de composant. Ici, une seule pile, lisible
 * depuis partout, qui couvre l'ajout d'une couleur comme l'ajustement
 * automatique des contrastes.
 *
 * Deux choix qui comptent :
 *
 * 1. chaque entrée porte un LIBELLÉ. « Annulé » tout seul ne dit pas ce
 *    qui a été défait ; « Annulé : ajustement de 3 couleurs » si. Le
 *    libellé est écrit au moment de l'action, par celui qui la déclenche,
 *    pas deviné après coup par comparaison d'états ;
 * 2. l'instantané est pris AVANT la mutation. C'est ce qui permet
 *    d'écrire `journal.agis('...', () => { ... })` autour de n'importe
 *    quelle modification sans se demander où poser la sauvegarde.
 */
import { settings } from './state.svelte';

/** Assez pour remonter une séance de travail, pas assez pour peser. */
const LIMITE = 50;

type Entree = { label: string; etat: Record<string, unknown> };

/**
 * Copie profonde par sérialisation JSON, et pas `structuredClone`.
 *
 * L'état est un objet réactif : `structuredClone` refuse le proxy qui
 * l'enveloppe (« could not be cloned »), y compris après passage par
 * `$state.snapshot` une fois le code compilé. `JSON.stringify`, lui, lit
 * au travers du proxy sans difficulté, et tout ce que contient l'état
 * est sérialisable — chaînes, nombres, booléens, tableaux d'objets
 * plats. Si un jour on y range une Date ou un Map, c'est ici qu'il
 * faudra revenir.
 */
function copie<T>(valeur: T): T {
  return JSON.parse(JSON.stringify(valeur)) as T;
}

function instantane(): Record<string, unknown> {
  return copie(settings) as unknown as Record<string, unknown>;
}

function restaure(etat: Record<string, unknown>): void {
  Object.assign(settings, copie(etat));
}

class Journal {
  #passe = $state<Entree[]>([]);
  #futur = $state<Entree[]>([]);

  get peutAnnuler(): boolean {
    return this.#passe.length > 0;
  }

  get peutRefaire(): boolean {
    return this.#futur.length > 0;
  }

  /** Ce que Ctrl+Z défera — affiché dans l'infobulle du bouton. */
  get prochaineAnnulation(): string | null {
    return this.#passe.at(-1)?.label ?? null;
  }

  get prochaineReprise(): string | null {
    return this.#futur.at(-1)?.label ?? null;
  }

  /** Nombre d'actions annulables, pour l'affichage. */
  get profondeur(): number {
    return this.#passe.length;
  }

  /**
   * Exécute une modification en la rendant annulable.
   * Le libellé est au passé et nomme l'objet : « Ajout de Glycine »,
   * « Retrait de Ocre », « Ajustement de 3 couleurs ».
   */
  agis(label: string, mutation: () => void): void {
    this.#passe = [...this.#passe, { label, etat: instantane() }].slice(-LIMITE);
    this.#futur = [];
    mutation();
  }

  annule(): string | null {
    const entree = this.#passe.at(-1);
    if (!entree) return null;
    this.#futur = [...this.#futur, { label: entree.label, etat: instantane() }];
    this.#passe = this.#passe.slice(0, -1);
    restaure(entree.etat);
    return entree.label;
  }

  refais(): string | null {
    const entree = this.#futur.at(-1);
    if (!entree) return null;
    this.#passe = [...this.#passe, { label: entree.label, etat: instantane() }].slice(-LIMITE);
    this.#futur = this.#futur.slice(0, -1);
    restaure(entree.etat);
    return entree.label;
  }

  /** Après un chargement de palette partagée ou une remise à zéro : la
   *  pile d'avant ne veut plus rien dire. */
  oublie(): void {
    this.#passe = [];
    this.#futur = [];
  }
}

export const journal = new Journal();
