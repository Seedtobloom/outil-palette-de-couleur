<script lang="ts">
  /**
   * Étape « Contraste ». Refondue selon la règle d'épure (§9.0) :
   * le spécimen d'abord, le chiffre en preuve à côté.
   *
   * - une décision par écran : LA paire à corriger, en avant/après ;
   * - le reste en liste courte ;
   * - la matrice exhaustive derrière un lien explicite, en second niveau.
   */
  import {
    evaluePaires,
    lectureApca,
    SEUILS,
    LEVEL_A_CHECK,
    findSpotCollisions,
    simulateCvd,
    toGrayscale,
    type PairUse,
  } from '../engine';
  import { settings } from './state.svelte';

  let { showTechnical }: { showTechnical: boolean } = $props();

  const USAGES: { id: PairUse; label: string }[] = [
    { id: 'texte', label: 'Texte courant' },
    { id: 'titre', label: 'Grand texte' },
    { id: 'composant', label: 'Icône, bordure, focus' },
  ];

  let usage: PairUse = $state('texte');
  let matriceOuverte = $state(false);
  /** Index de la paire en cours d'examen dans la liste des échecs. */
  let curseur = $state(0);

  const paires = $derived(evaluePaires(settings.colors, usage));
  const echecs = $derived(paires.filter((p) => p.niveau === null));
  const courante = $derived(echecs[Math.min(curseur, Math.max(0, echecs.length - 1))]);

  const seuil = $derived(SEUILS[usage]);

  function nomDe(id: string): string {
    return settings.colors.find((c) => c.id === id)?.label ?? id;
  }

  function appliquer(id: string, hex: string): void {
    settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, hex } : c));
    curseur = 0;
  }

  function fmt(r: number): string {
    return (Math.floor(r * 100) / 100).toFixed(2).replace('.', ',');
  }

  const spotCollisions = $derived(findSpotCollisions(settings.colors));

  /** Épreuve en trois rangs — ici seulement, là où elle sert (décision validée). */
  const epreuve = $derived([
    { label: 'Écran', hexes: settings.colors.map((c) => c.hex) },
    { label: 'Niveaux de gris', hexes: settings.colors.map((c) => toGrayscale(c.hex)) },
    { label: 'Deutéranopie', hexes: settings.colors.map((c) => simulateCvd(c.hex, 'deutan', 100)) },
  ]);
</script>

