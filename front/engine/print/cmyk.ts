/**
 * Estimation CMJN et taux d'encrage (TAC).
 *
 * ⚠ Honnêteté obligatoire (brief §8.3, règle de justesse n°7) : une
 * conversion CMJN correcte demande un vrai moteur ICC. Ce module fournit
 * une ESTIMATION analytique avec retrait de composante grise (GCR), ce
 * que le brief autorise explicitement en V0 « avec un message clair :
 * valeurs indicatives, non contractuelles ». Toute valeur produite ici
 * DOIT être affichée avec cet avertissement.
 *
 * L'estimation est meilleure qu'un naïf K = 1 − max(R,G,B) : elle
 * applique un GCR partiel, borne le noir, et respecte un plafond
 * d'encrage — c'est le comportement qualitatif d'un profil réel.
 */
import { parseToOklch, oklchToRgb } from '../color/space';

export const CMYK_DISCLAIMER =
  'Valeurs indicatives, non contractuelles : elles sont estimées, pas converties par un profil ICC. ' +
  'Faites toujours confirmer les valeurs et le taux d’encrage par votre imprimeur.';

export type PrintProcess = {
  id: string;
  label: string;
  /** Plafond d'encrage total accepté, en %. */
  tacLimit: number;
  /** Note d'usage. */
  note: string;
};

/** Plafonds de référence du brief (annexe D). */
export const PROCESSES: PrintProcess[] = [
  { id: 'coated', label: 'Offset couché', tacLimit: 300, note: 'papier couché, feuille' },
  { id: 'uncoated', label: 'Offset non couché', tacLimit: 280, note: 'papier non couché, feuille' },
  { id: 'recycled', label: 'Recyclé / journal', tacLimit: 240, note: 'papier fin ou recyclé' },
  { id: 'digital', label: 'Numérique toner', tacLimit: 260, note: 'selon machine' },
];

export type CmykEstimate = {
  c: number;
  m: number;
  y: number;
  k: number;
  /** Somme des quatre encres, en %. */
  tac: number;
  /** Vrai si le TAC dépasse le plafond du procédé choisi. */
  overLimit: boolean;
  /** Conseils d'éco-encrage quand la valeur est élevée. */
  advice: string[];
};

/**
 * Estime les valeurs CMJN d'une couleur écran pour un procédé donné.
 * `gcr` (0–1) contrôle la part de gris remplacée par du noir : plus il
 * est haut, moins on dépose d'encres couleur (et moins on encre).
 */
export function estimateCmyk(hex: string, tacLimit = 300, gcr = 0.8): CmykEstimate | null {
  const oklch = parseToOklch(hex);
  if (!oklch) return null;
  const { r, g, b } = oklchToRgb(oklch);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const R = clamp(r);
  const G = clamp(g);
  const B = clamp(b);

  // Encres brutes avant retrait de gris.
  let c = 1 - R;
  let m = 1 - G;
  let y = 1 - B;

  // Composante grise commune → noir (GCR partiel).
  const gray = Math.min(c, m, y);
  const k = gray * gcr;
  const denom = 1 - k;
  if (denom > 0.0001) {
    c = (c - k) / denom;
    m = (m - k) / denom;
    y = (y - k) / denom;
  } else {
    c = m = y = 0;
  }

  let cmyk = [c, m, y, k].map((v) => Math.round(clamp(v) * 100));

  // Respect du plafond d'encrage : on retire proportionnellement sur les
  // encres couleur (comportement d'un profil à TAC limité).
  let tac = cmyk.reduce((a, v) => a + v, 0);
  if (tac > tacLimit) {
    const excess = tac - tacLimit;
    const colorSum = (cmyk[0] as number) + (cmyk[1] as number) + (cmyk[2] as number);
    if (colorSum > 0) {
      const factor = Math.max(0, (colorSum - excess) / colorSum);
      cmyk = [
        Math.round((cmyk[0] as number) * factor),
        Math.round((cmyk[1] as number) * factor),
        Math.round((cmyk[2] as number) * factor),
        cmyk[3] as number,
      ];
      tac = cmyk.reduce((a, v) => a + v, 0);
    }
  }

  const [cc, mm, yy, kk] = cmyk as [number, number, number, number];
  const advice: string[] = [];
  if (tac > 200) {
    advice.push(
      'Au-dessus de 200 % d’encrage : sur une face principale, c’est le seuil au-delà duquel ' +
        'on gagne à passer en ton direct ou à ouvrir la trame.',
    );
  }
  if (kk >= 95) {
    advice.push('Un noir à 85 % au lieu de 100 % économise environ la moitié de l’encre, sans différence visible.');
  }
  if (cc + mm + yy > 180) {
    advice.push('Aplat très couvrant : une trame à 50 % donne la même intention pour deux fois moins d’encre.');
  }

  return { c: cc, m: mm, y: yy, k: kk, tac, overLimit: tac > tacLimit, advice };
}

/**
 * Le blanc de quelques papiers courants, pour l'aperçu. Ce ne sont PAS
 * des profils ICC : ce sont des points blancs approchés, utilisés
 * uniquement pour ne jamais montrer un aperçu print sur #FFFFFF
 * (règle de justesse n°8).
 */
export const SUBSTRATES = [
  { id: 'coated-white', label: 'Couché blanc', paper: '#fbfbf9' },
  { id: 'uncoated-white', label: 'Non couché blanchi', paper: '#f7f5ef' },
  { id: 'natural', label: 'Non couché naturel', paper: '#f2ede0' },
  { id: 'recycled', label: 'Recyclé 100 %', paper: '#ebe6d9' },
  { id: 'kraft', label: 'Kraft', paper: '#d8c4a4' },
] as const;

export const SUBSTRATE_DISCLAIMER =
  'Blancs de papier approchés, pour se faire une idée : le rendu réel dépend du papier exact, ' +
  'de l’encrage et de l’engraissement. Une validation couleur se fait sur épreuve, jamais sur écran.';
