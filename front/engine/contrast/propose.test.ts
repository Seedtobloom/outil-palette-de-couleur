import { describe, expect, it } from 'vitest';
import {
  MOUVEMENT_DOUX,
  PLANCHER_INTENSITE,
  TOLERANCE_TEINTE,
  corrigeTout,
  impactSurPalette,
  proposeCorrections,
  usageTenable,
} from './propose';
import { contrastRatio } from './wcag';
import { deltaE00 } from '../color/distance';
import { parseToOklch } from '../color/space';
import { analyzeHarmony } from '../harmony/analysis';

describe('propositions de correction', () => {
  it('ne propose rien quand la paire passe déjà', () => {
    const p = proposeCorrections('#1c1205', '#ffffff', 'texte');
    expect(p.verdict).toBe('passe');
    expect(p.candidats).toHaveLength(0);
  });

  it('propose plusieurs pistes, pas une seule', () => {
    // Bleu moyen sur blanc : rattrapable, et de plusieurs façons.
    const p = proposeCorrections('#7aa2f7', '#ffffff', 'texte');
    expect(p.verdict).toBe('corrigeable');
    expect(p.candidats.length).toBeGreaterThan(1);
  });

  it('propose de changer le fond autant que le texte', () => {
    const p = proposeCorrections('#7aa2f7', '#ffffff', 'texte');
    expect(p.candidats.some((c) => c.cible === 'avant')).toBe(true);
    expect(p.candidats.some((c) => c.cible === 'fond')).toBe(true);
  });

  it('toute piste proposée atteint réellement le seuil', () => {
    for (const [avant, fond] of [
      ['#7aa2f7', '#ffffff'],
      ['#c0392b', '#412f21'],
      ['#aa7c17', '#f1f4fb'],
    ] as const) {
      const p = proposeCorrections(avant, fond, 'texte');
      for (const c of p.candidats) {
        const autre = c.cible === 'avant' ? fond : avant;
        // 4,49 et non 4,5 : le seuil est cherché avec une marge, on
        // tolère l'arrondi du hex final.
        expect(contrastRatio(c.hex, autre)).toBeGreaterThanOrEqual(4.49);
      }
    }
  });

  it('classe les pistes indolores en tête', () => {
    const p = proposeCorrections('#7aa2f7', '#ffffff', 'texte');
    const rang = p.candidats.map((c) => (c.douce ? 0 : c.memeFamille ? 1 : 2));
    expect([...rang].sort((a, b) => a - b)).toEqual(rang);
  });

  it('la piste mise en avant tient la teinte et l’intensité', () => {
    const p = proposeCorrections('#7aa2f7', '#ffffff', 'texte');
    expect(p.meilleur).not.toBeNull();
    expect(p.meilleur!.memeFamille).toBe(true);
    expect(p.meilleur!.douce).toBe(true);
    expect(p.meilleur!.deltaL).toBeLessThanOrEqual(MOUVEMENT_DOUX);

    // Le critère de famille est bien teinte + intensité, PAS le ΔE :
    // un simple assombrissement produit un ΔE élevé et reste pourtant
    // la même couleur. Ce test verrouille ce choix.
    const avant = parseToOklch('#7aa2f7')!;
    const apres = parseToOklch(p.meilleur!.hex)!;
    expect(Math.abs(apres.h - avant.h)).toBeLessThanOrEqual(TOLERANCE_TEINTE);
    expect(apres.c / avant.c).toBeGreaterThanOrEqual(PLANCHER_INTENSITE);
  });

  it('la correction par clarté ne touche ni la teinte ni l’intensité', () => {
    const p = proposeCorrections('#7aa2f7', '#ffffff', 'texte');
    const parClarte = p.candidats.find((c) => c.strategie === 'clarte' && c.cible === 'avant');
    expect(parClarte).toBeDefined();
    const avant = parseToOklch('#7aa2f7')!;
    const apres = parseToOklch(parClarte!.hex)!;
    expect(Math.abs(apres.h - avant.h)).toBeLessThan(2);
  });

  it('annonce le coût au lieu d’inventer une correction indolore', () => {
    // Deux couleurs de clarté très voisine : le rattrapage existe, mais
    // il coûte cher. L'outil doit le dire, pas le masquer.
    const p = proposeCorrections('#8a8f7d', '#9a8f8a', 'texte');
    expect(p.verdict).toBe('cout-eleve');
    expect(p.meilleur).toBeNull();
    expect(p.candidats.length).toBeGreaterThan(0);
    expect(p.diagnostic).toContain('plumes');
  });

  it('redirige vers l’usage que la paire tient réellement', () => {
    // Échoue en texte courant (4,5:1) mais tient le 3:1 non textuel.
    const ratio = contrastRatio('#949494', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
    expect(usageTenable(ratio)).toBe('titre');

    const p = proposeCorrections('#949494', '#ffffff', 'texte');
    expect(p.usageTenable).toBe('titre');
  });

  it('usageTenable rend null quand la paire ne tient aucun seuil', () => {
    expect(usageTenable(1.4)).toBeNull();
  });

  it('un seuil plus permissif rend une paire corrigeable', () => {
    const dur = proposeCorrections('#8a8f7d', '#9a8f8a', 'texte');
    const doux = proposeCorrections('#8a8f7d', '#9a8f8a', 'composant');
    expect(dur.verdict).toBe('cout-eleve');
    expect(doux.verdict).toBe('corrigeable');
  });
});

describe('correction d’ensemble', () => {
  const palette = [
    { id: 'a', hex: '#437ffd', label: 'Principale' },
    { id: 'b', hex: '#d05219', label: 'Secondaire' },
    { id: 'c', hex: '#aa7c17', label: 'Accent' },
    { id: 'd', hex: '#f1f4fb', label: 'Gris clair' },
    { id: 'e', hex: '#16181d', label: 'Gris foncé' },
  ];

  it('réduit le nombre de paires en échec', () => {
    const compte = (cs: typeof palette) => {
      let n = 0;
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++)
          if (contrastRatio(cs[i]!.hex, cs[j]!.hex) < 4.5) n++;
      return n;
    };
    const avant = compte(palette);
    const bilan = corrigeTout(palette, 'texte');
    expect(compte(bilan.couleurs)).toBeLessThan(avant);
  });

  it('ne casse jamais plus de paires qu’il n’en répare', () => {
    // Invariant central : chaque déplacement retenu fait strictement
    // baisser le nombre d'échecs, donc le bilan ne peut pas régresser.
    const compte = (cs: { hex: string }[], seuil: number) => {
      let n = 0;
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++)
          if (contrastRatio(cs[i]!.hex, cs[j]!.hex) < seuil) n++;
      return n;
    };
    for (const usage of ['texte', 'titre', 'composant'] as const) {
      const seuil = usage === 'texte' ? 4.5 : 3;
      const bilan = corrigeTout(palette, usage);
      expect(compte(bilan.couleurs, seuil)).toBeLessThanOrEqual(compte(palette, seuil));
    }
  });

  it('aucune couleur ne dérive au-delà du budget de clarté', () => {
    const bilan = corrigeTout(palette, 'texte');
    for (const c of bilan.couleurs) {
      const origine = palette.find((p) => p.id === c.id)!;
      const a = parseToOklch(origine.hex)!;
      const b = parseToOklch(c.hex)!;
      expect(Math.abs(b.l - a.l) * 100).toBeLessThanOrEqual(MOUVEMENT_DOUX + 1);
    }
  });

  it('l’ajustement d’ensemble ne change jamais une teinte', () => {
    const bilan = corrigeTout(palette, 'texte');
    for (const ch of bilan.changements) {
      const a = parseToOklch(ch.avant)!;
      const b = parseToOklch(ch.apres)!;
      if (a.c < 0.02) continue;
      expect(Math.abs(b.h - a.h)).toBeLessThanOrEqual(TOLERANCE_TEINTE);
    }
  });

  it('rend compte de chaque changement, avec son coût', () => {
    const bilan = corrigeTout(palette, 'texte');
    for (const ch of bilan.changements) {
      expect(ch.avant).not.toBe(ch.apres);
      expect(ch.raison.length).toBeGreaterThan(10);
      expect(ch.deltaE).toBeGreaterThan(0);
    }
    // Les couleurs rendues correspondent aux changements annoncés.
    for (const ch of bilan.changements) {
      const finale = bilan.couleurs.find((c) => c.id === ch.id)!;
      const dernier = bilan.changements.filter((x) => x.id === ch.id).at(-1)!;
      expect(finale.hex).toBe(dernier.apres);
    }
  });

  it('nomme ce qui n’a pas pu être corrigé au lieu de le passer sous silence', () => {
    // Palette volontairement plate : beaucoup de paires irrattrapables.
    const plate = [
      { id: 'a', hex: '#8a8f7d', label: 'Un' },
      { id: 'b', hex: '#9a8f8a', label: 'Deux' },
      { id: 'c', hex: '#8f8a9a', label: 'Trois' },
    ];
    const bilan = corrigeTout(plate, 'texte');
    expect(bilan.restants.length).toBeGreaterThan(0);
    for (const r of bilan.restants) {
      expect(r.diagnostic.length).toBeGreaterThan(10);
      expect(r.ratio).toBeLessThan(4.5);
    }
  });

  it('ne touche à rien quand tout passe déjà', () => {
    const ok = [
      { id: 'a', hex: '#ffffff', label: 'Blanc' },
      { id: 'b', hex: '#1c1205', label: 'Ébène' },
    ];
    const bilan = corrigeTout(ok, 'texte');
    expect(bilan.changements).toHaveLength(0);
    expect(bilan.restants).toHaveLength(0);
    expect(bilan.couleurs).toEqual(ok);
  });

  it('termine sur une palette vide ou minuscule', () => {
    expect(corrigeTout([], 'texte').couleurs).toEqual([]);
    expect(corrigeTout([{ id: 'a', hex: '#123456' }], 'texte').changements).toHaveLength(0);
  });
});

