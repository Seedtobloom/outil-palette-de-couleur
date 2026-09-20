<script lang="ts">
  /**
   * Étape « Harmonie » : le schéma réellement suivi par la palette, et les
   * couleurs qui en sortent — avec correction applicable en un clic.
   * Un seul verdict, dérivé du calcul (brief §7 étape 2).
   */
  import {
    analyzeHarmony,
    appliqueReglages,
    libelleForce,
    libelleLuminosite,
    libelleSaturation,
    libelleTemperature,
    reglagesNeutres,
    AXIS_LABELS,
    FORCE_AMORCEE,
    LIBELLES_SCHEMA,
    SCHEME_LABELS,
    type SchemaVise,
    type SchemeGuess,
  } from '../engine';
  import { settings } from './state.svelte';
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

  /** Le schéma détecté, traduit vers celui que comprennent les réglages. */
  const SCHEMA_DEPUIS_ANALYSE: Record<SchemeGuess, Exclude<SchemaVise, 'auto'> | null> = {
    monochrome: 'mono',
    analogous: 'analogue',
    complementary: 'complementaire',
    'split-complementary': 'split',
    triadic: 'triadique',
    libre: null,
  };

  const SCHEMAS: SchemaVise[] = ['auto', 'analogue', 'complementaire', 'split', 'triadique', 'mono'];

  const CURSEURS = [
    { cle: 'force', label: 'Force d’harmonisation', min: 0, max: 100, libelle: libelleForce },
    { cle: 'temperature', label: 'Température', min: -100, max: 100, libelle: libelleTemperature },
    { cle: 'saturation', label: 'Saturation', min: -100, max: 100, libelle: libelleSaturation },
    { cle: 'luminosite', label: 'Luminosité', min: -100, max: 100, libelle: libelleLuminosite },
  ] as const;

  /**
   * L'aperçu est CALCULÉ, jamais écrit dans l'état : bouger un curseur
   * ne touche pas au nuancier. C'est « Appliquer » qui décide, en une
   * seule entrée d'historique. Écrire à chaque pixel de glissement
   * remplirait la pile d'annulation et — le piège classique — ferait
   * se recomposer les réglages sur eux-mêmes.
   */
  const apercu = $derived(
    appliqueReglages(settings.colors, settings.harmonie, SCHEMA_DEPUIS_ANALYSE[analysis.scheme]),
  );

  const reglagesActifs = $derived(!reglagesNeutres(settings.harmonie));

  const nbModifiees = $derived(
    apercu.filter((hex, i) => hex !== settings.colors[i]?.hex).length,
  );

  function choisitSchema(schema: SchemaVise): void {
    settings.harmonie.schema = schema;
    // Choisir un schéma sans force ne montrerait rien : on amorce.
    if (schema !== 'auto' && settings.harmonie.force === 0) {
      settings.harmonie.force = FORCE_AMORCEE;
    }
  }

  function reinitialise(): void {
    settings.harmonie.schema = 'auto';
    settings.harmonie.force = 0;
    settings.harmonie.temperature = 0;
    settings.harmonie.saturation = 0;
    settings.harmonie.luminosite = 0;
  }

  function appliqueLesReglages(): void {
    const cible = apercu;
    const n = nbModifiees;
    if (n === 0) return;
    journal.agis(`Réglage de ${n} couleur${n > 1 ? 's' : ''}`, () => {
      settings.colors = settings.colors.map((c, i) => ({ ...c, hex: cible[i] as string }));
    });
    reinitialise();
    messages.succes(`${n} couleur${n > 1 ? 's' : ''} ajustée${n > 1 ? 's' : ''}.`, {
      libelle: 'Annuler',
      faire: () => journal.annule(),
    });
  }
</script>