<div class="wrap">
  <div class="usages" role="group" aria-label="Usage évalué">
    {#each USAGES as u (u.id)}
      <button
        aria-pressed={usage === u.id}
        onclick={() => {
          usage = u.id;
          curseur = 0;
        }}>{u.label}</button
      >
    {/each}
  </div>
  <p class="regle">{seuil.regle} — il faut {fmt(seuil.aa)}:1</p>

  {#if echecs.length === 0}
    <!-- Rien à décider : on le dit une fois, sans encart décoratif. -->
    <p class="tout-passe">
      <span class="signe" aria-hidden="true">✓</span>
      Les {paires.length} associations passent le seuil. Rien à corriger sur cet usage.
    </p>
  {:else if courante}
    {@const fix = courante.fix}
    <!-- LE spécimen : vrai texte, vraie taille, vraie couleur -->
    <div class="decision">
      <p class="micro">
        À corriger — {curseur + 1} sur {echecs.length}
      </p>
      <h3 class="titre-decision">
        « {nomDe(courante.avantId)} » sur « {nomDe(courante.fondId)} », <i>illisible</i>.
      </h3>

      <div class="specimens">
        <div class="specimen">
          <div
            class="page"
            style="background:{courante.fondHex};color:{courante.avantHex}"
            data-usage={usage}
          >
            <p class="page-titre">Un titre de section</p>
            <p class="page-texte">
              Le texte courant d’un paragraphe, à la taille où on le lit vraiment. C’est ici
              que se juge la lisibilité, pas dans un chiffre.
            </p>
          </div>
          <p class="mesure">
            <span class="ratio value">{fmt(courante.ratio)}:1</span>
            <span class="verdict" data-ok="false"><span aria-hidden="true">✕</span> ne passe pas</span>
          </p>
        </div>

        {#if fix}
          <div class="specimen">
            <div
              class="page"
              style="background:{courante.fondHex};color:{fix.hex}"
              data-usage={usage}
            >
              <p class="page-titre">Un titre de section</p>
              <p class="page-texte">
                Le texte courant d’un paragraphe, à la taille où on le lit vraiment. C’est ici
                que se juge la lisibilité, pas dans un chiffre.
              </p>
            </div>
            <p class="mesure">
              <span class="ratio value">{fmt(fix.ratio)}:1</span>
              <span class="verdict" data-ok="true"><span aria-hidden="true">✓</span> passe AA</span>
            </p>
          </div>
        {/if}
      </div>

      {#if fix}
        <p class="note-pied">{fix.phrase}</p>
        <div class="actions">
          <button class="principal" onclick={() => appliquer(courante.avantId, fix.hex)}>
            Appliquer la correction
          </button>
          {#if echecs.length > 1}
            <button onclick={() => (curseur = (curseur + 1) % echecs.length)}>
              Voir la suivante
            </button>
          {/if}
        </div>
      {:else}
        <p class="note-pied">
          Aucune clarté ne rend cette association lisible : ces deux couleurs ne sont pas faites
          pour se porter l’une l’autre. Sépare-les dans la maquette.
        </p>
        {#if echecs.length > 1}
          <div class="actions">
            <button onclick={() => (curseur = (curseur + 1) % echecs.length)}>Voir la suivante</button>
          </div>
        {/if}
      {/if}

      {#if showTechnical}
        <p class="tech value">
          APCA Lc {courante.lc.toFixed(0)} — {lectureApca(courante.lc, usage)}. Complément
          informatif : la référence normative reste WCAG 2.2.
        </p>
      {/if}
    </div>

    {#if echecs.length > 1}
      <ul class="reste">
        {#each echecs as e, i (e.avantId + e.fondId)}
          {#if i !== curseur}
            <li>
              <button onclick={() => (curseur = i)}>
                <span class="puce" style="background:{e.fondHex};color:{e.avantHex}">Aa</span>
                <span>{nomDe(e.avantId)} sur {nomDe(e.fondId)}</span>
                <span class="value">{fmt(e.ratio)}:1</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  {/if}

  <!-- Second niveau : la vue de contrôle exhaustive -->
  <button class="lien-matrice" onclick={() => (matriceOuverte = !matriceOuverte)}>
    {matriceOuverte ? 'Masquer' : 'Voir'} les {paires.length} associations
  </button>

  {#if matriceOuverte}
    <div class="matrice-scroll">
      <table>
        <caption class="vh">Matrice de toutes les associations</caption>
        <thead>
          <tr>
            <th scope="col"><span class="vh">Sur</span></th>
            {#each settings.colors as c (c.id)}
              <th scope="col"><span class="tete" style="background:{c.hex}"></span>{c.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each settings.colors as ligne (ligne.id)}
            <tr>
              <th scope="row"><span class="tete" style="background:{ligne.hex}"></span>{ligne.label}</th>
              {#each settings.colors as colonne (colonne.id)}
                {#if ligne.id === colonne.id}
                  <td class="diag" aria-hidden="true"></td>
                {:else}
                  {@const p = paires.find((x) => x.avantId === ligne.id && x.fondId === colonne.id)}
                  <td>
                    {#if p}
                      <span class="signe" aria-hidden="true">{p.niveau ? '✓' : '✕'}</span>
                      <span class="value">{fmt(p.ratio)}</span>
                      <span class="niveau">{p.niveau ?? '—'}</span>
                    {/if}
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Épreuve en trois rangs : ici, là où elle sert -->
  <div class="epreuve">
    <p class="micro">L’épreuve</p>
    {#each epreuve as rang (rang.label)}
      <div class="rang">
        <span class="rang-label">{rang.label}</span>
        <span class="rang-bande" aria-hidden="true">
          {#each rang.hexes as hex, i (i)}<span style="background:{hex}"></span>{/each}
        </span>
      </div>
    {/each}
  </div>

  {#if spotCollisions.length > 0}
    <div class="spot">
      <p class="micro">En ton direct</p>
      {#each spotCollisions as c (c.a + c.b)}
        <p class="note-pied">{c.message}</p>
      {/each}
    </div>
  {/if}

  <!-- Niveau A : une vérification, jamais un ratio -->
  <div class="niveau-a">
    <p class="micro">Le niveau A — à vérifier toi-même</p>
    <p class="a-question">{LEVEL_A_CHECK.question}</p>
    <label class="a-check">
      <input type="checkbox" bind:checked={settings.levelAConfirmed} />
      Non — chaque information a un second indice (texte, icône, motif).
    </label>
    <p class="note-pied">{LEVEL_A_CHECK.why}</p>
  </div>
</div>

<style>
  .wrap {
    display: grid;
    gap: var(--gap-bloc);
  }

  .usages {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .usages button {
    font-size: 0.86rem;
    padding: 0.35rem 0.9rem;
    min-block-size: 0;
  }

  .regle {
    margin: -1.6rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .tout-passe {
    margin: 0;
    font-size: 1rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .signe {
    font-weight: 600;
  }

  /* — LA décision — */
  .decision {
    display: grid;
    gap: 0.9rem;
  }

  .titre-decision {
    font-size: 1.6rem;
    margin: -0.5rem 0 0;
  }

  .specimens {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  /* Aucune bordure, aucune ombre : les échantillons sont posés sur le blanc. */
  .page {
    padding: 1.6rem 1.5rem;
    min-block-size: 11rem;
  }

  .page-titre {
    margin: 0 0 0.5rem;
    font-family: var(--font-titre);
    font-size: 1.5rem;
  }

  .page-texte {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
    max-inline-size: var(--mesure);
  }

  /* Grand texte : on montre ce que la norme appelle grand texte. */
  .page[data-usage='titre'] .page-texte {
    font-size: 1.5rem;
    line-height: 1.35;
  }

  .page[data-usage='composant'] .page-texte {
    font-size: 0.9rem;
  }

  .mesure {
    margin: 0.6rem 0 0;
    display: flex;
    align-items: baseline;
    gap: 0.9rem;
  }

  .ratio {
    font-size: 1.6rem;
  }

  .verdict {
    font-size: 0.88rem;
    font-weight: 600;
  }

  .verdict[data-ok='true'] {
    color: var(--conforme);
  }

  .verdict[data-ok='false'] {
    color: var(--non-conforme);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  button.principal {
    background: var(--text-main);
    border-color: var(--text-main);
    color: var(--blanc);
  }

  .tech {
    margin: 0;
    font-size: 0.76rem;
    color: var(--text-muted);
  }

  /* — Le reste, en liste courte — */
  .reste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
    max-inline-size: 34rem;
  }

  .reste button {
    inline-size: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    border: none;
    padding: 0.35rem 0.4rem;
    min-block-size: 44px;
    font-size: 0.85rem;
    text-align: left;
  }

  .reste button:hover {
    background: var(--surface-panel);
  }

  .puce {
    display: grid;
    place-items: center;
    inline-size: 2.2rem;
    block-size: 1.7rem;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .reste .value {
    margin-inline-start: auto;
    color: var(--text-muted);
  }

  .lien-matrice {
    justify-self: start;
    border: none;
    padding: 0;
    min-block-size: 44px;
    text-decoration: underline;
    font-size: 0.86rem;
  }

  .lien-matrice:hover {
    background: none;
  }

  /* — Matrice, second niveau — */
  .matrice-scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    white-space: nowrap;
  }

  thead th,
  tbody th {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .tete {
    display: inline-block;
    inline-size: 0.7rem;
    block-size: 0.7rem;
    margin-right: 0.35rem;
    vertical-align: -0.05em;
  }

  td {
    display: table-cell;
  }

  td .signe {
    margin-right: 0.3rem;
  }

  td .niveau {
    margin-left: 0.35rem;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .diag {
    background: var(--surface-panel);
  }

  /* — Épreuve — */
  .epreuve {
    display: grid;
    gap: 0.25rem;
    max-inline-size: 34rem;
  }

  .rang {
    display: grid;
    grid-template-columns: 8rem 1fr;
    align-items: center;
    gap: 0.8rem;
  }

  .rang-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
  }

  .rang-bande {
    display: flex;
    gap: 2px;
    block-size: 1.1rem;
  }

  .rang-bande span {
    flex: 1;
  }

  .spot,
  .niveau-a {
    display: grid;
    gap: 0.4rem;
    max-inline-size: var(--mesure);
  }

  .niveau-a {
    max-inline-size: 34rem;
  }

  .a-question {
    margin: 0;
    font-size: 0.9rem;
  }

  .a-check {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.88rem;
  }

  @media (max-width: 52rem) {
    .specimens {
      grid-template-columns: 1fr;
    }
  }
</style>
