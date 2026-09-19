import { describe, expect, it } from 'vitest';
import { analyzeCoverage, bandOf } from './coverage';
import { parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';

describe('bandes de clarté', () => {
  it('classe clair / moyen / foncé', () => {
    expect(bandOf(parseToOklch('#f7f5ef')!)).toBe('light');
    expect(bandOf(parseToOklch('#2563eb')!)).toBe('mid');
    expect(bandOf(parseToOklch('#111827')!)).toBe('dark');
  });
});

describe('analyse de couverture', () => {
  const suggest = () => '#888888';

  it('signale une bande manquante avec une suggestion applicable', () => {
    const report = analyzeCoverage(
      [
        { id: 'a', hex: '#2563eb' },
        { id: 'b', hex: '#1e40af' },
        { id: 'c', hex: '#7c3aed' },
      ],
      suggest,
    );
    const gaps = report.advices.filter((a) => a.kind === 'gap');
    expect(gaps.some((g) => g.id === 'gap:light')).toBe(true);
    for (const g of gaps.filter((x) => x.id.startsWith('gap:') && x.id !== 'gap:count')) {
      expect(g.suggestion?.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(g.why.length).toBeGreaterThan(20);
    }
  });

  it('repère les doublons perceptuels', () => {
    const report = analyzeCoverage(
      [
        { id: 'a', hex: '#2563eb', label: 'bleu' },
        { id: 'b', hex: '#2765ec', label: 'bleu bis' },
        { id: 'c', hex: '#f7f5ef' },
        { id: 'd', hex: '#111827' },
      ],
      suggest,
    );
    expect(report.advices.some((a) => a.kind === 'duplicate')).toBe(true);
  });

  it('félicite une palette bien répartie', () => {
    const report = analyzeCoverage(
      [
        { id: 'a', hex: '#f7f5ef' },
        { id: 'b', hex: '#2563eb' },
        { id: 'c', hex: '#111827' },
      ],
      suggest,
    );
    expect(report.advices.some((a) => a.kind === 'ok')).toBe(true);
  });

  it('chaque conseil a un message et une explication non vides', () => {
    const report = analyzeCoverage([{ id: 'a', hex: '#2563eb' }], suggest);
    for (const a of report.advices) {
      expect(a.message.length).toBeGreaterThan(10);
      expect(a.why.length).toBeGreaterThan(20);
    }
  });
});