<div class="wrap">
  <div class="verdict" data-ok={analysis.offNotes.length === 0}>
    <div class="verdict-main">
      <p class="scheme">{SCHEME_LABELS[analysis.scheme]}</p>
      <p class="verdict-text">{analysis.verdict}</p>
    </div>
    <div class="verdict-score">
      <span class="score-num num">{analysis.score}</span>
      <span class="score-cap">harmonie</span>
    </div>
  </div>

  <div class="regularity">
    {#each [['lightness', analysis.regularity.lightness], ['chroma', analysis.regularity.chroma], ['hue', analysis.regularity.hue]] as [axis, value] (axis)}
      <div class="reg">
        <span class="reg-label">Régularité de {AXIS_LABELS[axis as 'hue' | 'chroma' | 'lightness']}</span>
        <span class="reg-bar" aria-hidden="true">
          <span style="inline-size:{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}%"></span>
        </span>
        <span class="reg-value num">{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}</span>
      </div>
    {/each}
  </div>

  {#if analysis.offNotes.length > 0}
    <div class="notes-tete">
      <p class="section-titre">
        <span class="glyphe" aria-hidden="true">✳</span>
        {analysis.offNotes.length} fausse{analysis.offNotes.length > 1 ? 's' : ''} note{analysis.offNotes.length > 1 ? 's' : ''}
      </p>
      {#if analysis.offNotes.length > 1}
        <button class="solid" onclick={corrigeTout}>Tout corriger</button>
      {/if}
    </div>
    <div class="notes">
      {#each analysis.offNotes as note (note.id + note.axis)}
        <article class="note">
          <div class="ba">
            <span class="ba-swatch" style="background:{hexOf(note.id)}" title="Avant"></span>
            <span class="ba-arrow" aria-hidden="true">→</span>
            <span class="ba-swatch" style="background:{note.fix.hex}" title="Après"></span>
          </div>
          <div class="note-body">
            <p class="note-title">
              « {labelOf(note.id)} » — écart de {AXIS_LABELS[note.axis]}
            </p>
            <p class="note-reason">{note.reason}</p>
            <p class="note-conseq">{note.consequence}</p>
          </div>
          <button class="fix" onclick={() => applyFix(note.id, note.fix.hex)}>
            {note.fix.label}
          </button>
        </article>
      {/each}
    </div>
  {:else}
    <p class="accorde">
      <span aria-hidden="true">✓</span> Tes teintes s’accordent. Aucune fausse note détectée.
    </p>
  {/if}

  <!--
    Les réglages d'ensemble. Ils déplacent TOUTE la palette d'un coup,
    là où les corrections ci-dessus traitent une couleur à la fois.

    L'aperçu est calculé sans rien écrire : bouger un curseur ne touche
    pas au nuancier tant qu'on n'a pas cliqué « Appliquer ». C'est ce qui
    permet d'essayer sans risque — et ce qui évite de remplir la pile
    d'annulation d'un cran par pixel de glissement.
  -->
  <section class="reglages">
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
            bind:value={settings.harmonie[curseur.cle]}
          />
        </label>
      {/each}
    </div>

    {#if reglagesActifs}
      <div class="apercu-bande">
        <span class="apercu-titre micro">Avant</span>
        <span class="bande" aria-hidden="true">
          {#each settings.colors as c (c.id)}<span style="background:{c.hex}"></span>{/each}
        </span>
        <span class="apercu-titre micro">Après</span>
        <span class="bande" aria-hidden="true">
          {#each apercu as hex, i (settings.colors[i]?.id ?? i)}
            <span style="background:{hex}"></span>
          {/each}
        </span>
      </div>

      <div class="reglages-actions">
        <button class="solid" onclick={appliqueLesReglages} disabled={nbModifiees === 0}>
          {nbModifiees === 0
            ? 'Rien à appliquer'
            : `Appliquer à ${nbModifiees} couleur${nbModifiees > 1 ? 's' : ''}`}
        </button>
        <button onclick={reinitialise}>Réinitialiser les réglages</button>
      </div>

      {#if settings.colors.some((c) => c.verrou)}
        <p class="note-pied">
          Les couleurs verrouillées ne bougent pas : elles servent d’ancre au schéma de teintes.
        </p>
      {/if}
    {/if}
  </section>
</div>

<style>
  /* — Corrections — */
  .notes-tete {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .notes-tete .section-titre {
    margin: 0;
  }

  .accorde {
    margin: 0;
    font-size: 0.9rem;
    padding: 0.75rem 0.95rem;
    border-radius: var(--radius);
    background: var(--surface-conforme);
    border: 1px solid var(--bord-conforme);
  }

  /* — Réglages d'ensemble — */
  .reglages {
    display: grid;
    gap: 0.7rem;
    padding-block-start: 1.2rem;
    border-block-start: 1px solid var(--filet);
  }

  .reglages .section-titre {
    margin: 0;
  }

  .reglages-corps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.5rem 1.4rem;
  }

  .schema,
  .curseur {
    display: grid;
    gap: 0.2rem;
  }

  .reg-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .reg-val {
    color: var(--text-main);
    font-size: 0.78rem;
  }

  .apercu-bande {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.35rem 0.7rem;
  }

  .bande {
    display: flex;
    gap: 2px;
    block-size: 1.8rem;
  }

  .bande span {
    flex: 1;
    border-radius: 2px;
  }

  .reglages-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .wrap {
    display: grid;
    gap: 1.1rem;
  }

  .verdict {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.1rem 1.3rem;
    border-radius: var(--radius);
    background: var(--surface-panel);
  }

  .verdict[data-ok='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .scheme {
    margin: 0 0 0.15rem;
    font-family: var(--font-titre);
    font-size: 1.2rem;
  }

  .verdict-text {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
    max-inline-size: 34rem;
  }

  .verdict-score {
    display: grid;
    justify-items: center;
    flex-shrink: 0;
  }

  .score-num {
    font-size: 1.9rem;
    line-height: 1;
  }

  .score-cap {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .regularity {
    display: grid;
    gap: 0.35rem;
  }

  .reg {
    display: grid;
    grid-template-columns: 11rem 1fr 2.5rem;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.8rem;
  }

  .reg-label {
    color: var(--text-muted);
  }

  .reg-bar {
    block-size: 4px;
    background: var(--ink-muted);
    border-radius: 2px;
    overflow: hidden;
  }

  .reg-bar span {
    display: block;
    block-size: 100%;
    background: var(--text-main);
  }

  .reg-value {
    text-align: right;
    color: var(--text-muted);
  }

  .notes {
    display: grid;
    gap: 0.6rem;
  }

  .note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'swatches body' '. action';
    align-items: start;
    gap: 0.5rem 1.1rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .ba {
    grid-area: swatches;
  }

  .note-body {
    grid-area: body;
  }

  .fix {
    grid-area: action;
    justify-self: start;
  }

  .ba {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-top: 0.1rem;
  }

  .ba-swatch {
    inline-size: 2.4rem;
    block-size: 2.4rem;
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .ba-arrow {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .note-body {
    display: grid;
    gap: 0.1rem;
  }

  .note-title {
    margin: 0;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .note-reason,
  .note-conseq {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .fix {
    font-size: 0.82rem;
    padding: 0.3rem 0.9rem;
  }

  @media (max-width: 44rem) {
    .note {
      grid-template-columns: 1fr;
      grid-template-areas: 'swatches' 'body' 'action';
    }

    .reg {
      grid-template-columns: 8rem 1fr 2.5rem;
    }
  }
</style>
