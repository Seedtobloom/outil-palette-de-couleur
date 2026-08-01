/**
 * Propositions de correction.
 *
 * `fix.ts` répond à « quelle clarté rendrait cette couleur lisible ». Ce
 * module répond à la question que se pose réellement une graphiste :
 * « qu'est-ce que tu me proposes, et qu'est-ce que ça me coûte ? »
 *
 * Trois différences avec une correction unique :
 *
 * 1. plusieurs pistes, jamais une seule — assombrir le texte, éclaircir
 *    le fond, assourdir, retomber sur un neutre teinté ; c'est la
 *    graphiste qui tranche, pas l'outil ;
 * 2. chaque piste annonce son coût en ΔE2000, l'écart perçu avec la
 *    couleur de départ. C'est la seule mesure honnête de « est-ce que
 *    c'est encore ma couleur ? » ;
 * 3. quand aucune piste ne tient sans quitter la famille, l'outil le dit
 *    et redirige vers l'usage que la paire peut réellement porter, au
 *    lieu d'inventer une correction acceptable.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch } from '../color/space';
import { deltaE00 } from '../color/distance';
import { contrastRatio } from './wcag';
import { SEUILS, type PairUse } from './fix';
import { analyzeHarmony } from '../harmony/analysis';
import { bandOf, type Band } from '../analyze/coverage';

/**
 * « Est-ce encore ma couleur ? » — trois critères, et surtout PAS ΔE2000.
 *
 * ΔE2000 mesure des écarts fins (contrôle qualité d'impression). Un
 * simple assombrissement de 20 points de clarté produit un ΔE de 20 et
 * plus, alors qu'une graphiste dira sans hésiter « c'est le même bleu,
 * en plus foncé ». Piloter le verdict au ΔE reviendrait donc à déclarer
 * hors-famille à peu près toutes les corrections utiles.
 *
 * Ce qui fait qu'une couleur reste elle-même, c'est sa TEINTE et son
 * INTENSITÉ. La clarté, elle, est justement la variable qu'on est venu
 * déplacer. Elle n'est pas un critère de famille : elle est le coût, et
 * elle s'annonce en clair.
 */
export const TOLERANCE_TEINTE = 4;
/** L'intensité peut baisser, pas s'effondrer : en dessous, c'est un gris. */
export const PLANCHER_INTENSITE = 0.35;
/**
 * Au-delà de 25 points de clarté, la couleur change de registre : une
 * claire devient moyenne, une moyenne devient foncée. La correction
 * reste proposée, mais elle n'est plus présentée comme indolore.
 */
export const MOUVEMENT_DOUX = 25;

