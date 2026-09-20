<script lang="ts">
  /**
   * Panneau d'harmonie, colonne de droite.
   *
   * C'est ici que vivent les corrections et les réglages d'ensemble,
   * comme dans l'outil de référence : le nuancier reste grand au
   * centre, et l'analyse l'accompagne sur le côté. On voit ce qu'on
   * corrige pendant qu'on le corrige.
   */
  import {
    analyzeHarmony,
    libelleForce,
    libelleLuminosite,
    libelleSaturation,
    libelleTemperature,
    AXIS_LABELS,
    FORCE_AMORCEE,
    LIBELLES_SCHEMA,
    SCHEME_LABELS,
    type SchemaVise,
  } from '../engine';
  import { settings } from './state.svelte';
  import { harmonie } from './harmonie.svelte';
  import { journal } from './journal.svelte';
  import { messages } from './messages.svelte';

  const analysis = $derived(analyzeHarmony(settings.colors));

  function labelOf(id: string): string {
    return settings.colors.find((c) => c.id === id)?.label ?? id;
  }

  function hexOf(id: string): string {
    return settings.colors.find((c) => c.id === id)?.hex ?? '#888888';
  }

  function applyFix(id: string, hex: string): void {
    journal.agis(`Correction de ${labelOf(id)}`, () => {
      settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, hex } : c));
    });
  }

  /**
   * Tout corriger d'un coup.
   *
   * Les corrections se répondent : déplacer une couleur change l'analyse
   * des autres. On reboucle donc jusqu'à ce qu'il n'y ait plus de fausse
   * note, avec une borne — sans elle, deux corrections qui s'annulent
   * tourneraient indéfiniment.
   *
   * Les couleurs verrouillées sont exclues : elles ne bougent nulle part
   * dans cet outil, et surtout pas dans une correction automatique.
   */
  const TOURS_MAX = 8;

  function corrigeTout(): void {
    const figees = new Set(settings.colors.filter((c) => c.verrou).map((c) => c.id));
    let courant = settings.colors.map((c) => ({ ...c }));
    let corrigees = 0;

    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const notes = analyzeHarmony(courant).offNotes.filter((n) => !figees.has(n.id));
      if (notes.length === 0) break;
      const note = notes[0]!;
      courant = courant.map((c) => (c.id === note.id ? { ...c, hex: note.fix.hex } : c));
      corrigees += 1;
    }

    if (corrigees === 0) {
      messages.montre('Rien à corriger — l’accord tient déjà.', 'info');
      return;
    }
    journal.agis(`Correction de ${corrigees} couleur${corrigees > 1 ? 's' : ''}`, () => {
      settings.colors = courant;
    });
    messages.succes(
      `${corrigees} couleur${corrigees > 1 ? 's' : ''} corrigée${corrigees > 1 ? 's' : ''}.`,
      { libelle: 'Annuler', faire: () => journal.annule() },
    );
  }

  // — Réglages d'ensemble —

  const SCHEMAS: SchemaVise[] = ['auto', 'analogue', 'complementaire', 'split', 'triadique', 'mono'];

  const CURSEURS = [
    { cle: 'force', label: 'Force d’harmonisation', min: 0, max: 100, libelle: libelleForce },
    { cle: 'temperature', label: 'Température', min: -100, max: 100, libelle: libelleTemperature },
    { cle: 'saturation', label: 'Saturation', min: -100, max: 100, libelle: libelleSaturation },
    { cle: 'luminosite', label: 'Luminosité', min: -100, max: 100, libelle: libelleLuminosite },
  ] as const;

  /**
   * L'aperçu vient du module partagé `harmonie.svelte.ts` : c'est le
   * même calcul que celui affiché sur la grille, à gauche. Une seconde
   * implémentation ici finirait par diverger de celle-là.
   *
   * Il est CALCULÉ, jamais écrit : bouger un curseur ne touche pas au
   * nuancier. C'est « Appliquer » qui décide, en une seule entrée
   * d'historique.
   */

  function choisitSchema(schema: SchemaVise): void {
    harmonie.choisitSchema(schema, FORCE_AMORCEE);
  }

</script>

