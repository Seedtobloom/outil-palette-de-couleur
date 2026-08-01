import { describe, expect, it } from 'vitest';
import { contrastMatrix, evaluatePair } from './matrix';

const PALETTE = [
  { id: 'encre', hex: '#1a1a1a' },
  { id: 'papier', hex: '#fafafa' },
  { id: 'bleu', hex: '#2563eb' },
  { id: 'gris', hex: '#9ca3af' },
];

describe('contrastMatrix', () => {
  it('construit une matrice N×N complète, diagonale nulle', () => {
    const m = contrastMatrix(PALETTE, 'body-text');
    expect(m.cells).toHaveLength(4);
    expect(m.cells.every((row) => row.length === 4)).toBe(true);
    for (let i = 0; i < 4; i++) expect(m.cells[i]![i]).toBeNull();
    expect(m.summary.pairsTested).toBe(12);
  });

  it('WCAG décide seul du verdict : une paire sous le seuil AA est fail', () => {
    const m = contrastMatrix(PALETTE, 'body-text');
    const grisSurPapier = m.cells[3]![1]!;
    expect(grisSurPapier.wcag.passesAA).toBe(false);
    expect(grisSurPapier.status).toBe('fail');
    expect(m.summary.failures).toBeGreaterThan(0);
    expect(m.summary.level).toBe('non conforme');
  });

  it('le niveau global est AAA seulement si toutes les paires atteignent AAA', () => {
    const m = contrastMatrix(
      [
        { id: 'encre', hex: '#111111' },
        { id: 'papier', hex: '#fafafa' },
      ],
      'body-text',
    );
    expect(m.summary.level).toBe('AAA');
  });

  it('le même couple de couleurs change de verdict selon l’usage (matrice typée)', () => {
    const fg = { id: 'bleu', hex: '#2563eb' };
    const bg = { id: 'papier', hex: '#fafafa' };
    const asBody = evaluatePair(fg, bg, 'body-text');
    const asLarge = evaluatePair(fg, bg, 'large-text');
    // ~4.9:1 : passe AA texte courant mais pas AAA ; en grand texte, AAA.
    expect(asBody.wcag.level).toBe('AA');
    expect(asLarge.wcag.level).toBe('AAA');
  });

  it('une paire conforme WCAG mais faible en APCA est warn, jamais fail', () => {
    // Paire sombre : ratio WCAG ≥ 3 (grand texte) mais Lc faible.
    const evaluation = evaluatePair(
      { id: 'texte', hex: '#8a8a8a' },
      { id: 'fond', hex: '#2e2e2e' },
      'large-text',
    );
    expect(evaluation.wcag.passesAA).toBe(true);
    expect(evaluation.apca.quality).toBe('weak');
    expect(evaluation.status).toBe('warn');
  });
});
