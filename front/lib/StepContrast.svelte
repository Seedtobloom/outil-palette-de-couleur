<script lang="ts">
  /**
   * Étape « Contraste » : pour CHAQUE couleur, les quatre tests de texte
   * qui décident de tous ses usages, avec les niveaux WCAG atteints.
   * Plus la vérification de niveau A (SC 1.4.1), qui ne se calcule pas.
   */
  import { analyzeUsage, LEVEL_A_CHECK, contrastRatio, findSpotCollisions, type TextTest } from '../engine';
  import { settings } from './state.svelte';

  let { showTechnical }: { showTechnical: boolean } = $props();

  const usages = $derived(
    settings.colors
      .map((c) => ({ entry: c, usage: analyzeUsage(c.hex) }))
      .filter((u): u is { entry: (typeof settings.colors)[number]; usage: NonNullable<ReturnType<typeof analyzeUsage>> } => u.usage !== null),
  );

  function fmt(r: number): string {
    return (Math.floor(r * 100) / 100).toFixed(2).replace('.', ',');
  }

  function levelChip(level: 'AAA' | 'AA' | null): string {
    return level ?? '—';
  }

  const SAMPLE = 'Aa';

  // Matrice croisée de TOUTES les paires : on voit d'un coup d'œil
  // quelles associations sont interdites (brief §7, étape 3).
  const matrix = $derived(
    settings.colors.map((row) =>
      settings.colors.map((col) => (row.id === col.id ? null : contrastRatio(row.hex, col.hex))),
    ),
  );

  /** Le meilleur usage possible d'une paire, du plus exigeant au moins. */
  function pairLevel(ratio: number): { label: string; rank: 0 | 1 | 2 | 3 } {
    if (ratio >= 7) return { label: 'Tout', rank: 3 };
    if (ratio >= 4.5) return { label: 'Texte', rank: 2 };
    if (ratio >= 3) return { label: 'Titre', rank: 1 };
    return { label: 'Non', rank: 0 };
  }

  const spotCollisions = $derived(findSpotCollisions(settings.colors));
</script>

