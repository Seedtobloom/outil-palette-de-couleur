/**
 * Analyse de couverture d'une palette : est-elle assez fournie, bien
 * répartie en clarté, assez variée en teinte ? Produit des conseils
 * exécutables en français courant (« il te manque une couleur claire »).
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
  kind: 'gap' | 'excess' | 'duplicate' | 'tonalite' | 'ok';
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
        message: `Il te manque une couleur ${BAND_LABELS[band].replace(/s$/, '')}.`,
        why: `Sans elle, tu n’as rien pour : ${BAND_USES[band]}.`,
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
  // Au-delà de 7 teintes de base, la hiérarchie se perd. Le conseil ne
  // sert à rien s'il s'arrête là : on désigne les deux couleurs les plus
  // proches, celles par lesquelles commencer à couper.
  if (parsed.length > 7) {
    let plusProches: { a: NamedHex; b: NamedHex; e: number } | null = null;
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i]!;
        const b = parsed[j]!;
        const e = deltaE00(a.hex, b.hex);
        if (!plusProches || e < plusProches.e) plusProches = { a, b, e };
      }
    }
    const piste = plusProches
      ? ` Les plus proches sont « ${plusProches.a.label ?? plusProches.a.id} » et ` +
        `« ${plusProches.b.label ?? plusProches.b.id} » : commence par là.`
      : '';
    advices.push({
      id: 'excess:count',
      kind: 'excess',
      message: `${parsed.length} couleurs de base, c’est trop pour tenir un système.`,
      why:
        'Au-delà de sept teintes, la hiérarchie se perd et la charte devient impossible à ' +
        'tenir dans le temps. Les nuances viennent des rampes, pas du nombre de teintes.' +
        piste,
      ...(plusProches ? { affected: [plusProches.a.id, plusProches.b.id] } : {}),
    });
  }

  // — Étalement des tonalités —
  //
  // Le défaut le plus fréquent d'une charte apportée par un client : de
  // belles couleurs, toutes à la même hauteur de clarté. Ça ne se voit
  // pas sur un moodboard, et ça rend l'étape contraste insoluble — aucune
  // paire n'a l'écart nécessaire, quoi qu'on tente ensuite.
  //
  // Le seuil est calculé, pas décrété : pour atteindre 4,5:1 il faut au
  // minimum de l'ordre de 0,40 d'écart de clarté OKLCH entre les deux
  // couleurs les plus éloignées. En dessous, on l'annonce tout de suite
  // plutôt que de laisser découvrir le mur trois étapes plus loin.
  if (parsed.length >= 3) {
    const clartes = parsed.map((c) => c.oklch.l);
    const min = Math.min(...clartes);
    const max = Math.max(...clartes);
    const etalement = max - min;

    if (etalement < 0.4) {
      advices.push({
        id: 'tonalite:etalement',
        kind: 'tonalite',
        message: 'Tes couleurs sont toutes dans la même tonalité.',
        why:
          `Elles tiennent entre ${Math.round(min * 100)} et ${Math.round(max * 100)} de clarté, ` +
          `soit ${Math.round(etalement * 100)} points d’écart. Il en faut environ 40 pour qu’une ` +
          'paire puisse porter du texte : en l’état, aucune combinaison ne passera l’étape contraste.',
        suggestion: {
          hex: suggest(min > 0.5 ? 'dark' : 'light'),
          label: min > 0.5 ? 'couleur foncée' : 'couleur claire',
        },
      });
    } else {
      // Étalement correct, mais tout le monde entassé au même endroit :
      // le système n'a qu'un seul registre utilisable.
      const dominante = bands.find((b) => counts[b] >= parsed.length - 1 && parsed.length >= 4);
      if (dominante) {
        advices.push({
          id: `tonalite:concentration:${dominante}`,
          kind: 'tonalite',
          message: `Presque toutes tes couleurs sont ${BAND_LABELS[dominante]}.`,
          why:
            `Tu as ${counts[dominante]} couleurs sur ${parsed.length} dans la même bande. ` +
            'Elles se concurrencent au lieu de se répartir les rôles : il n’y en a qu’une qui ' +
            'servira vraiment, les autres feront doublon à l’usage.',
        });
      }
    }
  }

  // — Étalement des intensités —
  //
  // Le pendant du défaut précédent, et tout aussi fréquent : des teintes
  // différentes, toutes calées au même niveau de saturation. Rien ne
  // domine, rien ne se retire, tout se vaut — c'est ce qu'on ressent
  // comme « fade ». Un système vivant a des couleurs qui claquent ET des
  // couleurs qui se taisent.
  //
  // On ne juge que les couleurs qui ont une intensité à comparer : un
  // gris à 0,01 de chroma n'est pas « fade », c'est un gris, et il a sa
  // place. Les vraies neutres sont donc écartées du calcul.
  const colorees = parsed.filter((c) => c.oklch.c >= 0.03);
  if (colorees.length >= 3) {
    const intensites = colorees.map((c) => c.oklch.c);
    const min = Math.min(...intensites);
    const max = Math.max(...intensites);

    if (max - min < 0.05) {
      advices.push({
        id: 'tonalite:intensite',
        kind: 'tonalite',
        message: 'Toutes tes couleurs ont la même intensité.',
        why:
          `Elles tiennent entre ${min.toFixed(2).replace('.', ',')} et ` +
          `${max.toFixed(2).replace('.', ',')} de chroma. Quand tout est saturé pareil, aucune ` +
          'couleur ne prend le dessus et l’ensemble paraît plat. Il faut une couleur qui claque ' +
          'et des couleurs qui se retirent derrière elle.',
      });
    }
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
        'Tu as de quoi construire des fonds, des aplats et des textes sans être obligée ' +
        'd’inventer une couleur en cours de route.',
    });
  }

  return { counts, advices, distinct };
}
