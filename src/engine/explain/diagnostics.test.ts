import { describe, expect, it } from 'vitest';
import { diagnoseContrast, diagnoseCvd } from './diagnostics';
import { contrastRemedies } from './remedies';
import { contrastRatio } from '../contrast/wcag';
import type { PairUsage } from '../types';

const USAGES: PairUsage[] = ['body-text', 'large-text', 'ui-component', 'focus-ring', 'surface', 'decorative'];

describe('recette : chaque diagnostic est expliqué et corrigeable', () => {
  const failingPairs: [string, string][] = [
    ['#9ca3af', '#fafafa'],
    ['#777777', '#ffffff'],
    ['#5a7d5a', '#3e3e3e'],
    ['#c0c0c0', '#e8e8e8'],
  ];

  it.each(failingPairs)('paire en échec %s/%s : explication non vide, ≥ 1 remède applicable', (fg, bg) => {
    const d = diagnoseContrast({ id: 'texte', hex: fg }, { id: 'fond', hex: bg }, 'body-text');
    expect(d.status).toBe('fail');
    expect(d.plain.length).toBeGreaterThan(20);
    expect(d.why.length).toBeGreaterThan(20);
    expect(d.remedies.length).toBeGreaterThanOrEqual(1);
    // Chaque remède, une fois appliqué, atteint réellement le seuil.
    for (const remedy of d.remedies) {
      expect(remedy.change.length).toBeGreaterThanOrEqual(1);
      let newFg = fg;
      let newBg = bg;
      for (const ch of remedy.change) {
        if (ch.target === 'texte') newFg = ch.to;
        if (ch.target === 'fond') newBg = ch.to;
      }
      expect(contrastRatio(newFg, newBg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tous les usages produisent un diagnostic complet, échec ou pas', () => {
    for (const usage of USAGES) {
      const d = diagnoseContrast({ id: 'a', hex: '#777777' }, { id: 'b', hex: '#ffffff' }, usage);
      expect(d.plain.length).toBeGreaterThan(20);
      expect(d.why.length).toBeGreaterThan(20);
      expect(d.rule.length).toBeGreaterThan(3);
      expect(d.affected).toEqual(['a', 'b']);
    }
  });

  it('explique aussi ce qui va bien (§2.4) : un pass a une explication', () => {
    const d = diagnoseContrast({ id: 'texte', hex: '#1a1a1a' }, { id: 'fond', hex: '#fafafa' }, 'body-text');
    expect(d.status).toBe('pass');
    expect(d.plain).toContain('AAA');
    expect(d.plain.length).toBeGreaterThan(40);
  });

  it('ne mentionne jamais un « niveau A » à côté d’un ratio', () => {
    for (const usage of USAGES) {
      for (const [fg, bg] of [
        ['#777777', '#ffffff'],
        ['#111111', '#fafafa'],
        ['#9ca3af', '#fafafa'],
      ] as const) {
        const d = diagnoseContrast({ id: 'x', hex: fg }, { id: 'y', hex: bg }, usage);
        const text = `${d.plain} ${d.why} ${d.technical ?? ''}`;
        expect(text).not.toMatch(/niveau A\b(?!A)/);
      }
    }
  });

  it('APCA est présenté comme signal, jamais comme conformité', () => {
    const d = diagnoseContrast({ id: 'texte', hex: '#8a8a8a' }, { id: 'fond', hex: '#2e2e2e' }, 'large-text');
    expect(d.status).toBe('warn'); // conforme WCAG, faible perceptuellement
    expect(d.technical).toContain('pas une conformité');
  });
});

describe('remèdes de contraste', () => {
  it('propose d’assombrir un texte trop clair sur fond clair', () => {
    const remedies = contrastRemedies({ id: 'texte', hex: '#9ca3af' }, { id: 'fond', hex: '#fafafa' }, 'body-text');
    const fgFix = remedies.find((r) => r.change.some((c) => c.target === 'texte'));
    expect(fgFix).toBeDefined();
    expect(fgFix!.label).toContain('Assombrir');
  });

  it('cas dur : fond moyen + cible AAA → remède combiné', () => {
    // Sur fond gris moyen, 7:1 est inatteignable en ne touchant qu'une couleur.
    const remedies = contrastRemedies({ id: 'texte', hex: '#666666' }, { id: 'fond', hex: '#7a7a7a' }, 'body-text', 7);
    expect(remedies.length).toBeGreaterThanOrEqual(1);
    for (const remedy of remedies) {
      let fg = '#666666';
      let bg = '#7a7a7a';
      for (const ch of remedy.change) {
        if (ch.target === 'texte') fg = ch.to;
        if (ch.target === 'fond') bg = ch.to;
      }
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('aucun remède quand la paire atteint déjà la cible', () => {
    expect(contrastRemedies({ id: 't', hex: '#111111' }, { id: 'f', hex: '#ffffff' }, 'body-text')).toEqual([]);
  });
});

describe('diagnostic CVD', () => {
  const okabeIto = [
    { id: 'orange', hex: '#E69F00' },
    { id: 'bleu-ciel', hex: '#56B4E9' },
    { id: 'vert', hex: '#009E73' },
    { id: 'vermillon', hex: '#D55E00' },
  ];

  it('pass explicite quand la palette résiste', () => {
    const d = diagnoseCvd(okabeIto, 'deutan', 100);
    expect(d.status).toBe('pass');
    expect(d.plain).toContain('distinguables');
  });

  it('fail bloquant avec paires nommées quand deux couleurs se confondent', () => {
    const d = diagnoseCvd(
      [
        { id: 'succès', hex: '#3f9b3f' },
        { id: 'erreur', hex: '#b05050' },
      ],
      'deutan',
      100,
    );
    expect(d.status).toBe('fail');
    expect(d.plain).toContain('succès');
    expect(d.plain).toContain('erreur');
    expect(d.remedies.length).toBeGreaterThanOrEqual(1);
  });
});
