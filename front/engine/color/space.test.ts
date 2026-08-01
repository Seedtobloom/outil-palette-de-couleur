import { describe, expect, it } from 'vitest';
import { parseToOklch, oklchToHex, formatOklch } from './space';
import { deltaE00 } from './distance';

/**
 * Recette Phase 0 : 20 couleurs témoins, conversions identiques à oklch.com
 * (tolérance ΔE00 < 0.5). Valeurs relevées sur oklch.com (arrondies par
 * l'affichage du site à 4 décimales / 2 décimales de teinte).
 */
const OKLCH_WITNESSES: [string, number, number, number][] = [
  ['#ff0000', 0.628, 0.2577, 29.23],
  ['#00ff00', 0.8664, 0.2948, 142.5],
  ['#0000ff', 0.452, 0.3132, 264.05],
  ['#ffffff', 1, 0, 0],
  ['#000000', 0, 0, 0],
  ['#ffff00', 0.968, 0.211, 109.77],
  ['#00ffff', 0.9054, 0.1546, 194.77],
  ['#ff00ff', 0.7017, 0.3225, 328.36],
  ['#808080', 0.5999, 0, 0],
  ['#800000', 0.3767, 0.1546, 29.23],
  ['#008000', 0.5198, 0.1769, 142.5],
  ['#000080', 0.2711, 0.1879, 264.05],
  ['#ffa500', 0.7927, 0.171, 70.67],
  ['#4682b4', 0.588, 0.0993, 245.74],
  ['#e69f00', 0.7527, 0.1576, 76.77],
  ['#56b4e9', 0.7345, 0.1174, 236.18],
  ['#009e73', 0.6198, 0.1295, 165.46],
  ['#d55e00', 0.6213, 0.1705, 47.51],
  ['#cc79a7', 0.6794, 0.1177, 346.32],
  ['#f0e442', 0.9016, 0.1721, 105.04],
];

describe('conversions OKLCH (référence oklch.com)', () => {
  it.each(OKLCH_WITNESSES)('%s → oklch attendu, ΔE00 < 0.5', (hex, l, c, h) => {
    const got = parseToOklch(hex);
    expect(got).not.toBeNull();
    const e = deltaE00(got!, { l, c, h });
    expect(e).toBeLessThan(0.5);
  });

  it('aller-retour hex → oklch → hex exact sur toute la palette témoin', () => {
    for (const [hex] of OKLCH_WITNESSES) {
      const oklch = parseToOklch(hex)!;
      expect(oklchToHex(oklch)).toBe(hex);
    }
  });

  it('accepte les notations CSS usuelles', () => {
    expect(parseToOklch('rgb(255 0 0)')).not.toBeNull();
    expect(parseToOklch('  #ABC  ')).not.toBeNull();
    expect(parseToOklch('oklch(62.8% 0.2577 29.23)')).not.toBeNull();
    expect(parseToOklch('pas-une-couleur')).toBeNull();
  });

  it('la teinte est normalisée dans [0, 360)', () => {
    const c = parseToOklch('#ff0000')!;
    expect(c.h).toBeGreaterThanOrEqual(0);
    expect(c.h).toBeLessThan(360);
  });

  it('formatOklch produit une syntaxe CSS lisible', () => {
    const c = parseToOklch('#ff0000')!;
    expect(formatOklch(c)).toMatch(/^oklch\(\d+(\.\d+)?% 0\.\d+ \d+(\.\d+)?\)$/);
  });
});