<div class="wrap">
  {#each usages as { entry, usage } (entry.id)}
    <section class="color-block">
      <header class="color-head">
        <span class="dot" style="background:{entry.hex}" aria-hidden="true"></span>
        <h3>{entry.label}</h3>
        <code>{entry.hex}</code>
      </header>
      <p class="summary">{usage.summary}</p>

      <div class="tests">
        {#each [usage.tests.whiteOn, usage.tests.blackOn, usage.tests.onWhite, usage.tests.onDark] as t (t.label)}
          {@const test = t as TextTest}
          <div class="test">
            <span class="preview" style="background:{test.bg};color:{test.fg}">{SAMPLE}</span>
            <span class="test-label">{test.label}</span>
            <span class="ratio num">{fmt(test.ratio)}:1</span>
            <span class="levels">
              <span class="lv" data-on={test.body !== null} title="Texte courant">
                Texte <b>{levelChip(test.body)}</b>
              </span>
              <span class="lv" data-on={test.large !== null} title="Grand texte (≥ 24 px)">
                Titre <b>{levelChip(test.large)}</b>
              </span>
              <span class="lv" data-on={test.ui} title="Icône, bordure (3:1)">
                Icône <b>{test.ui ? 'AA' : '—'}</b>
              </span>
            </span>
            {#if showTechnical}
              <span class="tech num">Lc {test.lc.toFixed(0)}</span>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}

  <section class="matrix-section">
    <h3>Toutes les associations</h3>
    <p class="matrix-lead">
      Chaque couleur de ligne posée sur chaque couleur de colonne. « Tout » = utilisable
      partout (AAA) · « Texte » = texte courant (AA) · « Titre » = grand texte et éléments
      graphiques seulement · « Non » = association à éviter.
    </p>
    <div class="matrix-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col"><span class="vh">Sur</span></th>
            {#each settings.colors as c (c.id)}
              <th scope="col">
                <span class="head-dot" style="background:{c.hex}" aria-hidden="true"></span>
                <span class="head-name">{c.label}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each settings.colors as row, i (row.id)}
            <tr>
              <th scope="row">
                <span class="head-dot" style="background:{row.hex}" aria-hidden="true"></span>
                <span class="head-name">{row.label}</span>
              </th>
              {#each settings.colors as col, j (col.id)}
                {@const ratio = matrix[i]?.[j]}
                {#if ratio === null || ratio === undefined}
                  <td class="diag" aria-hidden="true"></td>
                {:else}
                  {@const lvl = pairLevel(ratio)}
                  <td data-rank={lvl.rank}>
                    <span class="cell">
                      <span class="cell-sample" style="background:{col.hex};color:{row.hex}">Aa</span>
                      <span class="cell-ratio num">{fmt(ratio)}</span>
                      <span class="cell-level">{lvl.label}</span>
                    </span>
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  {#if spotCollisions.length > 0}
    <section class="spot-warn">
      <h3>En ton direct</h3>
      {#each spotCollisions as c (c.a + c.b)}
        <p>{c.message}</p>
      {/each}
    </section>
  {/if}

  <section class="level-a">
    <h3>Le niveau A — à vérifier vous-même</h3>
    <p class="a-question">{LEVEL_A_CHECK.question}</p>
    <label class="a-check">
      <input type="checkbox" bind:checked={settings.levelAConfirmed} />
      Non — chaque information a un second indice (texte, icône, motif).
    </label>
    <p class="a-why">{LEVEL_A_CHECK.why}</p>
    <p class="a-rule">{LEVEL_A_CHECK.rule}</p>
  </section>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.4rem;
  }

  .color-block {
    display: grid;
    gap: 0.5rem;
  }

  .color-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .dot {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.12);
    flex-shrink: 0;
  }

  h3 {
    font-size: 1.05rem;
    font-family: var(--font-ui);
    font-weight: 600;
  }

  .color-head code {
    color: var(--ink-2);
    font-size: 0.78rem;
  }

  .summary {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }

  .tests {
    display: grid;
    gap: 0.3rem;
  }

  .test {
    display: grid;
    grid-template-columns: 2.6rem 10rem 4.2rem 1fr auto;
    align-items: center;
    gap: 0.7rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--paper-sunken);
    font-size: 0.82rem;
  }

  .preview {
    display: grid;
    place-items: center;
    block-size: 2rem;
    border-radius: 4px;
    font-size: 0.95rem;
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.08);
  }

  .test-label {
    color: var(--ink-2);
  }

  .ratio {
    font-size: 0.85rem;
  }

  .levels {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .lv {
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    border-radius: 100px;
    color: var(--ink-2);
    background: var(--paper);
    box-shadow: inset 0 0 0 1px var(--hairline);
  }

  .lv[data-on='true'] {
    color: var(--paper);
    background: var(--ink);
    box-shadow: none;
  }

  .lv b {
    font-weight: 600;
  }

  .tech {
    color: var(--ink-2);
    font-size: 0.7rem;
  }

  .matrix-section {
    display: grid;
    gap: 0.5rem;
  }

  .matrix-section h3,
  .spot-warn h3 {
    font-family: var(--font-serif);
    font-size: 1.05rem;
  }

  .matrix-lead {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }

  .matrix-scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: separate;
    border-spacing: 3px;
    font-size: 0.75rem;
  }

  th {
    font-weight: 400;
    font-size: 0.72rem;
    text-align: left;
    white-space: nowrap;
    padding: 0.2rem 0.3rem;
  }

  .head-dot {
    display: inline-block;
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 3px;
    vertical-align: -0.1em;
    margin-right: 0.3rem;
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.15);
  }

  .head-name {
    color: var(--ink-2);
  }

  td {
    padding: 0.3rem;
    border-radius: var(--radius-sm);
    background: var(--paper-sunken);
    vertical-align: middle;
  }

  .cell {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    min-inline-size: 4.2rem;
  }

  td.diag {
    background: transparent;
  }

  .cell-sample {
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: 1.5rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .cell-ratio {
    font-size: 0.72rem;
  }

  .cell-level {
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  td[data-rank='0'] .cell-level {
    color: var(--ink);
    font-weight: 700;
  }

  td[data-rank='0'] {
    box-shadow: inset 0 0 0 1.5px var(--ink);
  }

  .spot-warn {
    display: grid;
    gap: 0.4rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    background: var(--paper-sunken);
  }

  .spot-warn p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }

  .vh {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .level-a {
    display: grid;
    gap: 0.45rem;
    padding: 1rem 1.1rem;
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
  }

  .level-a h3 {
    font-family: var(--font-serif);
  }

  .a-question {
    margin: 0;
    font-size: 0.9rem;
  }

  .a-check {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.88rem;
  }

  .a-why,
  .a-rule {
    margin: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }

  .a-rule {
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }

  @media (max-width: 44rem) {
    .test {
      grid-template-columns: 2.6rem 1fr;
      grid-template-areas: 'prev label' 'prev ratio' 'lv lv';
      row-gap: 0.2rem;
    }

    .levels {
      grid-area: lv;
    }
  }
</style>
