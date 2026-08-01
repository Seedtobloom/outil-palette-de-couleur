<script lang="ts">
  import {
    generatePalette,
    type GeneratedPalette,
    type SchemeName,
    type WheelName,
  } from './engine';
  import { settings } from './lib/state.svelte';
  import Flow from './lib/Flow.svelte';
  import HealthBadge from './lib/HealthBadge.svelte';
  import WitnessStrip from './lib/WitnessStrip.svelte';

  let showTechnical = $state(false);
  let loadNotice = $state('');
  let goToStepId: ((id: string) => void) | undefined = $state();

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
        loadNotice = 'Palette partagée chargée.';
      } catch {
        loadNotice =
          'Impossible de charger la palette partagée (lien expiré ou service indisponible).';
      }
    })();
  });
</script>

<div class="shell">
  <header class="barre">
    <div class="marque">
      <span class="sigle" aria-hidden="true">N</span>
      <span class="nom">Nuancier</span>
    </div>
    <WitnessStrip />
    <div class="barre-outils">
      <HealthBadge onGoToStep={(id) => goToStepId?.(id)} />
      <label class="tech-toggle">
        <input type="checkbox" bind:checked={showTechnical} />
        Détails techniques
      </label>
    </div>
  </header>

  <main>
    {#if loadNotice}
      <p class="notice" role="status">{loadNotice}</p>
    {/if}
    <Flow {palette} {showTechnical} bind:goToStepId />
  </main>

  <footer>
    <p>
      L’outil vérifie les critères d’accessibilité liés à la couleur (WCAG&nbsp;2.2)&nbsp;;
      il ne constitue pas un audit d’accessibilité complet.
    </p>
  </footer>
</div>


<style>
  .shell {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-block-size: 100vh;
  }

  /* — Barre de tête : claire, filet en bas, identité portée par le
       seul sigle carré. Le reste de la barre reste neutre pour ne pas
       peser sur les échantillons jugés juste en dessous. — */
  .barre {
    background: var(--surface-canvas);
    border-block-end: 1px solid rgba(28, 18, 5, 0.1);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 0.75rem var(--pad-lat);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .marque {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* Sigle carré plein — l'unique aplat Terre de la barre. */
  .sigle {
    inline-size: 2rem;
    block-size: 2rem;
    display: grid;
    place-items: center;
    background: var(--surface-chrome);
    color: var(--text-on-chrome);
    border-radius: var(--radius-sm);
    font-family: var(--font-titre);
    font-size: 1.1rem;
    line-height: 1;
  }

  .nom {
    font-family: var(--font-titre);
    font-size: 1.2rem;
    color: var(--text-main);
  }

  .barre-outils {
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: 1.1rem;
  }

  .tech-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  /* — Plan de travail : fond doux, les cartes portent le blanc — */
  main {
    background: var(--surface-panel);
    padding: var(--gap-bloc) var(--pad-lat);
  }

  .notice {
    margin: 0 0 var(--gap-bloc);
    font-style: italic;
    color: var(--text-muted);
    font-size: 0.85rem;
    max-inline-size: var(--mesure);
  }

  footer {
    background: var(--surface-panel);
    border-block-start: 1px solid rgba(28, 18, 5, 0.1);
    color: var(--text-muted);
    padding: 1rem var(--pad-lat);
    font-size: 0.75rem;
  }

  footer p {
    margin: 0;
    max-inline-size: 60rem;
  }
</style>