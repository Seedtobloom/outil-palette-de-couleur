/**
 * Export en variables CSS : rampes en `oklch()` avec repli hex (le repli
 * est déclaré d'abord — les navigateurs qui comprennent oklch() prennent la
 * seconde déclaration), rôles en `var()` vers les pas de rampe, thème
 * sombre via `[data-theme='dark']`.
 */
import { formatOklch } from '../color/space';
import type { GeneratedPalette } from '../palette';
import type { RampName, RoleName } from '../semantic/roles';
import type { Theme } from '../semantic/theme';

const RAMP_ORDER: RampName[] = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'success',
  'warning',
  'error',
  'info',
];

function roleLines(theme: Theme, indent: string): string {
  return (Object.entries(theme.tokens) as [RoleName, Theme['tokens'][RoleName]][])
    .map(([role, token]) => `${indent}--color-${role}: var(--color-${token.ramp}-${token.step});`)
    .join('\n');
}

export function exportCss(palette: GeneratedPalette): string {
  const lines: string[] = [
    '/* Palette générée par Nuancier — rampes + rôles, thèmes clair et sombre. */',
    ':root {',
  ];
  for (const name of RAMP_ORDER) {
    lines.push(`  /* ${name} */`);
    for (const step of palette.ramps[name].steps) {
      const varName = `--color-${name}-${step.step}`;
      lines.push(`  ${varName}: ${step.hex};`);
      lines.push(`  ${varName}: ${formatOklch(step.color)};`);
    }
  }
  lines.push('', '  /* Rôles — thème clair */');
  lines.push(roleLines(palette.themes.light, '  '));
  lines.push('}', '', "[data-theme='dark'] {");
  lines.push(roleLines(palette.themes.dark, '  '));
  lines.push('}', '');
  return lines.join('\n');
}
