/**
 * L'atelier : construire, trier. La règle commune est qu'une couleur
 * verrouillée survit à tout — c'est ce que ces tests gardent.
 */
import { describe, expect, it } from 'vitest';
import { construitPalette, trieParFamilles, messageTri, libelleTri } from './atelier';
import { parseToOklch } from '../color/space';

const nomme = (_h: string, i: number) => `Couleur ${i + 1}`;
const ok = (hex: string) => parseToOklch(hex)!;

describe('trier par familles de teinte', () => {
  const PALETTE = [
    { hex: '#1b3f8f' }, // bleu foncé
    { hex: '#f2e5c2' }, // paille
    { hex: '#c0392b' }, // rouge
    { hex: '#808080' }, // gris
    { hex: '#a8c8ff' }, // bleu clair
    { hex: '#412f21' }, // brun
  ];

  it('ne perd et n’invente aucune couleur', () => {
    const trie = trieParFamilles(PALETTE, 'clair-fonce');
    expect(trie).toHaveLength(PALETTE.length);
    expect(new Set(trie.map((c) => c.hex))).toEqual(new Set(PALETTE.map((c) => c.hex)));
  });

  it('range les deux bleus côte à côte', () => {
    const trie = trieParFamilles(PALETTE, 'clair-fonce').map((c) => c.hex);
    const i = trie.indexOf('#1b3f8f');
    const j = trie.indexOf('#a8c8ff');
    expect(Math.abs(i - j)).toBe(1);
  });

  it('inverse l’ordre quand on inverse le sens', () => {
    const clair = trieParFamilles(PALETTE, 'clair-fonce').map((c) => c.hex);
    const fonce = trieParFamilles(PALETTE, 'fonce-clair').map((c) => c.hex);
    expect(clair).not.toEqual(fonce);
  });

  it('met les plus claires en tête dans le sens clair → foncé', () => {
    const trie = trieParFamilles(PALETTE, 'clair-fonce');
    const premier = ok(trie[0]!.hex).l;
    const dernier = ok(trie[trie.length - 1]!.hex).l;
    expect(premier).toBeGreaterThan(dernier);
  });

  /** Un rouge à 355° et un rouge à 5° sont la même famille. */
  it('recolle les teintes qui chevauchent 0°', () => {
    const rouges = [{ hex: '#d4304a' }, { hex: '#2f7d4f' }, { hex: '#d45a30' }];
    const trie = trieParFamilles(rouges, 'clair-fonce').map((c) => c.hex);
    const i = trie.indexOf('#d4304a');
    const j = trie.indexOf('#d45a30');
    expect(Math.abs(i - j)).toBe(1);
  });

  it('ne touche à rien en dessous de deux couleurs', () => {
    expect(trieParFamilles([{ hex: '#000000' }], 'clair-fonce')).toEqual([{ hex: '#000000' }]);
    expect(trieParFamilles([], 'clair-fonce')).toEqual([]);
  });

  it('annonce le prochain clic, et rend compte du précédent', () => {
    expect(libelleTri('clair-fonce')).toContain('du plus clair au plus foncé');
    expect(libelleTri('fonce-clair')).toContain('du plus foncé au plus clair');
    expect(messageTri('clair-fonce')).toBe('Regroupé par couleur, du plus clair au plus foncé.');
  });
});

describe('construire une palette', () => {
  it('produit une palette utilisable depuis rien', () => {
    const p = construitPalette([], 0, nomme);
    expect(p.length).toBeGreaterThanOrEqual(5);
    for (const c of p) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('couvre le clair, le moyen et le foncé', () => {
    const p = construitPalette([], 0, nomme);
    const clartes = p.map((c) => ok(c.hex).l);
    expect(Math.max(...clartes)).toBeGreaterThan(0.85);
    expect(Math.min(...clartes)).toBeLessThan(0.4);
  });

  /** L'invariant : on construit AUTOUR des couleurs épinglées. */
  it('conserve les couleurs verrouillées, à l’identique et en tête', () => {
    const ancre = { id: 'a', hex: '#412f21', label: 'Terre', verrou: true };
    const libre = { id: 'b', hex: '#123456', label: 'Jetable' };
    const p = construitPalette([ancre, libre], 0, nomme);
    expect(p[0]).toEqual({ hex: '#412f21', label: 'Terre' });
    expect(p.some((c) => c.hex === '#123456')).toBe(false);
  });

  it('suit la teinte de l’ancre verrouillée', () => {
    const ancre = { id: 'a', hex: '#1b6fd4', label: 'Bleu', verrou: true };
    const p = construitPalette([ancre], 0, nomme);
    const teinteAncre = ok('#1b6fd4').h;
    // Au moins une couleur construite reste dans la famille de l'ancre.
    const proches = p
      .slice(1)
      .filter((c) => Math.abs(((ok(c.hex).h - teinteAncre + 540) % 360) - 180) < 45);
    expect(proches.length).toBeGreaterThan(0);
  });

  it('propose autre chose à chaque clic', () => {
    const a = construitPalette([], 0, nomme).map((c) => c.hex);
    const b = construitPalette([], 1, nomme).map((c) => c.hex);
    expect(a).not.toEqual(b);
  });

  /** Déterministe : même graine, même palette. Sinon, rien n'est testable. */
  it('redonne exactement la même palette pour la même graine', () => {
    expect(construitPalette([], 7, nomme)).toEqual(construitPalette([], 7, nomme));
  });

  it('ne produit pas deux fois la même couleur', () => {
    for (const graine of [0, 1, 2, 3, 4]) {
      const p = construitPalette([], graine, nomme);
      expect(new Set(p.map((c) => c.hex)).size).toBe(p.length);
    }
  });

  it('nomme chaque couleur construite', () => {
    const p = construitPalette([], 0, nomme);
    for (const c of p) expect(c.label.length).toBeGreaterThan(0);
  });
});
