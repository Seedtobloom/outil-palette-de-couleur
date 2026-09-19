/**
 * Matrice de contraste N×N typée par usage.
 *
 * WCAG 2.2 est le seul verrou. L'APCA servait ici à marquer « warn » les
 * paires conformes mais perceptuellement faibles ; il a été retiré de
 * l'outil, et avec lui ce troisième état. Une paire passe, ou elle ne
 * passe pas.
 */
import type { PairUsage } from '../types';
import { wcagCheck, type WcagResult } from './wcag';

export type PaletteColor = { id: string; hex: string };

export type PairEvaluation = {
  fg: PaletteColor;
  bg: PaletteColor;
  usage: PairUsage;
  wcag: WcagResult;
  /** Verdict de la paire, fondé sur le seuil AA de l'usage. */
  status: 'pass' | 'fail';
};

export function evaluatePair(fg: PaletteColor, bg: PaletteColor, usage: PairUsage): PairEvaluation {
  const wcag = wcagCheck(fg.hex, bg.hex, usage);
  return { fg, bg, usage, wcag, status: wcag.passesAA ? 'pass' : 'fail' };
}

export type ContrastMatrix = {
  colors: PaletteColor[];
  usage: PairUsage;
  /** cells[i][j] : couleur i utilisée SUR la couleur j. null sur la diagonale. */
  cells: (PairEvaluation | null)[][];
  summary: {
    pairsTested: number;
    failures: number;
    /** Niveau global atteint par toutes les paires testées (hors diagonale). */
    level: 'AAA' | 'AA' | 'non conforme';
  };
};

/** Construit la matrice complète pour un usage donné. */
export function contrastMatrix(colors: PaletteColor[], usage: PairUsage): ContrastMatrix {
  const cells: (PairEvaluation | null)[][] = [];
  let failures = 0;
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
      level: failures > 0 ? 'non conforme' : allAAA ? 'AAA' : 'AA',
    },
  };
}
