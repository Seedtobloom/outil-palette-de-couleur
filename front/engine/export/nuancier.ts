/**
 * Exports du nuancier de travail.
 *
 * `css.ts` et `tailwind.ts` exportent la palette GÉNÉRÉE (rampes + rôles).
 * Ici, c'est l'autre besoin : les couleurs que la graphiste a réellement
 * retenues, nommées par elle, telles qu'elles partiront chez un client ou
 * dans un dépôt. Trois formats, trois destinataires :
 *
 * - DTCG (`.tokens.json`) : le format du Design Tokens Community Group,
 *   celui que lisent Style Dictionary, Tokens Studio et Figma Variables.
 *   C'est le seul qui survit à un changement d'outil ;
 * - SCSS : pour les intégrations qui n'ont pas de pipeline de tokens ;
 * - ASE : pour Illustrator, InDesign et Photoshop (voir `ase.ts`).
 *
 * Tous partent de la même liste et du même nommage, pour qu'un nom de
 * couleur soit le même dans le JSON, dans le SCSS et dans le nuancier
 * ouvert dans Illustrator.
 */
import { formatOklch, parseToOklch } from '../color/space';

/** Une couleur du nuancier, telle que l'interface la manipule. */
export type EntreeNuancier = { hex: string; label: string };

/**
 * Nom technique dérivé du nom donné par la graphiste : accents retirés,
 * espaces en tirets, minuscules. « Vert d'eau » → `vert-d-eau`.
 *
 * Les doublons sont suffixés (`-2`, `-3`) plutôt que d'être écrasés
 * silencieusement : deux couleurs nommées pareil, ça arrive, et perdre
 * l'une des deux à l'export serait la pire des réponses.
 */
export function nomsTechniques(entrees: readonly EntreeNuancier[]): string[] {
  const vus = new Map<string, number>();
  return entrees.map((e, i) => {
    const base =
      e.label
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `couleur-${i + 1}`;
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/**
 * Format DTCG. `$value` porte le hex — c'est ce que tous les outils
 * savent relire ; `$extensions` porte l'OKLCH, qui est la valeur de
 * travail réelle de cet outil et qu'on aurait tort de perdre en route.
 */
export function exportDtcg(entrees: readonly EntreeNuancier[], nomPalette = 'palette'): string {
  const noms = nomsTechniques(entrees);
  const couleurs: Record<string, unknown> = {};
  entrees.forEach((e, i) => {
    const oklch = parseToOklch(e.hex);
    couleurs[noms[i] as string] = {
      $type: 'color',
      $value: e.hex.toLowerCase(),
      $description: e.label,
      ...(oklch
        ? {
            $extensions: {
              'com.seedtobloom.nuancier': {
                oklch: formatOklch(oklch),
                lightness: Number(oklch.l.toFixed(4)),
                chroma: Number(oklch.c.toFixed(4)),
                hue: Number(oklch.h.toFixed(2)),
              },
            },
          }
        : {}),
    };
  });
  return `${JSON.stringify({ [nomPalette]: couleurs }, null, 2)}\n`;
}

/** Variables SCSS + une map, pour pouvoir boucler dessus côté intégration. */
export function exportScss(entrees: readonly EntreeNuancier[], nomPalette = 'palette'): string {
  const noms = nomsTechniques(entrees);
  const lignes = ['// Nuancier exporté depuis Nuancier — noms repris du nuancier de travail.', ''];
  entrees.forEach((e, i) => {
    lignes.push(`$${noms[i]}: ${e.hex.toLowerCase()}; // ${e.label}`);
  });
  lignes.push('', `$${nomPalette}: (`);
  entrees.forEach((e, i) => {
    lignes.push(`  '${noms[i]}': $${noms[i]},`);
  });
  lignes.push(');', '');
  return lignes.join('\n');
}
