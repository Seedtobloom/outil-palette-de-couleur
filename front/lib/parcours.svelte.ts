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

/** Étapes qui travaillent sur le nuancier, et le supposent donc rempli. */
const ETAPES_ANALYSE = ['palette', 'harmony', 'roles', 'contrast', 'print', 'social'];

class Parcours {
  index = $state(0);
  maxAtteint = $state(0);
  /**
   * Une palette a été calculée depuis la couleur de départ. Elle sera
   * versée dans le nuancier à l'entrée des étapes d'analyse : la
   * condition d'accès doit donc en tenir compte, sinon l'étape
   * Génération se retrouve sans issue — le nuancier est encore vide et
   * « Continuer » reste désactivé alors même que le clic le remplirait.
   */
  paletteDisponible = $state(false);

  /** Appelé à l'entrée d'une étape, pour laisser Flow amorcer le nuancier. */
  onEntree: ((id: string) => void) | null = null;

  private readonly toutes: StepDef[] = [
    { id: 'usage', short: 'Projet', sub: 'Écran ou papier', title: 'C’est pour quoi ?' },
    { id: 'start', short: 'Départ', sub: 'Couleur ou image', title: 'D’où on part ?' },
    { id: 'color', short: 'Couleur', sub: 'La teinte gardée', title: 'Ta couleur' },
    {
      id: 'build',
      short: 'Génération',
      sub: 'Gammes générées',
      title: 'Le système se construit.',
      lead: 'Trois teintes de marque, des gris teintés, quatre couleurs fonctionnelles.',
    },
    {
      id: 'palette',
      short: 'Nuancier',
      sub: 'Ajouter, nommer',
      condition: this.auMoins3(),
      title: 'Ton nuancier, complet.',
      lead: 'Ajoute, retire, renomme. L’outil te dit ce qui manque.',
    },
    {
      id: 'harmony',
      short: 'Harmonie',
      sub: 'Le schéma suivi',
      condition: this.auMoins3(),
      title: 'Le groupe, accordé.',
      lead: 'Le schéma réellement suivi, et les couleurs qui en sortent.',
    },
    {
      id: 'roles',
      short: 'Rôles',
      sub: 'Qui fait quoi',
      condition: this.auMoins3(),
      title: 'Chaque couleur, à sa place.',
      lead: 'Déduit des contrastes réels, pas de l’intention.',
    },
    {
      id: 'contrast',
      short: 'Contraste',
      sub: 'AA, AAA, par paire',
      condition: this.auMoins3(),
      title: 'Chaque paire, vérifiée.',
      lead: 'Le spécimen d’abord, le chiffre en preuve. Une décision à la fois.',
    },
    {
      id: 'print',
      short: 'Impression',
      sub: 'Encres et papier',
      condition: this.auMoins3(),
      title: 'Sur le papier, vraiment.',
      lead: 'Estimation des encres, taux d’encrage, rendu sur le papier choisi.',
    },
    {
      id: 'social',
      short: 'Réseaux',
      sub: 'Dans un flux',
      condition: this.auMoins3(),
      title: 'En situation.',
      lead: 'Tes couleurs déclinées en clair et en profond — mêmes teintes.',
    },
    { id: 'deliver', short: 'Livraison', sub: 'Exporter, partager', title: 'À toi de jouer.' },
  ];

  private auMoins3() {
    return {
      met: () => settings.colors.length >= 3 || this.paletteDisponible,
      texte: 'Il faut au moins 3 couleurs',
    };
  }

  /** Les étapes réellement au programme : l'impression ne concerne pas
   *  un projet purement écran. */
  get etapes(): StepDef[] {
    return this.toutes.filter((s) =>
      s.id === 'print' ? settings.usage === 'print' || settings.usage === 'identity' : true,
    );
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
    const cible = this.etapes[i];
    if (cible && ETAPES_ANALYSE.includes(cible.id)) this.onEntree?.(cible.id);
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
