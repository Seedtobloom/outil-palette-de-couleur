import { describe, expect, it } from 'vitest';
import { generatePalette } from './palette';
import { scorePalette } from './harmony/constraints';
import { findCvdCollisions } from './contrast/cvd';
import { stepForContrast } from './ramp/inverse';
import { exportCss } from './export/css';
import { exportTailwind } from './export/tailwind';
import { SEMANTIC_RAMPS } from './semantic/roles';

/**
 * Recette Phase 1 (relance de fin de phase) : 5 palettes générées à partir
 * de 5 couleurs de marque très différentes doivent passer AA sur toute la
 * matrice des paires réellement utilisées, en clair ET en sombre, sans
 * intervention. Si l'une échoue, c'est le générateur qu'il faut corriger.
 */
const BRAND_COLORS = [
  '#0f62fe', // bleu vif
  '#e11d48', // rouge rosé
  '#f59e0b', // ambre (le cas piège : clair, texte blanc impossible)
  '#10b981', // vert
  '#7c3aed', // violet
];

describe('recette : toute palette générée passe AA, deux thèmes, sans intervention', () => {
  it.each(BRAND_COLORS)('marque %s', (hex) => {
    const palette = generatePalette(hex);
    for (const theme of [palette.themes.light, palette.themes.dark]) {
      const failures = theme.audit.filter(
        (p) => p.usage !== 'decorative' && p.usage !== 'surface' && !p.evaluation.wcag.passesAA,
      );
      expect(
        failures.map((f) => `${theme.mode}: ${f.fg}/${f.bg} = ${f.evaluation.wcag.ratio.toFixed(2)}`),
      ).toEqual([]);
      expect(theme.passes).toBe(true);
    }
  });

  it.each(BRAND_COLORS)('succès et erreur restent distinguables en deutéranopie et protanopie — %s', (hex) => {
    const palette = generatePalette(hex);
    const semantic = SEMANTIC_RAMPS.map((name) => ({
      id: name,
      hex: palette.themes.light.tokens[`${name}-content`].hex,
    }));
    const pair = semantic.filter((s) => s.id === 'success' || s.id === 'error');
    for (const type of ['deutan', 'protan'] as const) {
      expect(findCvdCollisions(pair, type, 100)).toEqual([]);
    }
  });
});

describe('structure de la palette générée', () => {
  const palette = generatePalette('#2563eb');

  it('8 rampes complètes : 3 marque + neutres + 4 sémantiques', () => {
    const names = Object.keys(palette.ramps);
    expect(names.sort()).toEqual(
      ['accent', 'error', 'info', 'neutral', 'primary', 'secondary', 'success', 'warning'].sort(),
    );
    for (const ramp of Object.values(palette.ramps)) {
      expect(ramp.steps).toHaveLength(11);
    }
  });

  it('la couleur de marque est conservée exactement', () => {
    const base = palette.ramps.primary.steps[palette.ramps.primary.baseIndex]!;
    expect(base.hex).toBe('#2563eb');
  });

  it('~34 rôles attribués, tous résolus, dans les deux thèmes', () => {
    for (const theme of [palette.themes.light, palette.themes.dark]) {
      const tokens = Object.values(theme.tokens);
      expect(tokens.length).toBeGreaterThanOrEqual(34);
      for (const t of tokens) {
        expect(t.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('le thème sombre n’est pas une inversion : rôles réattribués et revérifiés', () => {
    const light = palette.themes.light.tokens;
    const dark = palette.themes.dark.tokens;
    expect(light.background.hex).not.toBe(dark.background.hex);
    expect(light['text-primary'].hex).not.toBe(dark['text-primary'].hex);
    // Le fond sombre est réellement sombre, le texte réellement clair.
    expect(dark.background.step).toBeGreaterThan(dark['text-primary'].step);
  });

  it('ce qui a été ajouté est expliqué en français courant', () => {
    expect(palette.explanations.length).toBeGreaterThanOrEqual(5);
    for (const e of palette.explanations) {
      expect(e.length).toBeGreaterThan(40);
    }
  });

  it('les aplats de marque ne sont pas isoluminants entre eux', () => {
    const seeds = [
      palette.ramps.primary.steps[palette.ramps.primary.baseIndex]!,
      palette.ramps.secondary.steps[palette.ramps.secondary.baseIndex]!,
      palette.ramps.accent.steps[palette.ramps.accent.baseIndex]!,
    ];
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        expect(Math.abs(seeds[i]!.color.l - seeds[j]!.color.l)).toBeGreaterThan(0.04);
      }
    }
  });
});

describe('score de contraintes (jamais un score de beauté)', () => {
  it('une palette par défaut n’a aucune pénalité bloquante', () => {
    const report = scorePalette(generatePalette('#2563eb'));
    expect(report.diagnostics.filter((d) => d.status === 'fail')).toEqual([]);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it('chaque pénalité nomme sa règle, s’explique et propose un remède', () => {
    // Palette volontairement problématique : gris purs, chroma écrasé.
    const report = scorePalette(generatePalette('#8a8a8f', { neutralInfluence: 0, intensity: 0.5 }));
    expect(report.diagnostics.length).toBeGreaterThan(0);
    for (const d of report.diagnostics) {
      expect(d.rule.length).toBeGreaterThan(5);
      expect(d.plain.length).toBeGreaterThan(20);
      expect(d.why.length).toBeGreaterThan(20);
      expect(d.remedies.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('mode inversé (approche Leonardo)', () => {
  const palette = generatePalette('#2563eb');

  it('« le pas qui atteint exactement 4.5:1 sur ce fond »', () => {
    const bg = palette.themes.light.tokens.background.hex;
    const result = stepForContrast(palette.ramps.primary, bg, 4.5);
    expect(result.step).not.toBeNull();
    expect(result.exact).not.toBeNull();
    expect(result.exact!.ratio).toBeGreaterThanOrEqual(4.5);
    expect(result.exact!.ratio).toBeLessThan(4.65); // exactement au seuil, pas au-delà
  });

  it('fonctionne aussi sur fond sombre (direction inversée)', () => {
    const bg = palette.themes.dark.tokens.background.hex;
    const result = stepForContrast(palette.ramps.primary, bg, 4.5);
    expect(result.exact).not.toBeNull();
    expect(result.exact!.color.l).toBeGreaterThan(0.5);
  });
});

describe('exports', () => {
  const palette = generatePalette('#2563eb');

  it('CSS : rampes en oklch() avec repli hex, rôles en var(), thème sombre', () => {
    const css = exportCss(palette);
    expect(css).toContain('--color-primary-500: #');
    expect(css).toContain('--color-primary-500: oklch(');
    expect(css).toMatch(/--color-background: var\(--color-neutral-\d+\);/);
    expect(css).toContain("[data-theme='dark']");
    // 8 rampes × 11 pas × 2 déclarations (hex + oklch)
    expect((css.match(/--color-\w+-\d+:/g) ?? []).length).toBe(8 * 11 * 2);
  });

  it('Tailwind v4 : bloc @theme complet en oklch', () => {
    const tw = exportTailwind(palette);
    expect(tw).toContain('@theme {');
    expect((tw.match(/--color-\w+-\d+: oklch\(/g) ?? []).length).toBe(8 * 11);
  });
});
