/**
 * Analyse d'harmonie d'un groupe de couleurs libre : quel schéma la
 * palette suit-elle réellement, et quelle couleur en sort ?
 *
 * Principe (brief §7, étape 2) : l'outil ne doit pas seulement CONSTATER,
 * il doit produire une correction applicable. Chaque fausse note porte sa
 * raison en une phrase et une couleur corrigée, obtenue en ajustant le
 * seul axe fautif — les deux autres sont préservés.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { normalizeHue, oklchToHex, parseToOklch } from '../color/space';

export type SchemeGuess =
  | 'monochrome'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'libre';

export const SCHEME_LABELS: Record<SchemeGuess, string> = {
  monochrome: 'Monochrome',
  analogous: 'Analogue',
  complementary: 'Complémentaire',
  'split-complementary': 'Complémentaire adjacent',
  triadic: 'Triade',
  libre: 'Libre',
};

export type Axis = 'hue' | 'chroma' | 'lightness';

export const AXIS_LABELS: Record<Axis, string> = {
  hue: 'teinte',
  chroma: 'intensité',
  lightness: 'clarté',
};

export type OffNote = {
  id: string;
  axis: Axis;
  /** La raison, en une phrase. */
  reason: string;
  /** Ce que ça produit à l'usage. */
  consequence: string;
  /** La couleur corrigée : seul l'axe fautif bouge. */
  fix: { hex: string; label: string };
};

export type HarmonyAnalysis = {
  scheme: SchemeGuess;
  /** Confiance 0–1 dans le schéma détecté. */
  confidence: number;
  /** Verdict unique, dérivé du calcul — jamais un encart séparé. */
  verdict: string;
  /** Score d'harmonie 0–100, cohérent avec les fausses notes trouvées. */
  score: number;
  offNotes: OffNote[];
  /** Régularité des écarts, 0–1 (1 = parfaitement régulier). */
  regularity: { hue: number; chroma: number; lightness: number };
};

type Entry = { id: string; hex: string; label?: string; oklch: OklchColor };

