import { describe, expect, it } from 'vitest';
import { generateRamp } from './generate';
import { generateNeutralRamp } from './neutrals';
import { parseToOklch } from '../color/space';
import { inGamut, maxChroma } from '../color/gamut';
import { deltaE00 } from '../color/distance';
import type { ChromaCurveParams } from './curves';
import tailwind from '../../data/references/tailwind-v4.json';

const BLUE = parseToOklch('#2563eb')!;

describe('generateRamp — propriétés structurelles', () => {
  const ramp = generateRamp(BLUE);

  it('11 pas par défaut (50 → 950), clarté strictement décroissante', () => {
    expect(ramp.steps).toHaveLength(11);
    expect(ramp.steps[0]!.step).toBe(50);
    expect(ramp.steps[10]!.step).toBe(950);
    for (let i = 1; i < ramp.steps.length; i++) {
      expect(ramp.steps[i]!.color.l).toBeLessThan(ramp.steps[i - 1]!.color.l);
    }
  });

  it('la couleur de base est reproduite exactement sur son pas', () => {
    const baseStep = ramp.steps[ramp.baseIndex]!;
    expect(baseStep.isBase).toBe(true);
    expect(baseStep.color).toEqual(BLUE);
  });

  it('tous les pas sont dans le gamut cible', () => {
    for (const s of ramp.steps) {
      expect(inGamut(s.color, 'srgb')).toBe(true);
    }
  });

  it('le chroma respecte le plafond du gamut à chaque pas (jamais constant)', () => {
    for (const s of ramp.steps) {
      expect(s.color.c).toBeLessThanOrEqual(maxChroma(s.color.l, s.color.h, 'srgb') + 1e-6);
    }
    const chromas = ramp.steps.map((s) => s.color.c);
    expect(Math.max(...chromas)).toBeGreaterThan(Math.min(...chromas) * 2);
  });

  it('la torsion de teinte dérive linéairement autour du pas de base', () => {
    const twisted = generateRamp(BLUE, { hueTorsion: 12 });
    const first = twisted.steps[0]!;
    const last = twisted.steps[10]!;
    expect(first.color.h).toBeLessThan(BLUE.h);
    expect(last.color.h).toBeGreaterThan(BLUE.h);
    expect(twisted.steps[twisted.baseIndex]!.color.h).toBe(BLUE.h);
  });

  it('nombre de pas configurable (8 à 16)', () => {
    for (const n of [8, 12, 16]) {
      const r = generateRamp(BLUE, { stepCount: n });
      expect(r.steps).toHaveLength(n);
    }
  });

  it('baseStep force le pas porteur de la base', () => {
    const r = generateRamp(BLUE, { baseStep: 500 });
    expect(r.steps[r.baseIndex]!.step).toBe(500);
  });

  it('une base hors gamut est d’abord ramenée dans le gamut', () => {
    const r = generateRamp({ l: 0.7, c: 0.35, h: 150 });
    expect(inGamut(r.steps[r.baseIndex]!.color, 'srgb')).toBe(true);
  });
});

describe('generateNeutralRamp', () => {
  it('neutres teintés : chroma faible mais non nul, teinte de la marque', () => {
    const r = generateNeutralRamp(260, { influence: 0.5 });
    for (const s of r.steps) {
      expect(s.color.c).toBeGreaterThan(0);
      expect(s.color.c).toBeLessThanOrEqual(0.02);
      expect(s.color.h).toBe(260);
    }
  });

  it('influence 0 = gris purs ; l’influence module le chroma', () => {
    const pure = generateNeutralRamp(260, { influence: 0 });
    const strong = generateNeutralRamp(260, { influence: 1 });
    expect(pure.steps.every((s) => s.color.c === 0)).toBe(true);
    expect(strong.steps[5]!.color.c).toBeGreaterThan(0.015);
  });

  it('les extrêmes vont plus loin que les rampes chromatiques (fonds de thème)', () => {
    const r = generateNeutralRamp(260);
    expect(r.steps[0]!.color.l).toBeGreaterThan(0.98);
    expect(r.steps[10]!.color.l).toBeLessThan(0.15);
  });
});

type Scale = Record<string, [number, number, number]>;
const scales = tailwind.chromatic as unknown as Record<string, Scale>;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

function reproductionError(
  scaleName: string,
  curve?: ChromaCurveParams,
  torsion?: number,
): number {
  const scale = scales[scaleName]!;
  const [l, c, h] = scale['500']!;
  const ramp = generateRamp(
    { l, c, h },
    {
      gamut: 'p3', // Tailwind v4 est définie au-delà de sRGB sur les pas médians
      baseStep: 500,
      ...(curve ? { chromaCurve: curve } : {}),
      ...(torsion !== undefined ? { hueTorsion: torsion } : {}),
    },
  );
  let worst = 0;
  ramp.steps.forEach((s, i) => {
    const [tl, tc, th] = scale[String(STEPS[i])]!;
    worst = Math.max(worst, deltaE00(s.color, { l: tl, c: tc, h: th }));
  });
  return worst;
}

/**
 * La courbe par défaut est un profil MOYEN (aucune échelle réelle ne colle
 * exactement) ; la reproduction fine passe par les courbes éditables —
 * c'est leur raison d'être. On vérifie qu'un petit balayage des réglages
 * atelier (pic et retombées de chroma, torsion) suffit à retrouver une
 * échelle connue à ΔE00 < 3 sur chacun de ses pas.
 */
function bestFit(scaleName: string): number {
  let best = Infinity;
  for (const peak of [0.45, 0.5, 0.55, 0.6, 0.65]) {
    for (const spreadLight of [0.2, 0.25, 0.3, 0.35]) {
      for (const spreadDark of [0.28, 0.32, 0.38, 0.44, 0.5]) {
        for (const torsion of [-8, -6, -3, 0, 10, 13, 16]) {
          const e = reproductionError(scaleName, { peak, spreadLight, spreadDark }, torsion);
          if (e < best) best = e;
        }
      }
    }
  }
  return best;
}

describe('recette Phase 1 : régénérer une rampe Tailwind connue (ΔE00 < 3 par pas)', () => {
  it('blue (chroma qui persiste vers le sombre, torsion +13°)', () => {
    expect(bestFit('blue')).toBeLessThan(3);
  });

  it('violet (courbe proche du profil moyen, torsion légère)', () => {
    expect(bestFit('violet')).toBeLessThan(3);
  });

  it('la courbe par défaut reste une approximation raisonnable (ΔE00 < 6)', () => {
    expect(reproductionError('violet', undefined, -3)).toBeLessThan(6);
    expect(reproductionError('emerald', undefined, 0)).toBeLessThan(6);
  });
});
