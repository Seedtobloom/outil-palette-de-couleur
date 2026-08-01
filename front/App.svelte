<script lang="ts">
  import {
    generatePalette,
    type GeneratedPalette,
    type SchemeName,
    type WheelName,
  } from './engine';
  import { settings } from './lib/state.svelte';
  import GuidedFlow from './lib/GuidedFlow.svelte';
  import PaletteBuilder from './lib/PaletteBuilder.svelte';
  import ColorChecker from './lib/ColorChecker.svelte';
  import ProofBar from './lib/ProofBar.svelte';

  let showTechnical = $state(false);
  let view: 'guided' | 'atelier' | 'check' = $state('guided');
  let loadNotice = $state('');

  const API_BASE: string = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(
    /\/$/,
    '',
  );

  const palette: GeneratedPalette | null = $derived.by(() => {
    try {
      return generatePalette(settings.baseColor, {
        scheme: settings.scheme,
        wheel: settings.wheel,
        intensity: settings.intensity,
        neutralInfluence: settings.neutralInfluence / 100,
        hueTorsion: settings.hueTorsion,
      });
    } catch {
      return null;
    }
  });

  // Ouverture d'un lien de partage (?p=identifiant) : la recette est
  // rechargée dans l'état partagé et on ouvre directement l'atelier.
  $effect(() => {
    const id = new URLSearchParams(location.search).get('p');
    if (!id || !/^[0-9a-z]{16}$/.test(id)) return;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/palettes/${id}`);
        if (!response.ok) throw new Error(String(response.status));
        const stored = (await response.json()) as {
          baseColor: string;
          options: {
            scheme: SchemeName;
            wheel: WheelName;
            intensity: number;
            neutralInfluence: number;
            hueTorsion: number;
          };
        };
        settings.baseColor = stored.baseColor;
        settings.scheme = stored.options.scheme;
        settings.wheel = stored.options.wheel;
        settings.intensity = stored.options.intensity;
        settings.neutralInfluence = Math.round(stored.options.neutralInfluence * 100);
        settings.hueTorsion = stored.options.hueTorsion;
        view = 'atelier';
        loadNotice = 'Palette partagée chargée.';
      } catch {
        loadNotice =
          'Impossible de charger la palette partagée (lien expiré ou service indisponible).';
      }
    })();
  });
</script>

<div class="shell">
  <header>
    <div class="brand">
      <h1>Nuancier</h1>
      <p class="tagline">Atelier de couleur — complet, lisible, vérifié.</p>
    </div>
    {#if palette}
      <div class="mini-palette" aria-hidden="true">
        {#each palette.ramps.primary.steps as s (s.step)}
          <span style="background:{s.hex}"></span>
        {/each}
      </div>
    {/if}
    <nav aria-label="Modes">
      <button aria-pressed={view === 'guided'} onclick={() => (view = 'guided')}>
        Guidé
      </button>
      <button aria-pressed={view === 'atelier'} onclick={() => (view = 'atelier')}>
        Atelier
      </button>
      <button aria-pressed={view === 'check'} onclick={() => (view = 'check')}>
        Vérifier des couleurs
      </button>
    </nav>
    <label class="tech-toggle">
      <input type="checkbox" bind:checked={showTechnical} />
      Valeurs techniques
    </label>
  </header>

  <main>
    {#if loadNotice}
      <p class="notice" role="status">{loadNotice}</p>
    {/if}
    {#if view === 'guided'}
      <GuidedFlow {palette} {showTechnical} onAtelier={() => (view = 'atelier')} />
    {:else if view === 'atelier'}
      <PaletteBuilder {palette} {showTechnical} />
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

{#if view !== 'check'}
  <ProofBar {palette} />
{/if}

<style>
  .shell {
    max-width: 76rem;
    margin: 0 auto;
    padding: 1.1rem 1.25rem 2.2rem;
    display: grid;
    gap: 1.4rem;
    min-height: calc(100vh - 8rem);
    align-content: start;
  }

  header {
    border-bottom: 1px solid var(--hairline-strong);
    padding-bottom: 0.8rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'brand palette tech'
      'brand nav nav';
    align-items: center;
    gap: 0.5rem 1.6rem;
  }

  .brand {
    grid-area: brand;
  }

  h1 {
    font-size: 1.55rem;
    line-height: 1.1;
  }

  .tagline {
    margin: 0.1rem 0 0;
    color: var(--ink-2);
    font-size: 0.82rem;
  }

  .mini-palette {
    grid-area: palette;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 0.9rem;
    max-inline-size: 18rem;
    border: 1px solid var(--hairline);
    border-radius: 2px;
    overflow: hidden;
    align-self: center;
  }

  nav {
    grid-area: nav;
    display: flex;
    gap: 0.35rem;
  }

  .tech-toggle {
    grid-area: tech;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    justify-self: end;
  }

  main {
    display: grid;
    gap: 2rem;
  }

  .notice {
    color: var(--ink);
    background: var(--paper-sunken);
    border-left: 3px solid var(--hairline-strong);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    max-width: 46rem;
  }

  footer {
    border-top: 1px solid var(--hairline);
    padding-top: 0.7rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }

  footer p {
    margin: 0;
  }

  @media (max-width: 48rem) {
    header {
      grid-template-columns: 1fr;
      grid-template-areas: 'brand' 'palette' 'nav' 'tech';
    }

    .tech-toggle {
      justify-self: start;
    }
  }
</style>
