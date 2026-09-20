<script lang="ts">
  /**
   * Le tiroir des versions, ouvert depuis la barre de tête.
   *
   * Il remplace le bouton « Appliquer » des réglages d'harmonie : les
   * curseurs écrivent directement, donc il faut pouvoir poser un jalon
   * avant d'essayer autre chose — et revenir dessus.
   *
   * `<dialog showModal()>` : le piège à focus, la fermeture par Échap et
   * l'inertie de l'arrière-plan sont tenus par le navigateur.
   */
  import { versions } from './versions.svelte';
  import { settings } from './state.svelte';
  import { messages } from './messages.svelte';
  import { journal } from './journal.svelte';

  let { ouvert = $bindable(false) }: { ouvert?: boolean } = $props();

  let dialogue: HTMLDialogElement | null = $state(null);
  let nouveauNom = $state('');

  $effect(() => {
    if (!dialogue) return;
    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  });

  function enregistre(): void {
    const v = versions.enregistre(nouveauNom);
    if (!v) {
      messages.refus('Le nuancier est vide : il n’y a rien à enregistrer.');
      return;
    }
    nouveauNom = '';
    messages.succes(`« ${v.nom} » enregistrée.`);
  }

  function restaure(id: string): void {
    const v = versions.restaure(id);
    if (!v) return;
    ouvert = false;
    messages.succes(`Retour à « ${v.nom} ».`, {
      libelle: 'Annuler',
      faire: () => journal.annule(),
    });
  }

  function quand(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  }
</script>

<dialog bind:this={dialogue} onclose={() => (ouvert = false)} aria-labelledby="versions-titre">
  <div class="contenu">
    <div class="tete">
      <h2 id="versions-titre">Versions</h2>
      <button class="fermer" onclick={() => (ouvert = false)} aria-label="Fermer">✕</button>
    </div>

    <p class="explication">
      Un point de sauvegarde garde tes couleurs, leurs rôles et les associations retenues. Le
      Ctrl+Z défait le dernier geste ; une version, elle, tient aussi longtemps que tu veux et
      permet de comparer deux pistes.
    </p>

    <div class="ajout">
      <label class="vh" for="nom-version">Nom de cette version</label>
      <input
        id="nom-version"
        bind:value={nouveauNom}
        placeholder="Piste chaude, version client…"
        onkeydown={(e) => {
          if (e.key === 'Enter') enregistre();
        }}
      />
      <button class="solid" onclick={enregistre} disabled={settings.colors.length === 0}>
        Enregistrer
      </button>
    </div>

    {#if versions.liste.length === 0}
      <p class="note-pied">
        Aucune version pour l’instant. Enregistre-en une avant d’essayer un réglage que tu n’es pas
        sûre de garder.
      </p>
    {:else}
      <ul class="liste">
        {#each [...versions.liste].reverse() as v (v.id)}
          <li class="version">
            <span class="bande" aria-hidden="true">
              {#each v.colors as c (c.id)}<span style="background:{c.hex}"></span>{/each}
            </span>
            <div class="infos">
              <input
                class="nom"
                value={v.nom}
                oninput={(e) => versions.renomme(v.id, e.currentTarget.value)}
                aria-label="Nom de la version"
              />
              <p class="meta">
                {v.colors.length} couleur{v.colors.length > 1 ? 's' : ''} · {quand(v.quand)}
              </p>
            </div>
            <div class="actions">
              <button onclick={() => restaure(v.id)}>Revenir</button>
              <button
                class="supprimer"
                onclick={() => versions.supprime(v.id)}
                aria-label={`Supprimer ${v.nom}`}>✕</button
              >
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <p class="note-pied">
      Les versions restent dans ce navigateur, sur cette machine. Rien n’est envoyé ailleurs.
    </p>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    padding: 0;
    border-radius: var(--radius-lg);
    background: var(--surface-canvas);
    color: var(--text-main);
    box-shadow: var(--ombre-flottante);
    max-inline-size: min(34rem, calc(100vw - 2rem));
    inline-size: 100%;
    max-block-size: calc(100dvh - 3rem);
    overflow: auto;
  }

  dialog::backdrop {
    background: rgba(28, 18, 5, 0.42);
    backdrop-filter: blur(6px);
  }

  .contenu {
    display: grid;
    gap: 1rem;
    padding: 1.3rem 1.5rem 1.6rem;
  }

  .tete {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-family: var(--font-titre);
    font-weight: 300;
    font-size: 24px;
    margin: 0;
  }

  .fermer {
    border: none;
    background: none;
    padding: 0.3rem 0.5rem;
    min-block-size: 0;
    color: var(--text-muted);
  }

  .explication {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .ajout {
    display: flex;
    gap: 0.5rem;
  }

  .ajout input {
    flex: 1;
    min-inline-size: 0;
  }

  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .version {
    display: grid;
    grid-template-columns: 5.5rem 1fr auto;
    align-items: center;
    gap: 0.8rem;
    padding: 0.55rem 0.6rem;
    border: 1px solid var(--filet);
    border-radius: 14px;
  }

  /* La bande de couleurs est ce qui permet de reconnaître une version
     d'un coup d'œil — bien mieux que son nom. */
  .bande {
    display: flex;
    gap: 2px;
    block-size: 2.2rem;
  }

  .bande span {
    flex: 1;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.12);
  }

  .infos {
    min-inline-size: 0;
  }

  .nom {
    inline-size: 100%;
    border: none;
    background: none;
    padding: 0;
    min-block-size: 0;
    font-size: 14px;
    font-weight: 500;
  }

  .meta {
    margin: 0;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    gap: 0.3rem;
  }

  .actions button {
    font-size: 12px;
    padding: 0.25rem 0.7rem;
    min-block-size: 34px;
  }

  .supprimer {
    color: var(--text-muted);
    padding-inline: 0.5rem;
  }

  .supprimer:hover {
    color: var(--non-conforme);
    border-color: var(--non-conforme);
  }
</style>
