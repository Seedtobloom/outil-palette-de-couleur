<script lang="ts">
  /**
   * Panneau d'aide : les raccourcis, ce que l'outil vérifie exactement,
   * et les réglages qui n'ont pas leur place dans la barre.
   *
   * `<dialog showModal()>` plutôt qu'une div : le piège à focus, la
   * fermeture par Échap et l'inertie de l'arrière-plan sont alors tenus
   * par le navigateur — trois choses qu'une implémentation maison rate
   * presque toujours.
   */
  import { LIBELLES_THEME, theme, type ModeTheme } from './theme.svelte';
  import { efface } from './persistance.svelte';
  import { messages } from './messages.svelte';
  import { journal } from './journal.svelte';
  import { settings } from './state.svelte';

  let { ouvert = $bindable(false) }: { ouvert?: boolean } = $props();

  let dialogue: HTMLDialogElement | null = $state(null);

  $effect(() => {
    if (!dialogue) return;
    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  });

  /** Sur Mac le modificateur s'affiche ⌘, ailleurs Ctrl. */
  const mod = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl';

  const RACCOURCIS = $derived([
    { touches: `${mod} + Z`, quoi: 'Annuler la dernière action' },
    { touches: `${mod} + ⇧ + Z`, quoi: 'Rétablir' },
    { touches: 'Alt + ←  /  →', quoi: 'Étape précédente / suivante' },
    { touches: '?', quoi: 'Ouvrir cette aide' },
    { touches: 'Échap', quoi: 'Fermer' },
  ]);

  function toutEffacer(): void {
    efface();
    journal.agis('Remise à zéro du nuancier', () => {
      settings.colors = [];
    });
    ouvert = false;
    messages.montre('Nuancier vidé et mémoire locale effacée.', 'info', {
      libelle: 'Annuler',
      faire: () => journal.annule(),
    });
  }
</script>

<dialog bind:this={dialogue} onclose={() => (ouvert = false)} aria-labelledby="aide-titre">
  <div class="contenu">
    <div class="tete">
      <h2 id="aide-titre">Aide-mémoire</h2>
      <button class="fermer" onclick={() => (ouvert = false)} aria-label="Fermer l’aide">✕</button>
    </div>

    <section>
      <p class="section-titre"><span class="glyphe" aria-hidden="true">⌨</span> Raccourcis</p>
      <dl class="raccourcis">
        {#each RACCOURCIS as r (r.touches)}
          <dt><kbd>{r.touches}</kbd></dt>
          <dd>{r.quoi}</dd>
        {/each}
      </dl>
    </section>

    <section>
      <p class="section-titre"><span class="glyphe" aria-hidden="true">◐</span> Ce que l’outil vérifie</p>
      <ul class="liste">
        <li>
          <b>Texte courant</b> — <span class="value">4,5:1</span> minimum (AA),
          <span class="value">7:1</span> pour AAA. WCAG 2.2, SC 1.4.3.
        </li>
        <li>
          <b>Grand texte</b> — <span class="value">3:1</span> à partir de 24 px, ou 18,66 px en
          gras.
        </li>
        <li>
          <b>Éléments non textuels</b> — <span class="value">3:1</span> : bordures de champs,
          icônes porteuses de sens, indicateurs de focus. SC 1.4.11, le critère le plus souvent
          oublié.
        </li>
        <li>
          <b>Écarts perçus</b> — ΔE2000, la mesure du contrôle qualité d’impression, pas la
          distance RVB naïve.
        </li>
      </ul>
      <p class="note-pied">
        Il n’existe pas de « niveau A » de contraste : le seul critère de niveau A lié à la
        couleur, SC 1.4.1, n’impose aucun ratio. Un outil qui étiquette 3:1 « A » se trompe.
      </p>
    </section>

    <section>
      <p class="section-titre"><span class="glyphe" aria-hidden="true">◑</span> Thème de l’interface</p>
      <div class="choix" role="radiogroup" aria-label="Thème de l’interface">
        {#each ['clair', 'sombre', 'auto'] as const as m (m)}
          <button
            role="radio"
            aria-checked={theme.mode === m}
            class:choisi={theme.mode === m}
            onclick={() => (theme.mode = m)}
          >
            {LIBELLES_THEME[m]}
          </button>
        {/each}
      </div>
      <p class="note-pied">
        Le thème sombre n’habille que l’interface. La scène où les couleurs sont jugées reste
        blanche : sur fond noir, un aplat clair paraît plus lumineux qu’il ne l’est, et l’outil
        mentirait sur ce qu’il est censé vérifier.
      </p>
    </section>

    <section>
      <p class="section-titre"><span class="glyphe" aria-hidden="true">⌫</span> Mémoire locale</p>
      <p class="explication">
        Ton nuancier est enregistré dans ce navigateur, sur cette machine. Rien n’est envoyé
        ailleurs — le partage de palette, lui, est un bouton explicite.
      </p>
      <p class="explication">
        Le bouton <strong>⧉</strong> de la barre du haut garde des <strong>versions</strong> :
        des points de sauvegarde nommés, sur lesquels tu peux revenir. Pratique avant d’essayer
        un réglage d’harmonie que tu n’es pas sûre de garder, ou pour comparer deux pistes.
        Elles survivent au vidage ci-dessous : c’est un filet, il ne saute pas avec le reste.
      </p>
      <button onclick={toutEffacer}>Vider le nuancier et la mémoire</button>
    </section>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    padding: 0;
    border-radius: var(--radius-carte);
    background: var(--surface-canvas);
    color: var(--text-main);
    box-shadow: var(--ombre-flottante);
    max-inline-size: min(34rem, calc(100vw - 2rem));
    inline-size: 100%;
    /* Sur un portable ou en zoom 200 %, le contenu dépasse : il défile
       dans la boîte plutôt que d'être coupé (SC 1.4.10). */
    max-block-size: calc(100dvh - 3rem);
    overflow: auto;
  }

  dialog::backdrop {
    background: rgba(28, 18, 5, 0.42);
    backdrop-filter: blur(3px);
  }

  .contenu {
    display: grid;
    gap: 1.4rem;
    padding: 1.3rem 1.5rem 1.6rem;
  }

  .tete {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h2 {
    font-family: var(--font-titre);
    font-size: 1.5rem;
    margin: 0;
  }

  .fermer {
    border: none;
    background: none;
    padding: 0.3rem 0.5rem;
    min-block-size: 0;
    color: var(--text-muted);
  }

  section {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }

  .raccourcis {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 0.9rem;
    margin: 0;
    align-items: baseline;
    font-size: 0.86rem;
    inline-size: 100%;
  }

  .raccourcis dt {
    justify-self: start;
  }

  .raccourcis dd {
    margin: 0;
    color: var(--text-muted);
  }

  kbd {
    font-family: var(--font-ui);
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    padding: 0.15rem 0.45rem;
    border-radius: var(--radius-sm);
    background: var(--surface-panel);
    border: 1px solid var(--filet);
    white-space: nowrap;
  }

  .liste {
    margin: 0;
    padding-inline-start: 1.1rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .liste b {
    color: var(--text-main);
    font-weight: 500;
  }

  .explication {
    margin: 0;
    font-size: 0.86rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .choix {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .choix button {
    font-size: 0.82rem;
    padding: 0.3rem 0.9rem;
    min-block-size: 38px;
  }

  .choix button.choisi {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
  }
</style>
