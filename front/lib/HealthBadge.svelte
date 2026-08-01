<script lang="ts">
  /**
   * Score de santé dans le header. Au clic, il détaille la contribution
   * de chaque composante et pointe vers l'étape qui fait perdre des
   * points (brief §8). Le total est la somme pondérée : il ne peut pas
   * contredire le détail.
   */
  import { healthScore } from '../engine';
  import { settings } from './state.svelte';

  let { onGoToStep }: { onGoToStep: (step: string) => void } = $props();

  let open = $state(false);

  const score = $derived(healthScore(settings.colors));

  const STEP_LABELS: Record<string, string> = {
    contrast: 'Contraste',
    harmony: 'Harmonie',
    palette: 'Nuancier',
    roles: 'Rôles',
    print: 'Impression',
  };
</script>

{#if settings.colors.length > 0}
  <div class="health">
    <button class="badge" onclick={() => (open = !open)} aria-expanded={open}>
      <span class="badge-num num">{score.total}</span>
      <span class="badge-bar" aria-hidden="true">
        <span style="inline-size:{score.total}%"></span>
      </span>
      <span class="badge-cap">santé</span>
    </button>

    {#if open}
      <div class="panel" role="dialog" aria-label="Détail du score de santé">
        <p class="panel-lead">
          Somme pondérée des cinq composantes — cliquez pour aller corriger.
        </p>
        <ul>
          {#each score.components as c (c.id)}
            <li>
              <button class="row" onclick={() => { onGoToStep(c.step); open = false; }}>
                <span class="row-head">
                  <span class="row-label">{c.label}</span>
                  <span class="row-weight num">{Math.round(c.weight * 100)} %</span>
                  <span class="row-value num">{c.value}</span>
                </span>
                <span class="row-bar" aria-hidden="true">
                  <span style="inline-size:{c.value}%"></span>
                </span>
                <span class="row-detail">{c.detail}</span>
                <span class="row-go">→ {STEP_LABELS[c.step] ?? c.step}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .health {
    position: relative;
  }

  .badge {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: none;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
  }

  .badge-num {
    font-size: 0.95rem;
  }

  .badge-bar {
    inline-size: 3.5rem;
    block-size: 4px;
    background: var(--hairline);
    border-radius: 2px;
    overflow: hidden;
  }

  .badge-bar span {
    display: block;
    block-size: 100%;
    background: var(--ink);
  }

  .badge-cap {
    font-size: 0.72rem;
    color: var(--ink-2);
  }

  .panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 20;
    inline-size: 24rem;
    max-inline-size: calc(100vw - 2rem);
    background: var(--paper);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 0.9rem 1rem;
  }

  .panel-lead {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }

  .panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .row {
    inline-size: 100%;
    display: grid;
    gap: 0.2rem;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: var(--radius-sm);
    text-align: left;
  }

  .row:hover {
    background: var(--paper-sunken);
  }

  .row-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .row-label {
    flex: 1;
    font-weight: 500;
  }

  .row-weight,
  .row-value {
    color: var(--ink-2);
    font-size: 0.75rem;
  }

  .row-value {
    color: var(--ink);
    font-size: 0.85rem;
  }

  .row-bar {
    display: block;
    block-size: 3px;
    background: var(--hairline);
    border-radius: 2px;
    overflow: hidden;
  }

  .row-bar span {
    display: block;
    block-size: 100%;
    background: var(--ink);
  }

  .row-detail {
    font-size: 0.74rem;
    color: var(--ink-2);
    line-height: 1.4;
  }

  .row-go {
    font-size: 0.7rem;
    color: var(--ink-2);
  }
</style>
