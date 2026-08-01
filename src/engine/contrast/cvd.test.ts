import { describe, expect, it } from 'vitest';
import { simulateCvd, toGrayscale, findCvdCollisions } from './cvd';
import { relativeLuminance } from './wcag';
import { deltaE00 } from '../color/distance';
import matrices from '../../data/machado2009.json';

/** Palette Okabe-Ito : la référence CVD-safe (brief annexe C). */
const OKABE_ITO = [
  { id: 'noir', hex: '#000000' },
  { id: 'orange', hex: '#E69F00' },
  { id: 'bleu-ciel', hex: '#56B4E9' },
  { id: 'vert', hex: '#009E73' },
  { id: 'jaune', hex: '#F0E442' },
  { id: 'bleu', hex: '#0072B2' },
  { id: 'vermillon', hex: '#D55E00' },
  { id: 'rose', hex: '#CC79A7' },
];

describe('matrices Machado 2009 (données publiées)', () => {
  it('sévérité 0 = identité (les trois types)', () => {
    for (const type of ['protan', 'deutan', 'tritan'] as const) {
      const m = (matrices[type] as Record<string, number[]>)['0.0']!;
      expect(m[0]).toBeCloseTo(1, 5);
      expect(m[4]).toBeCloseTo(1, 5);
      expect(m[8]).toBeCloseTo(1, 5);
      expect(m[1]).toBeCloseTo(0, 5);
    }
  });

  it('protanopie 1.0 : première ligne conforme à la publication', () => {
    const m = (matrices.protan as Record<string, number[]>)['1.0']!;
    expect(m[0]).toBeCloseTo(0.152286, 6);
    expect(m[1]).toBeCloseTo(1.052583, 6);
    expect(m[2]).toBeCloseTo(-0.204868, 6);
  });

  it('chaque ligne de chaque matrice somme à ≈ 1 (préservation des gris)', () => {
    for (const type of ['protan', 'deutan', 'tritan'] as const) {
      for (const m of Object.values(matrices[type] as Record<string, number[]>)) {
        for (const row of [0, 3, 6]) {
          const sum = (m[row] ?? 0) + (m[row + 1] ?? 0) + (m[row + 2] ?? 0);
          expect(sum).toBeCloseTo(1, 2);
        }
      }
    }
  });
});

describe('simulateCvd', () => {
  it('sévérité 0 : la couleur ne change pas', () => {
    for (const { hex } of OKABE_ITO) {
      expect(deltaE00(simulateCvd(hex, 'deutan', 0), hex)).toBeLessThan(0.2);
    }
  });

  it('un gris neutre est stable sous toutes les simulations', () => {
    for (const type of ['protan', 'deutan', 'tritan'] as const) {
      expect(deltaE00(simulateCvd('#808080', type, 100), '#808080')).toBeLessThan(1.5);
    }
  });

  it('la deutéranopie complète rapproche fortement un rouge et un vert purs', () => {
    const red = simulateCvd('#cc0000', 'deutan', 100);
    const green = simulateCvd('#007700', 'deutan', 100);
    expect(deltaE00(red, green)).toBeLessThan(deltaE00('#cc0000', '#007700') / 2);
  });

  it('la sévérité est progressive : 50 % dévie moins que 100 %', () => {
    const orig = '#cc0000';
    const half = simulateCvd(orig, 'protan', 50);
    const full = simulateCvd(orig, 'protan', 100);
    expect(deltaE00(orig, half)).toBeGreaterThan(0.5);
    expect(deltaE00(orig, half)).toBeLessThan(deltaE00(orig, full));
  });

  it('la protanopie assombrit fortement les rouges (cônes L)', () => {
    const sim = simulateCvd('#ff0000', 'protan', 100);
    expect(relativeLuminance(sim)).toBeLessThan(relativeLuminance('#ff0000'));
  });

  it('achromatopsie 100 % : sortie neutre (R=G=B)', () => {
    const gray = simulateCvd('#e69f00', 'achromatopsia', 100);
    expect(gray.slice(1, 3)).toBe(gray.slice(3, 5));
    expect(gray.slice(1, 3)).toBe(gray.slice(5, 7));
    expect(toGrayscale('#e69f00')).toBe(gray);
  });
});

describe('recette : distinguabilité de la palette Okabe-Ito', () => {
  const types = ['protan', 'deutan', 'tritan'] as const;

  it.each(types)('aucune collision (ΔE00 < 10) en %s à 100 %%', (type) => {
    const collisions = findCvdCollisions(OKABE_ITO, type, 100);
    expect(collisions).toEqual([]);
  });

  it('aucune collision aux sévérités partielles (50 %)', () => {
    for (const type of types) {
      expect(findCvdCollisions(OKABE_ITO, type, 50)).toEqual([]);
    }
  });

  it('contre-exemple : un rouge et un vert de même clarté entrent en collision en deutéranopie', () => {
    const bad = [
      { id: 'succès', hex: '#3f9b3f' },
      { id: 'erreur', hex: '#b05050' },
    ];
    const collisions = findCvdCollisions(bad, 'deutan', 100);
    expect(collisions.length).toBe(1);
    expect(collisions[0]!.deltaE).toBeLessThan(10);
  });
});
