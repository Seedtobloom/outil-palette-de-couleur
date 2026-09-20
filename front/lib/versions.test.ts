/**
 * Les versions : points de sauvegarde nommés.
 *
 * Elles sont le filet des curseurs d'harmonie, qui écrivent désormais
 * sans bouton de validation. Deux choses comptent donc ici : qu'une
 * version soit bien DÉTACHÉE de l'état vivant (sinon elle se déformerait
 * en même temps que le nuancier qu'elle est censée mémoriser), et qu'un
 * retour reste annulable.
 *
 * Le stockage est simulé : les tests tournent sous Node, sans navigateur.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { versions } from './versions.svelte';
import { settings, type PaletteEntry } from './state.svelte';
import { journal } from './journal.svelte';

const DEPART: PaletteEntry[] = [
  { id: 'a', hex: '#412f21', label: 'Terre' },
  { id: 'b', hex: '#f2e5c2', label: 'Paille' },
];

/** Un localStorage de poche, suffisant pour ce que le module en fait. */
function stockageSimule(): Map<string, string> {
  const carte = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => carte.get(k) ?? null,
    setItem: (k: string, v: string) => void carte.set(k, v),
    removeItem: (k: string) => void carte.delete(k),
  });
  return carte;
}

let carte: Map<string, string>;

beforeEach(() => {
  carte = stockageSimule();
  versions.liste = [];
  journal.oublie();
  settings.colors = DEPART.map((c) => ({ ...c }));
  settings.roles = {};
  settings.pairings = [];
});

describe('versions', () => {
  it('refuse d’enregistrer un nuancier vide', () => {
    settings.colors = [];
    expect(versions.enregistre('Rien')).toBeNull();
    expect(versions.liste).toHaveLength(0);
  });

  it('enregistre les couleurs, les rôles et les associations', () => {
    settings.roles = { a: 'hero' };
    settings.pairings = ['a|b'];
    const v = versions.enregistre('Piste chaude');
    expect(v?.nom).toBe('Piste chaude');
    expect(v?.colors).toHaveLength(2);
    expect(v?.roles).toEqual({ a: 'hero' });
    expect(v?.pairings).toEqual(['a|b']);
  });

  it('donne un nom par défaut quand on n’en saisit pas', () => {
    expect(versions.enregistre('   ')?.nom).toMatch(/^Version du /);
  });

  /**
   * Le piège classique : garder la référence au tableau vivant. La
   * version suivrait alors chaque mouvement de curseur, et « revenir »
   * ne ramènerait nulle part.
   */
  it('l’instantané est détaché de l’état vivant', () => {
    const v = versions.enregistre('Départ');
    settings.colors[0]!.hex = '#000000';
    expect(v?.colors[0]?.hex).toBe('#412f21');
  });

  it('revient à une version, et ce retour est annulable', () => {
    const v = versions.enregistre('Départ');
    settings.colors = settings.colors.map((c) => ({ ...c, hex: '#ffffff' }));
    settings.pairings = ['x|y'];

    versions.restaure(v!.id);
    expect(settings.colors[0]!.hex).toBe('#412f21');
    expect(settings.pairings).toEqual([]);

    journal.annule();
    expect(settings.colors[0]!.hex).toBe('#ffffff');
    expect(settings.pairings).toEqual(['x|y']);
  });

  it('ignore un identifiant inconnu', () => {
    expect(versions.restaure('v-inexistante')).toBeNull();
  });

  it('renomme et supprime', () => {
    const v = versions.enregistre('Avant')!;
    versions.renomme(v.id, 'Après');
    expect(versions.liste[0]!.nom).toBe('Après');
    // Un nom vidé n'efface pas le nom : il ne se passe rien.
    versions.renomme(v.id, '   ');
    expect(versions.liste[0]!.nom).toBe('Après');
    versions.supprime(v.id);
    expect(versions.liste).toHaveLength(0);
  });

  /** Au-delà du plafond, ce sont les plus anciennes qui sortent. */
  it('plafonne la liste et garde les plus récentes', () => {
    for (let i = 0; i < 15; i++) versions.enregistre(`n°${i}`);
    expect(versions.liste).toHaveLength(12);
    expect(versions.liste[0]!.nom).toBe('n°3');
    expect(versions.liste.at(-1)!.nom).toBe('n°14');
  });

  it('relit ce qu’elle a écrit dans la mémoire locale', () => {
    versions.enregistre('Gardée');
    versions.liste = [];
    versions.charge();
    expect(versions.liste).toHaveLength(1);
    expect(versions.liste[0]!.nom).toBe('Gardée');
  });

  /**
   * Une sauvegarde abîmée à la main ne doit pas empêcher l'outil de
   * démarrer : on jette les entrées douteuses et on garde le reste.
   */
  it('écarte les entrées invalides sans rien casser', () => {
    carte.set(
      'nuancier.versions.v1',
      JSON.stringify([
        null,
        { id: 'x' },
        { id: 'y', nom: 'Sans couleur', colors: [] },
        { id: 'z', nom: 'Teinte illisible', colors: [{ id: 'a', hex: 'bleu' }] },
        { id: 'ok', nom: 'Bonne', colors: [{ id: 'a', hex: '#412F21' }] },
      ]),
    );
    versions.charge();
    expect(versions.liste).toHaveLength(1);
    expect(versions.liste[0]!.nom).toBe('Bonne');
    // Les champs absents reçoivent un repli utilisable.
    expect(versions.liste[0]!.roles).toEqual({});
    expect(versions.liste[0]!.pairings).toEqual([]);
  });

  it('survit à un stockage indisponible', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => versions.charge()).not.toThrow();
    expect(() => versions.enregistre('Navigation privée')).not.toThrow();
  });
});
