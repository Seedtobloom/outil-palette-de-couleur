/**
 * Glossaire vivant — définitions courtes en français courant.
 * Les illustrations interactives (avec la palette en cours) arrivent en
 * Phase 2 ; le socle de contenu vit ici, dans le moteur, pas dans l'UI.
 */
export type GlossaryEntry = {
  id: string;
  term: string;
  /** Définition courte, sans jargon. */
  short: string;
  /** Ce que ça change concrètement pour un graphiste. */
  concrete: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'contraste',
    term: 'Contraste',
    short:
      'L’écart de luminosité entre deux couleurs, exprimé en ratio de 1:1 (identiques) à 21:1 (noir sur blanc).',
    concrete:
      'C’est ce qui rend un texte lisible. La teinte ne suffit jamais : un rouge et un vert de même clarté sont illisibles l’un sur l’autre.',
  },
  {
    id: 'wcag',
    term: 'WCAG',
    short:
      'Les règles internationales d’accessibilité du web. C’est la référence légale en France (RGAA) et en Europe.',
    concrete:
      'Un site livré à un client doit les respecter. L’outil vérifie les critères liés à la couleur ; il ne remplace pas un audit complet.',
  },
  {
    id: 'aa-aaa',
    term: 'AA / AAA',
    short:
      'Les deux niveaux d’exigence de contraste : AA est le minimum (4,5:1 pour le texte courant), AAA le niveau confort (7:1).',
    concrete:
      'Il n’existe pas de « niveau A » pour le contraste : viser AA partout, AAA quand le projet le permet.',
  },
  {
    id: 'apca',
    term: 'APCA',
    short:
      'Une mesure de lisibilité plus fidèle à la perception que le ratio WCAG, mais qui n’est pas une norme.',
    concrete:
      'L’outil s’en sert comme signal de confort : une paire peut passer la norme et rester pénible à lire. APCA le détecte — sans jamais remplacer WCAG.',
  },
  {
    id: 'daltonisme',
    term: 'Daltonisme',
    short:
      'Une perception réduite de certaines couleurs, qui touche environ 8 % des hommes. La forme la plus courante confond rouges et verts.',
    concrete:
      'La plupart des personnes concernées ont une forme partielle : l’outil simule aussi ces formes-là, pas seulement les cas extrêmes.',
  },
  {
    id: 'teinte-clarte-intensite',
    term: 'Teinte · Clarté · Intensité',
    short:
      'Les trois dimensions d’une couleur : sa famille (teinte, en degrés), sa luminosité perçue (clarté, 0–100) et sa vivacité (intensité).',
    concrete:
      'Tout l’outil travaille dans un espace où ces trois axes correspondent à ce que l’œil perçoit réellement — pas aux curseurs trompeurs des vieux sélecteurs.',
  },
  {
    id: 'gamut',
    term: 'Gamut',
    short: 'L’ensemble des couleurs qu’un écran ou un procédé d’impression peut réellement produire.',
    concrete:
      'Une couleur peut exister « en théorie » mais pas sur votre écran ni sur le papier choisi. L’outil la remplace alors par la plus proche affichable — et le dit.',
  },
  {
    id: 'cmjn',
    term: 'CMJN',
    short:
      'Les quatre encres de l’imprimerie : cyan, magenta, jaune, noir. Une couleur écran (RVB) doit être traduite en CMJN pour être imprimée.',
    concrete:
      'Cette traduction perd toujours quelque chose : les couleurs très vives de l’écran n’existent pas en quadrichromie.',
  },
  {
    id: 'taux-encrage',
    term: 'Taux d’encrage',
    short:
      'La somme des quatre encres déposées en un point, de 0 à 400 %. Les presses acceptent 240 à 330 % selon le papier.',
    concrete:
      'Moins d’encre = séchage plus sûr, coût réduit, papier plus facile à recycler. C’est le levier print de l’éco-conception.',
  },
  {
    id: 'ton-direct',
    term: 'Ton direct',
    short:
      'Une encre pré-mélangée à la couleur exacte, imprimée telle quelle au lieu d’être reconstituée par les quatre encres CMJN.',
    concrete:
      'Indispensable quand la couleur de marque est irréproductible en quadrichromie, surtout sur papier non couché.',
  },
  {
    id: 'quadrichromie',
    term: 'Quadrichromie',
    short: 'L’impression standard en quatre encres (CMJN), qui reconstitue les couleurs par superposition de trames.',
    concrete: 'Économique et universelle, mais son gamut est plus étroit que celui d’un écran.',
  },
  {
    id: 'engraissement',
    term: 'Engraissement',
    short:
      'À l’impression, chaque point de trame s’étale légèrement dans le papier : les couleurs sortent plus sombres que prévu.',
    concrete: 'Très marqué sur papier non couché ou recyclé — les demi-teintes s’écrasent.',
  },
  {
    id: 'rampe',
    term: 'Rampe',
    short:
      'Une même teinte déclinée du très clair au très sombre en pas réguliers (50, 100, … 950), comme un nuancier.',
    concrete:
      'C’est la matière première d’un système de couleurs : chaque usage (fond, texte, bordure) puise dans un pas précis de la rampe.',
  },
  {
    id: 'token',
    term: 'Token',
    short:
      'Un rôle nommé (« texte principal », « fond de carte ») qui pointe vers un pas de rampe, au lieu d’une valeur en dur.',
    concrete:
      'Changer la rampe met à jour tous les usages d’un coup — et le mode sombre devient une simple réattribution des rôles.',
  },
  {
    id: 'mode-sombre',
    term: 'Mode sombre',
    short: 'La version du thème sur fonds sombres. Ce n’est pas une inversion : c’est une seconde palette vérifiée à part.',
    concrete:
      'Inverser naïvement une rampe casse les contrastes. L’outil régénère et revérifie tout pour le mode sombre.',
  },
];

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.id === id);
}
