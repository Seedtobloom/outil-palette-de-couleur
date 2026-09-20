/**
 * L'export CSS du nuancier.
 *
 * Ce module existe parce que l'ancien export descendait d'une couleur de
 * base fantôme et rendait un fichier sans rapport avec le nuancier
 * affiché. Le premier test est donc le plus important : ce qui sort doit
 * contenir les couleurs qu'on a mises dedans, et rien d'autre.
 */
import { describe, expect, it } from 'vitest';
import { enIdentifiant, exportNuancierCss } from './nuancier-css';

const NUANCIER = [
  { hex: '#412F21', label: 'Terre' },
  { hex: '#F2E5C2', label: 'Paille' },
  { hex: '#E4D1FE', label: 'Glycine' },
  { hex: '#F8F6F2', label: 'Off-white' },
  { hex: '#1C1205', label: 'Ébène' },
];
const IDS = ['a', 'b', 'c', 'd', 'e'];

describe('identifiants CSS', () => {
  it('translittère les accents et met en minuscules', () => {
    expect(enIdentifiant('Ébène')).toBe('ebene');
    expect(enIdentifiant('Off-white')).toBe('off-white');
    expect(enIdentifiant('Bleu Nuit')).toBe('bleu-nuit');
  });

  it('nettoie la ponctuation et les bords', () => {
    expect(enIdentifiant('  Rouge (vif) !  ')).toBe('rouge-vif');
    expect(enIdentifiant('—')).toBe('couleur');
  });

  /** Un identifiant CSS ne peut pas commencer par un chiffre. */
  it('préfixe les noms qui commencent par un chiffre', () => {
    expect(enIdentifiant('404')).toBe('c-404');
    expect(enIdentifiant('2e gris')).toBe('c-2e-gris');
  });
});

describe('export CSS du nuancier', () => {
  it('sort une variable par couleur, avec son nom', () => {
    const css = exportNuancierCss(NUANCIER);
    expect(css).toContain('--terre: #412F21;');
    expect(css).toContain('--paille: #F2E5C2;');
    expect(css).toContain('--ebene: #1C1205;');
    expect(css).toContain('/* Off-white */');
  });

  /** Le défaut d'origine, en un test : aucune couleur inventée. */
  it('ne contient aucune couleur absente du nuancier', () => {
    const css = exportNuancierCss(NUANCIER);
    const hex = [...css.matchAll(/#[0-9A-F]{6}/g)].map((m) => m[0]);
    const attendus = new Set(NUANCIER.map((c) => c.hex.toUpperCase()));
    expect(hex.length).toBeGreaterThan(0);
    for (const h of hex) expect(attendus.has(h)).toBe(true);
    expect(css).not.toContain('2563EB');
  });

  it('rend un nuancier vide comme une chaîne vide', () => {
    expect(exportNuancierCss([])).toBe('');
  });

  /**
   * Deux couleurs peuvent porter le même nom. Sans suffixe, la seconde
   * écraserait la première et disparaîtrait du fichier en silence.
   */
  it('désambiguïse les noms en double', () => {
    const css = exportNuancierCss([
      { hex: '#111111', label: 'Gris' },
      { hex: '#222222', label: 'Gris' },
    ]);
    expect(css).toContain('--gris: #111111;');
    expect(css).toContain('--gris-2: #222222;');
  });

  it('note le ton direct quand il est saisi', () => {
    const css = exportNuancierCss([{ hex: '#412F21', label: 'Terre', tonDirect: '476 C' }]);
    expect(css).toContain('ton direct 476 C');
  });

  describe('rôles', () => {
    it('pointent vers les couleurs au lieu de recopier leur valeur', () => {
      const css = exportNuancierCss(NUANCIER, {
        ids: IDS,
        roles: { a: 'hero', c: 'accent', d: 'neutre-claire', e: 'neutre-foncee' },
      });
      expect(css).toContain('--dominante: var(--terre);');
      expect(css).toContain('--accent: var(--glycine);');
      expect(css).toContain('--neutre-claire: var(--off-white);');
      expect(css).toContain('--neutre-foncee: var(--ebene);');
    });

    it('n’écrit pas de bloc de rôles quand aucun n’est attribué', () => {
      const css = exportNuancierCss(NUANCIER, { ids: IDS, roles: {} });
      expect(css).not.toContain('Rôles');
    });

    it('ignore un rôle pointant vers une couleur supprimée', () => {
      const css = exportNuancierCss(NUANCIER, { ids: IDS, roles: { zz: 'hero' } });
      expect(css).not.toContain('--dominante');
    });
  });

  describe('associations', () => {
    const ASSOC = [
      { texte: { hex: '#412F21', label: 'Terre' }, fond: { hex: '#F2E5C2', label: 'Paille' } },
    ];

    it('les liste avec leur ratio et leur verdict', () => {
      const css = exportNuancierCss(NUANCIER, { associations: ASSOC });
      expect(css).toContain('Terre sur Paille');
      // Terre sur Paille vaut 10,13:1 — au-delà de 7, donc AAA.
      expect(css).toContain('10,13:1');
      expect(css).toContain('AAA');
    });

    it('n’écrit rien quand rien n’a été retenu', () => {
      expect(exportNuancierCss(NUANCIER, { associations: [] })).not.toContain('Associations');
    });
  });

  /**
   * Un nom de couleur qui contient une fin de commentaire refermerait le
   * bloc et casserait le fichier. Le bug a réellement été commis dans le
   * commentaire de la fonction qui s'en protège.
   */
  it('neutralise une fin de commentaire glissée dans un nom', () => {
    const piege = '*' + '/ body { display: none }';
    const css = exportNuancierCss([{ hex: '#000000', label: `Terre ${piege}` }]);
    expect(css).not.toContain(piege);
    expect(css).toContain('* /');
  });

  /** Le fichier doit rester du CSS valide : accolades équilibrées. */
  it('produit un bloc :root bien fermé', () => {
    const css = exportNuancierCss(NUANCIER, {
      ids: IDS,
      roles: { a: 'hero' },
      associations: [
        { texte: { hex: '#412F21', label: 'Terre' }, fond: { hex: '#F8F6F2', label: 'Off' } },
      ],
    });
    expect((css.match(/\{/g) ?? []).length).toBe(1);
    expect((css.match(/\}/g) ?? []).length).toBe(1);
    expect(css.indexOf('{')).toBeLessThan(css.indexOf('}'));
    // Les associations viennent APRÈS la fermeture : ce sont des
    // commentaires de haut niveau, pas des déclarations.
    expect(css.indexOf('Associations validées')).toBeGreaterThan(css.indexOf('}'));
  });
});
