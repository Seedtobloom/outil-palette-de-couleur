/**
 * Les réglages d'harmonie. Ce sont des transformations qui touchent
 * TOUTE la palette d'un coup : les invariants comptent plus que les
 * valeurs exactes.
 */
import { describe, expect, it } from 'vitest';
import {
  appliqueReglages,
  libelleLuminosite,
  libelleSaturation,
  libelleTemperature,
  reglagesNeutres,
  REGLAGES_NEUTRES,
  type Reglages,
} from './reglages';
import { parseToOklch } from '../color/space';

const PALETTE = [
  { id: 'a', hex: '#412f21' },
  { id: 'b', hex: '#f2e5c2' },
  { id: 'c', hex: '#e4d1fe' },
  { id: 'd', hex: '#2f7d4f' },
];

const avec = (r: Partial<Reglages>): Reglages => ({ ...REGLAGES_NEUTRES, ...r });
const ok = (hex: string) => parseToOklch(hex)!;

describe('réglages d’harmonie', () => {
  it('ne change rien quand tous les curseurs sont à zéro', () => {
    expect(appliqueReglages(PALETTE, REGLAGES_NEUTRES)).toEqual(PALETTE.map((c) => c.hex));
  });

  it('rend autant de couleurs qu’il en reçoit, dans le même ordre', () => {
    const out = appliqueReglages(PALETTE, avec({ saturation: 40, luminosite: -20 }));
    expect(out).toHaveLength(PALETTE.length);
  });

  /** L'invariant central : un verrou est un verrou. */
  it('ne déplace jamais une couleur verrouillée', () => {
    const avecVerrou = PALETTE.map((c, i) => (i === 0 ? { ...c, verrou: true } : c));
    const out = appliqueReglages(
      avecVerrou,
      avec({ saturation: -100, luminosite: 100, temperature: 100, force: 100, schema: 'triadique' }),
    );
    expect(out[0]).toBe('#412f21');
    // …et les autres, si : le réglage n'est pas devenu inopérant.
    expect(out.slice(1)).not.toEqual(PALETTE.slice(1).map((c) => c.hex));
  });

  it('la saturation à −100 ramène les couleurs chromatiques au gris', () => {
    const out = appliqueReglages(PALETTE, avec({ saturation: -100 }));
    for (const hex of out) expect(ok(hex).c).toBeLessThan(0.04);
  });

  /**
   * Un gris n'a pas de teinte à harmoniser, à réchauffer ni à saturer.
   * Seule la clarté le concerne — c'est ce que fait la référence, et
   * c'est ce que l'œil attend.
   */
  it('laisse les neutres intacts, sauf sur la clarté', () => {
    const gris = [{ id: 'g', hex: '#808080' }];
    expect(
      appliqueReglages(gris, avec({ force: 100, schema: 'triadique', temperature: 100, saturation: 100 })),
    ).toEqual(['#808080']);
    expect(appliqueReglages(gris, avec({ luminosite: 100 }))[0]).not.toBe('#808080');
  });

  it('la saturation positive intensifie sans toucher la teinte', () => {
    const [source] = PALETTE.slice(3);
    const out = appliqueReglages([source!], avec({ saturation: 60 }));
    const avantC = ok(source!.hex).c;
    const apres = ok(out[0]!);
    expect(apres.c).toBeGreaterThan(avantC);
    expect(Math.abs(apres.h - ok(source!.hex).h)).toBeLessThan(3);
  });

  it('la luminosité déplace la clarté dans le bon sens, sans écraser', () => {
    const clair = appliqueReglages(PALETTE, avec({ luminosite: 80 }));
    const sombre = appliqueReglages(PALETTE, avec({ luminosite: -80 }));
    for (let i = 0; i < PALETTE.length; i++) {
      expect(ok(clair[i]!).l).toBeGreaterThan(ok(sombre[i]!).l);
      expect(ok(clair[i]!).l).toBeLessThanOrEqual(1);
      expect(ok(sombre[i]!).l).toBeGreaterThan(0);
    }
  });

  it('la température réchauffe ou refroidit, et laisse les neutres tranquilles', () => {
    const froid = appliqueReglages([{ id: 'x', hex: '#2f7d4f' }], avec({ temperature: -100 }));
    const chaud = appliqueReglages([{ id: 'x', hex: '#2f7d4f' }], avec({ temperature: 100 }));
    expect(ok(froid[0]!).h).not.toBeCloseTo(ok(chaud[0]!).h, 1);

    // Un gris n'a pas de teinte : le réchauffer n'aurait aucun sens.
    const gris = appliqueReglages([{ id: 'g', hex: '#808080' }], avec({ temperature: 100 }));
    expect(ok(gris[0]!).c).toBeLessThan(0.03);
  });

  it('l’harmonisation rapproche les teintes des pôles du schéma', () => {
    const eparse = [
      { id: 'a', hex: '#c0392b' },
      { id: 'b', hex: '#2f7d4f' },
      { id: 'c', hex: '#2b5fc0' },
    ];
    /**
     * Étendue CIRCULAIRE : le plus petit arc qui contient toutes les
     * teintes. Une simple différence min/max mentirait dès que le groupe
     * chevauche 0° — trois teintes à 350°, 5° et 20° sont serrées, pas
     * étalées sur 330°.
     */
    const etendue = (hexes: string[]) => {
      const teintes = hexes.map((h) => ok(h).h).sort((x, y) => x - y);
      let plusGrandTrou = 0;
      for (let i = 0; i < teintes.length; i++) {
        const suivant = teintes[(i + 1) % teintes.length] as number;
        const trou = (((suivant - (teintes[i] as number)) % 360) + 360) % 360;
        plusGrandTrou = Math.max(plusGrandTrou, trou);
      }
      return 360 - plusGrandTrou;
    };
    const ecartMax = etendue;
    const serre = appliqueReglages(eparse, avec({ schema: 'analogue', force: 100 }));
    expect(ecartMax(serre)).toBeLessThan(ecartMax(eparse.map((c) => c.hex)));
  });

  it('la force à zéro n’harmonise pas, même avec un schéma choisi', () => {
    expect(appliqueReglages(PALETTE, avec({ schema: 'triadique', force: 0 }))).toEqual(
      PALETTE.map((c) => c.hex),
    );
  });

  it('borne les valeurs hors plage au lieu de produire n’importe quoi', () => {
    const out = appliqueReglages(PALETTE, avec({ saturation: 9999, luminosite: -9999 }));
    for (const hex of out) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('rend toujours des couleurs dans le gamut sRGB', () => {
    const out = appliqueReglages(PALETTE, avec({ saturation: 100, luminosite: 50 }));
    for (const hex of out) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('laisse passer une couleur illisible sans planter', () => {
    expect(appliqueReglages([{ id: 'x', hex: 'nawak' }], avec({ saturation: 50 }))).toEqual([
      'nawak',
    ]);
  });
});

describe('libellés des curseurs', () => {
  it('disent le sens, pas seulement le chiffre', () => {
    expect(libelleTemperature(0)).toBe('neutre');
    expect(libelleTemperature(40)).toBe('+40 chaud');
    expect(libelleTemperature(-40)).toBe('40 froid');
    expect(libelleSaturation(0)).toBe('0 %');
    expect(libelleSaturation(25)).toBe('+25 %');
    expect(libelleLuminosite(0)).toBe('équilibrée');
    expect(libelleLuminosite(-15)).toBe('15 foncé');
  });

  it('reconnaît un réglage vierge', () => {
    expect(reglagesNeutres(REGLAGES_NEUTRES)).toBe(true);
    expect(reglagesNeutres(avec({ force: 10 }))).toBe(false);
  });
});
