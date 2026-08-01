import { describe, expect, it } from 'vitest';
import { analyzeCoverage, bandOf } from './coverage';
import { analyzeUsage, LEVEL_A_CHECK } from './usage';
import { estimateCmyk, PROCESSES } from '../print/cmyk';
import { socialPalette } from '../harmony/social';
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

describe('fiche d’usage d’une couleur', () => {
  it('teste les quatre paires qui décident des usages', () => {
    const usage = analyzeUsage('#2563eb')!;
    expect(usage.tests.whiteOn.ratio).toBeCloseTo(contrastRatio('#ffffff', '#2563eb'), 6);
    expect(usage.tests.onWhite.ratio).toBeCloseTo(contrastRatio('#2563eb', '#ffffff'), 6);
    expect(usage.tests.blackOn.ratio).toBeGreaterThan(1);
    expect(usage.tests.onDark.ratio).toBeGreaterThan(1);
  });

  it('les niveaux respectent les seuils WCAG (texte 4.5/7, grand 3/4.5, composant 3)', () => {
    const usage = analyzeUsage('#767676')!;
    const t = usage.tests.onWhite; // ≈ 4.54:1
    expect(t.body).toBe('AA');
    expect(t.large).toBe('AAA');
    expect(t.ui).toBe(true);
  });

  it('détecte le piège de la couleur moyenne (ni blanc ni noir lisible)', () => {
    const usage = analyzeUsage('#c08a3e')!;
    expect(usage.band).toBe('mid');
    expect(usage.roles.length).toBeGreaterThan(0);
    expect(usage.summary.length).toBeGreaterThan(30);
  });

  it('propose au moins un rôle pour toute couleur', () => {
    for (const hex of ['#ffffff', '#000000', '#2563eb', '#f59e0b', '#10b981']) {
      expect(analyzeUsage(hex)!.roles.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('le niveau A est une vérification, jamais un ratio', () => {
    expect(LEVEL_A_CHECK.rule).toContain('1.4.1');
    expect(LEVEL_A_CHECK.question).toContain('couleur SEULE');
    expect(LEVEL_A_CHECK.why).toContain('n’impose aucun ratio');
  });
});

describe('estimation CMJN', () => {
  it('le blanc ne dépose rien, le noir dépose du noir', () => {
    const white = estimateCmyk('#ffffff')!;
    expect(white.tac).toBe(0);
    const black = estimateCmyk('#000000')!;
    expect(black.k).toBeGreaterThan(70);
  });

  it('respecte le plafond d’encrage du procédé', () => {
    for (const process of PROCESSES) {
      const est = estimateCmyk('#1a1a2e', process.tacLimit)!;
      expect(est.tac).toBeLessThanOrEqual(process.tacLimit);
    }
  });

  it('applique un retrait de gris : un gris neutre passe surtout en noir', () => {
    const est = estimateCmyk('#808080')!;
    // Le noir porte l'essentiel : plus que chacune des encres couleur.
    expect(est.k).toBeGreaterThan(est.c);
    expect(est.k).toBeGreaterThan(est.m);
    expect(est.k).toBeGreaterThan(est.y);
  });

  it('conseille l’éco-encrage sur les couleurs très couvrantes', () => {
    const est = estimateCmyk('#101010')!;
    expect(est.advice.length).toBeGreaterThanOrEqual(1);
  });
});

describe('couleurs pour les réseaux sociaux', () => {
  const social = socialPalette('#2563eb');

  it('produit 5 couleurs étiquetées et expliquées', () => {
    expect(social).toHaveLength(5);
    for (const c of social) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.use.length).toBeGreaterThan(15);
    }
  });

  it('chaque couleur se détache d’au moins un des deux fonds de flux', () => {
    for (const c of social) {
      expect(Math.max(c.onLight, c.onDark)).toBeGreaterThanOrEqual(3);
    }
  });

  it('elles sont plus saturées que la couleur de marque', () => {
    const base = parseToOklch('#2563eb')!;
    const saturated = parseToOklch(social[0]!.hex)!;
    expect(saturated.c).toBeGreaterThan(base.c * 0.85);
  });
});