/** Écart de teinte en degrés, sur le cercle. */
function ecartTeinte(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export type Strategie = 'clarte' | 'assourdi' | 'neutre';

const LIBELLES: Record<Strategie, string> = {
  clarte: 'clarté seule',
  assourdi: 'clarté et intensité',
  neutre: 'neutre teinté',
};

export type Candidat = {
  /** Laquelle des deux couleurs change. */
  cible: 'avant' | 'fond';
  strategie: Strategie;
  /** Libellé court de la stratégie, prêt à afficher. */
  strategieLabel: string;
  hex: string;
  ratio: number;
  /** Écart perçu avec la couleur d'origine (ΔE2000). */
  deltaE: number;
  /** Déplacement de clarté, en points. */
  deltaL: number;
  sens: 'plus clair' | 'plus sombre';
  /** Teinte et intensité préservées : c'est encore la même couleur. */
  memeFamille: boolean;
  /** Même famille ET déplacement de clarté modéré : correction indolore. */
  douce: boolean;
  /** Une phrase, qui dit ce qui change ET ce que ça coûte. */
  phrase: string;
};

export type Verdict = 'passe' | 'corrigeable' | 'cout-eleve' | 'impossible';

export type Proposition = {
  verdict: Verdict;
  /** Toutes les pistes trouvées, la moins coûteuse en tête. */
  candidats: Candidat[];
  /** La piste à mettre en avant : la moins coûteuse qui reste dans la famille. */
  meilleur: Candidat | null;
  /** L'usage le plus exigeant que la paire tient déjà, sans rien changer. */
  usageTenable: PairUse | null;
  /** Ce qu'il faut comprendre, en une phrase. */
  diagnostic: string;
};

/** Ordre du plus exigeant au moins exigeant, pour la redirection d'usage. */
const ORDRE_USAGES: PairUse[] = ['texte', 'titre', 'composant'];

const NOM_USAGE: Record<PairUse, string> = {
  texte: 'du texte courant',
  titre: 'un grand titre',
  composant: 'une icône, une bordure ou un focus',
};

/**
 * Cherche la clarté la plus proche de la source qui atteint `cible`.
 * `facteurChroma` permet d'explorer la piste « assourdi » : baisser
 * l'intensité élargit la plage de clartés atteignables dans le gamut.
 */
function chercheClarte(
  source: OklchColor,
  autre: string,
  cible: number,
  sens: 'sombre' | 'clair',
  facteurChroma = 1,
): { hex: string; ratio: number; l: number } | null {
  const chromaVoulu = source.c * facteurChroma;
  const test = (l: number) => {
    const hex = oklchToHex(
      gamutMap({ l, c: Math.min(chromaVoulu, maxChroma(l, source.h, 'srgb')), h: source.h }, 'srgb'),
    );
    return { hex, ratio: contrastRatio(hex, autre) };
  };

  const extreme = sens === 'sombre' ? 0.02 : 0.99;
  if (test(extreme).ratio < cible) return null;

  let lo = 0.02;
  let hi = 0.99;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const atteint = test(mid).ratio >= cible;
    if (sens === 'sombre') {
      // On veut la clarté la plus HAUTE qui atteigne encore la cible :
      // le déplacement le plus court.
      if (atteint) lo = mid;
      else hi = mid;
    } else {
      if (atteint) hi = mid;
      else lo = mid;
    }
  }
  const l = sens === 'sombre' ? lo : hi;
  const out = test(l);
  return out.ratio >= cible ? { ...out, l } : null;
}

function faitCandidat(
  origine: string,
  source: OklchColor,
  trouve: { hex: string; ratio: number; l: number },
  cible: Candidat['cible'],
  strategie: Strategie,
): Candidat {
  const deltaE = deltaE00(origine, trouve.hex);
  const deltaL = Math.round(Math.abs(trouve.l - source.l) * 100);
  const sens: Candidat['sens'] = trouve.l < source.l ? 'plus sombre' : 'plus clair';
  const quoi = cible === 'avant' ? 'Le texte' : 'Le fond';

  // Famille = teinte tenue et intensité pas effondrée. Une couleur déjà
  // quasi neutre n'a pas de teinte significative : on ne lui en réclame
  // pas la conservation.
  const arrivee = parseToOklch(trouve.hex);
  const teinteTenue =
    source.c < 0.02 || !arrivee || ecartTeinte(source.h, arrivee.h) <= TOLERANCE_TEINTE;
  const partIntensite = source.c > 0 ? (arrivee?.c ?? 0) / source.c : 1;
  const memeFamille = teinteTenue && partIntensite >= PLANCHER_INTENSITE;
  const douce = memeFamille && deltaL <= MOUVEMENT_DOUX;

  let phrase: string;
  if (strategie === 'clarte') {
    phrase = `${quoi} passe ${sens} de ${deltaL} points. La teinte et l’intensité ne bougent pas.`;
  } else if (strategie === 'assourdi') {
    phrase =
      `${quoi} passe ${sens} de ${deltaL} points et perd un peu d’intensité — ` +
      'le déplacement de clarté reste plus court.';
  } else {
    phrase =
      `${quoi} retombe sur un neutre à peine teinté. Ce n’est plus vraiment ta couleur, ` +
      'mais elle reste disponible partout ailleurs.';
  }

  return {
    cible,
    strategie,
    strategieLabel: LIBELLES[strategie],
    hex: trouve.hex,
    ratio: trouve.ratio,
    deltaE,
    deltaL,
    sens,
    memeFamille,
    douce,
    phrase,
  };
}

