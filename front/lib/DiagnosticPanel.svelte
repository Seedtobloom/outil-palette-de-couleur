<script lang="ts">
  import type { Diagnostic } from '../engine';

  let {
    diagnostic,
    showTechnical,
    onapply,
  }: {
    diagnostic: Diagnostic;
    showTechnical: boolean;
    onapply: (changes: { target: string; to: string }[]) => void;
  } = $props();

  const STATUS_LABELS: Record<Diagnostic['status'], string> = {
    pass: '✓ Conforme',
    warn: '⚠ À surveiller',
    fail: '✗ Insuffisant',
  };
</script>

<div class="panel" data-status={diagnostic.status} aria-live="polite">
  <p class="status">
    <strong>{STATUS_LABELS[diagnostic.status]}</strong>
    <span class="rule">{diagnostic.rule}</span>
  </p>
  <p class="plain">{diagnostic.plain}</p>
  <details>
    <summary>Pourquoi ce seuil&nbsp;?</summary>
    <p>{diagnostic.why}</p>
  </details>
  {#if diagnostic.remedies.length > 0}
    <ul class="remedies">
      {#each diagnostic.remedies as remedy (remedy.id)}
        <li>
          <span>→ {remedy.label}</span>
          {#if remedy.change.length > 0}
            <button onclick={() => onapply(remedy.change)}>Appliquer</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if showTechnical && diagnostic.technical}
    <p class="technical">{diagnostic.technical}</p>
  {/if}
</div>

<style>
  .panel {
    border: 1px solid var(--hairline-strong);
    border-left-width: 4px;
    padding: 0.8rem 1rem;
    margin-top: 1rem;
    max-width: 46rem;
    background: #fff;
  }

  .panel[data-status='fail'] {
    border-left-color: var(--ink);
  }

  .status {
    margin: 0 0 0.4rem;
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
  }

  .rule {
    font-size: 0.78rem;
    color: var(--ink-2);
    font-family: var(--font-mono);
  }

  .plain {
    margin: 0 0 0.5rem;
  }

  details {
    font-size: 0.88rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }

  summary {
    cursor: pointer;
    color: var(--ink);
  }

  .remedies {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    display: grid;
    gap: 0.45rem;
  }

  .remedies li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
  }

  .remedies span {
    overflow-wrap: anywhere;
  }

  .technical {
    margin: 0.6rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
