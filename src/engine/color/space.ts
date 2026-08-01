/**
 * Conversions d'espaces de couleur. OKLCH est l'espace pivot : tout calcul
 * du moteur passe par lui. sRGB/hex ne sont que des formats d'entrée/sortie.
 * Aucun calcul en HSL, nulle part.
 */
import {
  converter,
  parse,
  formatHex,
  type Oklch,
  type Rgb,
  type Lab65,
  type P3,
  type Oklab,
} from 'culori';
import type { OklchColor } from '../types';

const toOklchConv = converter('oklch');
const toRgbConv = converter('rgb');
const toLabConv = converter('lab65');
const toP3Conv = converter('p3');
const toOklabConv = converter('oklab');
const toLrgbConv = converter('lrgb');

/** Normalise une teinte en degrés dans [0, 360). */
export function normalizeHue(h: number): number {
  const r = h % 360;
  return r < 0 ? r + 360 : r;
}

function fromCulori(c: Oklch): OklchColor {
  const out: OklchColor = {
    l: c.l,
    c: c.c,
    h: normalizeHue(c.h ?? 0),
  };
  if (c.alpha !== undefined && c.alpha < 1) out.alpha = c.alpha;
  return out;
}

function toCulori(c: OklchColor): Oklch {
  return { mode: 'oklch', l: c.l, c: c.c, h: c.h, alpha: c.alpha };
}

/**
 * Interprète une saisie utilisateur (hex, rgb(), oklch(), nom CSS…)
 * et la ramène dans l'espace pivot. Retourne null si illisible.
 */
export function parseToOklch(input: string): OklchColor | null {
  const parsed = parse(input.trim());
  if (!parsed) return null;
  const oklch = toOklchConv(parsed);
  if (!oklch) return null;
  return fromCulori(oklch);
}

/** Composantes sRGB 0–1 (non bornées : peuvent sortir de [0,1] hors gamut). */
export function oklchToRgb(c: OklchColor): { r: number; g: number; b: number } {
  const rgb: Rgb = toRgbConv(toCulori(c));
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}

/** Composantes sRGB linéaires (avant transfert gamma). */
export function oklchToLinearRgb(c: OklchColor): { r: number; g: number; b: number } {
  const lrgb = toLrgbConv(toCulori(c));
  return { r: lrgb.r, g: lrgb.g, b: lrgb.b };
}

/** CIELab (D65). */
export function oklchToLab(c: OklchColor): { l: number; a: number; b: number } {
  const lab: Lab65 = toLabConv(toCulori(c));
  return { l: lab.l, a: lab.a, b: lab.b };
}

/** Display P3, composantes 0–1 (non bornées hors gamut). */
export function oklchToP3(c: OklchColor): { r: number; g: number; b: number } {
  const p3: P3 = toP3Conv(toCulori(c));
  return { r: p3.r, g: p3.g, b: p3.b };
}

/** OKLab (utile pour ΔEOK et les moyennes perceptuelles). */
export function oklchToOklab(c: OklchColor): { l: number; a: number; b: number } {
  const lab: Oklab = toOklabConv(toCulori(c));
  return { l: lab.l, a: lab.a, b: lab.b };
}

/**
 * Sérialise en hex sRGB. Attention : suppose la couleur déjà dans le gamut
 * sRGB — sinon, passer d'abord par `gamutMap` (l'écrêtage silencieux ment).
 */
export function oklchToHex(c: OklchColor): string {
  return formatHex(toCulori(c));
}

/** Hex depuis composantes sRGB 0–1 (écrêtées). */
export function rgbToHex(r: number, g: number, b: number): string {
  return formatHex({ mode: 'rgb', r, g, b });
}

/** Composantes sRGB 0–255 d'un hex (pour apca-w3 notamment). */
export function hexToRgb255(hex: string): [number, number, number] | null {
  const parsed = parse(hex.trim());
  if (!parsed) return null;
  const rgb = toRgbConv(parsed);
  return [
    Math.round(Math.min(1, Math.max(0, rgb.r)) * 255),
    Math.round(Math.min(1, Math.max(0, rgb.g)) * 255),
    Math.round(Math.min(1, Math.max(0, rgb.b)) * 255),
  ];
}

/** Format CSS `oklch(l% c h)` pour l'export et le mode technique. */
export function formatOklch(c: OklchColor, digits = 4): string {
  const l = (c.l * 100).toFixed(Math.max(0, digits - 2));
  return `oklch(${l}% ${c.c.toFixed(digits)} ${c.h.toFixed(2)})`;
}
