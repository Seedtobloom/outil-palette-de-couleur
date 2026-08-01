import { describe, expect, it } from 'vitest';
import { corrigeParClarte, evaluePaires, SEUILS } from './fix';
import { contrastRatio } from './wcag';
import { parseToOklch } from '../color/space';

describe('correction par la clarté seule', () => {
  it('fait passer une paire en AA sans changer la teinte ni l’intensité', () => {
    // Recette du brief : « la correction proposée la fait passer en AA
    // sans changer la teinte ».
    const source = parseToOklch('#8fb3d9')!;
    const fix = corrigeParClarte('#8fb3d9', '#ffffff', 4.5)!;
    expect(fix).not.toBeNull();
    expect(contrastRatio(fix.hex, '#ffffff')).toBeGreaterThanOrEqual(4.5);

    const corrige = parseToOklch(fix.hex)!;
    expect(Math.abs(corrige.h - source.h)).toBeLessThan(2);
    // L'intensité ne peut que suivre le plafond de gamut, jamais grimper.
    expect(corrige.c).toBeLessThanOrEqual(source.c + 0.001);
  });

  it('annonce l’écart de clarté en points, comme le demande le brief', () => {
    const fix = corrigeParClarte('#8fb3d9', '#ffffff', 4.5)!;
    expect(fix.deltaL).toBeGreaterThan(0);
    expect(fix.deltaL).toBeLessThan(60);
    expect(fix.sens).toBe('plus sombre');
    expect(fix.phrase).toContain('clarté');
    expect(fix.phrase).toContain('teinte');
  });

  it('choisit le déplacement le plus court des deux', () => {
    // Sur un fond gris moyen, éclaircir est plus court que noircir.
    const fix = corrigeParClarte('#9a9a9a', '#6b6b6b', 3)!;
    expect(fix.sens).toBe('plus clair');
  });

  it('retourne null quand aucune clarté n’atteint la cible', () => {
    // 7:1 sur un fond gris moyen est hors d'atteinte des deux côtés.
    expect(corrigeParClarte('#808080', '#7a7a7a', 7)).toBeNull();
  });

  it('fonctionne pour les trois usages, seuils WCAG 2.2 respectés', () => {
    for (const [usage, seuil] of Object.entries(SEUILS)) {
      const fix = corrigeParClarte('#8fb3d9', '#ffffff', seuil.aa);
      expect(fix, usage).not.toBeNull();
      expect(contrastRatio(fix!.hex, '#ffffff')).toBeGreaterThanOrEqual(seuil.aa);
    }
  });

  it('le 3:1 non textuel est un critère de premier plan (SC 1.4.11)', () => {
    expect(SEUILS.composant.aa).toBe(3);
    expect(SEUILS.composant.regle).toContain('1.4.11');
  });
});

describe('priorisation — une décision par écran', () => {
  const palette = [
    { id: 'fond', hex: '#ffffff', label: 'Fond' },
    { id: 'texte', hex: '#1c1205', label: 'Texte' },
    { id: 'accent', hex: '#8fb3d9', label: 'Accent' }, // échoue de peu sur blanc
    { id: 'pale', hex: '#f4f4f4', label: 'Pâle' }, // échoue franchement
  ];

  it('met en tête une paire en échec, jamais une paire conforme', () => {
    const paires = evaluePaires(palette, 'texte');
    expect(paires[0]!.niveau).toBeNull();
  });

  it('privilégie ce qui est réparable et proche du seuil', () => {
    const paires = evaluePaires(palette, 'texte');
    const premiere = paires[0]!;
    expect(premiere.fix).not.toBeNull();
    // L'accent (proche du seuil) passe avant le pâle (très loin).
    const rangAccent = paires.findIndex((p) => p.avantId === 'accent' && p.fondId === 'fond');
    const rangPale = paires.findIndex((p) => p.avantId === 'pale' && p.fondId === 'fond');
    expect(rangAccent).toBeLessThan(rangPale);
  });

  it('n’évalue jamais une couleur contre elle-même', () => {
    for (const p of evaluePaires(palette)) {
      expect(p.avantId).not.toBe(p.fondId);
    }
  });

  it('une palette entièrement conforme ne propose aucune correction', () => {
    const paires = evaluePaires(
      [
        { id: 'a', hex: '#ffffff' },
        { id: 'b', hex: '#1c1205' },
      ],
      'texte',
    );
    expect(paires.every((p) => p.niveau !== null)).toBe(true);
    expect(paires.every((p) => p.fix === null)).toBe(true);
  });

  it('APCA accompagne chaque paire, en complément informatif', () => {
    for (const p of evaluePaires(palette)) {
      expect(typeof p.lc).toBe('number');
    }
  });
});
