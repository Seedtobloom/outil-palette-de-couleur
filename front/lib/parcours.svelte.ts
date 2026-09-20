/**
 * Le parcours : la liste des étapes et la position dans le fil.
 *
 * Ce modèle vivait dans Flow.svelte, qui affichait aussi la navigation
 * sous forme de rail à gauche. La navigation est remontée dans la barre
 * de tête : il fallait donc que l'état soit lisible depuis deux endroits
 * à la fois — la barre qui affiche le fil, et la scène qui affiche
 * l'étape. D'où ce module partagé.
 *
 * Classe plutôt qu'objet littéral : c'est la forme qui garde la
 * réactivité des runes au passage d'un module à l'autre.
 */
import { settings } from './state.svelte';

export type StepDef = {
  id: string;
  /** Nom court, celui qui s'affiche dans le fil. */
  short: string;
  /** Sous-libellé, pour les vues qui ont la place. */
  sub: string;
  title: string;
  lead?: string;
  /** Ce qu'il faut avoir fait pour déverrouiller cette étape. */
  condition?: { met: () => boolean; texte: string };
};

/**
 * Nombre d'associations de contraste à retenir avant d'ouvrir la suite
 * du parcours. C'est le verrou de la référence : on ne distribue pas des
 * rôles avant d'avoir décidé quelles paires on utilise réellement.
 */
export const PAIRINGS_REQUIS = 4;

class Parcours {
  index = $state(0);
  maxAtteint = $state(0);
  /**
   * Les six étapes, calquées sur celles de l'outil de référence — y
   * compris l'ordre : le contraste se teste AVANT d'attribuer les rôles,
   * puisque les rôles se déduisent des paires réellement lisibles.
   *
   * Le départ n'est plus une étape à part : les entrées (coller une
   * palette, importer une photo, construire, piper une couleur) sont la
   * barre d'outils de l'étape « Construire ».
   */
  private readonly toutes: StepDef[] = [
    {
      id: 'palette',
      short: 'Construire',
      sub: 'Ajouter, nommer',
      title: 'Construire la palette.',
      lead: 'Colle, importe, construis. Ajoute, retire, renomme, verrouille.',
    },
    {
      id: 'harmony',
      short: 'Harmonie',
      sub: 'Le schéma suivi',
      condition: this.auMoins3(),
      title: 'Analyser l’harmonie.',
      lead: 'Le schéma réellement suivi, les fausses notes, et les réglages d’ensemble.',
    },
    {
      id: 'contrast',
      short: 'Contraste',
      sub: 'AA, AAA, par paire',
      condition: this.auMoins3(),
      title: 'Tester le contraste.',
      lead: 'Toutes les paires, leur ratio et leur niveau. Retiens celles que tu utiliseras.',
    },
    {
      id: 'roles',
      short: 'Rôles',
      sub: 'Qui fait quoi',
      condition: this.auMoinsPairings(),
      title: 'Attribuer les rôles.',
      lead: 'Dominante, accents, neutres — d’après les contrastes réels, pas l’intention.',
    },
    {
      id: 'convert',
      short: 'Convertir',
      sub: 'HEX, RVB, HSL, CMJN',
      condition: this.auMoinsPairings(),
      title: 'Convertir.',
      lead: 'Une fiche par couleur, dans tous les formats — clique une valeur pour la copier.',
    },
    {
      id: 'deliver',
      short: 'Exporter',
      sub: 'Fichiers et code',
      condition: this.auMoinsPairings(),
      title: 'Exporter & utiliser.',
    },
  ];

  /**
   * ⚠ Ce verrou ne verrouillait rien.
   *
   * Il disait « au moins 3 couleurs OU une palette disponible », et
   * `paletteDisponible` était vrai en permanence : elle venait de
   * `generatePalette(settings.baseColor)`, qui réussit toujours. On
   * pouvait donc entrer dans l'étape Harmonie avec un nuancier vide, et
   * Flow amorçait alors le nuancier avec cinq couleurs dérivées de cette
   * couleur de base fantôme — le bleu par défaut, dans le nuancier de
   * quelqu'un qui travaille sur du brun.
   *
   * La condition dit maintenant ce qu'elle annonce.
   */
  private auMoins3() {
    return {
      met: () => settings.colors.length >= 3,
      texte: 'Il faut au moins 3 couleurs',
    };
  }

  /**
   * Le verrou de la référence : les trois dernières étapes n'ouvrent
   * qu'une fois quatre associations de contraste retenues. Ce n'est pas
   * une formalité — c'est ce qui garantit qu'on distribue des rôles sur
   * des paires dont on a vérifié la lisibilité.
   */
  private auMoinsPairings() {
    return {
      met: () => settings.pairings.length >= PAIRINGS_REQUIS,
      texte: `Retiens ${PAIRINGS_REQUIS} associations de contraste pour débloquer`,
    };
  }

  /**
   * Les six étapes, toujours les mêmes. Il y en a eu onze, dont deux
   * conditionnées à la nature du projet (écran ou papier) : le parcours
   * est revenu à une liste fixe, alignée sur l'outil de référence.
   */
  get etapes(): StepDef[] {
    return this.toutes;
  }

  get courante(): StepDef {
    return this.etapes[Math.min(this.index, this.etapes.length - 1)] as StepDef;
  }

  get suivante(): StepDef | null {
    return this.etapes[this.index + 1] ?? null;
  }

  /** La condition qui bloque l'étape suivante, si elle en a une. */
  get conditionSuivante(): string | null {
    const s = this.suivante;
    if (!s?.condition) return null;
    return s.condition.met() ? null : s.condition.texte;
  }

  get peutContinuer(): boolean {
    return this.suivante !== null && this.conditionSuivante === null;
  }

  /** Vrai si l'étape est accessible : atteinte et condition remplie. */
  accessible(i: number): boolean {
    const cible = this.etapes[i];
    if (!cible) return false;
    if (i > this.maxAtteint) return false;
    return !cible.condition || cible.condition.met();
  }

  private entre(i: number): void {
    this.index = i;
    this.maxAtteint = Math.max(this.maxAtteint, i);
  }

  va(i: number): void {
    if (i < 0 || i >= this.etapes.length) return;
    if (!this.accessible(i)) return;
    this.entre(i);
  }

  suivant(): void {
    if (this.index < this.etapes.length - 1) this.entre(this.index + 1);
  }

  precedent(): void {
    if (this.index > 0) this.index -= 1;
  }

  /** Saut direct par identifiant — utilisé par le score de santé. */
  versId(id: string): void {
    const i = this.etapes.findIndex((s) => s.id === id);
    if (i >= 0) this.entre(i);
  }
}

export const parcours = new Parcours();
