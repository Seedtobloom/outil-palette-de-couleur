<script lang="ts">
  /**
   * Étape « Réseaux sociaux ».
   *
   * Les couleurs sont tirées de la palette, pas inventées : chaque
   * famille est présentée sur sa propre ligne, claire → aplat → profonde,
   * pour qu'on voie d'un coup d'œil que c'est bien la même couleur qui
   * s'étire, et pas une nouvelle teinte qui s'invite.
   */
  import { socialPalette, SOCIAL_NOTE } from '../engine';
  import { settings } from './state.svelte';

  const colors = $derived(socialPalette(settings.colors));

  /** Regroupées par couleur d'origine, dans l'ordre de la palette. */
  const familles = $derived.by(() => {
    const map = new Map<string, typeof colors>();
    for (const c of colors) {
      const liste = map.get(c.sourceId) ?? [];
      liste.push(c);
      map.set(c.sourceId, liste);
    }
    return [...map.values()];
  });

  function fmt(r: number): string {
    return (Math.floor(r * 10) / 10).toFixed(1).replace('.', ',');
  }
</script>

<div class="wrap">
  {#if familles.length === 0}
    <p class="note">
      Ta palette n’a pas encore de couleur teintée à décliner. Ajoute au moins une couleur de
      marque à l’étape Nuancier : les nuances de réseaux sociaux en sortiront toutes seules.
    </p>
  {/if}

  {#each familles as famille (famille[0]?.sourceId)}
    <section class="famille">
      <p class="micro">{famille[0]?.sourceLabel}</p>
      <div class="grid">
        {#each famille as c (c.hex)}
          <article class="card">
            <div class="fill" style="background:{c.hex}"></div>
            <div class="body">
              <p class="label">{c.ton}</p>
              <span class="hex value">{c.hex}</span>
              <p class="use">{c.use}</p>
              <p class="feeds">
                <span data-ok={c.onLight >= 3}>flux clair <span class="num">{fmt(c.onLight)}</span></span>
                <span data-ok={c.onDark >= 3}>flux sombre <span class="num">{fmt(c.onDark)}</span></span>
              </p>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/each}

  <!-- Mise en situation : deux vignettes de post -->
  <div class="posts">
    {#each colors.slice(0, 2) as c (c.hex)}
      <div class="post" style="background:{c.hex}">
        <p class="post-kicker" style="color:{c.onDark > c.onLight ? 'var(--ebene)' : 'var(--blanc)'}">Votre marque</p>
        <p class="post-title" style="color:{c.onDark > c.onLight ? 'var(--ebene)' : 'var(--blanc)'}">
          Un titre de post,<br />lisible en petit.
        </p>
      </div>
    {/each}
  </div>

  <p class="note">{SOCIAL_NOTE}</p>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1rem;
  }

  .famille {
    display: grid;
    gap: 0.4rem;
  }

  .famille .micro {
    margin: 0;
  }

  /* Trois colonnes fixes : claire, aplat, profonde se lisent comme une
     progression, pas comme une grille de couleurs sans rapport. */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.7rem;
  }

  @media (max-width: 46rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .card {
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .fill {
    block-size: 4.2rem;
  }

  .body {
    padding: 0.55rem 0.7rem 0.7rem;
    display: grid;
    gap: 0.2rem;
  }

  .label {
    margin: 0;
    font-weight: 500;
    font-size: 0.88rem;
  }

  .body .hex {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .use {
    margin: 0.15rem 0 0;
    font-size: 0.76rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .feeds {
    margin: 0.3rem 0 0;
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .feeds span {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .feeds > span[data-ok='true']::before {
    content: '✓ ';
  }

  .feeds > span[data-ok='false']::before {
    content: '· ';
  }

  .posts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.7rem;
  }

  .post {
    aspect-ratio: 1;
    border-radius: var(--radius);
    padding: 1.1rem;
    display: grid;
    align-content: end;
    gap: 0.3rem;
  }

  .post-kicker {
    margin: 0;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .post-title {
    margin: 0;
    font-family: var(--font-titre);
    font-size: 1.35rem;
    line-height: 1.15;
  }

  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>