<div class="panneau-harmonie">
  <section class="bloc">
    <p class="section-titre">
      <span class="glyphe" aria-hidden="true">✳</span>
      Vérification d’harmonie
      {#if analysis.offNotes.length > 0}
        <span class="restantes">{analysis.offNotes.length} restante{analysis.offNotes.length > 1 ? 's' : ''}</span>
      {/if}
    </p>

    <p class="schema-ligne">
      <span class="schema-label">Schéma</span>
      <span class="schema-valeur">{SCHEME_LABELS[analysis.scheme]}</span>
      <span class="schema-score num">{analysis.score}</span>
    </p>

    {#if analysis.offNotes.length === 0}
      <p class="accorde">
        <span aria-hidden="true">✓</span> Tes teintes s’accordent. Aucune fausse note détectée.
      </p>
    {:else}
      {#if analysis.offNotes.length > 1}
        <button class="solid large" onclick={corrigeTout}>Tout corriger</button>
      {/if}
      <div class="corrections">
        {#each analysis.offNotes as note (note.id + note.axis)}
          <article class="correction">
            <p class="corr-action">{note.fix.label}</p>
            <p class="corr-nom">{labelOf(note.id)}</p>
            <div class="corr-duo">
              <span class="corr-sw" style="background:{hexOf(note.id)}"></span>
              <span class="corr-fleche" aria-hidden="true">→</span>
              <span class="corr-sw" style="background:{note.fix.hex}"></span>
              <span class="corr-axe">{AXIS_LABELS[note.axis]}</span>
            </div>
            <p class="corr-raison">{note.reason}</p>
            <p class="corr-effet">{note.consequence}</p>
            <button class="corr-appliquer" onclick={() => applyFix(note.id, note.fix.hex)}>
              Appliquer
            </button>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="bloc">
    <p class="section-titre">
      <span class="glyphe" aria-hidden="true">≋</span> Réglages d’harmonie
    </p>

    <div class="reglages-corps">
      <label class="schema">
        <span class="reg-label">Schéma de teintes visé</span>
        <select
          value={settings.harmonie.schema}
          onchange={(e) => choisitSchema(e.currentTarget.value as SchemaVise)}
        >
          {#each SCHEMAS as sc (sc)}
            <option value={sc}>{LIBELLES_SCHEMA[sc]}</option>
          {/each}
        </select>
      </label>

      {#each CURSEURS as curseur (curseur.cle)}
        <label class="curseur">
          <span class="reg-label">
            {curseur.label}
            <span class="reg-val value">{curseur.libelle(settings.harmonie[curseur.cle])}</span>
          </span>
          <input
            type="range"
            min={curseur.min}
            max={curseur.max}
            step="1"
            value={settings.harmonie[curseur.cle]}
            oninput={(e) => harmonie.regle(curseur.cle, Number(e.currentTarget.value))}
          />
        </label>
      {/each}
    </div>

    {#if harmonie.harmonisationSansEffet}
      <!--
        Le curseur de force est à fond et rien ne bouge : ce n'est pas
        une panne. En mode automatique, le schéma visé est celui que
        l'analyse vient de reconnaître DANS la palette — les teintes
        sont donc déjà posées dessus. Le dire, plutôt que de laisser
        croire à un réglage cassé.
      -->
      <p class="sans-effet">
        Tes teintes sont déjà alignées sur le schéma
        <b>{LIBELLES_SCHEMA[harmonie.schemaVise]}</b> : l’harmonisation n’a rien à déplacer.
        Choisis un schéma explicite pour forcer un autre accord.
      </p>
    {/if}

    {#if harmonie.actif}
      <p class="rappel-apercu">
        Les couleurs sont modifiées à mesure. Un seul Ctrl+Z annule tout le réglage.
      </p>
      <button class="large" onclick={() => harmonie.reinitialise()}>
        Revenir aux couleurs de départ
      </button>
    {/if}
  </section>
</div>

<style>
  .panneau-harmonie {
    display: grid;
    gap: 1.1rem;
  }

  .bloc {
    display: grid;
    gap: 0.55rem;
  }

  .bloc .section-titre {
    margin: 0;
  }

  .restantes {
    margin-inline-start: auto;
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.72rem;
    padding: 0.05rem 0.45rem;
    border-radius: var(--radius-pill);
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    color: var(--text-main);
  }

  .schema-ligne {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.82rem;
  }

  .schema-label {
    color: var(--text-muted);
  }

  .schema-valeur {
    font-weight: 600;
  }

  .schema-score {
    margin-inline-start: auto;
    font-weight: 700;
  }

  .accorde {
    margin: 0;
    font-size: 0.85rem;
    padding: 0.7rem 0.85rem;
    border-radius: var(--radius);
    background: var(--surface-conforme);
    border: 1px solid var(--bord-conforme);
  }

  button.large {
    inline-size: 100%;
    justify-content: center;
  }

  .corrections {
    display: grid;
    gap: 0.5rem;
  }

  /* Une carte par fausse note : l'action en capitales, le nom de la
     couleur, l'avant/après, puis la raison et son effet à l'usage. */
  .correction {
    display: grid;
    gap: 0.3rem;
    padding: 0.8rem 0.85rem;
    border-radius: 14px;
    background: var(--verre);
    backdrop-filter: blur(8px);
    border: 1px solid var(--filet);
  }

  .corr-action {
    margin: 0;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--surface-chrome);
  }

  .corr-nom {
    margin: 0;
    font-family: var(--font-titre);
    font-weight: 300;
    font-size: 16px;
  }

  .corr-duo {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-block: 0.15rem;
  }

  .corr-sw {
    inline-size: 26px;
    block-size: 26px;
    border-radius: 7px;
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.12);
  }

  .corr-fleche {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .corr-axe {
    margin-inline-start: auto;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .corr-raison,
  .corr-effet {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .corr-appliquer {
    inline-size: 100%;
    justify-content: center;
    margin-block-start: 0.35rem;
    font-size: 11.5px;
    min-block-size: 34px;
  }

  .reglages-corps {
    display: grid;
    gap: 0.5rem;
  }

  .schema,
  .curseur {
    display: grid;
    gap: 0.15rem;
  }

  .reg-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .reg-val {
    color: var(--text-main);
    font-size: 11px;
  }

  .rappel-apercu {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .sans-effet {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius);
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
  }



</style>
