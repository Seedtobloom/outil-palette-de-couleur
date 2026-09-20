/**
 * L'aperçu de l'étape Exporter.
 *
 * Deux règles, dans cet ordre, et tout le fichier tourne autour :
 *
 * 1. n'afficher que des duos texte/fond RETENUS à l'étape Contraste.
 *    L'aperçu classait les couleurs par clarté et posait le texte sur la
 *    deuxième plus claire — d'où une carte en gris moyen portant un
 *    rouge de marque, duo que personne n'avait validé ;
 * 2. prendre les fonds et le bouton dans les RÔLES de l'étape 4, qui
 *    disent exactement ça.
 */
import { describe, expect, it } from 'vitest';
import { composeApercu, type DuoValide, type EntreeApercu } from './apercu';
import { contrastRatio } from '../contrast/wcag';

const TERRE = { hex: '#412F21', label: 'Terre' };
const PAILLE = { hex: '#F2E5C2', label: 'Paille' };
const GLYCINE = { hex: '#E4D1FE', label: 'Glycine' };
const OFF_WHITE = { hex: '#F8F6F2', label: 'Off-white' };
const EBENE = { hex: '#1C1205', label: 'Ébène' };

const NUANCIER: EntreeApercu[] = [
  { ...TERRE, role: 'hero' },
  PAILLE,
  { ...GLYCINE, role: 'accent' },
  { ...OFF_WHITE, role: 'neutre-claire' },
  { ...EBENE, role: 'neutre-foncee' },
];

/** Ce que donnerait un vrai passage à l'étape Contraste. */
const DUOS: DuoValide[] = [
  { texte: TERRE, fond: PAILLE },
  { texte: EBENE, fond: PAILLE },
  { texte: PAILLE, fond: TERRE },
  { texte: OFF_WHITE, fond: TERRE },
  { texte: TERRE, fond: OFF_WHITE },
];

function toutes(vue: NonNullable<ReturnType<typeof composeApercu>>) {
  return [vue.fond, vue.carte, vue.texte, vue.detail, vue.action, vue.surAction];
}

