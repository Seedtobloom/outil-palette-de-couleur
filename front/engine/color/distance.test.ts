import { describe, expect, it } from 'vitest';
import { deltaE00, deltaE00Lab, deltaEOK } from './distance';

/**
 * Paires témoins du jeu de données publié de Sharma, Wu & Dalal (2005),
 * la référence de vérification standard pour ΔE2000.
 */
const SHARMA_PAIRS: [[number, number, number], [number, number, number], number][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
  [[50, 2.5, 0], [50, 3.2972, 0], 1.0],
  [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [61, -5, 29], 22.8977],
  [[50, 2.5, 0], [56, -27, -3], 31.903],
  [[50, 2.5, 0], [58, 24, 15], 19.4535],
];

describe('ΔE2000 (référence Sharma 2005)', () => {
  it.each(SHARMA_PAIRS)('Lab %j vs %j → %f', (a, b, expected) => {
    const got = deltaE00Lab({ l: a[0], a: a[1], b: a[2] }, { l: b[0], a: b[1], b: b[2] });
    expect(got).toBeCloseTo(expected, 3);
  });

  it('est symétrique et nul sur couleurs identiques', () => {
    expect(deltaE00('#336699', '#336699')).toBe(0);
    expect(deltaE00('#336699', '#996633')).toBeCloseTo(deltaE00('#996633', '#336699'), 10);
  });
});

describe('ΔEOK', () => {
  it('nul sur couleurs identiques, positif sinon', () => {
    expect(deltaEOK('#336699', '#336699')).toBe(0);
    expect(deltaEOK('#000000', '#ffffff')).toBeCloseTo(1, 5);
    expect(deltaEOK('#336699', '#396639')).toBeGreaterThan(0);
  });
});
