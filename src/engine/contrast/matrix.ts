/**
 * Matrice de contraste N×N typée par usage.
 * WCAG 2.2 est le verrou (bloquant), APCA le signal qualité (informatif).
 */
import type { PairUsage } from '../types';
import { wcagCheck, type WcagResult } from './wcag';
import { apcaAssess, type ApcaAssessment } from './apca';

export type PaletteColor = { id: string; hex: string };

export type PairEvaluation = {
  fg: PaletteColor;
  bg: PaletteColor;
  usage: PairUsage;
  wcag: WcagResult;
  apca: ApcaAssessment;
  /**
   * Verdict de la paire. Uniquement fondé sur WCAG 2.2 :
   * 'fail' si le verrou échoue, 'warn' si WCAG passe mais APCA signale une
   * paire perceptuellement faible, 'pass' sinon.
   */
  status: 'pass' | 'warn' | 'fail';
};

export function evaluatePair(fg: PaletteColor, bg: PaletteColor, usage: PairUsage): PairEvaluation {
  const wcag = wcagCheck(fg.hex, bg.hex, usage);
  const apca = apcaAssess(fg.hex, bg.hex, usage);
  let status: PairEvaluation['status'];
  if (!wcag.passesAA) status = 'fail';
  else if (apca.quality === 'weak') status = 'warn';
  else status = 'pass';
  return { fg, bg, usage, wcag, apca, status };
}

export type ContrastMatrix = {
  colors: PaletteColor[];
  usage: PairUsage;
  /** cells[i][j] : couleur i utilisée SUR la couleur j. null sur la diagonale. */
  cells: (PairEvaluation | null)[][];
  summary: {
    pairsTested: number;
    failures: number;
    warnings: number;
    /** Niveau global atteint par toutes les paires testées (hors diagonale). */
    level: 'AAA' | 'AA' | 'non conforme';
  };
};

/** Construit la matrice complète pour un usage donné. */
export function contrastMatrix(colors: PaletteColor[], usage: PairUsage): ContrastMatrix {
  const cells: (PairEvaluation | null)[][] = [];
  let failures = 0;
  let warnings = 0;
  let allAAA = true;
  let pairsTested = 0;

  for (let i = 0; i < colors.length; i++) {
    const row: (PairEvaluation | null)[] = [];
    for (let j = 0; j < colors.length; j++) {
      if (i === j) {
        row.push(null);
        continue;
      }
      const evaluation = evaluatePair(colors[i]!, colors[j]!, usage);
      pairsTested++;
      if (evaluation.status === 'fail') failures++;
      if (evaluation.status === 'warn') warnings++;
      if (evaluation.wcag.level !== 'AAA' && evaluation.wcag.level !== 'exempt') allAAA = false;
      row.push(evaluation);
    }
    cells.push(row);
  }

  return {
    colors,
    usage,
    cells,
    summary: {
      pairsTested,
      failures,
      warnings,
      level: failures > 0 ? 'non conforme' : allAAA ? 'AAA' : 'AA',
    },
  };
}
