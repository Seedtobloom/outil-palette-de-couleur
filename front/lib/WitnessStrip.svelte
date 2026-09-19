<script lang="ts">
  /**
   * Bande témoin d'imprimeur — la signature de l'outil.
   * Cases accolées (gap 2px), sans arrondi, dans le header.
   *
   * Elle a porté trois verres — écran, niveaux de gris, deutéranopie —
   * appliqués à la bande elle-même. Les deux derniers sont tombés avec
   * la simulation de daltonisme : il ne reste que les couleurs telles
   * qu'elles sont. Un clic sur une case sélectionne la couleur.
   */
  import { settings } from './state.svelte';

  let { onSelect }: { onSelect?: ((id: string) => void) | undefined } = $props();

</script>

{#if settings.colors.length > 0}
  <div class="witness">
    <div class="strip" role="group" aria-label="Palette en cours">
      {#each settings.colors as c (c.id)}
        <button
          class="case"
          style="background:{c.hex}"
          onclick={() => onSelect?.(c.id)}
          title="{c.label} · {c.hex}"
        >
          <span class="vh">{c.label} {c.hex}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .witness {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    flex-wrap: wrap;
  }

  /*
   * Cases accolées, gap 2px, sans arrondi — gamme de contrôle imprimeur.
   *
   * ⚠ LE CADRE EST BLANC, DANS LES DEUX THÈMES.
   * Il l'était en gris sombre, ce qui suffisait sur une barre claire.
   * En thème sombre, la case la plus foncée de la palette se confondait
   * avec lui et disparaissait — exactement ce que le cadre est censé
   * empêcher. C'est aussi la règle des deux zones (brief §9.1) : cette
   * bande est une zone d'évaluation, elle se lit sur blanc, comme une
   * gamme de contrôle se lit sur le papier.
   */
  .strip {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--blanc);
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.22);
    border-radius: 3px;
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
    outline: 2px solid var(--text-main);
    outline-offset: 1px;
  }
</style>
