/**
 * Le CSS du nuancier : les couleurs que la graphiste a construites, avec
 * leurs noms, leurs rôles et les associations qu'elle a validées.
 *
 * ⚠ CE MODULE REMPLACE `export/css.ts` DANS LE PARCOURS, et il existe à
 * cause d'un vrai défaut.
 *
 * L'ancien export descendait de `generatePalette(baseColor)` : il
 * fabriquait des rampes autour d'UNE couleur, héritée d'une étape
 * « choisis ta couleur de base » qui n'existe plus. Résultat, après un
 * Smart Builder — qui ne touche pas à `baseColor` — l'étape Exporter
 * servait un thème construit autour du bleu par défaut (#2563eb), sans
 * le moindre rapport avec le nuancier affiché trois étapes plus haut.
 * On pouvait travailler une heure sur Terre, Paille et Glycine et
 * télécharger un fichier bleu.
 *
 * Ici, la seule source est le nuancier lui-même. Rien n'est généré,
 * rien n'est déduit : ce qu'on exporte est ce qu'on a vu.
 *
 * Le fichier suit l'ordre dans lequel on s'en sert à l'intégration :
 *   1. les couleurs, nommées ;
 *   2. les rôles, qui POINTENT vers elles (`var(--terre)`) plutôt que de
 *      recopier leur valeur — changer une couleur au même endroit reste
 *      possible, et le lien entre rôle et couleur reste lisible ;
 *   3. les associations validées, en commentaire, avec leur ratio.
 */
import { contrastRatio } from '../contrast/wcag';

export type EntreeCss = {
  hex: string;
  label: string;
  /**
   * Référence de ton direct saisie par la graphiste, s'il y en a une.
   * `undefined` est explicite dans le type : `exactOptionalPropertyTypes`
   * est actif, et l'appelant construit ses objets par `map` sans pouvoir
   * omettre la clé.
   */
  tonDirect?: string | undefined;
};

export type AssociationCss = {
  texte: { hex: string; label: string };
  fond: { hex: string; label: string };
};

/** Les quatre rôles du parcours, et le nom de variable de chacun. */
export const VARIABLE_ROLE = {
  hero: 'dominante',
  accent: 'accent',
  'neutre-claire': 'neutre-claire',
  'neutre-foncee': 'neutre-foncee',
} as const;

export type RoleCss = keyof typeof VARIABLE_ROLE;

export type OptionsCss = {
  roles?: Partial<Record<string, RoleCss>>;
  associations?: AssociationCss[];
  /** Les identifiants, dans l'ordre de `couleurs`. Requis pour les rôles. */
  ids?: string[];
};

/**
 * Un nom de couleur devient un identifiant CSS.
 *
 * « Off-white » donne `off-white`, « Bleu nuit » donne `bleu-nuit`, et
 * « Ébène » donne `ebene` : les accents sautent, sinon le fichier oblige
 * à surveiller son encodage à chaque copier-coller.
 */
export function enIdentifiant(label: string): string {
  const sansAccents = label.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nettoye = sansAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Un identifiant CSS ne peut pas commencer par un chiffre, et une
  // couleur peut très bien s'appeler « 404 » ou « 2e gris ».
  if (nettoye === '') return 'couleur';
  return /^[0-9]/.test(nettoye) ? `c-${nettoye}` : nettoye;
}

/**
 * Deux couleurs peuvent porter le même nom — « Gris » et « Gris », ou
 * deux « Couleur » sorties du Smart Builder. Sans suffixe, la seconde
 * écraserait silencieusement la première dans le fichier : une variable
 * disparaîtrait du CSS sans que rien ne le signale.
 */
function identifiantsUniques(couleurs: EntreeCss[]): string[] {
  const vus = new Map<string, number>();
  return couleurs.map((c) => {
    const base = enIdentifiant(c.label);
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Tronqué vers le bas : 4,497 n'est pas 4,5, et ne passe donc pas AA. */
function ratio(a: string, b: string): string {
  const v = Math.floor(contrastRatio(a, b) * 100) / 100;
  return v.toFixed(2).replace('.', ',');
}

function verdict(valeur: number): string {
  if (valeur >= 7) return 'AAA';
  if (valeur >= 4.5) return 'AA';
  if (valeur >= 3) return 'AA grand texte';
  return 'insuffisant';
}

/**
 * Une fin de commentaire dans un nom de couleur refermerait le bloc et
 * casserait le fichier exporté. On l'espace.
 *
 * (Ce commentaire-ci ne peut pas montrer la séquence en question : il se
 * refermerait lui-même. C'est exactement l'erreur que la fonction évite,
 * et elle a été commise ici avant d'être corrigée.)
 */
function sansFinDeCommentaire(texte: string): string {
  return texte.replace(/\*\//g, '* /');
}

export function exportNuancierCss(couleurs: EntreeCss[], options: OptionsCss = {}): string {
  if (couleurs.length === 0) return '';

  const noms = identifiantsUniques(couleurs);
  const lignes: string[] = [];

  lignes.push('/* Nuancier — couleurs, rôles et associations validées. */');
  lignes.push(':root {');

  // 1. Les couleurs.
  for (const [i, c] of couleurs.entries()) {
    const commentaire = c.tonDirect
      ? `  /* ${sansFinDeCommentaire(c.label)} — ton direct ${sansFinDeCommentaire(c.tonDirect)} */`
      : `  /* ${sansFinDeCommentaire(c.label)} */`;
    lignes.push(commentaire);
    lignes.push(`  --${noms[i]}: ${c.hex.toUpperCase()};`);
  }

  // 2. Les rôles, en renvoi vers les couleurs.
  const ids = options.ids;
  const roles = options.roles;
  if (ids && roles) {
    const attribues: string[] = [];
    for (const [role, variable] of Object.entries(VARIABLE_ROLE)) {
      const index = ids.findIndex((id) => roles[id] === role);
      if (index >= 0) {
        attribues.push(`  --${variable}: var(--${noms[index]});`);
      }
    }
    if (attribues.length > 0) {
      lignes.push('');
      lignes.push('  /* Rôles — attribués à l’étape 4. */');
      lignes.push(...attribues);
    }
  }

  lignes.push('}');

  // 3. Les associations validées, en commentaire.
  //
  // En commentaire et pas en variables : une association n'est pas une
  // valeur, c'est une DÉCISION sur deux valeurs. En faire une variable
  // obligerait à inventer un nom par duo, et personne n'écrirait
  // `color: var(--terre-sur-paille)`. La personne qui intègre a besoin
  // de savoir quoi poser sur quoi — c'est une consigne, elle se lit.
  const associations = options.associations ?? [];
  if (associations.length > 0) {
    lignes.push('');
    lignes.push('/* Associations validées à l’étape Contraste (WCAG 2.2, SC 1.4.3).');
    for (const a of associations) {
      const valeur = contrastRatio(a.texte.hex, a.fond.hex);
      lignes.push(
        `   · ${sansFinDeCommentaire(a.texte.label)} sur ${sansFinDeCommentaire(a.fond.label)}` +
          ` — ${ratio(a.texte.hex, a.fond.hex)}:1, ${verdict(valeur)}`,
      );
    }
    lignes.push('   Les autres duos n’ont pas été vérifiés. */');
  }

  return lignes.join('\n') + '\n';
}
