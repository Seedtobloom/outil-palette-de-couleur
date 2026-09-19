/**
 * Nommage et conversion CMJN — les deux briques de la fiche couleur.
 */
import { describe, expect, it } from 'vitest';
import { nommeCouleur, nommePalette } from './nommage';
import { rgbToCmjn, formatCmjn } from './cmjn';

describe('nommage des couleurs', () => {
  it('nomme les couleurs de la marque de façon reconnaissable', () => {
    // Terre : un brun foncé et rabattu.
    expect(nommeCouleur('#412f21')).toMatch(/Ocre|Terracotta|Orange/);
    // Glycine : un violet très clair.
    expect(nommeCouleur('#e4d1fe')).toMatch(/Indigo|Violet|Bleu/);
  });

  it('nomme les neutres par leur clarté, sans teinte', () => {
    expect(nommeCouleur('#000000')).toBe('Encre');
    expect(nommeCouleur('#ffffff')).toBe('Blanc cassé');
    expect(nommeCouleur('#808080')).toBe('Gris');
  });

  it('ne donne jamais de nom de teinte à un gris', () => {
    for (const gris of ['#111111', '#333333', '#777777', '#bbbbbb', '#eeeeee']) {
      expect(nommeCouleur(gris)).not.toMatch(/Rouge|Bleu|Vert|Jaune|Violet/);
    }
  });

  it('qualifie la clarté', () => {
    const fonce = nommeCouleur('#1a2a5e');
    const clair = nommeCouleur('#c9d4f5');
    expect(fonce).not.toBe(clair);
    expect(`${fonce} ${clair}`).toMatch(/nuit|profond|foncé|clair|pâle|poudré/);
  });

  it('rend toujours un nom, même sur une valeur illisible', () => {
    expect(nommeCouleur('pas une couleur')).toBe('Couleur');
  });

  it('ne perd jamais une couleur à cause d’un nom en double', () => {
    const noms = nommePalette(['#808080', '#818181', '#828282']);
    expect(new Set(noms).size).toBe(3);
  });

  it('laisse les noms distincts tranquilles', () => {
    const noms = nommePalette(['#000000', '#ffffff']);
    expect(noms).toEqual(['Encre', 'Blanc cassé']);
  });
});

describe('conversion CMJN', () => {
  it('convertit le blanc et le noir', () => {
    expect(rgbToCmjn('#ffffff')).toEqual({ c: 0, m: 0, j: 0, n: 0 });
    expect(rgbToCmjn('#000000')).toEqual({ c: 0, m: 0, j: 0, n: 100 });
  });

  it('convertit les primaires', () => {
    expect(rgbToCmjn('#ff0000')).toEqual({ c: 0, m: 100, j: 100, n: 0 });
    expect(rgbToCmjn('#00ff00')).toEqual({ c: 100, m: 0, j: 100, n: 0 });
    expect(rgbToCmjn('#0000ff')).toEqual({ c: 100, m: 100, j: 0, n: 0 });
  });

  it('reste dans les bornes 0–100', () => {
    for (const hex of ['#412f21', '#f2e5c2', '#e4d1fe', '#7f3a12', '#0a0a0a']) {
      const v = rgbToCmjn(hex)!;
      for (const composante of [v.c, v.m, v.j, v.n]) {
        expect(composante).toBeGreaterThanOrEqual(0);
        expect(composante).toBeLessThanOrEqual(100);
      }
    }
  });

  it('rend null sur une valeur illisible', () => {
    expect(rgbToCmjn('nawak')).toBeNull();
  });

  it('se formate pour l’affichage', () => {
    expect(formatCmjn({ c: 12, m: 40, j: 78, n: 5 })).toBe('C 12 · M 40 · J 78 · N 5');
  });
});
