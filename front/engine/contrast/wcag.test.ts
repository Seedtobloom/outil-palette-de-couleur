import { describe, expect, it } from 'vitest';
import { contrastRatio, wcagCheck, wcagThresholds, findLightnessForRatio, relativeLuminance } from './wcag';
import { parseToOklch } from '../color/space';

/**
 * Recette Phase 0 : 20 paires témoins, ratios identiques à WebAIM Contrast
 * Checker (même formule, arrondi affiché à 2 décimales). Les valeurs des
 * paires célèbres (#767676 → 4.54, #777777 → 4.48, #0000ff → 8.59…) sont
 * celles affichées par WebAIM ; le reste est calculé par une implémentation
 * indépendante de la même formule normative.
 */
const WEBAIM_WITNESSES: [string, string, number][] = [
  ['#000000', '#FFFFFF', 21.0],
  ['#767676', '#FFFFFF', 4.54],
  ['#777777', '#FFFFFF', 4.48],
  ['#FF0000', '#FFFFFF', 4.0],
  ['#00FF00', '#FFFFFF', 1.37],
  ['#0000FF', '#FFFFFF', 8.59],
  ['#FFFF00', '#FFFFFF', 1.07],
  ['#FF0000', '#000000', 5.25],
  ['#0000FF', '#000000', 2.44],
  ['#808080', '#FFFFFF', 3.95],
  ['#008000', '#FFFFFF', 5.14],
  ['#000080', '#FFFFFF', 16.01],
  ['#E69F00', '#000000', 9.32],
  ['#56B4E9', '#000000', 9.1],
  ['#0072B2', '#FFFFFF', 5.19],
  ['#D55E00', '#FFFFFF', 3.87],
  ['#CC79A7', '#000000', 6.86],
  ['#333333', '#F5F5F5', 11.59],
  ['#6C757D', '#FFFFFF', 4.69],
  ['#1A73E8', '#FFFFFF', 4.51],
];

describe('ratio WCAG 2.2 (référence WebAIM)', () => {
  it.each(WEBAIM_WITNESSES)('%s sur %s → %f', (fg, bg, expected) => {
    expect(Math.round(contrastRatio(fg, bg) * 100) / 100).toBe(expected);
  });

  it('est symétrique et borné à [1, 21]', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(contrastRatio('#abcdef', '#123456'), 10);
    expect(contrastRatio('#888888', '#888888')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });

  it('luminance relative : bornes connues', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('seuils par usage (matrice typée, brief §3.5)', () => {
  it('texte courant : AA 4.5, AAA 7 — SC 1.4.3 / 1.4.6', () => {
    const t = wcagThresholds('body-text');
    expect(t.aa).toBe(4.5);
    expect(t.aaa).toBe(7);
    expect(t.rule).toContain('1.4.3');
  });

  it('grand texte : AA 3, AAA 4.5', () => {
    const t = wcagThresholds('large-text');
    expect(t.aa).toBe(3);
    expect(t.aaa).toBe(4.5);
  });

  it('composant et focus : 3:1, pas de AAA — SC 1.4.11', () => {
    for (const usage of ['ui-component', 'focus-ring'] as const) {
      const t = wcagThresholds(usage);
      expect(t.aa).toBe(3);
      expect(t.aaa).toBeNull();
      expect(t.rule).toContain('1.4.11');
    }
  });

  it('surface : cible indicative, marquée comme telle', () => {
    const t = wcagThresholds('surface');
    expect(t.advisory).toBe(true);
  });

  it('décoratif : exempté', () => {
    expect(wcagThresholds('decorative').aa).toBeNull();
    expect(wcagCheck('#cccccc', '#dddddd', 'decorative').level).toBe('exempt');
  });

  it('jamais de « niveau A » associé à un ratio', () => {
    for (const usage of ['body-text', 'large-text', 'ui-component', 'focus-ring', 'surface', 'decorative'] as const) {
      const r = wcagCheck('#777777', '#ffffff', usage);
      // Le type même du résultat ne peut représenter qu'AA, AAA, exempt ou échec.
      expect(['AA', 'AAA', 'exempt', null]).toContain(r.level);
    }
  });
});

describe('classification AA / AAA', () => {
  it('4.48:1 échoue AA en texte courant, passe AA en grand texte', () => {
    expect(wcagCheck('#777777', '#ffffff', 'body-text').passesAA).toBe(false);
    expect(wcagCheck('#777777', '#ffffff', 'large-text').level).toBe('AA');
  });

  it('4.54:1 passe AA mais pas AAA en texte courant', () => {
    const r = wcagCheck('#767676', '#ffffff', 'body-text');
    expect(r.level).toBe('AA');
    expect(r.passesAAA).toBe(false);
  });

  it('11.59:1 atteint AAA', () => {
    expect(wcagCheck('#333333', '#f5f5f5', 'body-text').level).toBe('AAA');
  });
});

describe('findLightnessForRatio (socle du mode inversé)', () => {
  it('trouve un pas qui atteint exactement 4.5:1 sur fond blanc', () => {
    const c = parseToOklch('#5c9ce6')!;
    const found = findLightnessForRatio('#ffffff', 4.5, { c: c.c, h: c.h, direction: 'darker' });
    expect(found).not.toBeNull();
    expect(found!.ratio).toBeGreaterThanOrEqual(4.5);
    expect(found!.ratio).toBeLessThan(4.7); // proche du seuil, pas au-delà
  });

  it('retourne null quand le ratio est inatteignable dans la direction demandée', () => {
    // Éclaircir sur fond blanc ne peut pas dépasser ~1.07 pour un jaune clair.
    const found = findLightnessForRatio('#ffffff', 4.5, { c: 0.1, h: 100, direction: 'lighter' });
    expect(found).toBeNull();
  });
});
