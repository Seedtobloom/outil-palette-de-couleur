/**
 * L'aperçu de l'étape Exporter.
 *
 * La règle unique, et la raison d'être du module : toute couleur montrée
 * doit venir du nuancier. L'aperçu précédent affichait un thème généré
 * autour d'une couleur de base fantôme — du bleu sur une palette brune.
 */
import { describe, expect, it } from 'vitest';
import { composeApercu, type CouleurApercu } from './apercu';
import { contrastRatio } from '../contrast/wcag';

const NUANCIER: CouleurApercu[] = [
  { hex: '#412F21', label: 'Terre' },
  { hex: '#F2E5C2', label: 'Paille' },
  { hex: '#E4D1FE', label: 'Glycine' },
  { hex: '#F8F6F2', label: 'Off-white' },
  { hex: '#1C1205', label: 'Ébène' },
];

function toutesLesCouleurs(vue: NonNullable<ReturnType<typeof composeApercu>>): string[] {
  return [vue.fond, vue.carte, vue.texte, vue.detail, vue.action, vue.surAction].map(
    (c) => c.hex,
  );
}

describe('aperçu', () => {
  it('n’utilise que des couleurs du nuancier', () => {
    const connus = new Set(NUANCIER.map((c) => c.hex));
    for (const mode of ['clair', 'sombre'] as const) {
      const vue = composeApercu(NUANCIER, mode);
      expect(vue).not.toBeNull();
      for (const hex of toutesLesCouleurs(vue!)) expect(connus.has(hex)).toBe(true);
    }
  });

  it('prend la plus claire en fond en mode clair', () => {
    const vue = composeApercu(NUANCIER, 'clair')!;
    expect(vue.fond.label).toBe('Off-white');
  });

  it('prend la plus foncée en fond en mode sombre', () => {
    const vue = composeApercu(NUANCIER, 'sombre')!;
    expect(vue.fond.label).toBe('Ébène');
  });

  it('choisit un texte lisible sur la carte', () => {
    for (const mode of ['clair', 'sombre'] as const) {
      const vue = composeApercu(NUANCIER, mode)!;
      expect(vue.ratioTexte).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('utilise la dominante pour le bouton quand elle tient sur la carte', () => {
    const vue = composeApercu(NUANCIER, 'clair', { hex: '#1C1205', label: 'Ébène' })!;
    expect(vue.action.label).toBe('Ébène');
  });

  /**
   * La dominante ne passe pas avant la lisibilité. En mode clair la
   * carte est Paille ; Glycine dessus ne donne que 1,1:1, soit un bouton
   * qu'on ne voit pas. L'aperçu descend alors sur la couleur suivante
   * qui tient — ici Terre.
   */
  it('écarte une dominante qui se confondrait avec la carte', () => {
    const vue = composeApercu(NUANCIER, 'clair', { hex: '#E4D1FE', label: 'Glycine' })!;
    expect(vue.carte.label).toBe('Paille');
    expect(vue.action.label).not.toBe('Glycine');
    expect(contrastRatio(vue.action.hex, vue.carte.hex)).toBeGreaterThanOrEqual(3);
  });

  it('prend la couleur la plus franche qui tient, faute de dominante', () => {
    const vue = composeApercu(NUANCIER, 'clair')!;
    // Glycine est la plus chromatique, mais invisible sur Paille : c'est
    // Terre qui sort, la plus franche parmi celles qui se détachent.
    expect(vue.action.label).toBe('Terre');
  });

  /**
   * Le bug attrapé au navigateur : en mode sombre, la carte est souvent
   * la dominante elle-même, et le bouton sortait dans la couleur exacte
   * du fond sur lequel il est posé. Invisible.
   */
  it('ne pose pas le bouton dans la couleur de la carte', () => {
    for (const mode of ['clair', 'sombre'] as const) {
      const vue = composeApercu(NUANCIER, mode, { hex: '#412F21', label: 'Terre' })!;
      expect(vue.action.hex).not.toBe(vue.carte.hex);
      // SC 1.4.11 : un élément non textuel se détache à 3:1.
      expect(contrastRatio(vue.action.hex, vue.carte.hex)).toBeGreaterThanOrEqual(3);
    }
  });

  it('pose sur le bouton la couleur la plus lisible dessus', () => {
    const vue = composeApercu(NUANCIER, 'clair')!;
    const connus = new Set(NUANCIER.map((c) => c.hex));
    expect(connus.has(vue.surAction.hex)).toBe(true);
    expect(vue.surAction.hex).not.toBe(vue.action.hex);
  });

  it('refuse de composer sous deux couleurs', () => {
    expect(composeApercu([], 'clair')).toBeNull();
    expect(composeApercu([{ hex: '#412F21', label: 'Terre' }], 'clair')).toBeNull();
  });

  /**
   * Une palette qui n'a pas de quoi écrire sur elle-même doit le
   * MONTRER. Le ratio faible ressort tel quel : l'interface s'en sert
   * pour le dire en toutes lettres plutôt que de bricoler un texte
   * lisible qui n'existe pas dans le nuancier.
   */
  it('laisse voir un ratio insuffisant au lieu d’inventer une couleur', () => {
    const fades: CouleurApercu[] = [
      { hex: '#CFCFCF', label: 'Gris clair' },
      { hex: '#DADADA', label: 'Gris très clair' },
      { hex: '#C4C4C4', label: 'Gris moyen' },
    ];
    const vue = composeApercu(fades, 'clair')!;
    expect(vue.ratioTexte).toBeLessThan(4.5);
    const connus = new Set(fades.map((c) => c.hex));
    for (const hex of toutesLesCouleurs(vue)) expect(connus.has(hex)).toBe(true);
  });

  /** Un détail illisible n'est pas un détail : on retombe sur le texte. */
  it('n’atténue pas le détail en dessous de AA', () => {
    const vue = composeApercu(
      [
        { hex: '#FFFFFF', label: 'Blanc' },
        { hex: '#F4F4F4', label: 'Presque blanc' },
        { hex: '#000000', label: 'Noir' },
        { hex: '#EDEDED', label: 'Gris pâle' },
      ],
      'clair',
    )!;
    expect(vue.detail.hex).toBe(vue.texte.hex);
  });
});
