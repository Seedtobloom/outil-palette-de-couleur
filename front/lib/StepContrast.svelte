<script lang="ts">
  /**
   * Étape « Contraste » : pour CHAQUE couleur, les quatre tests de texte
   * qui décident de tous ses usages, avec les niveaux WCAG atteints.
   * Plus la vérification de niveau A (SC 1.4.1), qui ne se calcule pas.
   */
  import { analyzeUsage, LEVEL_A_CHECK, type TextTest } from '../engine';
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
