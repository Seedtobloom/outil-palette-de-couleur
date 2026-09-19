<script lang="ts">
  import {
    generatePalette,
    type GeneratedPalette,
    type SchemeName,
    type WheelName,
  } from './engine';
  import { settings } from './lib/state.svelte';
  import { parcours } from './lib/parcours.svelte';
  import Flow from './lib/Flow.svelte';
  import HealthBadge from './lib/HealthBadge.svelte';
  import WitnessStrip from './lib/WitnessStrip.svelte';

  let showTechnical = $state(false);
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

  // Le parcours a besoin de savoir qu'une palette existe : c'est ce qui
  // déverrouille les étapes d'analyse avant que le nuancier soit rempli.
  $effect(() => {
    parcours.paletteDisponible = palette !== null;
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
    <div class="rang">
      <div class="marque">
        <span class="sigle" aria-hidden="true">N</span>
        <span class="nom">Nuancier</span>
      </div>

      <!--
        Le fil des étapes, au centre de la barre. Il remplace le rail
        vertical : la navigation reste visible en permanence sans manger
        une colonne entière du plan de travail. Seule l'étape en cours
        porte son nom ; les autres se réduisent à leur pastille.
      -->
      <nav class="fil" aria-label="Étapes du parcours">
        <ol>
          {#each parcours.etapes as etape, i (etape.id)}
            {@const active = parcours.index === i}
            {@const ouverte = parcours.accessible(i)}
            {@const faite = i < parcours.maxAtteint && ouverte && !active}
            <li>
              <button
                class="jalon"
                class:active
                class:faite
                disabled={!ouverte}
                aria-current={active ? 'step' : undefined}
                onclick={() => parcours.va(i)}
              >
                <span class="pastille" aria-hidden="true">{faite ? '✓' : i + 1}</span>
                <span class="vh">Étape {i + 1} : {etape.short}</span>
                {#if active}<span class="jalon-nom">{etape.short}</span>{/if}
              </button>
            </li>
          {/each}
        </ol>
      </nav>

      <div class="meta">
        <HealthBadge onGoToStep={(id) => parcours.versId(id)} />
        <label class="tech-toggle">
          <input type="checkbox" bind:checked={showTechnical} />
          Détails techniques
        </label>
      </div>
    </div>

    <!-- La bande témoin garde sa place : c'est la gamme de contrôle de
         l'imprimeur, elle se lit d'un coup d'œil à tout moment. -->
    <WitnessStrip />
  </header>

  <main>
    {#if loadNotice}
      <p class="notice" role="status">{loadNotice}</p>
    {/if}
    <Flow {palette} {showTechnical} />
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

  /* — Barre de tête : claire et translucide, posée sur le dégradé. — */
  .barre {
    background: color-mix(in oklab, var(--blanc) 78%, transparent);
    backdrop-filter: blur(14px);
    border-block-end: 1px solid var(--filet);
    padding: 0.6rem var(--pad-lat) 0.55rem;
    position: sticky;
    top: 0;
    z-index: 30;
    display: grid;
    gap: 0.5rem;
  }

  .rang {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.5rem;
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

  /* — Le fil — */
  .fil ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .jalon {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid transparent;
    background: none;
    padding: 0.15rem;
    border-radius: var(--radius-pill);
    min-block-size: 0;
  }

  .jalon:hover:not(:disabled) {
    background: var(--surface-panel);
    border-color: transparent;
  }

  .jalon:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pastille {
    inline-size: 1.6rem;
    block-size: 1.6rem;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  /* Étape franchie : la coche remplace le chiffre, sur fond vert pâle.
     Le signe porte l'information, la couleur la renforce. */
  .jalon.faite .pastille {
    background: var(--surface-conforme);
    border-color: var(--bord-conforme);
    color: var(--conforme);
  }

  /*
   * Étape en cours : elle s'ouvre pour porter son nom, en Glycine.
   * La Glycine ne donne que 1,3:1 sur le fond clair — elle ne peut donc
   * pas marquer l'état à elle seule. Ce sont la largeur, le nom affiché
   * et la pastille Terre pleine qui le font ; la teinte ne fait que
   * confirmer (voir chrome.test.ts).
   */
  .jalon.active {
    background: var(--etape-active);
    border-color: color-mix(in oklab, var(--glycine) 70%, var(--ink));
    padding-inline-end: 0.8rem;
  }

  .jalon.active .pastille {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
  }

  .jalon-nom {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ebene);
    white-space: nowrap;
  }

  .meta {
    justify-self: end;
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
    white-space: nowrap;
  }

  /* — Plan de travail : le fond dégradé vient de html, les cartes
       portent le blanc. — */
  main {
    padding: var(--gap-bloc) var(--pad-lat) 3rem;
  }

  .notice {
    margin: 0 auto var(--gap-bloc);
    max-inline-size: 78rem;
    font-style: italic;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  footer {
    border-block-start: 1px solid var(--filet);
    color: var(--text-muted);
    padding: 1rem var(--pad-lat);
    font-size: 0.75rem;
  }

  footer p {
    margin: 0 auto;
    max-inline-size: 78rem;
  }

  /* Sous 64rem, le fil déborderait : il défile horizontalement plutôt
     que de repousser la marque et le score sur trois lignes. */
  @media (max-width: 64rem) {
    .rang {
      grid-template-columns: 1fr auto;
      row-gap: 0.5rem;
    }

    .fil {
      order: 3;
      grid-column: 1 / -1;
      overflow-x: auto;
      padding-block-end: 0.2rem;
    }
  }
</style>
