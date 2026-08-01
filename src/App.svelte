<script lang="ts">
  import ColorChecker from './lib/ColorChecker.svelte';
  import PaletteBuilder from './lib/PaletteBuilder.svelte';

  let showTechnical = $state(false);
  let view: 'build' | 'check' = $state('build');
</script>

<div class="layout">
  <header>
    <h1>Nuancier</h1>
    <p class="tagline">Atelier de couleur — des palettes complètes, lisibles et vérifiées.</p>
    <nav aria-label="Sections">
      <button aria-pressed={view === 'build'} onclick={() => (view = 'build')}>
        Construire une palette
      </button>
      <button aria-pressed={view === 'check'} onclick={() => (view = 'check')}>
        Vérifier des couleurs
      </button>
    </nav>
    <label class="tech-toggle">
      <input type="checkbox" bind:checked={showTechnical} />
      Afficher les valeurs techniques
    </label>
  </header>

  <main>
    {#if view === 'build'}
      <PaletteBuilder {showTechnical} />
    {:else}
      <ColorChecker {showTechnical} />
    {/if}
  </main>

  <footer>
    <p>
      L’outil vérifie les critères d’accessibilité liés à la couleur (WCAG&nbsp;2.2)&nbsp;;
      il ne constitue pas un audit d’accessibilité complet.
    </p>
  </footer>
</div>

<style>
  .layout {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    display: grid;
    gap: 1.6rem;
  }

  header {
    border-bottom: 1px solid var(--hairline-strong);
    padding-bottom: 0.9rem;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 0.35rem 1rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  .tagline {
    margin: 0;
    grid-column: 1;
    color: var(--ink-2);
  }

  nav {
    grid-column: 1;
    display: flex;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }

  .tech-toggle {
    grid-column: 2;
    grid-row: 1 / span 3;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-2);
  }

  main {
    display: grid;
    gap: 2rem;
  }

  footer {
    border-top: 1px solid var(--hairline);
    padding-top: 0.75rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }

  footer p {
    margin: 0;
  }
</style>