describe('impact d’un changement sur toute la palette', () => {
  const palette = [
    { id: 'a', hex: '#7a8b6f', label: 'Un' },
    { id: 'b', hex: '#8b7a6f', label: 'Deux' },
    { id: 'c', hex: '#6f7a8b', label: 'Trois' },
    { id: 'd', hex: '#f0ede6', label: 'Quatre' },
  ];

  it('compte exactement ce qui se règle et ce qui se casse', () => {
    // Passer « Un » en quasi-noir : très contrasté avec le clair, donc
    // des paires se règlent ; on vérifie que le compte est cohérent.
    const i = impactSurPalette(palette, 'a', '#0d0d0b', 'texte');
    expect(i.apres).toBe(i.avant - i.resolues + i.cassees);
  });

  it('détecte qu’une correction peut en casser une autre', () => {
    // C'est LE cas qui manquait à l'interface : une palette où des paires
    // passent déjà, et un déplacement qui les fait tomber. Le blanc et le
    // quasi-noir se portent l'un l'autre ; ramener le blanc au gris moyen
    // casse forcément cette paire-là.
    const contrastee = [
      { id: 'clair', hex: '#ffffff', label: 'Clair' },
      { id: 'sombre', hex: '#1c1205', label: 'Sombre' },
      { id: 'moyen', hex: '#7a8b6f', label: 'Moyen' },
    ];
    const i = impactSurPalette(contrastee, 'clair', '#777777', 'texte');
    expect(i.cassees).toBeGreaterThan(0);
    expect(i.apres).toBeGreaterThan(i.avant);
  });

  it('ne signale ni gain ni perte quand rien ne change', () => {
    const i = impactSurPalette(palette, 'a', '#7a8b6f', 'texte');
    expect(i.resolues).toBe(0);
    expect(i.cassees).toBe(0);
    expect(i.apres).toBe(i.avant);
  });

  it('les pistes proposées peuvent être classées par gain net', () => {
    // Ce que l'interface fait : chaque piste est mesurée sur l'ensemble,
    // pas seulement sur la paire en cours.
    const prop = proposeCorrections('#7a8b6f', '#6f7a8b', 'texte');
    expect(prop.candidats.length).toBeGreaterThan(0);
    for (const c of prop.candidats) {
      const id = c.cible === 'avant' ? 'a' : 'c';
      const i = impactSurPalette(palette, id, c.hex, 'texte');
      // Toute piste règle au moins la paire qu'elle vise.
      expect(i.resolues).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('coordination avec l’harmonie', () => {
  const palette = [
    { id: 'a', hex: '#437ffd', label: 'Principale' },
    { id: 'b', hex: '#d05219', label: 'Secondaire' },
    { id: 'c', hex: '#aa7c17', label: 'Accent' },
    { id: 'd', hex: '#f1f4fb', label: 'Gris clair' },
    { id: 'e', hex: '#16181d', label: 'Gris foncé' },
  ];

  it('l’ajustement de contraste ne change jamais le schéma d’harmonie', () => {
    // La garantie de fond : le schéma se lit sur les TEINTES, et aucune
    // correction n'y touche. Corriger le contraste ne peut donc pas
    // défaire l'accord des couleurs. Ce test l'ancre.
    for (const usage of ['texte', 'titre', 'composant'] as const) {
      const bilan = corrigeTout(palette, usage);
      expect(analyzeHarmony(bilan.couleurs).scheme).toBe(analyzeHarmony(palette).scheme);
    }
  });

  it('l’impact rend le score d’harmonie avant et après', () => {
    const i = impactSurPalette(palette, 'a', '#1b3f8f', 'texte');
    expect(i.harmonieAvant).toBeGreaterThanOrEqual(0);
    expect(i.harmonieApres).toBeGreaterThanOrEqual(0);
    expect(i.harmonieAvant).toBeLessThanOrEqual(100);
    expect(i.harmonieApres).toBeLessThanOrEqual(100);
  });

  it('un déplacement de clarté laisse les teintes en place', () => {
    // Corollaire mesuré : ce sont bien les clartés qui bougent, et elles
    // seules. Si un jour une stratégie touchait à la teinte, ce test
    // tomberait avant l'interface.
    const bilan = corrigeTout(palette, 'texte');
    for (const c of bilan.couleurs) {
      const avant = parseToOklch(palette.find((p) => p.id === c.id)!.hex)!;
      const apres = parseToOklch(c.hex)!;
      if (avant.c < 0.02) continue;
      expect(Math.abs(apres.h - avant.h)).toBeLessThanOrEqual(TOLERANCE_TEINTE);
    }
  });
});

describe('la structure de la palette est protégée', () => {
  /**
   * Le cas trouvé sur captures : la palette n'a qu'une couleur claire, et
   * l'assombrir règle plusieurs contrastes d'un coup. Le compte de paires
   * applaudit ; la palette, elle, n'a plus de quoi faire un fond de page.
   */
  const uneSeuleClaire = [
    { id: 'a', hex: '#7a8b6f', label: 'Un' },
    { id: 'b', hex: '#8b7a6f', label: 'Deux' },
    { id: 'c', hex: '#6f7a8b', label: 'Trois' },
    { id: 'd', hex: '#f0ede6', label: 'Le clair' },
  ];

  it('signale qu’un changement viderait une bande de clarté', () => {
    const i = impactSurPalette(uneSeuleClaire, 'd', '#141414', 'texte');
    expect(i.bandeVidee).toBe('light');
  });

  it('ne signale rien quand la bande reste peuplée', () => {
    const i = impactSurPalette(uneSeuleClaire, 'a', '#0d0d0b', 'texte');
    expect(i.bandeVidee).toBeNull();
  });

  it('l’ajustement automatique ne vide jamais une bande', () => {
    // Même si cela lui coûte des paires réglées : une palette sans clair
    // n'est pas une palette corrigée, c'est une palette cassée.
    const bandes = (cs: { hex: string }[]) => {
      const out = { light: 0, mid: 0, dark: 0 };
      for (const c of cs) {
        const o = parseToOklch(c.hex)!;
        out[o.l >= 0.8 ? 'light' : o.l <= 0.45 ? 'dark' : 'mid']++;
      }
      return out;
    };
    for (const usage of ['texte', 'titre', 'composant'] as const) {
      const avant = bandes(uneSeuleClaire);
      const apres = bandes(corrigeTout(uneSeuleClaire, usage).couleurs);
      for (const k of ['light', 'mid', 'dark'] as const) {
        if (avant[k] > 0) expect(apres[k]).toBeGreaterThan(0);
      }
    }
  });
});
