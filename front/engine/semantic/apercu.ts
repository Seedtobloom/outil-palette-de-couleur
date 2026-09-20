/**
 * L'aperçu de l'étape Exporter : une petite interface montée AVEC les
 * couleurs du nuancier, pour voir ce que la palette donne en situation.
 *
 * ⚠ CE MODULE NE FABRIQUE AUCUNE COULEUR, ET N'INVENTE AUCUNE
 * ASSOCIATION. Il ne fait que choisir, parmi les couleurs de la
 * graphiste, laquelle joue le fond, la carte, le texte, le détail et le
 * bouton — et il choisit à partir du travail déjà fait, pas d'un
 * classement mécanique.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. LES ASSOCIATIONS RETENUES à l'étape Contraste. Ce sont des duos
 *    texte/fond dont la lisibilité a été vérifiée et gardée. L'aperçu
 *    n'affiche pas d'autre duo : poser un texte sur un fond qu'on n'a
 *    pas validé reviendrait à montrer, dans le livrable, exactement ce
 *    que l'étape précédente sert à éviter ;
 * 2. LES RÔLES de l'étape Rôles. La neutre claire est le fond du mode
 *    clair, la neutre foncée celui du mode sombre, et la dominante fait
 *    le bouton. C'est la définition même de ces rôles ; les déduire
 *    d'un tri par clarté donnait des cartes en gris moyen et des
 *    détails rouges posés sur elles.
 *
 * Le tri par clarté ne sert plus que de dernier repli, quand ni les
 * associations ni les rôles ne disent rien — c'est-à-dire avant que la
 * graphiste ait travaillé.
 *
 * Deux conséquences assumées :
 *
 * · pas de vert de succès ni de rouge d'erreur. Une palette de marque
 *   n'en contient presque jamais, et les inventer remettrait dans
 *   l'aperçu des couleurs absentes du nuancier ;
 * · l'aperçu peut être pauvre. Si les associations retenues ne
 *   permettent qu'un seul duo, le détail sortira dans la couleur du
 *   texte plutôt que dans une teinte qu'on n'a pas validée. C'est une
 *   information, pas un raté d'affichage.
 */
import { parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';

/** Mirroir des rôles de l'étape 4 (voir `RoleCouleur` côté interface). */
export type RoleNuancier = 'hero' | 'accent' | 'neutre-claire' | 'neutre-foncee';

export type CouleurApercu = { hex: string; label: string };

/** Une couleur du nuancier, avec le rôle qu'elle a reçu s'il y en a un. */
export type EntreeApercu = CouleurApercu & { role?: RoleNuancier | undefined };

/** Une association retenue à l'étape Contraste. */
export type DuoValide = { texte: CouleurApercu; fond: CouleurApercu };

export type Apercu = {
  fond: CouleurApercu;
  carte: CouleurApercu;
  texte: CouleurApercu;
  detail: CouleurApercu;
  action: CouleurApercu;
  surAction: CouleurApercu;
  /** Contraste du texte courant sur la carte — ce qui décide de la lisibilité. */
  ratioTexte: number;
  /**
   * Vrai quand le duo texte/carte vient d'une association retenue.
   * Faux quand l'aperçu a dû se rabattre sur un choix automatique —
   * l'interface le dit, pour que rien ne passe pour validé sans l'être.
   */
  valide: boolean;
};

/** Seuil du corps de texte, WCAG 2.2 SC 1.4.3 niveau AA. */
const AA = 4.5;
/** Seuil des éléments non textuels — un bouton, un contour. SC 1.4.11. */
const NON_TEXTUEL = 3;

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

function parRole(couleurs: EntreeApercu[], role: RoleNuancier): EntreeApercu | undefined {
  return couleurs.find((c) => c.role === role);
}

/**
 * Choisit la carte : la surface sur laquelle on écrit.
 *
 * Elle doit venir des fonds RÉELLEMENT VALIDÉS, sinon on repose du texte
 * sur une surface que personne n'a vérifiée.
 *
 * Parmi eux, le rôle passe d'abord : la neutre claire EST le fond du
 * mode clair, la neutre foncée celui du mode sombre — c'est leur
 * définition. Le rôle reste une préférence, pas un ordre : s'il désigne
 * une couleur qui n'a jamais été validée comme fond, on ne va pas y
 * poser du texte pour autant, et on retombe sur le plus clair (ou le
 * plus foncé) des fonds validés.
 */
function choisitCarte(
  couleurs: EntreeApercu[],
  duos: DuoValide[],
  mode: 'clair' | 'sombre',
): { carte: CouleurApercu; valide: boolean } {
  const fondsValides = [...new Map(duos.map((d) => [d.fond.hex, d.fond])).values()];
  const source = fondsValides.length > 0 ? fondsValides : couleurs;

  const role = parRole(couleurs, mode === 'clair' ? 'neutre-claire' : 'neutre-foncee');
  const parRoleValide = role && source.find((c) => c.hex === role.hex);
  if (parRoleValide) return { carte: parRoleValide, valide: fondsValides.length > 0 };

  const trie = [...source].sort((a, b) =>
    mode === 'clair' ? clarte(b.hex) - clarte(a.hex) : clarte(a.hex) - clarte(b.hex),
  );
  return { carte: trie[0] as CouleurApercu, valide: fondsValides.length > 0 };
}

/** En dessous, une couleur est un neutre : elle peut faire une page. */
const SEUIL_NEUTRE = 0.05;

/**
 * Choisit le fond de page, DERRIÈRE la carte.
 *
 * Une seule règle, et elle ne dépend pas du mode : LA CARTE EST TOUJOURS
 * PLUS CLAIRE QUE SA PAGE. C'est la convention des surfaces posées — une
 * carte surélevée prend plus de lumière —, et elle tient aussi bien en
 * clair (carte blanche sur page crème) qu'en sombre (carte brune sur
 * page presque noire).
 *
 * Deux garde-fous, appris d'un aperçu raté :
 *
 * · la page doit être un NEUTRE. Sans ce filtre, un nuancier de gris et
 *   de carmin posait sa carte gris foncé sur une page carmin, parce que
 *   le carmin se trouvait être la couleur la plus sombre disponible ;
 * · elle doit rester DISCRÈTE. Au-delà de AA d'écart avec la carte, la
 *   carte cesse d'être une surface pour devenir un bloc de couleur.
 *
 * Si rien ne convient, la page prend la couleur de la carte : le filet
 * de la carte suffit à la détacher, et une page uniforme vaut mieux
 * qu'une teinte qui jure.
 */
function choisitFond(couleurs: EntreeApercu[], carte: CouleurApercu): CouleurApercu {
  const lCarte = clarte(carte.hex);
  const candidats = couleurs.filter(
    (c) =>
      c.hex !== carte.hex &&
      clarte(c.hex) < lCarte &&
      chroma(c.hex) < SEUIL_NEUTRE &&
      contrastRatio(c.hex, carte.hex) <= AA,
  );
  if (candidats.length === 0) return carte;

  // La plus proche de la carte : l'écart doit se sentir sans se voir.
  return candidats.reduce((a, b) =>
    contrastRatio(a.hex, carte.hex) <= contrastRatio(b.hex, carte.hex) ? a : b,
  );
}

/**
 * Compose l'aperçu d'un mode.
 *
 * `sombre` ne veut pas dire « inverser » : on reprend les mêmes
 * décisions par l'autre bout — les associations dont le fond est foncé
 * plutôt que clair.
 */
export function composeApercu(
  couleurs: EntreeApercu[],
  mode: 'clair' | 'sombre',
  duos: DuoValide[] = [],
): Apercu | null {
  if (couleurs.length < 2) return null;

  const { carte, valide: carteValidee } = choisitCarte(couleurs, duos, mode);
  const fond = choisitFond(couleurs, carte);

  /*
   * Le texte : parmi les textes VALIDÉS sur cette carte, le plus
   * lisible. Sans association sur cette carte, on retombe sur le plus
   * contrasté du nuancier — et `valide` passe à faux, pour que
   * l'interface ne fasse pas passer ce choix pour une décision prise.
   */
  const textesValides = duos.filter((d) => d.fond.hex === carte.hex).map((d) => d.texte);
  const texte = (plusContrastee(textesValides, carte.hex) ??
    plusContrastee(couleurs, carte.hex)) as CouleurApercu;
  const ratioTexte = contrastRatio(texte.hex, carte.hex);
  const valide = carteValidee && textesValides.length > 0;

  /*
   * Le détail atténué : le MOINS contrasté des textes validés qui tient
   * encore AA. C'est ce qu'on cherche — une couleur plus discrète mais
   * toujours lisible —, et le fait qu'elle soit validée garantit qu'on
   * ne pose pas un rouge de marque sur un gris parce qu'il se trouvait
   * là. Faute de second duo, le détail reprend la couleur du texte :
   * l'aperçu montre alors une palette qui n'offre qu'un seul registre.
   */
  const autresValides = textesValides.filter(
    (c) => c.hex !== texte.hex && contrastRatio(c.hex, carte.hex) >= AA,
  );
  const detail =
    autresValides.length > 0
      ? (autresValides.reduce((a, b) =>
          contrastRatio(a.hex, carte.hex) <= contrastRatio(b.hex, carte.hex) ? a : b,
        ) as CouleurApercu)
      : texte;

  /*
   * Le bouton : la dominante, puis l'accent — c'est ce que ces rôles
   * veulent dire —, sinon la couleur la plus franche.
   *
   * ⚠ Mais il doit se détacher de la carte. En mode sombre, la carte est
   * souvent la dominante elle-même : le bouton sortait alors dans la
   * couleur exacte du fond qui le porte, et disparaissait. Seuil des
   * éléments non textuels, SC 1.4.11 : 3:1. On descend la liste des
   * préférences jusqu'à en trouver un qui tienne.
   */
  const preferences: CouleurApercu[] = [
    ...[parRole(couleurs, 'hero'), parRole(couleurs, 'accent')].filter(
      (c): c is EntreeApercu => c !== undefined,
    ),
    ...[...couleurs].sort((a, b) => chroma(b.hex) - chroma(a.hex)),
  ];
  const action =
    preferences.find((c) => contrastRatio(c.hex, carte.hex) >= NON_TEXTUEL) ??
    (plusContrastee(preferences, carte.hex) as CouleurApercu);

  /*
   * L'intitulé du bouton : d'abord un texte validé sur cette couleur —
   * si l'association « ce texte sur ce fond » a été retenue, c'est
   * qu'elle a été vérifiée. Sinon la plus lisible du nuancier.
   */
  const surActionValides = duos.filter((d) => d.fond.hex === action.hex).map((d) => d.texte);
  const surAction = (plusContrastee(surActionValides, action.hex) ??
    plusContrastee(couleurs, action.hex)) as CouleurApercu;

  return { fond, carte, texte, detail, action, surAction, ratioTexte, valide };
}
