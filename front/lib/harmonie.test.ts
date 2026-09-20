/**
 * Les curseurs d'harmonie, depuis qu'ils écrivent directement.
 *
 * Le bouton « Appliquer » a disparu : chaque mouvement réécrit le
 * nuancier. Tout repose alors sur la base figée au premier geste. Ce
 * test garde les deux propriétés qui en dépendent :
 *
 * 1. les réglages ne se COMPOSENT PAS. Tirer la saturation à −50 deux
 *    fois de suite doit donner le même nuancier qu'une seule fois,
 *    sinon le curseur ment sur ce qu'il affiche ;
 * 2. tout le glissement ne coûte QU'UN cran d'annulation.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { harmonie } from './harmonie.svelte';
import { settings, type PaletteEntry } from './state.svelte';
import { journal } from './journal.svelte';

const DEPART: PaletteEntry[] = [
  { id: 'a', hex: '#412f21', label: 'Terre' },
  { id: 'b', hex: '#f2e5c2', label: 'Paille' },
  { id: 'c', hex: '#e4d1fe', label: 'Glycine' },
];

function hex(): string[] {
  return settings.colors.map((c) => c.hex);
}

beforeEach(() => {
  harmonie.reinitialise();
  journal.oublie();
  settings.colors = DEPART.map((c) => ({ ...c }));
});

describe('réglages d’harmonie à écriture directe', () => {
  it('au repos, ne touche à rien', () => {
    expect(harmonie.actif).toBe(false);
    expect(harmonie.nbModifiees).toBe(0);
    expect(hex()).toEqual(DEPART.map((c) => c.hex));
  });

  it('un mouvement de curseur réécrit le nuancier tout de suite', () => {
    harmonie.regle('saturation', -60);
    expect(harmonie.actif).toBe(true);
    expect(hex()).not.toEqual(DEPART.map((c) => c.hex));
    expect(harmonie.nbModifiees).toBeGreaterThan(0);
  });

  /** La propriété n°1 : pas de composition. */
  it('rejouer la même valeur donne le même résultat', () => {
    harmonie.regle('saturation', -50);
    const premier = hex();
    harmonie.regle('saturation', 0);
    harmonie.regle('saturation', -50);
    expect(hex()).toEqual(premier);
  });

  it('revenir à zéro redonne exactement les couleurs de départ', () => {
    harmonie.regle('luminosite', 40);
    harmonie.regle('luminosite', 0);
    expect(hex()).toEqual(DEPART.map((c) => c.hex));
  });

  /** La propriété n°2 : un seul cran d'annulation pour tout le geste. */
  it('tout un glissement ne coûte qu’un Ctrl+Z', () => {
    for (let v = -5; v >= -60; v -= 5) harmonie.regle('saturation', v);
    expect(journal.annule()).toBe('Réglage d’harmonie');
    expect(hex()).toEqual(DEPART.map((c) => c.hex));
    expect(journal.peutAnnuler).toBe(false);
  });

  it('« revenir aux couleurs de départ » remet tout à plat', () => {
    harmonie.regle('temperature', 70);
    harmonie.reinitialise();
    expect(hex()).toEqual(DEPART.map((c) => c.hex));
    expect(harmonie.actif).toBe(false);
    expect(settings.harmonie.schema).toBe('auto');
  });

  /**
   * Figer, c'est garder le résultat et repartir de lui. Sans cela, une
   * retouche faite à la main entre deux glissements serait effacée par
   * le mouvement suivant, qui repartirait d'une base périmée.
   */
  it('figer garde le résultat et remet les curseurs à zéro', () => {
    harmonie.regle('saturation', -60);
    const obtenu = hex();
    harmonie.fige();
    expect(hex()).toEqual(obtenu);
    expect(harmonie.actif).toBe(false);
    expect(harmonie.nbModifiees).toBe(0);

    // Le mouvement suivant repart bien de ce résultat-là.
    harmonie.regle('saturation', 0);
    expect(hex()).toEqual(obtenu);
  });

  it('choisir un schéma amorce la force d’harmonisation', () => {
    harmonie.choisitSchema('complementaire', 65);
    expect(settings.harmonie.schema).toBe('complementaire');
    expect(settings.harmonie.force).toBe(65);
    expect(hex()).not.toEqual(DEPART.map((c) => c.hex));
  });

  it('revenir en automatique n’amorce rien', () => {
    harmonie.choisitSchema('auto', 65);
    expect(settings.harmonie.force).toBe(0);
  });
});