/** Toutes les pistes pour une couleur donnée, face à l'autre. */
function pistesPour(
  origine: string,
  autre: string,
  seuil: number,
  cible: Candidat['cible'],
): Candidat[] {
  const source = parseToOklch(origine);
  if (!source) return [];
  const marge = seuil + 0.01;
  const out: Candidat[] = [];

  for (const sens of ['sombre', 'clair'] as const) {
    const clarte = chercheClarte(source, autre, marge, sens);
    if (clarte) out.push(faitCandidat(origine, source, clarte, cible, 'clarte'));

    // Assourdir n'a de sens que si la couleur a de l'intensité à perdre.
    if (source.c > 0.06) {
      const assourdi = chercheClarte(source, autre, marge, sens, 0.45);
      if (assourdi) out.push(faitCandidat(origine, source, assourdi, cible, 'assourdi'));
    }
  }

  // Repli neutre : la même teinte, vidée de son intensité. Il n'a de
  // sens que si la couleur en avait à perdre — proposer « retomber sur un
  // neutre » à une couleur déjà quasi grise annonce un renoncement qui
  // n'a pas lieu, et le texte affiché contredit alors la couleur rendue.
  if (source.c >= 0.05) {
    const neutre = { ...source, c: 0.02 };
    for (const sens of ['sombre', 'clair'] as const) {
      const trouve = chercheClarte(neutre, autre, marge, sens);
      if (trouve) out.push(faitCandidat(origine, source, trouve, cible, 'neutre'));
    }
  }

  return out;
}

/**
 * Ce que la paire tient déjà, telle quelle : l'usage le plus exigeant
 * dont elle atteint le seuil. C'est ce qui permet de dire « pas pour du
 * texte, mais très bien pour une icône » au lieu d'un simple refus.
 */
export function usageTenable(ratio: number): PairUse | null {
  for (const u of ORDRE_USAGES) {
    if (ratio >= SEUILS[u].aa) return u;
  }
  return null;
}

/**
 * Toutes les propositions pour une paire, classées par coût croissant.
 * L'appelant reçoit de quoi guider : ce qu'on peut faire, ce que ça
 * coûte, et — si rien ne tient — ce que la paire peut porter à la place.
 */
