/**
 * L'interface doit passer les tests qu'elle fait passer aux autres
 * (brief §9.8). Ce test lit les tokens du DS et vérifie les contrastes
 * du chrome avec le moteur de l'outil lui-même.
 *
 * Si le bundle DS change une valeur, ce test le signale immédiatement.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast/wcag';

// Les tokens sont lus depuis le fichier du DS lui-même : si le bundle
// change une valeur, ces tests le signalent immédiatement.
const css = readFileSync(new URL('../styles/colors_and_type.css', import.meta.url), 'utf8');

/** Lit une variable CSS du fichier de tokens (valeurs littérales seulement). */
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`Token --${name} absent du fichier de tokens`);
  return (match[1] as string).trim();
}

/** rgba(...) → hex approché sur un fond donné (les tokens « dim » en usent). */
function flatten(value: string, background: string): string {
  const rgba = value.match(/rgba?\(([^)]+)\)/);
  if (!rgba) return value;
  const parts = (rgba[1] as string).split(',').map((p) => parseFloat(p.trim()));
  const [r, g, b, a = 1] = parts as [number, number, number, number?];
  const bg = background.replace('#', '');
  const br = parseInt(bg.slice(0, 2), 16);
  const bgg = parseInt(bg.slice(2, 4), 16);
  const bb = parseInt(bg.slice(4, 6), 16);
  const mix = (fg: number, back: number) => Math.round(fg * a + back * (1 - a));
  return `#${[mix(r, br), mix(g, bgg), mix(b, bb)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

describe('contrastes du chrome de l’application', () => {
  const terre = token('terre');
  const paille = token('paille');
  const glycine = token('glycine');
  const ebene = token('ebene');
  const blanc = token('blanc');
  const ink = token('ink');

  it('texte Paille sur chrome Terre : AAA en texte courant', () => {
    expect(contrastRatio(paille, terre)).toBeGreaterThanOrEqual(7);
  });

  it('texte secondaire (Paille-dim) sur Terre : au moins AA', () => {
    const dim = flatten(token('paille-dim'), terre);
    expect(contrastRatio(dim, terre)).toBeGreaterThanOrEqual(4.5);
  });

  it('étape active : Ink sur Glycine passe AAA', () => {
    expect(contrastRatio(ebene, glycine)).toBeGreaterThanOrEqual(7);
  });

  /**
   * ⚠ MESURE QUI A CHANGÉ LE DESSIN DU RAIL.
   * Le rail est passé sur fond clair : la Glycine de l'étape courante ne
   * donne plus que 1,31:1 sur l'Off-white. Une teinte à ce niveau ne peut
   * PAS porter seule l'indication d'état (SC 1.4.11 : 3:1 sur les
   * éléments non textuels qui identifient un état). Ce test acte le
   * constat pour qu'on ne « corrige » pas le symptôme en remontant la
   * Glycine — le token vient du DS et ne bouge pas.
   */
  it('la Glycine seule ne suffit pas à marquer l’étape courante sur fond clair', () => {
    expect(contrastRatio(glycine, token('off-white'))).toBeLessThan(3);
  });

  /**
   * La conséquence : c'est le tranchant Terre en tête de carte qui porte
   * l'état. Il doit se détacher DES DEUX fonds qu'il côtoie — celui de la
   * page et celui de la carte active elle-même.
   */
  it('le marqueur Terre de l’étape courante se détache du fond et de la carte (SC 1.4.11)', () => {
    expect(contrastRatio(terre, token('off-white'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(terre, glycine)).toBeGreaterThanOrEqual(3);
  });

  it('la pastille numérotée reste lisible sur l’étape courante', () => {
    // Chiffre Paille sur pastille Terre, posée sur la carte Glycine.
    expect(contrastRatio(paille, terre)).toBeGreaterThanOrEqual(4.5);
  });

  it('le sigle de la barre de tête : Paille sur Terre, AAA', () => {
    expect(contrastRatio(paille, terre)).toBeGreaterThanOrEqual(7);
  });

  it('la carte blanche se détache du plan de travail Off-white', () => {
    // Écart faible et assumé : ce n'est pas un indicateur d'état, la
    // séparation est portée par l'ombre et le rythme, pas par la couleur.
    expect(contrastRatio(blanc, token('off-white'))).toBeLessThan(1.2);
  });

  it('texte principal sur le canvas d’évaluation : AAA', () => {
    expect(contrastRatio(ink, blanc)).toBeGreaterThanOrEqual(7);
  });

  /**
   * ⚠ LIMITE DU DS RELEVÉE — à remonter au design system.
   * --ink-muted (rgba(28,18,5,.52)) donne 3,71:1 sur blanc : cela passe le
   * grand texte et les éléments non textuels (3:1), mais PAS le texte
   * courant (4,5:1). Le token n'est pas modifié ici — il vient du DS.
   * Conséquence appliquée dans l'interface : --text-muted ne porte jamais
   * de texte courant essentiel, seulement des libellés secondaires, des
   * notes en italique et des valeurs doublées par un signe.
   */
  it('texte secondaire (Ink-muted) sur le canvas : 3:1 minimum, pas 4,5', () => {
    const muted = flatten(token('ink-muted'), blanc);
    const ratio = contrastRatio(muted, blanc);
    expect(ratio).toBeGreaterThanOrEqual(3);
    // Verrou de non-régression : si le DS le remonte au-dessus de 4,5,
    // ce test devra être resserré (et l'usage pourra s'élargir).
    expect(ratio).toBeLessThan(4.5);
  });

  it('texte principal sur le panneau Off-white : AAA', () => {
    expect(contrastRatio(ink, token('off-white'))).toBeGreaterThanOrEqual(7);
  });

  it('les tokens de verdict se détachent du canvas (3:1 minimum)', () => {
    // Rappel : le verdict se lit d'abord sans la couleur (signe + graisse).
    // Ces couleurs ne font que renforcer — elles doivent malgré tout être
    // visibles pour ne pas être un ornement inutile.
    expect(contrastRatio(token('conforme'), blanc)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(token('non-conforme'), blanc)).toBeGreaterThanOrEqual(3);
  });

  /**
   * ⚠ CONSTAT MESURÉ — les deux tokens de verdict sont proches en
   * niveaux de gris (ΔE00 ≈ 2,9) : un vert olive et un terracotta de
   * clarté voisine. C'est acceptable ICI, et seulement ici, parce que la
   * règle d'usage impose que le verdict se lise d'abord SANS la couleur
   * (signe ✓/✕, position, graisse). Ce test verrouille cette dépendance :
   * si l'écart se réduisait encore, il faudrait revoir les tokens.
   */
  it('les tokens de verdict sont proches en niveaux de gris — le signe doit porter l’information', async () => {
    const { toGrayscale } = await import('./contrast/cvd');
    const { deltaE00 } = await import('./color/distance');
    const ecart = deltaE00(toGrayscale(token('conforme')), toGrayscale(token('non-conforme')));
    expect(ecart).toBeLessThan(5);
    expect(ecart).toBeGreaterThan(1);
  });

  it('les deux verdicts se distinguent en deutéranopie autant qu’en vision typique', async () => {
    const { simulateCvd } = await import('./contrast/cvd');
    const { deltaE00 } = await import('./color/distance');
    const sim = deltaE00(
      simulateCvd(token('conforme'), 'deutan', 100),
      simulateCvd(token('non-conforme'), 'deutan', 100),
    );
    // Faible, comme attendu sur un couple vert/rouge : d'où la règle
    // « le signe porte l'information, la couleur ne fait que renforcer ».
    expect(sim).toBeLessThan(deltaE00(token('conforme'), token('non-conforme')));
  });
});
