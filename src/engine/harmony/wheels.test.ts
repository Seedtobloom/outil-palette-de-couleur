import { describe, expect, it } from 'vitest';
import { wheelToHue, hueToWheel, rotateOnWheel } from './wheels';
import { schemeHues, SCHEMES } from './schemes';
import { parseToOklch } from '../color/space';

const RED_HUE = parseToOklch('#ff0000')!.h; // 29.23
const GREEN_HUE = parseToOklch('#00ff00')!.h; // 142.5
const CYAN_HUE = parseToOklch('#00ffff')!.h; // 194.77

describe('les deux roues, jamais confondues (règle de justesse n°11)', () => {
  it('RYB : le complémentaire du rouge est le VERT', () => {
    const complement = rotateOnWheel('ryb', RED_HUE, 180);
    expect(Math.abs(complement - GREEN_HUE)).toBeLessThan(2);
  });

  it('RGB : le complémentaire du rouge est le CYAN', () => {
    const complement = rotateOnWheel('rgb', RED_HUE, 180);
    expect(Math.abs(complement - CYAN_HUE)).toBeLessThan(2);
  });

  it('les ancres des roues sont exactes (aller-retour angle ↔ teinte)', () => {
    for (const wheel of ['ryb', 'rgb'] as const) {
      for (const angle of [0, 60, 120, 180, 240, 300]) {
        const hue = wheelToHue(wheel, angle);
        expect(Math.abs(hueToWheel(wheel, hue) - angle) % 360).toBeLessThan(0.5);
      }
    }
  });

  it('la rotation est continue et revient au départ après 360°', () => {
    const h = rotateOnWheel('ryb', 200, 360);
    expect(Math.abs(h - wheelToHue('ryb', hueToWheel('ryb', 200)))).toBeLessThan(0.5);
  });
});

describe('schémas classiques', () => {
  it('chaque schéma produit base + décalages, base en premier', () => {
    for (const scheme of SCHEMES) {
      const hues = schemeHues(250, scheme.name, 'ryb');
      expect(hues).toHaveLength(scheme.offsets.length + 1);
      expect(hues[0]).toBe(250);
    }
  });

  it('complémentaire divisé : deux teintes de part et d’autre de l’opposée', () => {
    const [, a, b] = schemeHues(RED_HUE, 'split-complementary', 'ryb');
    const complement = rotateOnWheel('ryb', RED_HUE, 180);
    // a et b encadrent le complémentaire.
    const spread = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180);
    expect(spread(a!, complement)).toBeGreaterThan(10);
    expect(spread(b!, complement)).toBeGreaterThan(10);
  });

  it('chaque schéma a une explication en français courant', () => {
    for (const scheme of SCHEMES) {
      expect(scheme.effect.length).toBeGreaterThan(30);
    }
  });
});
