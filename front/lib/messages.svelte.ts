/**
 * Messages éphémères (les « toasts »).
 *
 * Trois règles, qui sont aussi trois écarts avec l'implémentation
 * habituelle :
 *
 * 1. l'information ne passe JAMAIS par la seule couleur — chaque message
 *    porte un signe (✓, ✕, ·) et un mot. C'est la règle de verdict de
 *    tout l'outil (SC 1.4.1), elle vaut aussi pour son interface ;
 * 2. le compte à rebours se met en pause au survol et au focus. WCAG 2.2
 *    SC 2.2.1 demande de pouvoir prolonger un contenu qui disparaît tout
 *    seul : un message qu'on est en train de lire ne doit pas s'effacer
 *    sous les yeux ;
 * 3. un refus reste deux fois plus longtemps qu'une confirmation. Une
 *    réussite se devine à l'écran ; un refus, non.
 */
export type Ton = 'info' | 'succes' | 'refus';

export type Message = {
  id: number;
  texte: string;
  ton: Ton;
  /** Action facultative offerte dans le message (« Annuler »). */
  action?: { libelle: string; faire: () => void };
};

const DUREES: Record<Ton, number> = { info: 4000, succes: 4000, refus: 8000 };

class Messages {
  liste = $state<Message[]>([]);
  #compteur = 0;
  #minuteries = new Map<number, ReturnType<typeof setTimeout>>();

  montre(texte: string, ton: Ton = 'info', action?: Message['action']): number {
    const id = ++this.#compteur;
    this.liste = [...this.liste, { id, texte, ton, ...(action ? { action } : {}) }];
    this.relance(id);
    return id;
  }

  /** Raccourcis de lecture, pour que les appels restent courts. */
  succes(texte: string, action?: Message['action']): void {
    this.montre(texte, 'succes', action);
  }

  refus(texte: string): void {
    this.montre(texte, 'refus');
  }

  ferme(id: number): void {
    clearTimeout(this.#minuteries.get(id));
    this.#minuteries.delete(id);
    this.liste = this.liste.filter((m) => m.id !== id);
  }

  /** Survol ou focus : on suspend la disparition. */
  suspend(id: number): void {
    clearTimeout(this.#minuteries.get(id));
    this.#minuteries.delete(id);
  }

  /** Survol ou focus n'importe où dans la pile : tout se fige. Plus
   *  juste que de ne suspendre que le message pointé — on lit la pile,
   *  pas une ligne. */
  suspendTout(): void {
    for (const m of this.liste) this.suspend(m.id);
  }

  relanceTout(): void {
    for (const m of this.liste) this.relance(m.id);
  }

  relance(id: number): void {
    const message = this.liste.find((m) => m.id === id);
    if (!message) return;
    this.suspend(id);
    this.#minuteries.set(
      id,
      setTimeout(() => this.ferme(id), DUREES[message.ton]),
    );
  }
}

export const messages = new Messages();
