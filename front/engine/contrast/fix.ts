/**
 * Correction de contraste par ajustement de la seule clarté.
 *
 * C'est tout l'intérêt d'OKLCH : on descend ou on monte le L, la teinte
 * et l'intensité ne bougent pas. La couleur reste la même couleur, elle
 * devient lisible.
 *
 * Ce module fournit aussi la priorisation : « une décision par écran »
 * (brief §9.0) suppose de savoir QUELLE paire présenter en premier.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch } from '../color/space';
import { contrastRatio } from './wcag';
import { apcaLc } from './apca';

export type PairUse = 'texte' | 'titre' | 'composant';

/** Seuils WCAG 2.2 par usage. Le 3:1 non textuel (SC 1.4.11) est traité
 *  comme un critère de premier plan, pas comme une option. */
export const SEUILS: Record<PairUse, { aa: number; aaa: number | null; regle: string }> = {
  texte: { aa: 4.5, aaa: 7, regle: 'WCAG 2.2 SC 1.4.3 — texte courant' },
  titre: { aa: 3, aaa: 4.5, regle: 'WCAG 2.2 SC 1.4.3 — grand texte (≥ 24 px, ou 18,66 px gras)' },
  composant: { aa: 3, aaa: null, regle: 'WCAG 2.2 SC 1.4.11 — éléments non textuels' },
};

export type Fix = {
  /** La couleur corrigée. */
  hex: string;
  /** Ratio obtenu. */
  ratio: number;
  /** Sens du déplacement. */
  sens: 'plus sombre' | 'plus clair';
  /** Écart de clarté, en points de pourcentage (ce qu'on annonce). */
  deltaL: number;
  /** Ce qui a été touché — sert à prouver que la teinte ne bouge pas. */
  preserve: { teinte: number; intensite: number };
  /** Phrase prête à afficher. */
  phrase: string;
};

/** Cherche la clarté minimale qui atteint `cible` sur `fond`. */
function chercheL(
  source: OklchColor,
  fond: string,
  cible: number,
  sens: 'darker' | 'lighter',
): { l: number; hex: string; ratio: number } | null {
  const test = (l: number) => {
    const hex = oklchToHex(
      gamutMap({ l, c: Math.min(source.c, maxChroma(l, source.h, 'srgb')), h: source.h }, 'srgb'),
    );
    return { hex, ratio: contrastRatio(hex, fond) };
  };
  const extreme = sens === 'darker' ? 0.02 : 0.99;
  if (test(extreme).ratio < cible) return null;

  let lo = 0.02;
  let hi = 0.99;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const atteint = test(mid).ratio >= cible;
    if (sens === 'darker') {
      // On veut le L le plus HAUT qui atteigne encore la cible.
      if (atteint) lo = mid;
      else hi = mid;
    } else {
      if (atteint) hi = mid;
      else lo = mid;
    }
  }
  const l = sens === 'darker' ? lo : hi;
  const { hex, ratio } = test(l);
  return ratio >= cible ? { l, hex, ratio } : null;
}

/**
 * Corrige une couleur pour qu'elle atteigne le seuil sur un fond donné,
 * en ne touchant QUE sa clarté. Choisit d'office le déplacement le plus
 * court des deux.
 */
export function corrigeParClarte(
  couleur: string,
  fond: string,
  cible: number,
): Fix | null {
  const source = parseToOklch(couleur);
  if (!source) return null;

  const marge = cible + 0.01;
  const candidats: { r: NonNullable<ReturnType<typeof chercheL>>; sens: Fix['sens'] }[] = [];
  const sombre = chercheL(source, fond, marge, 'darker');
  if (sombre) candidats.push({ r: sombre, sens: 'plus sombre' });
  const clair = chercheL(source, fond, marge, 'lighter');
  if (clair) candidats.push({ r: clair, sens: 'plus clair' });
  if (candidats.length === 0) return null;

  // Le déplacement le plus court : on reste au plus près de l'intention.
  const meilleur = candidats.reduce((a, b) =>
    Math.abs(a.r.l - source.l) <= Math.abs(b.r.l - source.l) ? a : b,
  );

  const deltaL = Math.round(Math.abs(meilleur.r.l - source.l) * 100);
  const corrige = parseToOklch(meilleur.r.hex);
  return {
    hex: meilleur.r.hex,
    ratio: meilleur.r.ratio,
    sens: meilleur.sens,
    deltaL,
    preserve: { teinte: corrige?.h ?? source.h, intensite: corrige?.c ?? source.c },
    phrase:
      `${deltaL} points de clarté en moins suffisent` .replace(
        'en moins',
        meilleur.sens === 'plus sombre' ? 'en moins' : 'en plus',
      ) + ` — la teinte et l’intensité ne bougent pas.`,
  };
}

export type PaireEvaluee = {
  avantId: string;
  fondId: string;
  avantHex: string;
  fondHex: string;
  usage: PairUse;
  ratio: number;
  lc: number;
  /** Niveau atteint : 'AAA' | 'AA' | null. */
  niveau: 'AAA' | 'AA' | null;
  /** Ce qui manque pour passer, si ça ne passe pas. */
  fix: Fix | null;
  /** Plus il est haut, plus la paire mérite d'être traitée en premier. */
  priorite: number;
};

/**
 * Évalue toutes les paires utiles et les classe. Une paire « utile » est
 * une paire dont on peut réellement faire quelque chose : on ne teste pas
 * une couleur contre elle-même.
 *
 * La priorité met en tête : (1) les échecs, (2) l'usage le plus exigeant,
 * (3) l'écart le plus faible au seuil — parce qu'une paire à 4,3:1 se
 * corrige d'un rien, alors qu'une paire à 1,2:1 n'a rien à faire ensemble.
 */
export function evaluePaires(
  couleurs: { id: string; hex: string; label?: string }[],
  usage: PairUse = 'texte',
): PaireEvaluee[] {
  const seuil = SEUILS[usage];
  const out: PaireEvaluee[] = [];

  for (const avant of couleurs) {
    for (const fond of couleurs) {
      if (avant.id === fond.id) continue;
      const ratio = contrastRatio(avant.hex, fond.hex);
      const niveau =
        seuil.aaa !== null && ratio >= seuil.aaa ? 'AAA' : ratio >= seuil.aa ? 'AA' : null;
      const fix = niveau === null ? corrigeParClarte(avant.hex, fond.hex, seuil.aa) : null;

      // Une paire irrécupérable (aucune correction possible) passe après
      // celles qu'on peut réparer : montrer d'abord ce qui est actionnable.
      const manque = Math.max(0, seuil.aa - ratio);
      const priorite =
        niveau === null ? (fix ? 100 - manque * 10 : 10 - manque) : 0;

      out.push({
        avantId: avant.id,
        fondId: fond.id,
        avantHex: avant.hex,
        fondHex: fond.hex,
        usage,
        ratio,
        lc: apcaLc(avant.hex, fond.hex),
        niveau,
        fix,
        priorite,
      });
    }
  }

  return out.sort((a, b) => b.priorite - a.priorite);
}

/** Repères APCA, présentés comme complément informatif (jamais normatif). */
export function lectureApca(lc: number, usage: PairUse): string {
  const abs = Math.abs(lc);
  const plancher = usage === 'texte' ? 75 : usage === 'titre' ? 45 : 45;
  if (abs >= plancher + 15) return 'confortable';
  if (abs >= plancher) return 'juste au niveau attendu';
  return 'en dessous du niveau attendu';
}
