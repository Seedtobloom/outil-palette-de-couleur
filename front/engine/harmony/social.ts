/**
 * Couleurs d'extension pour les réseaux sociaux.
 *
 * Contrainte propre au support : une image de post est vue en petit, dans
 * un flux qui alterne fond blanc et fond sombre, à côté de contenus qui
 * crient. Il faut donc des couleurs plus vives que la marque, mais qui
 * restent de la même famille — et qui gardent un contraste suffisant sur
 * les deux fonds de flux.
 */
import type { OklchColor } from '../types';
import { gamutMap, maxChroma } from '../color/gamut';
import { oklchToHex, parseToOklch } from '../color/space';
import { contrastRatio } from '../contrast/wcag';
import { rotateOnWheel, type WheelName } from './wheels';

export type SocialColor = {
  hex: string;
  label: string;
  /** À quoi elle sert dans un post. */
  use: string;
  /** Contraste avec le blanc du flux clair. */
  onLight: number;
  /** Contraste avec le sombre du flux nuit. */
  onDark: number;
};

/** Fonds de flux de référence (blanc pur et gris très sombre : ce que
 * font Instagram, LinkedIn et consorts en thème clair et sombre). */
const FEED_LIGHT = '#ffffff';
const FEED_DARK = '#111111';

/**
 * Dérive 5 couleurs d'extension à partir de la couleur de marque :
 * une version « qui claque » de la marque, deux voisines, une opposée
 * pour les mises en avant, et un fond profond pour les visuels sombres.
 */
export function socialPalette(base: string | OklchColor, wheel: WheelName = 'ryb'): SocialColor[] {
  const parsed = typeof base === 'string' ? parseToOklch(base) : base;
  if (!parsed) return [];

  const make = (l: number, chromaRatio: number, h: number): string => {
    const c = chromaRatio * maxChroma(l, h, 'srgb');
    return oklchToHex(gamutMap({ l, c, h }, 'srgb'));
  };

  const h = parsed.h;
  const specs: { hex: string; label: string; use: string }[] = [
    {
      hex: make(0.62, 0.92, h),
      label: 'Marque saturée',
      use: 'aplats de fond de post, stories — la marque poussée pour survivre au flux',
    },
    {
      hex: make(0.72, 0.9, rotateOnWheel(wheel, h, 28)),
      label: 'Voisine claire',
      use: 'variations de posts d’une même série, fonds de citations',
    },
    {
      hex: make(0.5, 0.9, rotateOnWheel(wheel, h, -28)),
      label: 'Voisine profonde',
      use: 'bandeaux, blocs de texte inversé, carrousels',
    },
    {
      hex: make(0.66, 0.95, rotateOnWheel(wheel, h, 180)),
      label: 'Opposée (accent)',
      use: 'un seul élément par visuel : bouton, chiffre clé, mot souligné',
    },
    {
      hex: make(0.26, 0.55, h),
      label: 'Fond profond',
      use: 'visuels sombres, fonds de vidéo, texte blanc dessus',
    },
  ];

  return specs.map((s) => ({
    ...s,
    onLight: contrastRatio(s.hex, FEED_LIGHT),
    onDark: contrastRatio(s.hex, FEED_DARK),
  }));
}

export const SOCIAL_NOTE =
  'Ces couleurs sont plus vives que votre palette d’interface : c’est volontaire. ' +
  'Un post est vu en petit, entre deux contenus criards, sur fond blanc ou noir selon le thème ' +
  'de la personne. Elles restent dans la famille de votre marque, mais elles tiennent le flux. ' +
  'Ne les utilisez pas pour du texte courant sur un site.';
