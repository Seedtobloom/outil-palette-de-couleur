import { describe, expect, it } from 'vitest';
import { apcaLc, apcaAssess, apcaTargetFor } from './apca';

/**
 * Recette Phase 0 : 20 paires témoins. Les 4 premières sont les valeurs
 * canoniques documentées dans le dépôt apca-w3 (l'implémentation de
 * référence, version épinglée 0.1.9) ; les autres sont figées depuis cette
 * même version pour détecter toute régression ou montée de version sauvage.
 */
const APCA_WITNESSES: [string, string, number][] = [
  ['#888888', '#ffffff', 63.0565],
  ['#ffffff', '#888888', -68.5415],
  ['#000000', '#aaaaaa', 58.1463],
  ['#aaaaaa', '#000000', -56.2411],
  ['#112233', '#ddeeff', 91.6683],
  ['#ddeeff', '#112233', -93.0677],
  ['#334455', '#eeeeee', 83.1058],
  ['#eeeeee', '#334455', -86.1985],
  ['#123456', '#abcdef', 67.4958],
  ['#abcdef', '#123456', -68.0943],
  ['#ff0000', '#ffffff', 64.1262],
  ['#ffffff', '#ff0000', -69.621],
  ['#0000ff', '#ffffff', 85.8208],
  ['#00ff00', '#000000', -86.4892],
  ['#e69f00', '#000000', -58.0955],
  ['#0072b2', '#ffffff', 75.0404],
  ['#767676', '#ffffff', 71.5724],
  ['#767676', '#000000', -30.1035],
  ['#5c6ac4', '#ffffff', 73.5614],
  ['#333333', '#f5f5f5', 92.7032],
];

describe('APCA Lc (référence apca-w3 0.1.9)', () => {
  it.each(APCA_WITNESSES)('%s sur %s → Lc %f', (txt, bg, expected) => {
    expect(apcaLc(txt, bg)).toBeCloseTo(expected, 3);
  });

  it('est asymétrique (polarité) : signe opposé en inversant texte et fond', () => {
    const a = apcaLc('#222222', '#eeeeee');
    const b = apcaLc('#eeeeee', '#222222');
    expect(a).toBeGreaterThan(0); // texte sombre sur fond clair
    expect(b).toBeLessThan(0); // texte clair sur fond sombre
    expect(Math.abs(Math.abs(a) - Math.abs(b))).toBeGreaterThan(0.5); // pas symétrique
  });
});

describe('positionnement APCA : signal qualité, jamais une conformité', () => {
  it('les usages sans cible perceptuelle renvoient n/a', () => {
    expect(apcaTargetFor('surface')).toBeNull();
    expect(apcaAssess('#777777', '#ffffff', 'surface').quality).toBe('n/a');
  });

  it('qualitatif uniquement : comfortable / limit / weak', () => {
    expect(apcaAssess('#333333', '#f5f5f5', 'body-text').quality).toBe('comfortable');
    expect(apcaAssess('#888888', '#ffffff', 'body-text').quality).toBe('limit');
    expect(apcaAssess('#999999', '#777777', 'body-text').quality).toBe('weak');
  });
});
