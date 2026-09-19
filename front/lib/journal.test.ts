/**
 * L'historique global.
 *
 * Ce test existe à cause d'un bug réel : la copie d'état passait par
 * `structuredClone`, qui refuse le proxy réactif de Svelte une fois le
 * code compilé — le Ctrl+Z partait en exception dans le navigateur,
 * alors que rien ne le signalait au typage ni au build. D'où les deux
 * premiers cas : ils vérifient qu'une copie a bien lieu, et qu'elle est
 * indépendante de l'état vivant.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { journal } from './journal.svelte';
import { settings, type PaletteEntry } from './state.svelte';

const DEPART: PaletteEntry[] = [
  { id: 'a', hex: '#412f21', label: 'Terre' },
  { id: 'b', hex: '#f2e5c2', label: 'Paille' },
];

beforeEach(() => {
  journal.oublie();
  settings.colors = DEPART.map((c) => ({ ...c }));
  settings.baseColor = '#412f21';
});

describe('journal d’annulation', () => {
  it('ne peut rien annuler au démarrage', () => {
    expect(journal.peutAnnuler).toBe(false);
    expect(journal.peutRefaire).toBe(false);
    expect(journal.annule()).toBeNull();
  });

  it('annule une modification et rend son libellé', () => {
    journal.agis('Ajout de Glycine', () => {
      settings.colors = [...settings.colors, { id: 'c', hex: '#e4d1fe', label: 'Glycine' }];
    });
    expect(settings.colors).toHaveLength(3);
    expect(journal.annule()).toBe('Ajout de Glycine');
    expect(settings.colors).toHaveLength(2);
  });

  /** Le cœur du bug d'origine : l'instantané doit être détaché. */
  it('l’instantané est indépendant de l’état vivant', () => {
    journal.agis('Changement de Terre', () => {
      settings.colors = settings.colors.map((c) =>
        c.id === 'a' ? { ...c, hex: '#000000' } : c,
      );
    });
    // On continue de modifier après coup : l'instantané ne doit pas suivre.
    settings.colors[0]!.hex = '#ffffff';
    journal.annule();
    expect(settings.colors[0]!.hex).toBe('#412f21');
  });

  it('rétablit ce qui vient d’être annulé', () => {
    journal.agis('Retrait de Paille', () => {
      settings.colors = settings.colors.filter((c) => c.id !== 'b');
    });
    journal.annule();
    expect(settings.colors).toHaveLength(2);
    expect(journal.refais()).toBe('Retrait de Paille');
    expect(settings.colors).toHaveLength(1);
  });

  it('une nouvelle action efface la pile de rétablissement', () => {
    journal.agis('Un', () => (settings.baseColor = '#111111'));
    journal.annule();
    expect(journal.peutRefaire).toBe(true);
    journal.agis('Deux', () => (settings.baseColor = '#222222'));
    expect(journal.peutRefaire).toBe(false);
  });

  it('annonce ce que la prochaine annulation défera', () => {
    journal.agis('Ajout de Glycine', () => {
      settings.colors = [...settings.colors, { id: 'c', hex: '#e4d1fe', label: 'Glycine' }];
    });
    expect(journal.prochaineAnnulation).toBe('Ajout de Glycine');
    journal.annule();
    expect(journal.prochaineReprise).toBe('Ajout de Glycine');
  });

  it('remonte plusieurs actions dans l’ordre inverse', () => {
    journal.agis('Un', () => (settings.baseColor = '#111111'));
    journal.agis('Deux', () => (settings.baseColor = '#222222'));
    journal.agis('Trois', () => (settings.baseColor = '#333333'));
    expect(journal.annule()).toBe('Trois');
    expect(settings.baseColor).toBe('#222222');
    expect(journal.annule()).toBe('Deux');
    expect(settings.baseColor).toBe('#111111');
    expect(journal.annule()).toBe('Un');
    expect(settings.baseColor).toBe('#412f21');
  });

  it('conserve le verrou d’une couleur au fil des annulations', () => {
    journal.agis('Verrouillage de Terre', () => {
      settings.colors = settings.colors.map((c) => (c.id === 'a' ? { ...c, verrou: true } : c));
    });
    journal.agis('Ajout de Glycine', () => {
      settings.colors = [...settings.colors, { id: 'c', hex: '#e4d1fe', label: 'Glycine' }];
    });
    journal.annule();
    expect(settings.colors.find((c) => c.id === 'a')?.verrou).toBe(true);
    journal.annule();
    expect(settings.colors.find((c) => c.id === 'a')?.verrou).toBeFalsy();
  });

  it('la pile ne grandit pas indéfiniment', () => {
    for (let i = 0; i < 80; i++) {
      journal.agis(`Action ${i}`, () => (settings.baseColor = `#0000${(i % 90) + 10}`));
    }
    expect(journal.profondeur).toBeLessThanOrEqual(50);
  });

  it('oublie() remet le journal à plat', () => {
    journal.agis('Un', () => (settings.baseColor = '#111111'));
    journal.oublie();
    expect(journal.peutAnnuler).toBe(false);
    expect(journal.peutRefaire).toBe(false);
  });
});
