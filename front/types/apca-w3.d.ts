/**
 * Déclarations minimales pour apca-w3@0.1.9 (pas de types publiés).
 * Signatures relevées dans la source de la version épinglée.
 */
declare module 'apca-w3' {
  /** Luminance écran Ys depuis des composantes sRGB 0–255. */
  export function sRGBtoY(rgb: [number, number, number]): number;
  /** Luminance écran Ys depuis des composantes Display P3 0–1. */
  export function displayP3toY(rgb: [number, number, number]): number;
  /**
   * Contraste Lc entre luminance du texte et luminance du fond.
   * `places = -1` (défaut) retourne un nombre flottant.
   */
  export function APCAcontrast(
    txtY: number,
    bgY: number,
    places?: number,
  ): number | string;
  export function calcAPCA(
    textColor: string | number | number[],
    bgColor: string | number | number[],
    places?: number,
    isInt?: boolean,
  ): number | string;
}

/** Import de fichiers en texte brut (Vite). */
declare module '*.css?raw' {
  const content: string;
  export default content;
}
