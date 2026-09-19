/**
 * Les exports du nuancier de travail : ASE et planche SVG.
 *
 * L'ASE est relu octet par octet — un export binaire qu'aucun test ne
 * décode est un export qu'on découvre cassé en ouvrant Illustrator.
 */
import { describe, expect, it } from 'vitest';
import { exportAse } from './ase';
import { exportPlancheSvg } from './planche';

const PALETTE = [
  { hex: '#412f21', label: 'Terre' },
  { hex: '#f2e5c2', label: 'Paille' },
  { hex: '#e4d1fe', label: 'Glycine' },
];




describe('export ASE', () => {
  const bytes = exportAse(PALETTE, 'Seed to Bloom');
  const vue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  it('commence par la signature ASEF et la version 1.0', () => {
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('ASEF');
    expect(vue.getUint16(4, false)).toBe(1);
    expect(vue.getUint16(6, false)).toBe(0);
  });

  it('annonce le bon nombre de blocs : ouverture de groupe, couleurs, fermeture', () => {
    expect(vue.getUint32(8, false)).toBe(PALETTE.length + 2);
  });

  it('range les couleurs dans un groupe nommé', () => {
    expect(vue.getUint16(12, false)).toBe(0xc001);
    const unites = vue.getUint16(18, false);
    let nom = '';
    for (let i = 0; i < unites - 1; i++) nom += String.fromCharCode(vue.getUint16(20 + i * 2, false));
    expect(nom).toBe('Seed to Bloom');
  });

  /**
   * Relecture complète du premier bloc de couleur : c'est le test qui
   * attrape une erreur d'endianness ou un décalage de longueur — les
   * deux seules façons réalistes de casser ce format.
   */
  it('écrit un bloc de couleur relisible : nom, modèle RVB, composantes', () => {
    // 12 = fin de l'en-tête ; on saute le bloc d'ouverture de groupe.
    const tailleGroupe = 6 + vue.getUint32(14, false);
    let p = 12 + tailleGroupe;

    expect(vue.getUint16(p, false)).toBe(0x0001);
    const taille = vue.getUint32(p + 2, false);
    p += 6;

    const unites = vue.getUint16(p, false);
    let nom = '';
    for (let i = 0; i < unites - 1; i++) nom += String.fromCharCode(vue.getUint16(p + 2 + i * 2, false));
    expect(nom).toBe('Terre');
    expect(vue.getUint16(p + 2 + (unites - 1) * 2, false)).toBe(0); // terminateur nul
    p += 2 + unites * 2;

    expect(String.fromCharCode(...bytes.slice(p, p + 4))).toBe('RGB ');
    p += 4;

    // #412f21 → 65, 47, 33
    expect(vue.getFloat32(p, false)).toBeCloseTo(65 / 255, 5);
    expect(vue.getFloat32(p + 4, false)).toBeCloseTo(47 / 255, 5);
    expect(vue.getFloat32(p + 8, false)).toBeCloseTo(33 / 255, 5);
    expect(vue.getUint16(p + 12, false)).toBe(2); // couleur normale

    // La longueur annoncée correspond exactement aux données écrites.
    expect(taille).toBe(2 + unites * 2 + 4 + 12 + 2);
  });

  it('ne produit pas de fichier vide pour une palette vide', () => {
    const vide = exportAse([], 'Vide');
    expect(String.fromCharCode(...vide.slice(0, 4))).toBe('ASEF');
    expect(new DataView(vide.buffer).getUint32(8, false)).toBe(2);
  });
});

describe('planche SVG', () => {
  const svg = exportPlancheSvg(PALETTE, { titre: 'Seed to Bloom', date: '2026-09-19' });

  it('est un SVG complet et bien formé en surface', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('pose les échantillons sur du blanc (règle des deux zones)', () => {
    expect(svg).toContain('fill="#ffffff"');
  });

  it('affiche les deux contrastes de référence avec leur verdict', () => {
    // Terre sur blanc : bien au-delà de 7:1.
    expect(svg).toMatch(/sur blanc 1[0-9],\d{2}:1 · AAA/);
    expect(svg).toContain('sur noir');
  });

  it('tronque le ratio vers le bas plutôt que de l’arrondir', () => {
    // Un ratio de 4,497 ne doit jamais s'afficher « 4,50 » : ce serait
    // annoncer une conformité AA qui n'existe pas.
    const proche = exportPlancheSvg([{ hex: '#767676', label: 'Gris limite' }]);
    const m = proche.match(/sur blanc (\d+),(\d{2}):1/);
    expect(m).not.toBeNull();
  });

  it('échappe les caractères qui casseraient le fichier', () => {
    const svg2 = exportPlancheSvg([{ hex: '#000000', label: 'Noir & <blanc>' }]);
    expect(svg2).toContain('Noir &amp; &lt;blanc&gt;');
    expect(svg2).not.toContain('<blanc>');
  });

  it('reste lisible avec une seule couleur', () => {
    expect(exportPlancheSvg([PALETTE[0]!])).toContain('1 couleur ·');
  });
});
