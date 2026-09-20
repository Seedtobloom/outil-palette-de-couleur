/**
 * Les versions : des points de sauvegarde nommés, sur lesquels on peut
 * revenir.
 *
 * Elles sont devenues nécessaires le jour où les réglages d'harmonie se
 * sont mis à écrire directement dans le nuancier : sans bouton de
 * validation, il faut un autre filet que l'annulation. Le Ctrl+Z défait
 * le dernier geste ; une version garde un état entier, aussi longtemps
 * qu'on veut, et permet de comparer deux pistes.
 *
 * Ce qu'une version retient : les couleurs, les rôles attribués et les
 * associations de contraste retenues. Pas la position dans le parcours —
 * on revient à un ÉTAT DE PALETTE, pas à un moment de navigation.
 *
 * Tout reste dans ce navigateur, comme le reste de la mémoire locale.
 */
import { settings, type PaletteEntry, type RoleCouleur } from './state.svelte';
import { journal } from './journal.svelte';

const CLE = 'nuancier.versions.v1';
/** Au-delà, la liste devient une brocante : les plus anciennes sortent. */
const MAX = 12;

export type Version = {
  id: string;
  nom: string;
  quand: string;
  colors: PaletteEntry[];
  roles: Record<string, RoleCouleur>;
  pairings: string[];
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Relecture défensive : une sauvegarde bricolée ne doit rien casser. */
function valide(brut: unknown): Version[] {
  if (!Array.isArray(brut)) return [];
  const out: Version[] = [];
  for (const v of brut) {
    if (typeof v !== 'object' || v === null) continue;
    const { id, nom, quand, colors, roles, pairings } = v as Record<string, unknown>;
    if (typeof id !== 'string' || typeof nom !== 'string' || !Array.isArray(colors)) continue;
    const couleurs = colors.filter(
      (c): c is PaletteEntry =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as PaletteEntry).id === 'string' &&
        typeof (c as PaletteEntry).hex === 'string' &&
        HEX.test((c as PaletteEntry).hex),
    );
    if (couleurs.length === 0) continue;
    out.push({
      id,
      nom,
      quand: typeof quand === 'string' ? quand : new Date().toISOString(),
      colors: couleurs,
      roles: (typeof roles === 'object' && roles !== null ? roles : {}) as Record<
        string,
        RoleCouleur
      >,
      pairings: Array.isArray(pairings) ? pairings.filter((p) => typeof p === 'string') : [],
    });
  }
  return out;
}

class Versions {
  liste = $state<Version[]>([]);

  /** À appeler une fois au démarrage, hors de tout effet réactif. */
  charge(): void {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) this.liste = valide(JSON.parse(brut));
    } catch {
      // Navigation privée, stockage refusé : on repart d'une liste vide.
    }
  }

  #range(): void {
    try {
      localStorage.setItem(CLE, JSON.stringify(this.liste));
    } catch {
      // Quota plein : la version reste en mémoire pour cette séance.
    }
  }

  /** Un nom par défaut qui dit quelque chose : la date et l'heure. */
  #nomParDefaut(): string {
    const d = new Date();
    return `Version du ${d.getDate()}/${d.getMonth() + 1} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  }

  enregistre(nom?: string): Version | null {
    if (settings.colors.length === 0) return null;
    const version: Version = {
      id: `v${Date.now().toString(36)}`,
      nom: nom?.trim() || this.#nomParDefaut(),
      quand: new Date().toISOString(),
      colors: settings.colors.map((c) => ({ ...c })),
      roles: { ...settings.roles },
      pairings: [...settings.pairings],
    };
    this.liste = [...this.liste, version].slice(-MAX);
    this.#range();
    return version;
  }

  /** Restaurer passe par le journal : on peut donc défaire un retour. */
  restaure(id: string): Version | null {
    const v = this.liste.find((x) => x.id === id);
    if (!v) return null;
    journal.agis(`Retour à « ${v.nom} »`, () => {
      settings.colors = v.colors.map((c) => ({ ...c }));
      settings.roles = { ...v.roles };
      settings.pairings = [...v.pairings];
    });
    return v;
  }

  renomme(id: string, nom: string): void {
    this.liste = this.liste.map((v) => (v.id === id ? { ...v, nom: nom.trim() || v.nom } : v));
    this.#range();
  }

  supprime(id: string): void {
    this.liste = this.liste.filter((v) => v.id !== id);
    this.#range();
  }
}

export const versions = new Versions();