export function proposeCorrections(
  avantHex: string,
  fondHex: string,
  usage: PairUse = 'texte',
): Proposition {
  const seuil = SEUILS[usage].aa;
  const ratio = contrastRatio(avantHex, fondHex);
  const tenable = usageTenable(ratio);

  if (ratio >= seuil) {
    return {
      verdict: 'passe',
      candidats: [],
      meilleur: null,
      usageTenable: tenable,
      diagnostic: 'Cette association tient déjà le seuil : il n’y a rien à corriger.',
    };
  }

  const candidats = [
    ...pistesPour(avantHex, fondHex, seuil, 'avant'),
    ...pistesPour(fondHex, avantHex, seuil, 'fond'),
  ];

  // On classe AVANT de dédoublonner : à deux couleurs que l'œil ne sépare
  // pas, c'est la moins coûteuse qu'il faut garder.
  //
  // L'ordre est celui dans lequel une graphiste veut voir les options :
  // d'abord ce qui ne coûte rien, puis ce qui reste sa couleur, puis le
  // reste ; à égalité, le plus petit déplacement de clarté.
  const classes = [...candidats].sort((a, b) => {
    if (a.douce !== b.douce) return a.douce ? -1 : 1;
    if (a.memeFamille !== b.memeFamille) return a.memeFamille ? -1 : 1;
    return a.deltaL - b.deltaL;
  });

  // Deux stratégies tombent souvent sur la même couleur, ou sur deux
  // couleurs indiscernables : proposer trois fois la même chose sous
  // trois noms différents donne l'illusion du choix, pas le choix.
  const uniques: Candidat[] = [];
  for (const c of classes) {
    const jumeau = uniques.some(
      (r) => r.cible === c.cible && (r.hex === c.hex || deltaE00(r.hex, c.hex) < 3),
    );
    if (!jumeau) uniques.push(c);
  }

  if (uniques.length === 0) {
    return {
      verdict: 'impossible',
      candidats: [],
      meilleur: null,
      usageTenable: tenable,
      diagnostic:
        'Aucune variante de ces deux teintes n’atteint le seuil : elles ne peuvent pas se porter l’une l’autre.',
    };
  }

  const meilleur = uniques.find((c) => c.douce) ?? null;

  if (!meilleur) {
    // Des solutions existent, mais aucune n'est indolore. On dit ce
    // qu'elles coûtent, et surtout ce que la paire sait déjà faire :
    // « pas pour du texte, très bien pour une icône » vaut mieux qu'un
    // refus sec.
    const moinsCher = uniques[0] as Candidat;
    const cout = moinsCher.memeFamille
      ? `il faudrait la déplacer de ${moinsCher.deltaL} points de clarté`
      : 'il faudrait lui retirer sa teinte ou son intensité';
    const suite = tenable
      ? ` Telle quelle, la paire tient ${fmtRatio(ratio)}:1 — garde-la pour ${NOM_USAGE[tenable]}.`
      : ' Telle quelle, la paire ne tient aucun seuil : ces deux couleurs ne doivent pas se toucher.';
    return {
      verdict: 'cout-eleve',
      candidats: uniques,
      meilleur: null,
      usageTenable: tenable,
      diagnostic: `Cette association ne se rattrape pas sans y laisser des plumes : ${cout}.${suite}`,
    };
  }

  return {
    verdict: 'corrigeable',
    candidats: uniques,
    meilleur,
    usageTenable: tenable,
    diagnostic:
      `${fmtRatio(ratio)}:1 aujourd’hui, il en faut ${fmtRatio(seuil)}. ` +
      `${meilleur.deltaL} points de clarté suffisent, sans toucher à la teinte.`,
  };
}

/**
 * Troncature, pas arrondi : sur un seuil, arrondir 4,497 à 4,50 revient
 * à annoncer conforme ce qui ne l'est pas. On tronque partout, et
 * l'affichage colle au chiffre du spécimen.
 */
function fmtRatio(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2).replace('.', ',');
}

// —————————————————————————————————————————————————————————————
// Correction d'ensemble
// —————————————————————————————————————————————————————————————

export type Couleur = { id: string; hex: string; label?: string };

export type Changement = {
  id: string;
  label: string;
  avant: string;
  apres: string;
  deltaE: number;
  raison: string;
};

export type Restant = {
  avantId: string;
  fondId: string;
  ratio: number;
  diagnostic: string;
  usageTenable: PairUse | null;
};

export type Bilan = {
  couleurs: Couleur[];
  changements: Changement[];
  /** Les paires qui échouent encore, avec la raison. */
  restants: Restant[];
};

export type Impact = {
  /** Paires en échec avant le changement. */
  avant: number;
  /** Paires en échec après. */
  apres: number;
  /** Paires que ce changement fait passer. */
  resolues: number;
  /** Paires que ce changement fait tomber — l'information qui manquait. */
  cassees: number;
  /** Score d'harmonie avant le changement. */
  harmonieAvant: number;
  /** Score d'harmonie après. */
  harmonieApres: number;
  /**
   * La bande de clarté que ce changement laisserait vide.
   *
   * Le garde-fou de structure : une palette a besoin d'un clair, d'un
   * moyen et d'un foncé. Assombrir la seule couleur claire règle
   * effectivement des contrastes — et détruit le système, puisqu'il ne
   * reste plus rien pour faire un fond de page. Aucun compte de paires
   * ne voit ce désastre : il fallait le mesurer à part.
   */
  bandeVidee: Band | null;
};

const BANDES: Band[] = ['light', 'mid', 'dark'];

