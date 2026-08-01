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
          Somme pondérée des cinq composantes — clique pour aller corriger.
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
    color: var(--text-on-chrome);
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: none;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius);
  }

  .badge-num {
    font-size: 0.95rem;
  }

  .badge-bar {
    inline-size: 3.5rem;
    block-size: 4px;
    background: rgba(242, 229, 194, 0.3);
    border-radius: 2px;
    overflow: hidden;
  }

  .badge-bar span {
    display: block;
    block-size: 100%;
    background: var(--text-on-chrome);
  }

  .badge-cap {
    font-size: 0.72rem;
    color: var(--text-on-chrome-muted);
  }

  .panel {
    color: var(--text-main);
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 20;
    inline-size: 24rem;
    max-inline-size: calc(100vw - 2rem);
    background: var(--surface-canvas);
    border-radius: var(--radius);
    box-shadow: 0 4px 24px rgba(28, 18, 5, 0.18);
    padding: 0.9rem 1rem;
  }

  .panel-lead {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    color: var(--text-muted);
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
    border-radius: var(--radius);
    text-align: left;
  }

  .row:hover {
    background: var(--surface-panel);
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
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .row-value {
    color: var(--text-main);
    font-size: 0.85rem;
  }

  .row-bar {
    display: block;
    block-size: 3px;
    background: var(--ink-muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .row-bar span {
    display: block;
    block-size: 100%;
    background: var(--text-main);
  }

  .row-detail {
    font-size: 0.74rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .row-go {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
</style>
