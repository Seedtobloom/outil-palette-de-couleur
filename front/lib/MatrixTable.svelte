<script lang="ts">
  import type { ContrastMatrix } from '../engine';

  let {
    matrix,
    showTechnical,
    selected,
    onselect,
  }: {
    matrix: ContrastMatrix;
    showTechnical: boolean;
    selected: { fgIndex: number; bgIndex: number } | null;
    onselect: (fgIndex: number, bgIndex: number) => void;
  } = $props();

  function fmt(ratio: number): string {
    return (Math.floor(ratio * 100) / 100).toFixed(2).replace('.', ',');
  }

  function badge(level: 'AA' | 'AAA' | 'exempt' | null, status: string): string {
    if (level === 'AAA') return 'AAA';
    if (level === 'AA') return status === 'warn' ? 'AA ⚠' : 'AA';
    if (level === 'exempt') return '—';
    return '✗';
  }
</script>

<div class="matrix-scroll">
  <table>
    <caption class="visually-hidden">
      Matrice de contraste : chaque case évalue la couleur de la ligne posée sur la couleur de
      la colonne.
    </caption>
    <thead>
      <tr>
        <th scope="col"><span class="axis">ligne&nbsp;sur&nbsp;colonne&nbsp;→</span></th>
        {#each matrix.colors as bg (bg.id)}
          <th scope="col">
            <span class="swatch" style="background:{bg.hex}" aria-hidden="true"></span>
            <code>{bg.hex}</code>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each matrix.cells as row, i (matrix.colors[i]?.id)}
        <tr>
          <th scope="row">
            <span class="swatch" style="background:{matrix.colors[i]?.hex}" aria-hidden="true"
            ></span>
            <code>{matrix.colors[i]?.hex}</code>
          </th>
          {#each row as cell, j (matrix.colors[j]?.id)}
            {#if cell === null}
              <td class="diagonal" aria-hidden="true"></td>
            {:else}
              <td>
                <button
                  class="cell"
                  class:selected={selected?.fgIndex === i && selected?.bgIndex === j}
                  data-status={cell.status}
                  onclick={() => onselect(i, j)}
                  aria-label={`${cell.fg.hex} sur ${cell.bg.hex} : contraste ${fmt(cell.wcag.ratio)} pour 1, ${cell.wcag.level ?? 'insuffisant'}`}
                >
                  <span
                    class="sample"
                    style="color:{cell.fg.hex};background:{cell.bg.hex}"
                    aria-hidden="true">Aa</span
                  >
                  <span class="num">{fmt(cell.wcag.ratio)}</span>
                  <span class="badge">{badge(cell.wcag.level, cell.status)}</span>
                  {#if showTechnical}
                    <span class="num lc">Lc&nbsp;{cell.apca.lc.toFixed(0)}</span>
                  {/if}
                </button>
              </td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .matrix-scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid var(--hairline);
    padding: 0.3rem 0.45rem;
    text-align: left;
    vertical-align: middle;
  }

  th {
    font-weight: 400;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  th .swatch {
    display: inline-block;
    inline-size: 0.9rem;
    block-size: 0.9rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
    vertical-align: -0.15em;
    margin-right: 0.3rem;
  }

  .axis {
    color: var(--ink-2);
    font-size: 0.75rem;
  }

  .diagonal {
    background: var(--paper-sunken);
  }

  .cell {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: none;
    background: none;
    padding: 0.15rem 0.2rem;
    width: 100%;
  }

  .cell:hover {
    background: var(--paper-sunken);
  }

  .cell.selected {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .sample {
    display: inline-grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 1.5rem;
    border: 1px solid var(--hairline);
    border-radius: 2px;
    font-size: 0.85rem;
  }

  .badge {
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    min-inline-size: 2.6em;
  }

  .cell[data-status='fail'] .badge {
    font-weight: 700;
  }

  .lc {
    color: var(--ink-2);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