function compteBandes(couleurs: Couleur[]): Record<Band, number> {
  const out: Record<Band, number> = { light: 0, mid: 0, dark: 0 };
  for (const c of couleurs) {
    const oklch = parseToOklch(c.hex);
    if (oklch) out[bandOf(oklch)]++;
  }
  return out;
}

/** Rend la bande que le passage `avant` → `apres` laisserait vide. */
function bandeVidee(avant: Couleur[], apres: Couleur[]): Band | null {
  const a = compteBandes(avant);
  const b = compteBandes(apres);
  return BANDES.find((k) => a[k] > 0 && b[k] === 0) ?? null;
}

/**
 * Ce qu'une couleur de remplacement fait à TOUTE la palette.
 *
 * C'est l'information décisive, et elle manquait : corriger « A sur B »
 * en déplaçant A peut très bien faire tomber « A sur C ». Sans ce calcul,
 * on applique une correction, le compteur ne bouge pas — ou remonte — et
 * on a le sentiment de tourner en rond sans savoir pourquoi.
 *
 * Le calcul est exact, pas estimé : on compare paire à paire l'état avant
 * et l'état après.
 *
 * Le score d'harmonie est mesuré en même temps, pour la même raison :
 * une correction ne doit pas régler le contraste en défaisant l'accord.
 * Le SCHÉMA, lui, ne peut pas bouger — les corrections ne déplacent que
 * la clarté et ne touchent jamais aux teintes, dont le schéma dépend
 * (garanti par test). Ce qui peut se dégrader, c'est l'équilibre des
 * clartés : c'est exactement ce que ce score rend visible.
 */
export function impactSurPalette(
  couleurs: Couleur[],
  idCible: string,
  hex: string,
  usage: PairUse = 'texte',
): Impact {
  const seuil = SEUILS[usage].aa;
  const apresColors = couleurs.map((c) => (c.id === idCible ? { ...c, hex } : c));

  let avant = 0;
  let apres = 0;
  let resolues = 0;
  let cassees = 0;

  for (let i = 0; i < couleurs.length; i++) {
    for (let j = i + 1; j < couleurs.length; j++) {
      const passeAvant =
        contrastRatio((couleurs[i] as Couleur).hex, (couleurs[j] as Couleur).hex) >= seuil;
      const passeApres =
        contrastRatio((apresColors[i] as Couleur).hex, (apresColors[j] as Couleur).hex) >= seuil;
      if (!passeAvant) avant++;
      if (!passeApres) apres++;
      if (!passeAvant && passeApres) resolues++;
      if (passeAvant && !passeApres) cassees++;
    }
  }

  return {
    avant,
    apres,
    resolues,
    cassees,
    harmonieAvant: analyzeHarmony(couleurs).score,
    harmonieApres: analyzeHarmony(apresColors).score,
    bandeVidee: bandeVidee(couleurs, apresColors),
  };
}

/** Compte les paires qui échouent — le critère que l'ajustement fait baisser. */
function compteEchecs(couleurs: Couleur[], seuil: number): number {
  let n = 0;
  for (let i = 0; i < couleurs.length; i++) {
    for (let j = i + 1; j < couleurs.length; j++) {
      const a = couleurs[i] as Couleur;
      const b = couleurs[j] as Couleur;
      if (contrastRatio(a.hex, b.hex) < seuil) n++;
    }
  }
  return n;
}

/**
 * Corrige tout ce qui peut l'être, d'un coup.
 *
 * Ajustement pas à pas : à chaque tour, on retient le déplacement qui
 * fait baisser le plus le nombre de paires en échec, et on recommence.
 * Deux garde-fous qui font que l'outil ajuste sans déraper :
 *
 * - un changement n'est retenu que s'il fait STRICTEMENT baisser le
 *   nombre d'échecs. Corriger une paire en cassant deux autres n'est pas
 *   une correction ; c'est aussi ce qui garantit que la boucle termine ;
 * - seules les corrections indolores sont retenues, et le déplacement
 *   cumulé depuis la couleur d'ORIGINE reste plafonné. Sans ce garde-fou,
 *   une couleur retouchée dix fois finirait à l'autre bout de l'échelle
 *   sans que personne ne l'ait décidé.
 *
 * Ce qui ne peut pas être corrigé n'est pas maquillé : c'est rendu dans
 * `restants`, avec son diagnostic.
 */
