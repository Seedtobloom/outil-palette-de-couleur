import { describe, expect, it } from 'vitest';
import { findSpotCollisions, interpretDeltaE, matchSpot, SPOT_NOTE } from './spot';
import { oklchToLab, parseToOklch } from '../color/space';

describe('interprétation des écarts (seuils du brief §6.2)', () => {
  it.each([
    [0.5, 'exact'],
    [1.5, 'proche'],
    [3, 'visible'],
    [8, 'différent'],
  ])('ΔE %f → %s', (e, status) => {
    expect(interpretDeltaE(e).status).toBe(status);
    expect(interpretDeltaE(e).verdict.length).toBeGreaterThan(20);
  });
});

describe('comparaison avec une encre saisie depuis le nuancier physique', () => {
  it('une encre identique donne un écart nul', () => {
    const lab = oklchToLab(parseToOklch('#2563eb')!);
    const match = matchSpot('#2563eb', { colorId: 'c1', reference: 'Réf. atelier 12', lab })!;
    expect(match.deltaE).toBeLessThan(0.01);
    expect(match.status).toBe('exact');
  });

  it('une encre éloignée est signalée comme une autre couleur', () => {
    const lab = oklchToLab(parseToOklch('#c0392b')!);
    const match = matchSpot('#2563eb', { colorId: 'c1', reference: 'Réf. 21', lab })!;
    expect(match.deltaE).toBeGreaterThan(5);
    expect(match.status).toBe('différent');
    expect(match.verdict).toContain('ne rend pas ta couleur');
  });
});

describe('couleurs non distinguables en ton direct', () => {
  it('détecte deux couleurs qui tomberaient sur la même encre', () => {
    const collisions = findSpotCollisions([
      { id: 'a', hex: '#eda4a4', label: 'Corail' },
      { id: 'b', hex: '#eea6a6', label: 'Rose' },
      { id: 'c', hex: '#2563eb', label: 'Bleu' },
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.message).toContain('Corail');
    expect(collisions[0]!.message).toContain('Rose');
  });

  it('ne signale rien sur une palette franchement différenciée', () => {
    expect(
      findSpotCollisions([
        { id: 'a', hex: '#2563eb' },
        { id: 'b', hex: '#d05219' },
        { id: 'c', hex: '#111827' },
      ]),
    ).toEqual([]);
  });

  it('ne nécessite aucune donnée de nuancier commercial', () => {
    // Le contrôle ne prend que des hex : aucune référence propriétaire.
    expect(SPOT_NOTE).toContain('Aucun nuancier commercial');
  });
});
