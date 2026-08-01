/**
 * Production des corrections applicables en un clic.
 * Un diagnostic qui échoue DOIT proposer au moins un remède exécutable :
 * un outil pédagogique qui laisse l'utilisateur se débrouiller n'est pas
 * pédagogique (prompt §2.1).
 */
import type { PairUsage, Remedy } from '../types';
import { parseToOklch } from '../color/space';
import { contrastRatio, findLightnessForRatio, wcagThresholds } from '../contrast/wcag';

export type NamedColor = { id: string; hex: string; label?: string };

function fmtRatio(r: number): string {
  return `${(Math.floor(r * 100) / 100).toFixed(2).replace('.', ',')}:1`;
}

/**
 * Remèdes pour une paire qui n'atteint pas son seuil WCAG : ajuster la
 * clarté du premier plan ou du fond (teinte et intensité conservées,
 * résultat garanti dans le gamut sRGB), et en dernier recours les deux.
 */
export function contrastRemedies(
  fg: NamedColor,
  bg: NamedColor,
  usage: PairUsage,
  target?: number,
): Remedy[] {
  const thresholds = wcagThresholds(usage);
  const goal = target ?? thresholds.aa;
  if (goal === null) return [];
  // Marge pour que la valeur affichée arrondie reste au-dessus du seuil.
  const goalSafe = goal + 0.005;
  if (contrastRatio(fg.hex, bg.hex) >= goalSafe) return [];

  const fgColor = parseToOklch(fg.hex);
  const bgColor = parseToOklch(bg.hex);
  if (!fgColor || !bgColor) return [];

  const fgLabel = fg.label ?? fg.id;
  const bgLabel = bg.label ?? bg.id;
  const remedies: Remedy[] = [];

  const tryOne = (
    id: string,
    label: (hex: string, ratio: number) => string,
    targetColor: NamedColor,
    reference: string,
    c: number,
    h: number,
    direction: 'darker' | 'lighter',
  ) => {
    const found = findLightnessForRatio(reference, goalSafe, { c, h, direction });
    if (found && found.hex !== targetColor.hex) {
      remedies.push({
        id,
        label: label(found.hex, found.ratio),
        change: [{ target: targetColor.id, from: targetColor.hex, to: found.hex }],
        achieves: `contraste ${fmtRatio(found.ratio)}`,
      });
    }
  };

  const verb = (dir: 'darker' | 'lighter') => (dir === 'darker' ? 'Assombrir' : 'Éclaircir');
  // Direction utile : s'éloigner de la clarté du fond.
  const fgDirections: ('darker' | 'lighter')[] =
    fgColor.l <= bgColor.l ? ['darker', 'lighter'] : ['lighter', 'darker'];
  for (const dir of fgDirections) {
    tryOne(
      `adjust-fg-${dir}`,
      (hex, ratio) => `${verb(dir)} « ${fgLabel} » (${fg.hex} → ${hex}) donne ${fmtRatio(ratio)}`,
      fg,
      bg.hex,
      fgColor.c,
      fgColor.h,
      dir,
    );
    if (remedies.length > 0) break; // une seule direction pour le premier plan
  }
  const bgDirections: ('darker' | 'lighter')[] =
    bgColor.l <= fgColor.l ? ['darker', 'lighter'] : ['lighter', 'darker'];
  for (const dir of bgDirections) {
    tryOne(
      `adjust-bg-${dir}`,
      (hex, ratio) => `${verb(dir)} le fond « ${bgLabel} » (${bg.hex} → ${hex}) donne ${fmtRatio(ratio)}`,
      bg,
      fg.hex,
      bgColor.c,
      bgColor.h,
      dir,
    );
    if (remedies.length > 1) break;
  }

  // Dernier recours : si ni l'un ni l'autre ne suffit seul (fond moyen et
  // seuil élevé), pousser le premier plan à son extrême puis ajuster le fond.
  if (remedies.length === 0) {
    const extremeFgHex = fgColor.l <= bgColor.l ? '#000000' : '#ffffff';
    const dir: 'darker' | 'lighter' = fgColor.l <= bgColor.l ? 'lighter' : 'darker';
    const found = findLightnessForRatio(extremeFgHex, goalSafe, {
      c: bgColor.c,
      h: bgColor.h,
      direction: dir,
    });
    if (found) {
      remedies.push({
        id: 'adjust-both',
        label:
          `Pousser « ${fgLabel} » à ${extremeFgHex} et ${verb(dir).toLowerCase()} le fond ` +
          `« ${bgLabel} » (${bg.hex} → ${found.hex}) donne ${fmtRatio(found.ratio)}`,
        change: [
          { target: fg.id, from: fg.hex, to: extremeFgHex },
          { target: bg.id, from: bg.hex, to: found.hex },
        ],
        achieves: `contraste ${fmtRatio(found.ratio)}`,
      });
    }
  }

  return remedies;
}
