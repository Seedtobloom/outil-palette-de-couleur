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
  const palette = [
    { id: 'a', hex: '#2563eb', label: 'Principale' },
    { id: 'b', hex: '#c0392b', label: 'Secondaire' },
    { id: 'c', hex: '#8a8a8a', label: 'Gris' },
  ];
  const social = socialPalette(palette);

  it('décline chaque couleur de la palette en clair, aplat et profond', () => {
    // Le gris est écarté : il n'a pas de teinte à décliner.
    expect(social).toHaveLength(6);
    expect(new Set(social.map((c) => c.sourceId))).toEqual(new Set(['a', 'b']));
    for (const source of ['a', 'b']) {
      const tons = social.filter((c) => c.sourceId === source).map((c) => c.ton);
      expect(tons).toEqual(['claire', 'aplat', 'profonde']);
    }
  });

  it('garde exactement la teinte de la couleur d’origine', () => {
    // C'est la raison d'être de ce module : ne PAS inventer de teintes.
    for (const c of social) {
      expect(c.ecartTeinte).toBeLessThan(1);
    }
  });

  it('l’aplat est la couleur de la palette, inchangée', () => {
    for (const c of social.filter((x) => x.ton === 'aplat')) {
      expect(c.hex).toBe(c.sourceHex);
    }
  });

  it('la nuance claire est claire, la profonde est profonde', () => {
    for (const c of social) {
      const l = parseToOklch(c.hex)!.l;
      if (c.ton === 'claire') expect(l).toBeGreaterThan(0.8);
      if (c.ton === 'profonde') expect(l).toBeLessThan(0.4);
    }
  });

  it('chaque couleur se détache d’au moins un des deux fonds de flux', () => {
    for (const c of social) {
      expect(Math.max(c.onLight, c.onDark)).toBeGreaterThanOrEqual(3);
    }
  });

  it('plafonne le nombre de familles déclinées', () => {
    const large = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      hex: ['#2563eb', '#c0392b', '#2e7d6f', '#aa7c17', '#7b2fbe', '#d81b60'][i] as string,
      label: `C${i}`,
    }));
    expect(socialPalette(large).length).toBe(9);
  });

  it('ne rend rien sur une palette sans couleur teintée', () => {
    expect(socialPalette([{ id: 'g', hex: '#888888' }])).toEqual([]);
  });
});