describe('aperçu', () => {
  it('n’utilise que des couleurs du nuancier', () => {
    const connus = new Set(NUANCIER.map((c) => c.hex));
    for (const mode of ['clair', 'sombre'] as const) {
      const vue = composeApercu(NUANCIER, mode, DUOS)!;
      for (const c of toutes(vue)) expect(connus.has(c.hex)).toBe(true);
    }
  });

  describe('les associations retenues commandent', () => {
    /** Le cœur de la demande : aucun duo non validé à l'écran. */
    it('ne compose que des duos retenus', () => {
      const retenus = new Set(DUOS.map((d) => `${d.texte.hex}|${d.fond.hex}`));
      for (const mode of ['clair', 'sombre'] as const) {
        const vue = composeApercu(NUANCIER, mode, DUOS)!;
        expect(retenus.has(`${vue.texte.hex}|${vue.carte.hex}`)).toBe(true);
        expect(retenus.has(`${vue.detail.hex}|${vue.carte.hex}`)).toBe(true);
        expect(vue.valide).toBe(true);
      }
    });

    it('prend la carte parmi les fonds validés, pas la plus claire du nuancier', () => {
      const vue = composeApercu(NUANCIER, 'clair', DUOS)!;
      // Off-white est plus claire que Paille, mais les deux sont des
      // fonds validés : c'est la plus claire DES VALIDÉS qui sort.
      expect(vue.carte.label).toBe('Off-white');
    });

    /**
     * Le cas de la capture qui a motivé la reprise : une couleur non
     * validée comme fond ne doit pas devenir la carte, même si le tri
     * par clarté la désignait.
     */
    it('écarte un fond jamais validé', () => {
      const duos: DuoValide[] = [{ texte: EBENE, fond: PAILLE }];
      const vue = composeApercu(NUANCIER, 'clair', duos)!;
      expect(vue.carte.label).toBe('Paille');
      expect(vue.texte.label).toBe('Ébène');
    });

    it('prend pour détail le duo validé le plus discret qui tient AA', () => {
      const vue = composeApercu(NUANCIER, 'clair', DUOS)!;
      expect(vue.detail.hex).not.toBe(vue.carte.hex);
      expect(contrastRatio(vue.detail.hex, vue.carte.hex)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(vue.detail.hex, vue.carte.hex)).toBeLessThanOrEqual(
        contrastRatio(vue.texte.hex, vue.carte.hex),
      );
    });

    /**
     * Un seul duo validé sur cette carte : le détail reprend la couleur
     * du texte plutôt que d'aller chercher une teinte non vérifiée.
     */
    it('retombe sur la couleur du texte faute de second duo', () => {
      const duos: DuoValide[] = [{ texte: TERRE, fond: PAILLE }];
      const vue = composeApercu(NUANCIER, 'clair', duos)!;
      expect(vue.detail.hex).toBe(vue.texte.hex);
    });

    it('signale une composition non validée', () => {
      const vue = composeApercu(NUANCIER, 'clair', [])!;
      expect(vue.valide).toBe(false);
    });
  });

  describe('les rôles commandent', () => {
    /** La neutre claire EST la surface du mode clair : c'est sa définition. */
    it('fait la carte du mode clair avec la neutre claire', () => {
      const vue = composeApercu(NUANCIER, 'clair', DUOS)!;
      expect(vue.carte.label).toBe('Off-white');
    });

    it('fait la carte du mode sombre avec la neutre foncée', () => {
      const duos: DuoValide[] = [...DUOS, { texte: PAILLE, fond: EBENE }];
      const vue = composeApercu(NUANCIER, 'sombre', duos)!;
      expect(vue.carte.label).toBe('Ébène');
    });

    /**
     * Le rôle est une préférence, pas un ordre. S'il désigne une couleur
     * qu'aucune association n'a validée comme fond, on n'y pose pas de
     * texte pour autant.
     */
    it('n’impose pas un rôle jamais validé comme fond', () => {
      const duos: DuoValide[] = [{ texte: PAILLE, fond: TERRE }];
      const vue = composeApercu(NUANCIER, 'sombre', duos)!;
      // Ébène porte le rôle, mais n'a jamais servi de fond validé.
      expect(vue.carte.label).toBe('Terre');
    });

    it('fait le bouton avec la dominante quand elle tient sur la carte', () => {
      const duos: DuoValide[] = [{ texte: PAILLE, fond: OFF_WHITE }];
      const vue = composeApercu(NUANCIER, 'clair', duos)!;
      expect(vue.action.label).toBe('Terre');
    });

    /**
     * Le bug attrapé au navigateur : en mode sombre la carte EST souvent
     * la dominante, et le bouton sortait dans la couleur du fond qui le
     * porte. Invisible.
     */
    it('ne pose pas le bouton dans la couleur de la carte', () => {
      for (const mode of ['clair', 'sombre'] as const) {
        const vue = composeApercu(NUANCIER, mode, DUOS)!;
        expect(vue.action.hex).not.toBe(vue.carte.hex);
        // SC 1.4.11 : un élément non textuel se détache à 3:1.
        expect(contrastRatio(vue.action.hex, vue.carte.hex)).toBeGreaterThanOrEqual(3);
      }
    });

    it('bascule sur l’accent quand la dominante se confond avec la carte', () => {
      const duos: DuoValide[] = [{ texte: PAILLE, fond: TERRE }];
      const vue = composeApercu(NUANCIER, 'sombre', duos)!;
      expect(vue.carte.label).toBe('Terre');
      expect(vue.action.label).toBe('Glycine');
    });

    it('préfère un texte validé pour l’intitulé du bouton', () => {
      const duos: DuoValide[] = [
        { texte: PAILLE, fond: OFF_WHITE },
        { texte: OFF_WHITE, fond: TERRE },
      ];
      const vue = composeApercu(NUANCIER, 'clair', duos)!;
      expect(vue.action.label).toBe('Terre');
      expect(vue.surAction.label).toBe('Off-white');
    });
  });

  describe('replis', () => {
    it('trie par clarté quand rien n’a encore été décidé', () => {
      const nus: EntreeApercu[] = [TERRE, PAILLE, GLYCINE, OFF_WHITE, EBENE];
      expect(composeApercu(nus, 'clair', [])!.carte.label).toBe('Off-white');
      expect(composeApercu(nus, 'sombre', [])!.carte.label).toBe('Ébène');
    });

    it('refuse de composer sous deux couleurs', () => {
      expect(composeApercu([], 'clair')).toBeNull();
      expect(composeApercu([TERRE], 'clair')).toBeNull();
    });

    /**
     * La page ne doit pas trancher plus fort avec la carte qu'un texte :
     * la carte ressortirait comme un aplat de couleur. Faute de neutre
     * assez proche, la page reprend la couleur de la carte, et le filet
     * de la carte suffit à la détacher.
     */
    it('ne pose pas la carte sur une page qui jure avec elle', () => {
      const duos: DuoValide[] = [{ texte: PAILLE, fond: TERRE }];
      const sansNeutre: EntreeApercu[] = [TERRE, PAILLE, OFF_WHITE];
      const vue = composeApercu(sansNeutre, 'sombre', duos)!;
      expect(contrastRatio(vue.fond.hex, vue.carte.hex)).toBeLessThanOrEqual(4.5);
    });
  });

  describe('la page derrière la carte', () => {
    /** La convention des surfaces posées, dans les deux modes. */
    it('est toujours plus sombre que la carte, ou identique', () => {
      for (const mode of ['clair', 'sombre'] as const) {
        const vue = composeApercu(NUANCIER, mode, DUOS)!;
        const l = (h: string) => contrastRatio(h, '#FFFFFF');
        // Plus une couleur est sombre, plus elle contraste avec le blanc.
        expect(l(vue.fond.hex)).toBeGreaterThanOrEqual(l(vue.carte.hex));
      }
    });

    /**
     * Le défaut repéré sur la capture d'un nuancier de gris et de
     * carmin : la page sortait EN CARMIN, parce que le carmin se
     * trouvait être la couleur la plus sombre disponible. Une page est
     * un neutre, pas une couleur de marque.
     */
    it('n’est jamais une couleur franche', () => {
      const gris: EntreeApercu[] = [
        { hex: '#FBF7EF', label: 'Crème', role: 'neutre-claire' },
        { hex: '#E8E4DC', label: 'Gris clair' },
        { hex: '#2B2B2B', label: 'Gris foncé', role: 'neutre-foncee' },
        { hex: '#8E0C22', label: 'Carmin', role: 'hero' },
      ];
      const duos: DuoValide[] = [
        { texte: { hex: '#2B2B2B', label: 'Gris foncé' }, fond: { hex: '#FBF7EF', label: 'Crème' } },
        { texte: { hex: '#FBF7EF', label: 'Crème' }, fond: { hex: '#2B2B2B', label: 'Gris foncé' } },
      ];
      for (const mode of ['clair', 'sombre'] as const) {
        const vue = composeApercu(gris, mode, duos)!;
        expect(vue.fond.label).not.toBe('Carmin');
      }
    });

    it('reste discrète : jamais plus de AA d’écart avec la carte', () => {
      for (const mode of ['clair', 'sombre'] as const) {
        const vue = composeApercu(NUANCIER, mode, DUOS)!;
        expect(contrastRatio(vue.fond.hex, vue.carte.hex)).toBeLessThanOrEqual(4.5);
      }
    });

    it('laisse voir un ratio insuffisant au lieu d’inventer une couleur', () => {
      const fades: EntreeApercu[] = [
        { hex: '#CFCFCF', label: 'Gris clair' },
        { hex: '#DADADA', label: 'Gris très clair' },
        { hex: '#C4C4C4', label: 'Gris moyen' },
      ];
      const vue = composeApercu(fades, 'clair', [])!;
      expect(vue.ratioTexte).toBeLessThan(4.5);
      const connus = new Set(fades.map((c) => c.hex));
      for (const c of toutes(vue)) expect(connus.has(c.hex)).toBe(true);
    });
  });
});
