<script lang="ts">
  /**
   * Étape « Harmonie » : le schéma réellement suivi par la palette, et les
   * couleurs qui en sortent — avec correction applicable en un clic.
   * Un seul verdict, dérivé du calcul (brief §7 étape 2).
   */
  import { analyzeHarmony, AXIS_LABELS, SCHEME_LABELS } from '../engine';
  import { settings } from './state.svelte';

  const analysis = $derived(analyzeHarmony(settings.colors));

  function labelOf(id: string): string {
    return settings.colors.find((c) => c.id === id)?.label ?? id;
  }

  function hexOf(id: string): string {
    return settings.colors.find((c) => c.id === id)?.hex ?? '#888888';
  }

  function applyFix(id: string, hex: string): void {
    settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, hex } : c));
  }
</script>

<div class="wrap">
  <div class="verdict" data-ok={analysis.offNotes.length === 0}>
    <div class="verdict-main">
      <p class="scheme">{SCHEME_LABELS[analysis.scheme]}</p>
      <p class="verdict-text">{analysis.verdict}</p>
    </div>
    <div class="verdict-score">
      <span class="score-num num">{analysis.score}</span>
      <span class="score-cap">harmonie</span>
    </div>
  </div>

  <div class="regularity">
    {#each [['lightness', analysis.regularity.lightness], ['chroma', analysis.regularity.chroma], ['hue', analysis.regularity.hue]] as [axis, value] (axis)}
      <div class="reg">
        <span class="reg-label">Régularité de {AXIS_LABELS[axis as 'hue' | 'chroma' | 'lightness']}</span>
        <span class="reg-bar" aria-hidden="true">
          <span style="inline-size:{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}%"></span>
        </span>
        <span class="reg-value num">{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}</span>
      </div>
    {/each}
  </div>

  {#if analysis.offNotes.length > 0}
    <div class="notes">
      {#each analysis.offNotes as note (note.id + note.axis)}
        <article class="note">
          <div class="ba">
            <span class="ba-swatch" style="background:{hexOf(note.id)}" title="Avant"></span>
            <span class="ba-arrow" aria-hidden="true">→</span>
            <span class="ba-swatch" style="background:{note.fix.hex}" title="Après"></span>
          </div>
          <div class="note-body">
            <p class="note-title">
              « {labelOf(note.id)} » — écart de {AXIS_LABELS[note.axis]}
            </p>
            <p class="note-reason">{note.reason}</p>
            <p class="note-conseq">{note.consequence}</p>
          </div>
          <button class="fix" onclick={() => applyFix(note.id, note.fix.hex)}>
            {note.fix.label}
          </button>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.1rem;
  }

  .verdict {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.1rem 1.3rem;
    border-radius: var(--radius);
    background: var(--paper-sunken);
  }

  .verdict[data-ok='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
  }

  .scheme {
    margin: 0 0 0.15rem;
    font-family: var(--font-serif);
    font-size: 1.2rem;
  }

  .verdict-text {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-2);
    max-inline-size: 34rem;
  }

  .verdict-score {
    display: grid;
    justify-items: center;
    flex-shrink: 0;
  }

  .score-num {
    font-size: 1.9rem;
    line-height: 1;
  }

  .score-cap {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-2);
  }

  .regularity {
    display: grid;
    gap: 0.35rem;
  }

  .reg {
    display: grid;
    grid-template-columns: 11rem 1fr 2.5rem;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.8rem;
  }

  .reg-label {
    color: var(--ink-2);
  }

  .reg-bar {
    block-size: 4px;
    background: var(--hairline);
    border-radius: 2px;
    overflow: hidden;
  }

  .reg-bar span {
    display: block;
    block-size: 100%;
    background: var(--ink);
  }

  .reg-value {
    text-align: right;
    color: var(--ink-2);
  }

  .notes {
    display: grid;
    gap: 0.6rem;
  }

  .note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'swatches body' '. action';
    align-items: start;
    gap: 0.5rem 1.1rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--hairline);
  }

  .ba {
    grid-area: swatches;
  }

  .note-body {
    grid-area: body;
  }

  .fix {
    grid-area: action;
    justify-self: start;
  }

  .ba {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-top: 0.1rem;
  }

  .ba-swatch {
    inline-size: 2.4rem;
    block-size: 2.4rem;
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.12);
  }

  .ba-arrow {
    color: var(--ink-2);
    font-size: 0.9rem;
  }

  .note-body {
    display: grid;
    gap: 0.1rem;
  }

  .note-title {
    margin: 0;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .note-reason,
  .note-conseq {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }

  .fix {
    font-size: 0.82rem;
    padding: 0.3rem 0.9rem;
  }

  @media (max-width: 44rem) {
    .note {
      grid-template-columns: 1fr;
      grid-template-areas: 'swatches' 'body' 'action';
    }

    .reg {
      grid-template-columns: 8rem 1fr 2.5rem;
    }
  }
</style>