/** Écart angulaire signé le plus court entre deux teintes. */
function hueDelta(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * Devine le schéma dominant à partir des écarts de teinte au dominant
 * (la couleur la plus chromatique du groupe).
 */
function guessScheme(entries: Entry[]): { scheme: SchemeGuess; confidence: number } {
  const chromatic = entries.filter((e) => e.oklch.c > 0.03);
  if (chromatic.length < 2) return { scheme: 'monochrome', confidence: chromatic.length ? 0.9 : 0.5 };

  const anchor = chromatic.reduce((a, b) => (a.oklch.c >= b.oklch.c ? a : b));
  const spreads = chromatic
    .filter((e) => e.id !== anchor.id)
    .map((e) => Math.abs(hueDelta(anchor.oklch.h, e.oklch.h)));
  const maxSpread = Math.max(...spreads);

  // Un schéma est d'autant plus « sûr » que les écarts collent à sa
  // définition canonique. On mesure la distance à chaque modèle.
  const candidates: { scheme: SchemeGuess; target: number[]; }[] = [
    { scheme: 'monochrome', target: [0] },
    { scheme: 'analogous', target: [30] },
    { scheme: 'complementary', target: [180] },
    { scheme: 'split-complementary', target: [150, 210 - 180 + 150] },
    { scheme: 'triadic', target: [120] },
  ];

  let best: { scheme: SchemeGuess; confidence: number } = { scheme: 'libre', confidence: 0 };
  for (const c of candidates) {
    // Distance moyenne de chaque écart au point le plus proche du modèle.
    const errors = spreads.map((s) => Math.min(...c.target.map((t) => Math.abs(s - t))));
    const avgError = mean(errors);
    // 45° d'erreur moyenne = confiance nulle.
    const confidence = Math.max(0, 1 - avgError / 45);
    if (confidence > best.confidence) best = { scheme: c.scheme, confidence };
  }

  // Un groupe très étalé sans structure reste « libre ».
  if (best.confidence < 0.45 && maxSpread > 45) return { scheme: 'libre', confidence: 1 - best.confidence };
  return best;
}

/** Seuils de détection des fausses notes (écarts à la logique du groupe). */
const OFF_NOTE = {
  /** Chroma > n× la médiane du reste. */
  chromaRatio: 2,
  /** Clarté à plus de n écarts-types du groupe. */
  lightnessSigma: 1.9,
  /** Teinte isolée : à plus de n degrés de sa plus proche voisine. */
  hueIsolation: 75,
} as const;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function analyzeHarmony(colors: { id: string; hex: string; label?: string }[]): HarmonyAnalysis {
  const entries: Entry[] = colors
    .map((c) => ({ ...c, oklch: parseToOklch(c.hex) }))
    .filter((c): c is Entry => c.oklch !== null);

  if (entries.length < 2) {
    return {
      scheme: 'monochrome',
      confidence: 0.5,
      verdict: 'Trop peu de couleurs pour parler d’harmonie : ajoutez-en au moins deux.',
      score: 100,
      offNotes: [],
      regularity: { hue: 1, chroma: 1, lightness: 1 },
    };
  }

  const { scheme, confidence } = guessScheme(entries);
  const offNotes: OffNote[] = [];

  // — Fausse note d'intensité : une couleur bien plus saturée que le reste
  const chromas = entries.map((e) => e.oklch.c);
  for (const e of entries) {
    const others = entries.filter((o) => o.id !== e.id).map((o) => o.oklch.c);
    const ref = median(others);
    if (ref > 0.01 && e.oklch.c > ref * OFF_NOTE.chromaRatio) {
      const target = ref * 1.5;
      const fixed = gamutMap({ ...e.oklch, c: Math.min(target, maxChroma(e.oklch.l, e.oklch.h, 'srgb')) }, 'srgb');
      offNotes.push({
        id: e.id,
        axis: 'chroma',
        reason: `Intensité ${(e.oklch.c / ref).toFixed(1)} fois supérieure au reste de la palette.`,
        consequence:
          'Elle attire l’œil bien plus que les autres : utilisée en aplat, elle écrase la composition ' +
          'et empêche de hiérarchiser.',
        fix: { hex: oklchToHex(fixed), label: 'Ramener son intensité au niveau du groupe' },
      });
    }
  }

  // — Fausse note de clarté : une couleur isolée en L
  const lights = entries.map((e) => e.oklch.l);
  const lSigma = stddev(lights);
  const lMean = mean(lights);
  if (lSigma > 0.02) {
    for (const e of entries) {
      const z = Math.abs(e.oklch.l - lMean) / lSigma;
      if (z > OFF_NOTE.lightnessSigma && !offNotes.some((o) => o.id === e.id)) {
        const target = lMean + Math.sign(e.oklch.l - lMean) * lSigma * 1.2;
        const fixed = gamutMap(
          { ...e.oklch, l: Math.min(0.97, Math.max(0.06, target)) },
          'srgb',
        );
        offNotes.push({
          id: e.id,
          axis: 'lightness',
          reason: `Clarté très éloignée du reste du groupe (${Math.round(e.oklch.l * 100)} contre ${Math.round(lMean * 100)} en moyenne).`,
          consequence:
            'L’écart est si grand qu’elle ne semble pas appartenir à la même famille — ' +
            'sauf si c’est votre neutre clair ou foncé, auquel cas c’est voulu.',
          fix: { hex: oklchToHex(fixed), label: 'Rapprocher sa clarté du groupe' },
        });
      }
    }
  }

  // — Fausse note de teinte : une couleur seule dans son coin de la roue
  const chromatic = entries.filter((e) => e.oklch.c > 0.04);
  if (chromatic.length >= 3) {
    for (const e of chromatic) {
      const nearest = Math.min(
        ...chromatic.filter((o) => o.id !== e.id).map((o) => Math.abs(hueDelta(e.oklch.h, o.oklch.h))),
      );
      if (nearest > OFF_NOTE.hueIsolation && !offNotes.some((o) => o.id === e.id)) {
        // On la rapproche de sa voisine la plus proche, à mi-chemin.
        const closest = chromatic
          .filter((o) => o.id !== e.id)
          .reduce((a, b) =>
            Math.abs(hueDelta(e.oklch.h, a.oklch.h)) <= Math.abs(hueDelta(e.oklch.h, b.oklch.h)) ? a : b,
          );
        const shifted = normalizeHue(e.oklch.h + hueDelta(e.oklch.h, closest.oklch.h) * 0.45);
        const fixed = gamutMap(
          { ...e.oklch, h: shifted, c: Math.min(e.oklch.c, maxChroma(e.oklch.l, shifted, 'srgb')) },
          'srgb',
        );
        offNotes.push({
          id: e.id,
          axis: 'hue',
          reason: `Teinte isolée : ${Math.round(nearest)}° la séparent de sa plus proche voisine.`,
          consequence:
            'Rien ne la rattache aux autres : dans une composition, elle passe pour une couleur ' +
            'd’un autre projet.',
          fix: { hex: oklchToHex(fixed), label: 'La rapprocher de sa voisine' },
        });
      }
    }
  }

  // — Régularité des écarts —
  const sortedByL = [...entries].sort((a, b) => b.oklch.l - a.oklch.l);
  const lGaps = sortedByL.slice(1).map((e, i) => (sortedByL[i] as Entry).oklch.l - e.oklch.l);
  const regularity = {
    lightness: lGaps.length > 1 ? Math.max(0, 1 - stddev(lGaps) / Math.max(0.001, mean(lGaps))) : 1,
    chroma: chromas.length > 1 ? Math.max(0, 1 - stddev(chromas) / Math.max(0.001, mean(chromas))) : 1,
    hue: confidence,
  };

  // — Score et verdict : un seul, dérivé du calcul —
  const score = Math.max(0, Math.round(100 - offNotes.length * 18 - (1 - confidence) * 15));
  const verdict =
    offNotes.length === 0
      ? `${SCHEME_LABELS[scheme]}${confidence >= 0.7 ? '' : ' (structure souple)'} — le groupe est cohérent : aucune couleur ne sort de sa logique.`
      : `${SCHEME_LABELS[scheme]} — ${offNotes.length} couleur${offNotes.length > 1 ? 's sortent' : ' sort'} de la logique du groupe (voir ci-dessous).`;

  return { scheme, confidence, verdict, score, offNotes, regularity };
}
