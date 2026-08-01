import { describe, expect, it } from 'vitest';
import { analyzeHarmony } from './analysis';
import { healthScore } from '../score';
import { parseToOklch } from '../color/space';

describe('détection du schéma dominant', () => {
  it('reconnaît un monochrome', () => {
    const a = analyzeHarmony([
      { id: '1', hex: '#1e3a8a' },
      { id: '2', hex: '#3b82f6' },
      { id: '3', hex: '#93c5fd' },
    ]);
    expect(a.scheme).toBe('monochrome');
    expect(a.confidence).toBeGreaterThan(0.6);
  });

  it('reconnaît une complémentaire', () => {
    // Bleu et orange : opposés sur la roue.
    const a = analyzeHarmony([
      { id: '1', hex: '#2563eb' },
      { id: '2', hex: '#d97706' },
    ]);
    expect(['complementary', 'split-complementary']).toContain(a.scheme);
  });

  it('reconnaît un groupe analogue', () => {
    const a = analyzeHarmony([
      { id: '1', hex: '#2563eb' },
      { id: '2', hex: '#0891b2' },
    ]);
    expect(['analogous', 'monochrome']).toContain(a.scheme);
  });
});

describe('détection des fausses notes', () => {
  it('repère une couleur bien plus saturée que le reste', () => {
    const a = analyzeHarmony([
      { id: 'doux1', hex: '#8fa3b8' },
      { id: 'doux2', hex: '#a3b5c4' },
      { id: 'crie', hex: '#ff0055' },
    ]);
    const note = a.offNotes.find((n) => n.id === 'crie');
    expect(note).toBeDefined();
    expect(note!.axis).toBe('chroma');
    expect(note!.reason).toContain('Intensité');
  });

  it('la correction ne touche QUE l’axe fautif', () => {
    const a = analyzeHarmony([
      { id: 'doux1', hex: '#8fa3b8' },
      { id: 'doux2', hex: '#a3b5c4' },
      { id: 'crie', hex: '#ff0055' },
    ]);
    const note = a.offNotes.find((n) => n.id === 'crie')!;
    const before = parseToOklch('#ff0055')!;
    const after = parseToOklch(note.fix.hex)!;
    // Teinte et clarté préservées, intensité réduite.
    expect(Math.abs(after.h - before.h)).toBeLessThan(6);
    expect(Math.abs(after.l - before.l)).toBeLessThan(0.03);
    expect(after.c).toBeLessThan(before.c);
  });

  it('repère une teinte isolée et la rapproche de sa voisine', () => {
    const a = analyzeHarmony([
      { id: '1', hex: '#2563eb' },
      { id: '2', hex: '#3b82f6' },
      { id: '3', hex: '#1d4ed8' },
      { id: 'seule', hex: '#84cc16' },
    ]);
    const note = a.offNotes.find((n) => n.id === 'seule');
    expect(note).toBeDefined();
    expect(note!.axis).toBe('hue');
    const before = parseToOklch('#84cc16')!;
    const after = parseToOklch(note!.fix.hex)!;
    expect(after.h).not.toBeCloseTo(before.h, 0);
  });

  it('chaque fausse note a une raison, une conséquence et une correction', () => {
    const a = analyzeHarmony([
      { id: '1', hex: '#8fa3b8' },
      { id: '2', hex: '#a3b5c4' },
      { id: '3', hex: '#ff0055' },
      { id: '4', hex: '#84cc16' },
    ]);
    expect(a.offNotes.length).toBeGreaterThan(0);
    for (const n of a.offNotes) {
      expect(n.reason.length).toBeGreaterThan(15);
      expect(n.consequence.length).toBeGreaterThan(25);
      expect(n.fix.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(n.fix.label.length).toBeGreaterThan(10);
    }
  });

  it('ne signale rien sur un groupe cohérent', () => {
    const a = analyzeHarmony([
      { id: '1', hex: '#1e3a8a' },
      { id: '2', hex: '#2563eb' },
      { id: '3', hex: '#60a5fa' },
    ]);
    expect(a.offNotes).toEqual([]);
  });
});

describe('cohérence stricte du verdict (brief §7 étape 2)', () => {
  it('un verdict positif est impossible s’il existe des fausses notes', () => {
    const bad = analyzeHarmony([
      { id: '1', hex: '#8fa3b8' },
      { id: '2', hex: '#a3b5c4' },
      { id: '3', hex: '#ff0055' },
    ]);
    expect(bad.offNotes.length).toBeGreaterThan(0);
    expect(bad.verdict).not.toContain('cohérent');
    expect(bad.score).toBeLessThan(90);
  });

  it('le score baisse quand le nombre de fausses notes augmente', () => {
    const one = analyzeHarmony([
      { id: '1', hex: '#8fa3b8' },
      { id: '2', hex: '#a3b5c4' },
      { id: '3', hex: '#ff0055' },
    ]);
    const two = analyzeHarmony([
      { id: '1', hex: '#8fa3b8' },
      { id: '2', hex: '#a3b5c4' },
      { id: '3', hex: '#ff0055' },
      { id: '4', hex: '#84cc16' },
    ]);
    expect(two.score).toBeLessThanOrEqual(one.score);
  });
});

describe('score de santé (brief §8)', () => {
  const good = [
    { id: '1', hex: '#f7f5ef' },
    { id: '2', hex: '#2563eb' },
    { id: '3', hex: '#111827' },
    { id: '4', hex: '#8fa3b8' },
    { id: '5', hex: '#d97706' },
  ];

  it('les poids sont ceux du brief : 30/20/20/15/15', () => {
    const s = healthScore(good);
    const weights = Object.fromEntries(s.components.map((c) => [c.id, c.weight]));
    expect(weights.accessibility).toBeCloseTo(0.3, 5);
    expect(weights.harmony).toBeCloseTo(0.2, 5);
    expect(weights.completeness).toBeCloseTo(0.2, 5);
    expect(weights.balance).toBeCloseTo(0.15, 5);
    expect(weights.ink).toBeCloseTo(0.15, 5);
    expect(s.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 5);
  });

  it('le total est la somme pondérée exacte — jamais une estimation à côté', () => {
    const s = healthScore(good);
    const expected = Math.round(s.components.reduce((sum, c) => sum + c.value * c.weight, 0));
    expect(s.total).toBe(expected);
  });

  it('chaque composante explique ce qu’elle mesure et où corriger', () => {
    for (const c of healthScore(good).components) {
      expect(c.detail.length).toBeGreaterThan(15);
      expect(c.step.length).toBeGreaterThan(2);
      expect(c.value).toBeGreaterThanOrEqual(0);
      expect(c.value).toBeLessThanOrEqual(100);
    }
  });

  it('une palette sans neutre et sans bande claire perd des points aux bons endroits', () => {
    const poor = healthScore([
      { id: '1', hex: '#ff0055' },
      { id: '2', hex: '#00d4ff' },
      { id: '3', hex: '#ffee00' },
      { id: '4', hex: '#7c3aed' },
    ]);
    const balance = poor.components.find((c) => c.id === 'balance')!;
    const completeness = poor.components.find((c) => c.id === 'completeness')!;
    expect(balance.value).toBeLessThan(80);
    expect(completeness.value).toBeLessThan(100);
    expect(poor.total).toBeLessThan(healthScore(good).total);
  });
});
