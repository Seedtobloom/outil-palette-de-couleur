<script lang="ts">
  import { simulateCvd, toGrayscale, type GeneratedPalette } from '../engine';

  let { palette }: { palette: GeneratedPalette | null } = $props();

  let open = $state(true);

  // Les couleurs « qui parlent » : aplats de marque, sémantiques, et trois
  // neutres — l'échantillon que l'on suit pendant toute l'édition.
  const witnesses = $derived.by(() => {
    if (!palette) return [];
    const t = palette.themes.light.tokens;
    const picks = [
      t.primary,
      t.secondary,
      t.accent,
      t['success-content'],
      t['warning-content'],
      t['error-content'],
      t['info-content'],
      t['surface-sunken'],
      t['text-muted'],
      t['text-primary'],
    ];
    return picks.map((p) => p.hex);
  });

  const rows = $derived.by(() => {
    if (witnesses.length === 0) return [];
    return [
      { label: 'Écran', hexes: witnesses },
      { label: 'Niveaux de gris', hexes: witnesses.map((h) => toGrayscale(h)) },
      { label: 'Deutéranopie', hexes: witnesses.map((h) => simulateCvd(h, 'deutan', 100)) },
    ];
  });
</script>

{#if palette}
  <aside class="proof" aria-label="Bande d’épreuve : la palette dans trois états simultanés">
    <button class="proof-toggle" onclick={() => (open = !open)} aria-expanded={open}>
      Bande d’épreuve {open ? '▾' : '▸'}
    </button>
    {#if open}
      <div class="proof-rows">
        {#each rows as row (row.label)}
          <div class="proof-row">
            <span class="proof-label">{row.label}</span>
            <span class="proof-strip" aria-hidden="true">
              {#each row.hexes as hex, i (i)}
                <span style="background:{hex}"></span>
              {/each}
            </span>
          </div>
        {/each}
        <p class="proof-note">Sur papier : arrive avec le module print.</p>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .proof {
    position: sticky;
    bottom: 0;
    background: var(--paper);
    border-top: 1px solid var(--hairline-strong);
    padding: 0.3rem 1.25rem 0.55rem;
    z-index: 10;
  }

  .proof-toggle {
    border: none;
    background: none;
    padding: 0.15rem 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .proof-rows {
    display: grid;
    gap: 3px;
    max-width: 46rem;
  }

  .proof-row {
    display: grid;
    grid-template-columns: 8.5rem 1fr;
    align-items: center;
    gap: 0.8rem;
  }

  .proof-label {
    font-size: 0.72rem;
    color: var(--ink-2);
    text-align: right;
  }

  .proof-strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 16px;
    border: 1px solid var(--hairline);
    border-radius: 2px;
    overflow: hidden;
  }

  .proof-note {
    grid-column: 1 / -1;
    margin: 0.1rem 0 0;
    font-size: 0.7rem;
    color: var(--ink-2);
    padding-left: 9.3rem;
  }

  @media (max-width: 40rem) {
    .proof-row {
      grid-template-columns: 6rem 1fr;
    }

    .proof-note {
      padding-left: 6.8rem;
    }
  }
</style>
