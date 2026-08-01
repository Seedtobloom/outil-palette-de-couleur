import { describe, expect, it } from 'vitest';
import { inGamut, gamutMap, maxChroma } from './gamut';
import { parseToOklch, oklchToHex } from './space';
import { deltaEOK } from './distance';

describe('inGamut', () => {
  it('toute couleur hex sRGB est dans le gamut sRGB et P3', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#e69f00']) {
      const c = parseToOklch(hex)!;
      expect(inGamut(c, 'srgb')).toBe(true);
      expect(inGamut(c, 'p3')).toBe(true);
    }
  });

  it('un vert P3 très saturé est hors sRGB mais dans P3', () => {
    // oklch d'un vert typique hors sRGB
    const c = { l: 0.85, c: 0.31, h: 145 };
    expect(inGamut(c, 'srgb')).toBe(false);
    expect(inGamut(c, 'p3')).toBe(true);
  });
});

describe('gamutMap (algo CSS Color 4)', () => {
  it('ne touche pas une couleur déjà dans le gamut', () => {
    const c = parseToOklch('#d55e00')!;
    expect(gamutMap(c, 'srgb')).toEqual(c);
  });

  it('L ≥ 1 → blanc, L ≤ 0 → noir', () => {
    expect(gamutMap({ l: 1.2, c: 0.1, h: 200 }, 'srgb').l).toBe(1);
    expect(gamutMap({ l: -0.1, c: 0.1, h: 200 }, 'srgb').l).toBe(0);
  });

  it('ramène une couleur hors gamut dans le gamut, à teinte quasi constante', () => {
    const out = { l: 0.7, c: 0.35, h: 150 };
    const mapped = gamutMap(out, 'srgb');
    expect(inGamut(mapped, 'srgb')).toBe(true);
    // Le chroma a été réduit, la teinte reste proche (écrêtage final ≤ JND).
    expect(mapped.c).toBeLessThan(out.c);
    expect(Math.abs(mapped.h - out.h)).toBeLessThan(4);
    // Le résultat est proche perceptuellement de la frontière du gamut :
    // il ne s'effondre pas vers le gris.
    expect(mapped.c).toBeGreaterThan(0.1);
  });

  it('reste proche du résultat de référence de culori (même algorithme)', async () => {
    const { toGamut, converter } = await import('culori');
    const mapper = toGamut('rgb', 'oklch');
    const toOklch = converter('oklch');
    for (const c of [
      { l: 0.7, c: 0.35, h: 150 },
      { l: 0.45, c: 0.32, h: 264 },
      { l: 0.9, c: 0.25, h: 110 },
      { l: 0.55, c: 0.3, h: 29 },
    ]) {
      const ours = gamutMap(c, 'srgb');
      const theirs = toOklch(mapper({ mode: 'oklch', ...c }));
      const e = deltaEOK(ours, { l: theirs.l, c: theirs.c, h: theirs.h ?? 0 });
      expect(e).toBeLessThan(0.02); // sous le JND de l'algo
    }
  });

  it('produit un hex valide après mapping', () => {
    const mapped = gamutMap({ l: 0.7, c: 0.35, h: 150 }, 'srgb');
    expect(oklchToHex(mapped)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('maxChroma', () => {
  it('dépend fortement de la teinte : le jaune culmine clair, le bleu sombre', () => {
    // Jaune (h≈110) : chroma max vers L élevé ; bleu (h≈264) : vers L moyen-bas.
    const yellowHigh = maxChroma(0.85, 110, 'srgb');
    const yellowLow = maxChroma(0.45, 110, 'srgb');
    const blueHigh = maxChroma(0.85, 264, 'srgb');
    const blueLow = maxChroma(0.45, 264, 'srgb');
    expect(yellowHigh).toBeGreaterThan(yellowLow);
    expect(blueLow).toBeGreaterThan(blueHigh);
  });

  it('nul aux extrêmes de clarté', () => {
    expect(maxChroma(0, 200, 'srgb')).toBe(0);
    expect(maxChroma(1, 200, 'srgb')).toBe(0);
  });

  it('le plafond est bien la frontière du gamut', () => {
    const c = maxChroma(0.6, 250, 'srgb');
    expect(inGamut({ l: 0.6, c, h: 250 }, 'srgb')).toBe(true);
    expect(inGamut({ l: 0.6, c: c + 0.001, h: 250 }, 'srgb')).toBe(false);
  });

  it('le gamut P3 offre plus de chroma que sRGB', () => {
    expect(maxChroma(0.6, 145, 'p3')).toBeGreaterThan(maxChroma(0.6, 145, 'srgb'));
  });
});