export function corrigeTout(
  couleurs: Couleur[],
  usage: PairUse = 'texte',
  options: { budget?: number; maxTours?: number } = {},
): Bilan {
  const budget = options.budget ?? MOUVEMENT_DOUX;
  const maxTours = options.maxTours ?? 40;
  const seuil = SEUILS[usage].aa;
  const origines = new Map(couleurs.map((c) => [c.id, c.hex]));

  let courant = couleurs.map((c) => ({ ...c }));
  const changements: Changement[] = [];

  for (let tour = 0; tour < maxTours; tour++) {
    const echecsAvant = compteEchecs(courant, seuil);
    if (echecsAvant === 0) break;

    let meilleur: { index: number; candidat: Candidat; echecs: number } | null = null;

    for (let i = 0; i < courant.length; i++) {
      for (let j = 0; j < courant.length; j++) {
        if (i === j) continue;
        const avant = courant[i] as Couleur;
        const fond = courant[j] as Couleur;
        if (contrastRatio(avant.hex, fond.hex) >= seuil) continue;

        const prop = proposeCorrections(avant.hex, fond.hex, usage);
        for (const candidat of prop.candidats) {
          // On ne déplace que la couleur « avant » de cette itération :
          // la paire symétrique est examinée à son propre tour de boucle.
          if (candidat.cible !== 'avant') continue;
          // L'ajustement automatique ne prend que les corrections
          // indolores : tout ce qui coûte se décide à la main.
          if (!candidat.douce) continue;

          const origine = parseToOklch(origines.get(avant.id) as string);
          const arrivee = parseToOklch(candidat.hex);
          if (origine && arrivee && Math.abs(arrivee.l - origine.l) * 100 > budget) continue;

          const essai = courant.map((c) => (c.id === avant.id ? { ...c, hex: candidat.hex } : c));
          // Jamais au prix de la structure : mieux vaut une paire en
          // échec qu'une palette sans couleur claire.
          if (bandeVidee(courant, essai)) continue;
          const echecs = compteEchecs(essai, seuil);
          if (echecs >= echecsAvant) continue;

          // À gain égal, on retient le déplacement le moins coûteux.
          const mieux =
            !meilleur ||
            echecs < meilleur.echecs ||
            (echecs === meilleur.echecs && candidat.deltaE < meilleur.candidat.deltaE);
          if (mieux) meilleur = { index: i, candidat, echecs };
        }
      }
    }

    if (!meilleur) break;

    const couleur = courant[meilleur.index] as Couleur;
    const avantHex = couleur.hex;
    courant = courant.map((c) =>
      c.id === couleur.id ? { ...c, hex: (meilleur as NonNullable<typeof meilleur>).candidat.hex } : c,
    );
    changements.push({
      id: couleur.id,
      label: couleur.label ?? couleur.id,
      avant: avantHex,
      apres: meilleur.candidat.hex,
      deltaE: deltaE00(origines.get(couleur.id) as string, meilleur.candidat.hex),
      raison: meilleur.candidat.phrase,
    });
  }

  // Ce qui reste : on le nomme, on ne l'efface pas.
  const restants: Restant[] = [];
  for (let i = 0; i < courant.length; i++) {
    for (let j = i + 1; j < courant.length; j++) {
      const a = courant[i] as Couleur;
      const b = courant[j] as Couleur;
      const ratio = contrastRatio(a.hex, b.hex);
      if (ratio >= seuil) continue;
      const prop = proposeCorrections(a.hex, b.hex, usage);
      restants.push({
        avantId: a.id,
        fondId: b.id,
        ratio,
        diagnostic: prop.diagnostic,
        usageTenable: prop.usageTenable,
      });
    }
  }

  return { couleurs: courant, changements, restants };
}
