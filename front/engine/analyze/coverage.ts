/**
 * Analyse de couverture d'une palette : est-elle assez fournie, bien
 * répartie en clarté, assez variée en teinte ? Produit des conseils
 * exécutables en français courant (« il vous manque une couleur claire »).
 *
 * Les seuils sont des cibles de métier, pas des normes — ils sont
 * présentés comme des conseils, jamais comme des obligations.
 */
import type { OklchColor } from '../types';
import { parseToOklch } from '../color/space';
import { deltaE00 } from '../color/distance';

export type Band = 'light' | 'mid' | 'dark';

/**
 * Bandes de clarté. Les bornes correspondent à des usages réels :
 * au-dessus de 0,80 on peut poser du texte sombre (fonds, grandes
 * surfaces) ; en dessous de 0,45 on peut poser du texte clair (textes,
 * fonds sombres) ; entre les deux, c'est la zone des aplats de marque.
 */
export const BAND_BOUNDS = { light: 0.8, dark: 0.45 } as const;

export function bandOf(color: OklchColor): Band {
  if (color.l >= BAND_BOUNDS.light) return 'light';
  if (color.l <= BAND_BOUNDS.dark) return 'dark';
  return 'mid';
}

export const BAND_LABELS: Record<Band, string> = {
  light: 'claires',
  mid: 'moyennes',
  dark: 'foncées',
};

export const BAND_USES: Record<Band, string> = {
  light: 'fonds de page, grandes surfaces, texte posé sur du sombre',
  mid: 'aplats de marque, boutons, éléments d’accent',
  dark: 'textes, titres, fonds sombres, filets',
};

export type Advice = {
  id: string;
  /** 'gap' = il manque quelque chose ; 'excess' = il y en a trop ; 'ok'. */
  kind: 'gap' | 'excess' | 'duplicate' | 'ok';
  /** Le conseil, en français courant. */
  message: string;
  /** Ce que ça change concrètement. */
  why: string;
  /** Couleur à ajouter, quand le conseil est un manque. */
  suggestion?: { hex: string; label: string };
  /** Identifiants concernés (doublons). */
  affected?: string[];
};

export type CoverageReport = {
  counts: Record<Band, number>;
  advices: Advice[];
  /** Nombre de couleurs distinctes (ΔE00 ≥ 10 entre elles). */
  distinct: number;
};

export type NamedHex = { id: string; hex: string; label?: string };

/**
 * Analyse une palette libre (les couleurs que la graphiste a réellement
 * mises dans son nuancier) et conseille ce qui manque.
 */
export function analyzeCoverage(colors: NamedHex[], suggest: (band: Band) => string): CoverageReport {
  const parsed = colors
    .map((c) => ({ ...c, oklch: parseToOklch(c.hex) }))
    .filter((c): c is NamedHex & { oklch: OklchColor } => c.oklch !== null);

  const counts: Record<Band, number> = { light: 0, mid: 0, dark: 0 };
  for (const c of parsed) counts[bandOf(c.oklch)]++;

  const advices: Advice[] = [];

  // — Manques par bande —
  const bands: Band[] = ['light', 'mid', 'dark'];
  for (const band of bands) {
    if (counts[band] === 0 && parsed.length > 0) {
      advices.push({
        id: `gap:${band}`,
        kind: 'gap',
        message: `Il vous manque une couleur ${BAND_LABELS[band].replace(/s$/, '')}.`,
        why: `Sans elle, vous n’avez rien pour : ${BAND_USES[band]}.`,
        suggestion: {
          hex: suggest(band),
          label: `couleur ${BAND_LABELS[band].replace(/s$/, '')}`,
        },
      });
    }
  }

  // — Doublons perceptuels —
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]!;
      const b = parsed[j]!;
      const e = deltaE00(a.hex, b.hex);
      if (e < 5) {
        advices.push({
          id: `dup:${a.id}:${b.id}`,
          kind: 'duplicate',
          message: `« ${a.label ?? a.id} » et « ${b.label ?? b.id} » sont presque identiques.`,
          why:
            'Deux couleurs trop proches n’ajoutent rien au système : elles ne se distinguent pas ' +
            'à l’usage et compliquent la documentation. Autant en supprimer une.',
          affected: [a.id, b.id],
        });
      }
    }
  }

  // — Palette trop maigre / trop touffue —
  if (parsed.length > 0 && parsed.length < 3) {
    advices.push({
      id: 'gap:count',
      kind: 'gap',
      message: `${parsed.length} couleur${parsed.length > 1 ? 's' : ''} seulement : c’est trop peu pour un système.`,
      why:
        'Il faut au minimum une couleur de marque, une famille de gris et des couleurs ' +
        'fonctionnelles (succès, erreur…). L’outil peut les construire pour vous.',
    });
  }
  if (parsed.length > 9) {
    advices.push({
      id: 'excess:count',
      kind: 'excess',
      message: `${parsed.length} couleurs de base, c’est beaucoup.`,
      why:
        'Au-delà de 8 teintes distinctes, la hiérarchie se perd et le nuancier devient ' +
        'difficile à tenir dans le temps. Les nuances viennent des rampes, pas du nombre de teintes.',
    });
  }

  // — Distinguabilité —
  let distinct = 0;
  for (let i = 0; i < parsed.length; i++) {
    const isDistinct = parsed.every(
      (other, j) => j === i || deltaE00(parsed[i]!.hex, other.hex) >= 10,
    );
    if (isDistinct) distinct++;
  }

  if (advices.length === 0 && parsed.length >= 3) {
    advices.push({
      id: 'ok',
      kind: 'ok',
      message: 'La répartition est bonne : clair, moyen et foncé sont couverts.',
      why:
        'Vous avez de quoi construire des fonds, des aplats et des textes sans être obligée ' +
        'd’inventer une couleur en cours de route.',
    });
  }

  return { counts, advices, distinct };
}
