<script lang="ts">
  /**
   * Bande témoin d'imprimeur — la signature de l'outil.
   * Cases accolées (gap 2px), sans arrondi, dans le header.
   *
   * Elle est commutable : trois verres — écran, niveaux de gris,
   * deutéranopie — appliqués à la bande de navigation elle-même.
   * Un seul objet, trois lectures : le verre s'applique à l'objet que
   * l'on manipule, plutôt que d'empiler deux bandes à l'écran.
   *
   * Un clic sur une case sélectionne la couleur.
   */
  import { simulateCvd, toGrayscale } from '../engine';
  import { settings } from './state.svelte';

  let { onSelect }: { onSelect?: ((id: string) => void) | undefined } = $props();

  type Lens = 'ecran' | 'gris' | 'deutan';

  const LENSES: { id: Lens; label: string; hint: string }[] = [
    { id: 'ecran', label: 'Écran', hint: 'les couleurs telles qu’elles sont' },
    { id: 'gris', label: 'Niveaux de gris', hint: 'le contrôle de luminance le plus rapide' },
    { id: 'deutan', label: 'Deutéranopie', hint: 'la forme la plus fréquente de daltonisme' },
  ];

  let lens: Lens = $state('ecran');

  function through(hex: string): string {
    if (lens === 'gris') return toGrayscale(hex);
    if (lens === 'deutan') return simulateCvd(hex, 'deutan', 100);
    return hex;
  }

  const current = $derived(LENSES.find((l) => l.id === lens) as (typeof LENSES)[number]);
</script>

{#if settings.colors.length > 0}
  <div class="witness">
    <div class="strip" role="group" aria-label="Palette en cours">
      {#each settings.colors as c (c.id)}
        <button
          class="case"
          style="background:{through(c.hex)}"
          onclick={() => onSelect?.(c.id)}
          title="{c.label} · {c.hex}"
        >
          <span class="vh">{c.label} {c.hex}</span>
        </button>
      {/each}
    </div>

    <div class="lenses" role="group" aria-label="Verre appliqué à la bande">
      {#each LENSES as l (l.id)}
        <button
          class="lens"
          aria-pressed={lens === l.id}
          onclick={() => (lens = l.id)}
          title={l.hint}
        >
          {l.label}
        </button>
      {/each}
    </div>
    <p class="hint">{current.hint}</p>
  </div>
{/if}

<style>
  .witness {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    flex-wrap: wrap;
  }

  /* Cases accolées, gap 2px, sans arrondi — gamme de contrôle imprimeur. */
  /* Fond clair sous la bande : sans lui, une couleur identique au chrome
     disparaîtrait purement et simplement. */
  .strip {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--text-on-chrome-muted);
  }

  .case {
    inline-size: 2.1rem;
    block-size: 1.6rem;
    min-block-size: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    cursor: pointer;
  }

  .case:hover {
    outline: 2px solid var(--text-on-chrome);
    outline-offset: 1px;
  }

  .lenses {
    display: flex;
    gap: 0.15rem;
  }

  .lens {
    border: none;
    background: none;
    color: var(--text-on-chrome-muted);
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    min-block-size: 0;
    border-radius: var(--radius);
  }

  .lens:hover {
    background: rgba(242, 229, 194, 0.12);
    color: var(--text-on-chrome);
  }

  .lens[aria-pressed='true'] {
    background: var(--etape-active);
    color: var(--text-main);
  }

  .hint {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-on-chrome-muted);
    font-style: italic;
  }

  @media (max-width: 54rem) {
    .hint {
      display: none;
    }
  }
</style>
