/**
 * L'atelier de la palette : construire, trier, vider.
 *
 * Trois opérations qui agissent sur la LISTE entière, là où le reste de
 * l'outil travaille couleur par couleur. Elles partagent une règle :
 * **une couleur verrouillée survit à tout**. On peut vider la palette,
 * la reconstruire de zéro ou la réordonner, les couleurs épinglées
 * restent — c'est ce qui permet de chercher autour d'un logo imposé sans
 * craindre de le perdre.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch, oklchToOklab } from '../color/space';

export type EntreeAtelier = { id: string; hex: string; label: string; verrou?: boolean };

/** En dessous, la couleur ne porte plus de teinte lisible. */
const SEUIL_NEUTRE = 0.03;

/**
 * Pseudo-aléatoire DÉTERMINISTE : la même graine rend toujours la même
 * suite. C'est ce qui permet à « Construire » de proposer autre chose à
 * chaque clic tout en restant reproductible — et testable.
 */
function alea(graine: number): number {
  const x = Math.sin(graine * 99.13 + 7.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Distance perceptuelle en OKLab, pour écarter les quasi-doublons. */
function distanceOk(a: string, b: string): number {
  const ca = parseToOklch(a);
  const cb = parseToOklch(b);
  if (!ca || !cb) return Infinity;
  const la = oklchToOklab(ca);
  const lb = oklchToOklab(cb);
  return Math.hypot(la.l - lb.l, la.a - lb.a, la.b - lb.b);
}

function hex(l: number, c: number, h: number): string {
  return oklchToHex(gamutMap({ l, c: Math.min(c, maxChroma(l, h, 'srgb')), h }, 'srgb'));
}

// — Trier —

export type SensTri = 'clair-fonce' | 'fonce-clair';

/**
 * Écart de teinte au-delà duquel on ouvre une nouvelle famille. 40° est
 * large : c'est ce qui regroupe un bleu et un bleu-vert, et sépare un
 * bleu d'un violet.
 */
const ECART_FAMILLE = 40;

/**
 * Regroupe par famille de teinte, puis ordonne par clarté — à
 * l'intérieur de chaque famille ET entre les familles.
 *
 * Un tri purement par clarté mélangerait les teintes et donnerait une
 * liste illisible. Un tri purement par teinte ignorerait la structure
 * clair/foncé. C'est le croisement des deux qui donne un nuancier qu'on
 * peut lire.
 *
 * Chaque neutre forme sa propre famille : un gris n'appartient à aucune
 * teinte, il se range simplement à sa place de clarté.
 */
export function trieParFamilles<T extends { hex: string }>(couleurs: readonly T[], sens: SensTri): T[] {
  if (couleurs.length < 2) return [...couleurs];
  const versLeClair = sens === 'clair-fonce';

  const meta = couleurs.map((col) => {
    const o = parseToOklch(col.hex);
    return { col, l: o?.l ?? 0.5, h: o?.h ?? 0, neutre: (o?.c ?? 0) < SEUIL_NEUTRE };
  });

  const chromatiques = meta.filter((m) => !m.neutre).sort((a, b) => a.h - b.h);
  const familles: (typeof meta)[] = [];

  for (const m of chromatiques) {
    const courante = familles[familles.length - 1];
    const dernier = courante?.[courante.length - 1];
    if (!courante || !dernier || m.h - dernier.h > ECART_FAMILLE) familles.push([m]);
    else courante.push(m);
  }

  // Recollage du passage par 0° : un rouge à 355° et un rouge à 5° sont
  // la même famille, même s'ils se retrouvent aux deux bouts du tri.
  if (familles.length > 1) {
    const premiere = familles[0] as (typeof meta);
    const derniere = familles[familles.length - 1] as (typeof meta);
    const finDerniere = derniere[derniere.length - 1]!.h;
    const debutPremiere = premiere[0]!.h;
    if (360 - finDerniere + debutPremiere <= ECART_FAMILLE) {
      derniere.push(...premiere);
      familles.shift();
    }
  }

  for (const neutre of meta.filter((m) => m.neutre)) familles.push([neutre]);

  const parClarte = (a: { l: number }, b: { l: number }) => (versLeClair ? b.l - a.l : a.l - b.l);
  for (const f of familles) f.sort(parClarte);
  familles.sort((a, b) => {
    const moy = (f: typeof meta) => f.reduce((s, m) => s + m.l, 0) / f.length;
    return parClarte({ l: moy(a) }, { l: moy(b) });
  });

  return familles.flat().map((m) => m.col);
}

/** Le libellé annoncé par le bouton, qui dit ce que fera le PROCHAIN clic. */
export function libelleTri(prochainSens: SensTri): string {
  return prochainSens === 'clair-fonce'
    ? 'Regrouper par couleur, du plus clair au plus foncé'
    : 'Regrouper par couleur, du plus foncé au plus clair';
}

/** Le message affiché APRÈS le tri, qui dit ce qui vient d'être fait. */
export function messageTri(sens: SensTri): string {
  return sens === 'clair-fonce'
    ? 'Regroupé par couleur, du plus clair au plus foncé.'
    : 'Regroupé par couleur, du plus foncé au plus clair.';
}

// — Construire —

/** Les schémas parcourus par les clics successifs sur « Construire ». */
const SCHEMAS_CYCLE: number[][] = [
  [-30, 0, 30], // analogue
  [0, 180], // complémentaire
  [0, 150, 210], // split-complémentaire
  [0, 120, 240], // triadique
];

/** Clartés des neutres produits, du plus clair au plus foncé. */
const CLARTES_CLAIRES = [0.97, 0.92];
const CLARTES_FONCEES = [0.35, 0.21];
/** Les neutres sont teintés, jamais des gris purs (brief §4.4). */
const CHROMA_NEUTRE = 0.012;

export type CouleurConstruite = { hex: string; label: string };

/**
 * Construit une palette complète et cohérente.
 *
 * Les couleurs verrouillées sont conservées telles quelles et servent
 * d'ancres : c'est leur teinte qui décide du reste. Les autres sont
 * remplacées. La graine fait varier le résultat d'un clic à l'autre —
 * schéma, clarté des accents, décalage de teinte — sans jamais tirer au
 * hasard pur : la même graine redonne la même palette.
 */
export function construitPalette(
  couleurs: readonly EntreeAtelier[],
  graine: number,
  nomme: (hex: string, index: number) => string,
): CouleurConstruite[] {
  const ancres = couleurs.filter((c) => c.verrou);
  const analyses = ancres
    .map((c) => parseToOklch(c.hex))
    .filter((c): c is OklchColor => c !== null);

  const chromatiques = analyses.filter((c) => c.c >= SEUIL_NEUTRE);

  // Teinte directrice : celle de l'ancre la plus franche, sinon une
  // teinte tirée de la graine — reproductible, jamais aléatoire.
  const teinte = chromatiques.length
    ? (chromatiques.reduce((a, b) => (b.c > a.c ? b : a)).h)
    : (alea(graine * 13 + 1) * 360) % 360;

  const intensite = chromatiques.length
    ? chromatiques.reduce((s, c) => s + c.c, 0) / chromatiques.length
    : 0.11;

  const schema = SCHEMAS_CYCLE[graine % SCHEMAS_CYCLE.length] as number[];
  const clarteAccent = Math.min(0.72, Math.max(0.52, 0.62 + (alea(graine * 7 + 3) - 0.5) * 0.1));

  const sortie: string[] = [];
  const ajoute = (candidat: string, ecartMini: number): void => {
    if (sortie.some((h) => distanceOk(h, candidat) < ecartMini)) return;
    if (ancres.some((a) => distanceOk(a.hex, candidat) < ecartMini)) return;
    sortie.push(candidat);
  };

  // Une couleur de marque par pôle du schéma.
  for (const ecart of schema) {
    ajoute(hex(clarteAccent, intensite, (teinte + ecart + 360) % 360), 0.06);
  }
  // Puis la charpente : des neutres teintés, clairs et foncés.
  for (const l of CLARTES_CLAIRES) ajoute(hex(l, CHROMA_NEUTRE, teinte), 0.02);
  for (const l of CLARTES_FONCEES) ajoute(hex(l, CHROMA_NEUTRE * 1.8, teinte), 0.02);

  const construites = sortie.map((h, i) => ({ hex: h, label: nomme(h, i) }));
  return [
    ...ancres.map((a) => ({ hex: a.hex, label: a.label })),
    ...construites,
  ];
}
