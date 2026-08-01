<script lang="ts">
  /**
   * Étape « Rôles » : à quoi sert chaque couleur, et ce qu'il ne faut pas
   * lui faire faire. Les conseils viennent du moteur (analyzeUsage), pas
   * de l'interface.
   */
  import { analyzeUsage } from '../engine';
  import { settings } from './state.svelte';

  const cards = $derived(
    settings.colors
      .map((c) => ({ entry: c, usage: analyzeUsage(c.hex) }))
      .filter((u) => u.usage !== null),
  );
</script>

<div class="wrap">
  {#each cards as { entry, usage } (entry.id)}
    {#if usage}
      <article class="role-card">
        <div class="banner" style="background:{entry.hex}">
          <span class="banner-label" style="color:{usage.tests.whiteOn.ratio >= usage.tests.blackOn.ratio ? 'var(--blanc)' : 'var(--ebene)'}">
            {entry.label}
          </span>
        </div>
        <ul class="roles">
          {#each usage.roles as r (r.role)}
            <li data-safe={r.safe}>
              <strong>{r.role}</strong>
              <span>{r.why}</span>
            </li>
          {/each}
        </ul>
      </article>
    {/if}
  {/each}
</div>

<p class="note">
  Ces rôles sont déduits des contrastes réels de chaque couleur : une couleur qui ne peut
  porter ni texte blanc ni texte noir n’est pas une couleur de bouton, quelle que soit sa beauté.
</p>

<style>
  .wrap {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.8rem;
  }

  .role-card {
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .banner {
    block-size: 3.6rem;
    display: grid;
    align-items: center;
    padding: 0 0.9rem;
  }

  .banner-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .roles {
    list-style: none;
    margin: 0;
    padding: 0.6rem 0.9rem 0.8rem;
    display: grid;
    gap: 0.5rem;
  }

  .roles li {
    display: grid;
    gap: 0.1rem;
    font-size: 0.85rem;
  }

  .roles li strong {
    font-weight: 500;
  }

  .roles li[data-safe='false'] strong::before {
    content: '⚠ ';
  }

  .roles li span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .note {
    margin: 1rem 0 0;
    font-size: 0.82rem;
    color: var(--text-muted);
  }
</style>
