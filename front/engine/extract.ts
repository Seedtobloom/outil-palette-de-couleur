/**
 * Extraction de couleurs depuis une image.
 *
 * k-means dans OKLab, jamais de median cut en RGB : c'est ce qui donne
 * les extractions ternes de la plupart des outils. Dans OKLab, la
 * distance euclidienne correspond à l'écart perçu, donc les groupes
 * formés sont ceux que l'œil forme.
 *
 * Déterministe : l'initialisation est calculée (k-means++ avec un
 * générateur pseudo-aléatoire à graine fixe), jamais tirée au sort. Deux
 * extractions de la même image donnent exactement la même palette.
 */
import type { OklchColor } from './types';
import { oklchToHex } from './color/space';

/** Un pixel réduit à ce qui nous intéresse. */
export type Echantillon = { l: number; a: number; b: number; poids: number };

export type CouleurExtraite = {
  hex: string;
  oklch: OklchColor;
  /** Part de l'image occupée, 0–1. */
  part: number;
};

/** Générateur déterministe (mulberry32) — pas de Math.random. */
function alea(graine: number): () => number {
  let t = graine;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function distance2(a: Echantillon, b: { l: number; a: number; b: number }): number {
  return (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;
}

/**
 * k-means++ : les centres de départ sont choisis loin les uns des
 * autres, ce qui évite les palettes où deux couleurs se ressemblent.
 */
function initialise(points: Echantillon[], k: number, rnd: () => number) {
  const centres: { l: number; a: number; b: number }[] = [];
  const premier = points[Math.floor(rnd() * points.length)] as Echantillon;
  centres.push({ l: premier.l, a: premier.a, b: premier.b });

  while (centres.length < k) {
    const dists = points.map((p) => Math.min(...centres.map((c) => distance2(p, c))) * p.poids);
    const total = dists.reduce((s, d) => s + d, 0);
    if (total <= 0) break;
    let seuil = rnd() * total;
    let choisi = points[points.length - 1] as Echantillon;
    for (let i = 0; i < points.length; i++) {
      seuil -= dists[i] as number;
      if (seuil <= 0) {
        choisi = points[i] as Echantillon;
        break;
      }
    }
    centres.push({ l: choisi.l, a: choisi.a, b: choisi.b });
  }
  return centres;
}

/**
 * Regroupe les échantillons en `k` couleurs. Les échantillons portent un
 * poids (nombre de pixels) : une couleur qui occupe 40 % de l'image pèse
 * quarante fois plus qu'une couleur présente sur 1 %.
 */
export function kmeansOklab(
  points: Echantillon[],
  k: number,
  iterations = 24,
  graine = 20260801,
): CouleurExtraite[] {
  if (points.length === 0) return [];
  const kReel = Math.min(k, points.length);
  const rnd = alea(graine);
  let centres = initialise(points, kReel, rnd);

  let groupes: number[] = [];
  for (let iter = 0; iter < iterations; iter++) {
    groupes = points.map((p) => {
      let meilleur = 0;
      let d = Infinity;
      centres.forEach((c, i) => {
        const dd = distance2(p, c);
        if (dd < d) {
          d = dd;
          meilleur = i;
        }
      });
      return meilleur;
    });

    const sommes = centres.map(() => ({ l: 0, a: 0, b: 0, poids: 0 }));
    points.forEach((p, i) => {
      const s = sommes[groupes[i] as number] as (typeof sommes)[number];
      s.l += p.l * p.poids;
      s.a += p.a * p.poids;
      s.b += p.b * p.poids;
      s.poids += p.poids;
    });

    let bouge = false;
    centres = centres.map((c, i) => {
      const s = sommes[i] as (typeof sommes)[number];
      if (s.poids === 0) return c;
      const nouveau = { l: s.l / s.poids, a: s.a / s.poids, b: s.b / s.poids };
      if (distance2({ ...nouveau, poids: 1 }, c) > 1e-9) bouge = true;
      return nouveau;
    });
    if (!bouge) break;
  }

  // Poids final par groupe → part de l'image.
  const poids = centres.map(() => 0);
  let total = 0;
  points.forEach((p, i) => {
    poids[groupes[i] as number] = (poids[groupes[i] as number] as number) + p.poids;
    total += p.poids;
  });

  return centres
    .map((c, i) => {
      // OKLab → OKLCH.
      const chroma = Math.sqrt(c.a * c.a + c.b * c.b);
      let teinte = (Math.atan2(c.b, c.a) * 180) / Math.PI;
      if (teinte < 0) teinte += 360;
      const oklch: OklchColor = { l: c.l, c: chroma, h: teinte };
      return { hex: oklchToHex(oklch), oklch, part: total > 0 ? (poids[i] as number) / total : 0 };
    })
    .filter((c) => c.part > 0)
    .sort((a, b) => b.part - a.part);
}

/**
 * Prépare les échantillons depuis des pixels RGBA (sortie d'un canvas).
 * Les pixels transparents sont ignorés ; les couleurs identiques sont
 * regroupées (quantification légère) pour que le calcul reste rapide sur
 * une grande image.
 */
export function echantillonneRgba(
  donnees: Uint8ClampedArray,
  versOklab: (r: number, g: number, b: number) => { l: number; a: number; b: number },
): Echantillon[] {
  const seaux = new Map<number, number>();
  for (let i = 0; i < donnees.length; i += 4) {
    const alpha = donnees[i + 3] as number;
    if (alpha < 125) continue;
    // Quantification 5 bits par canal : 32 768 seaux au maximum.
    const r = (donnees[i] as number) >> 3;
    const g = (donnees[i + 1] as number) >> 3;
    const b = (donnees[i + 2] as number) >> 3;
    const cle = (r << 10) | (g << 5) | b;
    seaux.set(cle, (seaux.get(cle) ?? 0) + 1);
  }

  const out: Echantillon[] = [];
  for (const [cle, poids] of seaux) {
    const r = (((cle >> 10) & 31) << 3) + 4;
    const g = (((cle >> 5) & 31) << 3) + 4;
    const b = ((cle & 31) << 3) + 4;
    const lab = versOklab(r / 255, g / 255, b / 255);
    out.push({ ...lab, poids });
  }
  return out;
}
