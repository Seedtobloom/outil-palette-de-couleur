/**
 * Export Tailwind v4 : bloc `@theme` en OKLCH natif.
 */
import { formatOklch } from '../color/space';
import type { GeneratedPalette } from '../palette';
import type { RampName } from '../semantic/roles';

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

export function exportTailwind(palette: GeneratedPalette): string {
  const lines: string[] = [
    '/* Palette générée par Nuancier — à importer dans votre CSS Tailwind v4. */',
    '@theme {',
  ];
  for (const name of RAMP_ORDER) {
    for (const step of palette.ramps[name].steps) {
      lines.push(`  --color-${name}-${step.step}: ${formatOklch(step.color)};`);
    }
  }
  lines.push('}', '');
  return lines.join('\n');
}
