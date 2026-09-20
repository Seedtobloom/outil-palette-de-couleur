/**
 * L'aperçu de l'étape Exporter : une petite interface montée AVEC les
 * couleurs du nuancier, pour voir ce que la palette donne en situation.
 *
 * ⚠ CE MODULE NE FABRIQUE AUCUNE COULEUR. Il ne fait que choisir, parmi
 * celles de la graphiste, laquelle joue le fond, la carte, le texte,
 * le détail et le bouton. C'est tout l'enjeu : l'aperçu précédent
 * affichait un thème généré autour d'une couleur de base fantôme, et
 * montrait donc du bleu à quelqu'un qui travaillait sur du brun.
 *
 * Deux conséquences assumées :
 *
 * 1. pas de vert de succès ni de rouge d'erreur. Une palette de marque
 *    n'en contient presque jamais, et les inventer reviendrait à
 *    remettre dans l'aperçu des couleurs qui ne sont pas là — le défaut
 *    qu'on vient de corriger ;
 * 2. l'aperçu peut être médiocre. Si la palette n'a pas de quoi écrire
 *    lisiblement sur son propre fond, ça se voit — et c'est une
 *    information, pas un raté d'affichage. Le ratio retenu est rendu
 *    disponible pour que l'interface puisse le dire.
 */
import { parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';

export type CouleurApercu = { hex: string; label: string };

export type Apercu = {
  fond: CouleurApercu;
  carte: CouleurApercu;
  texte: CouleurApercu;
  detail: CouleurApercu;
  action: CouleurApercu;
  surAction: CouleurApercu;
  /** Contraste du texte courant sur la carte — ce qui décide de la lisibilité. */
  ratioTexte: number;
};

/** Seuil du corps de texte, WCAG 2.2 SC 1.4.3 niveau AA. */
const AA = 4.5;
/** Seuil des éléments non textuels — un bouton, un contour. SC 1.4.11. */
const NON_TEXTUEL = 3;
/** En dessous, une couleur n'est plus « chromatique » mais un neutre. */
const SEUIL_CHROMA = 0.03;

function clarte(hex: string): number {
  return parseToOklch(hex)?.l ?? 0;
}

function chroma(hex: string): number {
  return parseToOklch(hex)?.c ?? 0;
}

/** La plus contrastée d'une liste, sur un fond donné. */
function plusContrastee<T extends CouleurApercu>(couleurs: T[], fond: string): T | undefined {
  let meilleure: T | undefined;
  let meilleur = -1;
  for (const c of couleurs) {
    const r = contrastRatio(c.hex, fond);
    if (r > meilleur) {
      meilleur = r;
      meilleure = c;
    }
  }
  return meilleure;
}

/**
 * Compose l'aperçu d'un mode.
 *
 * `sombre` ne veut pas dire « inverser » : on reprend la même palette
 * par l'autre bout. Le fond est la couleur la plus foncée au lieu de la
 * plus claire, et tout le reste se recalcule dessus.
 */
export function composeApercu(
  couleurs: CouleurApercu[],
  mode: 'clair' | 'sombre',
  dominante?: CouleurApercu,
): Apercu | null {
  if (couleurs.length < 2) return null;

  // Du plus clair au plus foncé en mode clair, l'inverse en sombre :
  // dans les deux cas, `ordre[0]` est le fond et `ordre[1]` la carte.
  const ordre = [...couleurs].sort((a, b) =>
    mode === 'clair' ? clarte(b.hex) - clarte(a.hex) : clarte(a.hex) - clarte(b.hex),
  );

  const fond = ordre[0] as CouleurApercu;
  const carte = (ordre[1] ?? fond) as CouleurApercu;

  // Le texte : la couleur la plus lisible sur la carte, point. Aucune
  // exclusion — si la meilleure est aussi le fond, c'est que la palette
  // ne propose rien d'autre, et le montrer est plus utile que le
  // masquer derrière un choix arbitraire.
  const texte = plusContrastee(couleurs, carte.hex) as CouleurApercu;
  const ratioTexte = contrastRatio(texte.hex, carte.hex);

  /*
   * Le détail atténué : la meilleure des couleurs restantes, à condition
   * qu'elle tienne encore AA. Un « détail » illisible n'est pas un
   * détail, c'est une faute — dans ce cas on garde la couleur du texte
   * et l'aperçu ne ment pas sur ce que la palette permet.
   */
  const restantes = couleurs.filter((c) => c.hex !== texte.hex && c.hex !== carte.hex);
  const candidat = plusContrastee(restantes, carte.hex);
  const detail =
    candidat && contrastRatio(candidat.hex, carte.hex) >= AA ? candidat : texte;

  /*
   * Le bouton : la dominante si elle a été attribuée à l'étape 4 — c'est
   * exactement ce que ce rôle veut dire —, sinon la couleur la plus
   * franche du nuancier.
   *
   * ⚠ MAIS IL DOIT SE DÉTACHER DE LA CARTE. En mode sombre, la carte est
   * la deuxième couleur la plus foncée, qui est très souvent la
   * dominante elle-même : le bouton sortait alors dans la couleur du
   * fond sur lequel il est posé, et disparaissait purement et
   * simplement. Le seuil est celui des éléments non textuels, WCAG 2.2
   * SC 1.4.11 : 3:1 contre la surface adjacente.
   *
   * On descend la liste des préférences jusqu'à en trouver un qui tient.
   * Si aucun ne tient, on garde le mieux placé : la palette ne permet
   * pas de bouton visible sur cette carte, et c'est une information.
   */
  const preferences = [
    ...(dominante ? [dominante] : []),
    ...[...couleurs].sort((a, b) => chroma(b.hex) - chroma(a.hex)),
  ];
  const action =
    preferences.find((c) => contrastRatio(c.hex, carte.hex) >= NON_TEXTUEL) ??
    (plusContrastee(preferences, carte.hex) as CouleurApercu);
  const surAction = plusContrastee(couleurs, action.hex) as CouleurApercu;

  return { fond, carte, texte, detail, action, surAction, ratioTexte };
}
