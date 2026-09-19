/**
 * Score de santé de la palette.
 *
 * Règle non négociable (brief §4 et §8) : il est **calculé** à partir des
 * sous-scores, jamais estimé à côté. Un score global ne peut donc pas
 * contredire un score de détail — ils viennent du même calcul.
 * Chaque composante sait vers quelle étape pointer.
 */
import { analyzeCoverage, type NamedHex } from './analyze/coverage';
import { analyzeHarmony } from './harmony/analysis';
import { contrastRatio } from './contrast/wcag';
import { bandOf } from './analyze/coverage';
import { parseToOklch } from './color/space';

export type ScoreComponent = {
  id: 'accessibility' | 'harmony' | 'completeness' | 'balance';
  label: string;
  /** Sous-score 0–100. */
  value: number;
  /** Poids dans le total. */
  weight: number;
  /** Ce qui fait perdre des points, en français courant. */
  detail: string;
  /** Étape du parcours à ouvrir pour corriger. */
  step: string;
};

export type HealthScore = {
  /** 0–100, somme pondérée des composantes. */
  total: number;
  components: ScoreComponent[];
};

/**
 * Pondération. Le brief §8 en prévoyait cinq, dont l'éco-encrage : la
 * composante est tombée avec le module d'impression. Les 15 points
 * qu'elle portait sont rendus à l'accessibilité, qui reste la seule
 * composante dont un mauvais score rend la palette inutilisable.
 */
const WEIGHTS = {
  accessibility: 0.45,
  harmony: 0.2,
  completeness: 0.2,
  balance: 0.15,
} as const;

export function healthScore(colors: NamedHex[]): HealthScore {
  // — Accessibilité : part des paires utiles conformes AA —
  let pairs = 0;
  let passing = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = 0; j < colors.length; j++) {
      if (i === j) continue;
      const a = colors[i]!;
      const b = colors[j]!;
      // « Paire utile » : on ne compte pas deux couleurs de même bande
      // (deux fonds clairs ne sont pas censés se porter l'un l'autre).
      const oa = parseToOklch(a.hex);
      const ob = parseToOklch(b.hex);
      if (!oa || !ob || bandOf(oa) === bandOf(ob)) continue;
      pairs++;
      if (contrastRatio(a.hex, b.hex) >= 4.5) passing++;
    }
  }
  const accessibility = pairs === 0 ? 100 : Math.round((passing / pairs) * 100);

  // — Harmonie —
  const harmony = analyzeHarmony(colors);

  // — Complétude : bandes couvertes + nombre de couleurs —
  const coverage = analyzeCoverage(colors, () => '#888888');
  const bandsCovered = (['light', 'mid', 'dark'] as const).filter((b) => coverage.counts[b] > 0).length;
  const enough = Math.min(1, colors.length / 5);
  const completeness = Math.round((bandsCovered / 3) * 70 + enough * 30);

  // — Équilibre de répartition (esprit 60-30-10) : assez de neutres —
  const neutralish = colors.filter((c) => {
    const o = parseToOklch(c.hex);
    return o !== null && o.c < 0.05;
  }).length;
  const vivid = colors.filter((c) => {
    const o = parseToOklch(c.hex);
    return o !== null && o.c > 0.12;
  }).length;
  const balance =
    colors.length === 0
      ? 100
      : Math.round(
          Math.max(
            0,
            100 -
              // Trop de couleurs vives : chaque vive au-delà de 3 coûte.
              Math.max(0, vivid - 3) * 15 -
              // Aucun neutre : la palette n'a pas de charpente.
              (neutralish === 0 ? 35 : 0),
          ),
        );

  const components: ScoreComponent[] = [
    {
      id: 'accessibility',
      label: 'Accessibilité',
      value: accessibility,
      weight: WEIGHTS.accessibility,
      detail:
        pairs === 0
          ? 'Pas encore assez de couleurs contrastées pour mesurer.'
          : `${passing} associations utiles sur ${pairs} atteignent 4,5:1 (texte courant, AA).`,
      step: 'contrast',
    },
    {
      id: 'harmony',
      label: 'Harmonie',
      value: harmony.score,
      weight: WEIGHTS.harmony,
      detail:
        harmony.offNotes.length === 0
          ? `Groupe cohérent, schéma détecté : ${harmony.scheme}.`
          : `${harmony.offNotes.length} couleur(s) sortent de la logique du groupe.`,
      step: 'harmony',
    },
    {
      id: 'completeness',
      label: 'Complétude',
      value: completeness,
      weight: WEIGHTS.completeness,
      detail:
        bandsCovered === 3
          ? `${colors.length} couleurs, clair/moyen/foncé couverts.`
          : `${3 - bandsCovered} bande(s) de clarté manquante(s) sur 3.`,
      step: 'palette',
    },
    {
      id: 'balance',
      label: 'Équilibre',
      value: balance,
      weight: WEIGHTS.balance,
      detail:
        neutralish === 0
          ? 'Aucun neutre : rien ne repose l’œil entre les couleurs vives.'
          : `${neutralish} neutre(s) pour ${vivid} couleur(s) vive(s).`,
      step: 'roles',
    },
  ];

  const total = Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0));
  return { total, components };
}
