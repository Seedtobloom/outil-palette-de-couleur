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
/** La feuille de l'application : c'est elle qui porte le thème sombre,
 *  le bundle DS n'en définit pas. */
const app = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');

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
   * La conséquence : c'est le Terre qui porte l'état, partout où la
   * Glycine sert de fond — la pastille pleine du jalon en cours dans le
   * fil, et le bouton « Continuer » de la carte « prochaine étape ». Il
   * doit se détacher DES DEUX fonds qu'il côtoie : celui de la page et
   * la Glycine elle-même.
   */
  it('le Terre se détache du fond de page et de la Glycine (SC 1.4.11)', () => {
    expect(contrastRatio(terre, token('off-white'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(terre, glycine)).toBeGreaterThanOrEqual(3);
  });

  it('la pastille numérotée du jalon en cours reste lisible', () => {
    // Chiffre Paille sur pastille Terre, posée sur le jalon Glycine.
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

/**
 * Le thème sombre passe les mêmes tests que le thème clair.
 *
 * C'est le point où la plupart des outils lâchent : la bascule sombre
 * est traitée comme une préférence esthétique, et plus personne ne
 * mesure les contrastes obtenus. Ici, les valeurs sont lues directement
 * dans `app.css` — si quelqu'un retouche une teinte, ces tests le
 * signalent.
 */
describe('contrastes du chrome en thème sombre', () => {
  /**
   * Lit une variable dans le bloc `[data-theme='sombre']` d'app.css.
   * Un `var(--paille)` est résolu jusqu'à sa valeur littérale dans le
   * fichier de tokens : c'est ainsi que le thème sombre est écrit, et le
   * test doit mesurer ce qui sera réellement peint.
   */
  function tokenSombre(name: string): string {
    const bloc = app.match(/:root\[data-theme='sombre'\]\s*\{([\s\S]*?)\n\}/);
    if (!bloc) throw new Error('Bloc de thème sombre introuvable dans app.css');
    const match = (bloc[1] as string).match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
    if (!match) throw new Error(`Token sombre --${name} absent`);
    const valeur = (match[1] as string).trim();
    const reference = valeur.match(/^var\(--([a-z0-9-]+)\)$/);
    return reference ? token(reference[1] as string) : valeur;
  }

  const paille = token('paille');
  const terre = token('terre');
  const fondPage = tokenSombre('surface-panel');
  const fondCarte = tokenSombre('surface-canvas');

  it('le texte principal sur le fond de page : AAA', () => {
    expect(contrastRatio(paille, fondPage)).toBeGreaterThanOrEqual(7);
  });

  it('le texte principal sur une carte de chrome : AAA', () => {
    expect(contrastRatio(paille, fondCarte)).toBeGreaterThanOrEqual(7);
  });

  it('le texte secondaire atteint AA — contrairement au token clair', () => {
    // --text-muted du DS ne donne que 3,71:1 sur blanc, et l'usage est
    // restreint en conséquence. Le token sombre, lui, n'est pas imposé
    // par le DS : on le choisit ici, donc on le choisit conforme.
    const muted = flatten(tokenSombre('text-muted'), fondCarte);
    expect(contrastRatio(muted, fondCarte)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * ⚠ MESURE QUI A CHANGÉ LA COULEUR DES BOUTONS EN SOMBRE.
   * Le Terre plein ne donne que 1,4:1 sur un fond presque noir : un
   * bouton principal en Terre y serait invisible en tant que surface
   * (SC 1.4.11). Les surfaces d'action passent donc en Paille, avec du
   * texte Terre — couple déjà AAA.
   */
  it('le Terre ne peut pas servir de surface d’action sur fond sombre', () => {
    expect(contrastRatio(terre, fondPage)).toBeLessThan(3);
  });

  it('la surface d’action retenue se détache du fond de page (SC 1.4.11)', () => {
    expect(contrastRatio(tokenSombre('surface-chrome'), fondPage)).toBeGreaterThanOrEqual(3);
  });

  it('le texte posé sur la surface d’action reste AAA', () => {
    expect(
      contrastRatio(tokenSombre('text-on-chrome'), tokenSombre('surface-chrome')),
    ).toBeGreaterThanOrEqual(7);
  });

  it('l’étape en cours reste lisible : Ébène sur Glycine, et Glycine sur le fond sombre', () => {
    expect(contrastRatio(token('ebene'), token('glycine'))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(token('glycine'), fondPage)).toBeGreaterThanOrEqual(3);
  });

  /**
   * L'invariant de cet outil : quel que soit le thème, la scène où l'on
   * JUGE une couleur reste blanche. Un aplat clair paraît plus lumineux
   * sur fond noir — évaluer dans une interface sombre fausserait la
   * lecture de ce que l'outil est précisément censé mesurer.
   */
  it('la zone d’évaluation rétablit le blanc et l’encre, quel que soit le thème', () => {
    const bloc = app.match(/\.zone-evaluation\s*\{([\s\S]*?)\n\}/);
    expect(bloc).not.toBeNull();
    const regles = bloc![1] as string;
    expect(regles).toMatch(/--surface-canvas:\s*var\(--blanc\)/);
    expect(regles).toMatch(/--text-main:\s*var\(--ink\)/);
    expect(regles).toMatch(/--surface-chrome:\s*var\(--terre\)/);
  });
});
