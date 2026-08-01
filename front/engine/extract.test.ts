import { describe, expect, it } from 'vitest';
import { echantillonneRgba, kmeansOklab, type Echantillon } from './extract';
import { oklchToOklab, parseToOklch } from './color/space';
import { deltaE00 } from './color/distance';

/** Convertit un hex en échantillon OKLab pondéré, pour les tests. */
function ech(hex: string, poids: number): Echantillon {
  const lab = oklchToOklab(parseToOklch(hex)!);
  return { ...lab, poids };
}

const versOklab = (r: number, g: number, b: number) => {
  const oklch = parseToOklch(
    `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`,
  )!;
  return oklchToOklab(oklch);
};

describe('k-means en OKLab', () => {
  it('retrouve les couleurs dominantes d’une image simple', () => {
    // Trois familles nettes : rouge, bleu, beige.
    const points = [
      ech('#c0392b', 50),
      ech('#c4402f', 30),
      ech('#2563eb', 40),
      ech('#2a68ee', 20),
      ech('#f2e5c2', 60),
    ];
    const out = kmeansOklab(points, 3);
    expect(out).toHaveLength(3);
    // Chaque couleur d'origine doit trouver son groupe.
    for (const attendu of ['#c0392b', '#2563eb', '#f2e5c2']) {
      const plusProche = Math.min(...out.map((o) => deltaE00(o.hex, attendu)));
      expect(plusProche).toBeLessThan(6);
    }
  });

  it('est déterministe : deux appels donnent exactement la même palette', () => {
    const points = [
      ech('#c0392b', 33),
      ech('#2563eb', 21),
      ech('#f2e5c2', 55),
      ech('#412f21', 12),
      ech('#8fb3d9', 44),
    ];
    const a = kmeansOklab(points, 4);
    const b = kmeansOklab(points, 4);
    expect(a.map((c) => c.hex)).toEqual(b.map((c) => c.hex));
  });

  it('pondère par l’aire : la couleur la plus présente arrive en tête', () => {
    const out = kmeansOklab([ech('#c0392b', 5), ech('#2563eb', 500)], 2);
    expect(deltaE00(out[0]!.hex, '#2563eb')).toBeLessThan(5);
    expect(out[0]!.part).toBeGreaterThan(0.9);
  });

  it('les parts somment à 1', () => {
    const out = kmeansOklab([ech('#c0392b', 10), ech('#2563eb', 20), ech('#f2e5c2', 30)], 3);
    expect(out.reduce((s, c) => s + c.part, 0)).toBeCloseTo(1, 6);
  });

  it('ne renvoie jamais plus de couleurs qu’il n’y a d’échantillons', () => {
    expect(kmeansOklab([ech('#c0392b', 1)], 6)).toHaveLength(1);
    expect(kmeansOklab([], 5)).toEqual([]);
  });

  it('les couleurs extraites sont bien séparées (pas de doublons)', () => {
    const points = [
      ech('#c0392b', 30),
      ech('#2563eb', 30),
      ech('#f2e5c2', 30),
      ech('#2e7d6f', 30),
    ];
    const out = kmeansOklab(points, 4);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(deltaE00(out[i]!.hex, out[j]!.hex)).toBeGreaterThan(10);
      }
    }
  });
});

describe('échantillonnage des pixels', () => {
  it('ignore les pixels transparents', () => {
    const donnees = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]);
    const out = echantillonneRgba(donnees, versOklab);
    expect(out).toHaveLength(1);
  });

  it('regroupe les pixels identiques en un échantillon pondéré', () => {
    const rouge = [192, 57, 43, 255];
    const donnees = new Uint8ClampedArray([...rouge, ...rouge, ...rouge]);
    const out = echantillonneRgba(donnees, versOklab);
    expect(out).toHaveLength(1);
    expect(out[0]!.poids).toBe(3);
  });

  it('sépare deux couleurs franchement différentes', () => {
    const donnees = new Uint8ClampedArray([192, 57, 43, 255, 37, 99, 235, 255]);
    expect(echantillonneRgba(donnees, versOklab)).toHaveLength(2);
  });
});
