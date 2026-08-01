import { describe, expect, it } from 'vitest';
import { generateId, validatePalette } from './validate';

const NOW = new Date('2026-08-01T12:00:00Z');

const VALID = {
  baseColor: '#2563eb',
  options: {
    scheme: 'split-complementary',
    wheel: 'ryb',
    intensity: 1,
    neutralInfluence: 0.5,
    hueTorsion: 0,
  },
};

describe('validatePalette', () => {
  it('accepte une recette valide et la normalise (version, date)', () => {
    const out = validatePalette(VALID, NOW);
    expect(out).not.toBeNull();
    expect(out!.version).toBe(1);
    expect(out!.created).toBe('2026-08-01T12:00:00.000Z');
    expect(out!.baseColor).toBe('#2563eb');
  });

  it('ne conserve aucun champ inconnu', () => {
    const out = validatePalette(
      { ...VALID, injected: 'x', options: { ...VALID.options, extra: 42 } },
      NOW,
    );
    expect(out).not.toBeNull();
    expect(JSON.stringify(out)).not.toContain('injected');
    expect(JSON.stringify(out)).not.toContain('extra');
  });

  it('rejette les couleurs non hex, les schémas inconnus, les bornes dépassées', () => {
    expect(validatePalette({ ...VALID, baseColor: 'red' }, NOW)).toBeNull();
    expect(validatePalette({ ...VALID, baseColor: '#12345' }, NOW)).toBeNull();
    expect(
      validatePalette({ ...VALID, options: { ...VALID.options, scheme: 'joli' } }, NOW),
    ).toBeNull();
    expect(
      validatePalette({ ...VALID, options: { ...VALID.options, wheel: 'cmyk' } }, NOW),
    ).toBeNull();
    expect(
      validatePalette({ ...VALID, options: { ...VALID.options, intensity: 9 } }, NOW),
    ).toBeNull();
    expect(
      validatePalette({ ...VALID, options: { ...VALID.options, hueTorsion: 500 } }, NOW),
    ).toBeNull();
    expect(
      validatePalette({ ...VALID, options: { ...VALID.options, intensity: Number.NaN } }, NOW),
    ).toBeNull();
  });

  it('rejette les entrées non-objets', () => {
    expect(validatePalette(null, NOW)).toBeNull();
    expect(validatePalette('{}', NOW)).toBeNull();
    expect(validatePalette([], NOW)?.baseColor).toBeUndefined();
  });
});

describe('generateId', () => {
  it('produit un identifiant base36 de la longueur des octets fournis', () => {
    const id = generateId(new Uint8Array([0, 35, 36, 71, 255, 10, 20, 30, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(id).toMatch(/^[0-9a-z]{16}$/);
  });
});
