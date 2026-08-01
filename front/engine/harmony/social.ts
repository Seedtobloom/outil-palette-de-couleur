/**
 * Couleurs d'extension pour les réseaux sociaux.
 *
 * Une palette d'interface est faite pour être discrète et lisible sur
 * une page. Un visuel de réseau social est vu en petit, dans un flux qui
 * défile, entre deux contenus qui crient, sur fond blanc ou sur fond noir
 * selon le thème de la personne qui scrolle. Il lui faut donc plus
 * d'amplitude.
 *
 * Cette amplitude se prend dans la CLARTÉ, pas dans la teinte.
 *
 * C'est le point important : dériver des couleurs en faisant tourner la
 * roue produit des teintes que la graphiste n'a jamais choisies, et le
 * résultat ne ressemble plus à sa marque. Ici, chaque couleur d'extension
 * garde exactement la teinte de la couleur dont elle sort — seule sa
 * clarté bouge. On obtient une version claire et une version profonde de
 * chaque couleur de la palette : de quoi tenir une série de posts sans
 * jamais quitter l'identité.
 */
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';

export type NamedHex = { id: string; hex: string; label?: string };

export type Ton = 'claire' | 'aplat' | 'profonde';

export type SocialColor = {
  hex: string;
  label: string;
  /** La couleur de la palette dont celle-ci est tirée. */
  sourceId: string;
  sourceLabel: string;
  sourceHex: string;
  ton: Ton;
  /** À quoi elle sert dans un post. */
  use: string;
  /** Contraste avec le blanc du flux clair. */
  onLight: number;
  /** Contraste avec le sombre du flux nuit. */
  onDark: number;
  /** Écart de teinte avec la source, en degrés. Doit rester nul. */
  ecartTeinte: number;
};

/** Fonds de flux de référence : blanc pur et gris très sombre, ce que
 *  servent la plupart des applications en thème clair et en thème nuit. */
const FEED_LIGHT = '#ffffff';
const FEED_DARK = '#111111';

/** Clartés visées pour les deux nuances. Assez écartées de l'aplat pour
 *  qu'on les distingue au premier coup d'œil dans un flux. */
const L_CLAIRE = 0.9;
const L_PROFONDE = 0.28;

const USAGES: Record<Ton, string> = {
  claire:
    'fonds de post, cartouches de citation, arrière-plans de carrousel — du texte foncé passe dessus',
  aplat: 'la couleur telle qu’elle est dans ta charte : logo, aplats identitaires, pictogrammes',
  profonde: 'bandeaux, fonds de vidéo, blocs de texte inversé — du texte clair passe dessus',
};

const SUFFIXES: Record<Ton, string> = {
  claire: 'claire',
  aplat: 'aplat',
  profonde: 'profonde',
};

/**
 * Décline la palette en nuances claires et profondes.
 *
 * On ne décline que les couleurs qui ont une teinte à décliner : un gris
 * n'a pas de version « claire de la même famille », il a juste une autre
 * valeur de gris — et la palette en contient déjà. Les couleurs sont
 * prises de la plus intense à la moins intense, et plafonnées : trois
 * familles déclinées en trois tons font déjà neuf visuels possibles,
 * au-delà la série ne se tient plus.
 */
export function socialPalette(couleurs: NamedHex[], maxFamilles = 3): SocialColor[] {
  const parsed = couleurs
    .map((c) => ({ ...c, oklch: parseToOklch(c.hex) }))
    .filter((c): c is NamedHex & { oklch: NonNullable<ReturnType<typeof parseToOklch>> } =>
      c.oklch !== null,
    );

  const sources = parsed
    .filter((c) => c.oklch.c >= 0.04)
    .sort((a, b) => b.oklch.c - a.oklch.c)
    .slice(0, maxFamilles);

  const out: SocialColor[] = [];

  for (const source of sources) {
    const { c, h } = source.oklch;
    const nom = source.label ?? source.id;

    const nuance = (ton: Ton): string => {
      if (ton === 'aplat') return source.hex;
      const cible = ton === 'claire' ? L_CLAIRE : L_PROFONDE;
      // La version claire s'assourdit un peu — à cette clarté, garder
      // toute l'intensité donne un pastel criard. La version profonde
      // garde la sienne : c'est ce qui la fait tenir en petit.
      const part = ton === 'claire' ? 0.5 : 1;
      return oklchToHex(
        gamutMap({ l: cible, c: Math.min(c * part, maxChroma(cible, h, 'srgb')), h }, 'srgb'),
      );
    };

    for (const ton of ['claire', 'aplat', 'profonde'] as Ton[]) {
      const hex = nuance(ton);
      const arrivee = parseToOklch(hex);
      // Distance sur le cercle des teintes, déjà ramenée dans [0, 180].
      const ecart =
        arrivee && c >= 0.02 ? Math.abs((((arrivee.h - h) % 360) + 540) % 360 - 180) : 0;
      out.push({
        hex,
        label: `${nom}, ${SUFFIXES[ton]}`,
        sourceId: source.id,
        sourceLabel: nom,
        sourceHex: source.hex,
        ton,
        use: USAGES[ton],
        onLight: contrastRatio(hex, FEED_LIGHT),
        onDark: contrastRatio(hex, FEED_DARK),
        ecartTeinte: ecart,
      });
    }
  }

  return out;
}

export const SOCIAL_NOTE =
  'Ces couleurs ne sont pas de nouvelles couleurs : ce sont tes couleurs, déclinées en clair et ' +
  'en profond. La teinte ne bouge pas d’un degré — seule la clarté change. C’est ce qui permet ' +
  'à une série de posts d’avoir de l’amplitude sans quitter ta charte. Les valeurs de contraste ' +
  'indiquent la tenue sur un flux clair et sur un flux nuit ; en dessous de 3, ne pose pas de ' +
  'texte dessus.';
