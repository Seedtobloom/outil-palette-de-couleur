<script lang="ts">
  /**
   * Étape « Ta palette » : la liste complète des couleurs, éditable
   * (ajouter, retirer, dupliquer, verrouiller, réordonner), avec les
   * conseils de couverture — clair / moyen / foncé, doublons, tonalité
   * trop uniforme, palette trop maigre.
   *
   * Toutes les modifications passent par `journal.agis` : chacune est
   * annulable au Ctrl+Z, depuis n'importe quelle étape.
   *
   * L'ordre des couleurs se change à la souris (glisser-déposer) ET au
   * clavier (deux boutons de déplacement, toujours visibles). Le
   * glisser-déposer seul exclurait la moitié des usages — dans un outil
   * d'accessibilité, ce serait difficile à défendre.
   */
  import {
    analyzeCoverage,
    bandOf,
    BAND_LABELS,
    gamutMap,
    maxChroma,
    oklchToHex,
    parseToOklch,
  } from '../engine';
  import { settings, type PaletteEntry } from './state.svelte';
  import { journal } from './journal.svelte';
  import { messages } from './messages.svelte';

  let {
    /** Les conseils de couverture sous la grille. L'étape Harmonie
     *  montre la même grille, mais ses conseils à elle sont dans le
     *  panneau de droite. */
    conseils = true,
    /** Identifiants des couleurs signalées par une analyse : elles
     *  portent une pastille « ! » sur leur aplat. */
    marques = [] as readonly string[],
  }: { conseils?: boolean; marques?: readonly string[] } = $props();

  /** Génère une couleur de remplacement dans la bande manquante, en
   * restant dans la famille de la marque. */
  function suggestFor(band: 'light' | 'mid' | 'dark'): string {
    const base = parseToOklch(settings.baseColor) ?? { l: 0.6, c: 0.1, h: 260 };
    const l = band === 'light' ? 0.93 : band === 'dark' ? 0.28 : 0.6;
    const ratio = band === 'mid' ? 0.85 : 0.45;
    return oklchToHex(gamutMap({ l, c: ratio * maxChroma(l, base.h, 'srgb'), h: base.h }, 'srgb'));
  }

  const report = $derived(analyzeCoverage(settings.colors, suggestFor));

  function idFrais(): string {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  function add(hex?: string, nom?: string): void {
    const next = hex ?? suggestFor('mid');
    const label = nom ?? `Couleur ${settings.colors.length + 1}`;
    journal.agis(`Ajout de ${label}`, () => {
      settings.colors = [...settings.colors, { id: idFrais(), hex: next, label }];
    });
  }

  function remove(entree: PaletteEntry): void {
    journal.agis(`Retrait de ${entree.label}`, () => {
      settings.colors = settings.colors.filter((c) => c.id !== entree.id);
    });
    messages.montre(`« ${entree.label} » retirée.`, 'info', {
      libelle: 'Annuler',
      faire: () => journal.annule(),
    });
  }

  /**
   * Dupliquer : la copie se pose JUSTE APRÈS l'originale, pas en fin de
   * liste. C'est ce qu'on veut en dérivant une nuance d'une couleur —
   * les deux restent côte à côte, la comparaison est immédiate.
   */
  function duplique(entree: PaletteEntry): void {
    journal.agis(`Duplication de ${entree.label}`, () => {
      const i = settings.colors.findIndex((c) => c.id === entree.id);
      const copie: PaletteEntry = {
        id: idFrais(),
        hex: entree.hex,
        label: `${entree.label} (copie)`,
      };
      settings.colors = [
        ...settings.colors.slice(0, i + 1),
        copie,
        ...settings.colors.slice(i + 1),
      ];
    });
  }

  function basculeVerrou(entree: PaletteEntry): void {
    const verrouille = !entree.verrou;
    journal.agis(`${verrouille ? 'Verrouillage' : 'Déverrouillage'} de ${entree.label}`, () => {
      settings.colors = settings.colors.map((c) =>
        c.id === entree.id ? { ...c, verrou: verrouille } : c,
      );
    });
    messages.montre(
      verrouille
        ? `« ${entree.label} » verrouillée : l’ajustement automatique ne la déplacera plus.`
        : `« ${entree.label} » déverrouillée.`,
      'info',
    );
  }

  function update(entree: PaletteEntry, hex: string): void {
    if (entree.verrou) return;
    journal.agis(`Changement de ${entree.label}`, () => {
      settings.colors = settings.colors.map((c) => (c.id === entree.id ? { ...c, hex } : c));
    });
  }

  /**
   * Le renommage n'ouvre PAS une entrée d'historique par frappe : on
   * mémorise l'état au premier caractère, puis on laisse écrire. Sinon
   * dix Ctrl+Z ne remonteraient que « Terr », « Ter », « Te »…
   */
  let renommageEnCours: string | null = null;
  function rename(entree: PaletteEntry, label: string): void {
    const appliquer = () => {
      settings.colors = settings.colors.map((c) => (c.id === entree.id ? { ...c, label } : c));
    };
    if (renommageEnCours === entree.id) appliquer();
    else {
      renommageEnCours = entree.id;
      journal.agis(`Renommage de ${entree.label}`, appliquer);
    }
  }

  function deplace(de: number, vers: number): void {
    if (de === vers || de < 0 || vers < 0 || vers >= settings.colors.length) return;
    const entree = settings.colors[de] as PaletteEntry;
    journal.agis(`Déplacement de ${entree.label}`, () => {
      const suite = [...settings.colors];
      suite.splice(de, 1);
      suite.splice(vers, 0, entree);
      settings.colors = suite;
    });
  }

  // — Glisser-déposer —
  let saisie: number | null = $state(null);
  let cible: number | null = $state(null);


  const bandOfHex = (hex: string) => {
    const c = parseToOklch(hex);
    return c ? bandOf(c) : 'mid';
  };

  const verrouillees = $derived(settings.colors.filter((c) => c.verrou).length);
</script>

<div class="wrap">
  <div class="grid">
    {#each settings.colors as color, i (color.id)}
      <article
        class="card"
        class:saisie={saisie === i}
        class:cible={cible === i && saisie !== i}
        draggable="true"
        ondragstart={(e) => {
          saisie = i;
          e.dataTransfer?.setData('text/plain', String(i));
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        }}
        ondragover={(e) => {
          e.preventDefault();
          cible = i;
        }}
        ondragleave={() => {
          if (cible === i) cible = null;
        }}
        ondrop={(e) => {
          e.preventDefault();
          if (saisie !== null) deplace(saisie, i);
          saisie = null;
          cible = null;
        }}
        ondragend={() => {
          saisie = null;
          cible = null;
        }}
      >
        <label class="swatch" style="background:{color.hex}">
          <input
            type="color"
            value={color.hex}
            disabled={color.verrou}
            oninput={(e) => update(color, e.currentTarget.value)}
            aria-label={`Modifier ${color.label}`}
          />
          {#if marques.includes(color.id)}
            <!-- Fausse note repérée par l'analyse d'harmonie. Le signe
                 porte l'information ; la couleur ne fait que renforcer. -->
            <span class="alerte" title="Cette couleur sort de la logique du groupe">!</span>
          {/if}
          {#if color.verrou}
            <span class="cadenas" aria-hidden="true">🔒</span>
          {/if}
        </label>
        <div class="corps">
        <input
          class="name"
          value={color.label}
          oninput={(e) => rename(color, e.currentTarget.value)}
          onblur={() => (renommageEnCours = null)}
          aria-label="Nom de la couleur"
        />
        <div class="meta">
          <span class="hex value">{color.hex}</span>
          <span class="band">{BAND_LABELS[bandOfHex(color.hex)].replace(/s$/, '')}</span>
        </div>

        <!--
          Barre d'actions. Cibles de 32 px : au-dessus du minimum de
          24 px exigé par WCAG 2.2 SC 2.5.8 (AA). Le 44 px du reste de
          l'interface vient du SC 2.5.5, qui est AAA — impossible à tenir
          pour cinq actions dans une carte de nuancier sans doubler sa
          largeur. Chaque action reste par ailleurs accessible au clavier.
        -->
        <div class="actions">
          <button
            class="act"
            title="Déplacer avant"
            aria-label={`Déplacer ${color.label} avant`}
            disabled={i === 0}
            onclick={() => deplace(i, i - 1)}>⇠</button
          >
          <button
            class="act"
            title="Déplacer après"
            aria-label={`Déplacer ${color.label} après`}
            disabled={i === settings.colors.length - 1}
            onclick={() => deplace(i, i + 1)}>⇢</button
          >
          <button
            class="act"
            title="Dupliquer"
            aria-label={`Dupliquer ${color.label}`}
            onclick={() => duplique(color)}>⧉</button
          >
          <button
            class="act"
            class:actif={color.verrou}
            aria-pressed={color.verrou === true}
            title={color.verrou ? 'Déverrouiller' : 'Verrouiller : ne plus l’ajuster automatiquement'}
            aria-label={`${color.verrou ? 'Déverrouiller' : 'Verrouiller'} ${color.label}`}
            onclick={() => basculeVerrou(color)}>{color.verrou ? '🔒' : '🔓'}</button
          >
          <button
            class="act danger"
            title="Retirer"
            aria-label={`Retirer ${color.label}`}
            onclick={() => remove(color)}>✕</button
          >
        </div>
        </div>
      </article>
    {/each}
    <button class="ajout" onclick={() => add()}>
      <span class="plus" aria-hidden="true">+</span>
      Ajouter une couleur
    </button>
  </div>

  <div class="sous-barre">
    {#if verrouillees > 0}
      <p class="note-verrou">
        <span aria-hidden="true">🔒</span>
        {verrouillees} couleur{verrouillees > 1 ? 's' : ''} verrouillée{verrouillees > 1 ? 's' : ''} :
        l’ajustement automatique corrigera autour, sans y toucher.
      </p>
    {/if}
  </div>

  {#if conseils}
  <div class="advices">
    {#each report.advices as a (a.id)}
      <div class="advice" data-kind={a.kind}>
        <p class="advice-msg">{a.message}</p>
        <p class="advice-why">{a.why}</p>
        {#if a.suggestion}
          <button class="apply" onclick={() => add(a.suggestion?.hex, a.suggestion?.label)}>
            <span class="chip" style="background:{a.suggestion.hex}" aria-hidden="true"></span>
            Ajouter cette {a.suggestion.label}
          </button>
        {/if}
      </div>
    {/each}
  </div>
  {/if}
</div>

<style>
  /* La pastille d'alerte occupe le coin de l'aplat ; le cadenas se
     décale alors à gauche pour ne pas la recouvrir. */
  .alerte {
    position: absolute;
    inset-block-start: 8px;
    inset-inline-end: 8px;
    inline-size: 20px;
    block-size: 20px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--non-conforme);
    color: var(--blanc);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 2px 6px rgba(28, 18, 5, 0.25);
    pointer-events: none;
    z-index: 3;
  }

  .swatch:has(.alerte) .cadenas {
    inset-inline-end: auto;
    inset-inline-start: 8px;
  }

  .wrap {
    display: grid;
    gap: 1.1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(146px, 1fr));
    gap: 14px;
  }

  /*
   * La carte est une surface de verre, pas une liste d'éléments posés
   * sur le fond : l'aplat occupe toute la largeur en haut, les
   * commandes sont dessous, séparées par un filet. Au survol elle
   * lévite de 3 px — c'est le seul retour de profondeur, puisqu'il n'y
   * a pas d'ombre.
   */
  .card {
    display: grid;
    gap: 0;
    padding: 0;
    background: var(--verre);
    backdrop-filter: blur(10px);
    border: 1px solid var(--filet);
    border-radius: 16px;
    overflow: hidden;
    text-align: left;
    justify-items: stretch;
    align-content: start;
    transition: transform 180ms ease, border-color 180ms ease;
  }

  .card:hover {
    transform: translateY(-3px);
    border-color: var(--filet-fort);
  }

  .corps {
    display: grid;
    gap: 0.3rem;
    padding: 11px 13px 13px;
  }

  .card.saisie {
    opacity: 0.4;
  }

  .card:hover .cadenas,
  .card:focus-within .cadenas {
    opacity: 1;
  }

  /* La carte visée par le dépôt : un filet, pas un déplacement — rien ne
     doit bouger sous le curseur pendant qu'on vise. */
  /* Cible de dépôt : un contour POINTILLÉ décalé, pas une bordure —
     une bordure décalerait la mise en page sous le curseur. */
  .card.cible {
    outline: 2px dashed var(--surface-chrome);
    outline-offset: 2px;
  }

  /* Aplat : 96 px, pleine largeur, coins haut arrondis par
     l'`overflow:hidden` de la carte. Le liseré INTÉRIEUR délimite les
     teintes très claires sans poser d'ombre sur l'échantillon. */
  .swatch {
    position: relative;
    display: block;
    block-size: 96px;
    cursor: grab;
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.12);
  }

  .swatch:active {
    cursor: grabbing;
  }

  .swatch input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    border: none;
    cursor: pointer;
  }

  .swatch input:disabled {
    cursor: not-allowed;
  }

  /* Le cadenas n'apparaît qu'au survol — sauf s'il est fermé, auquel
     cas il reste visible : c'est un état, pas une commande. */
  .cadenas {
    position: absolute;
    inset-block-start: 8px;
    inset-inline-end: 8px;
    font-size: 0.8rem;
    line-height: 1;
    opacity: 0;
    transition: opacity 150ms ease;
    /* Pastille blanche : le cadenas doit rester lisible quelle que soit
       la couleur en dessous — c'est exactement le cas d'usage du 3:1
       non textuel (SC 1.4.11), et aucune teinte d'échantillon ne peut le
       garantir seule. */
    background: var(--blanc);
    border-radius: var(--radius-pill);
    padding: 0.12rem 0.2rem;
    box-shadow: 0 0 0 1px rgba(28, 18, 5, 0.18);
  }

  .name {
    border: none;
    background: none;
    padding: 0;
    font-size: 0.9rem;
    font-weight: 500;
    inline-size: 100%;
    min-block-size: 0;
  }

  .name:focus-visible {
    outline-offset: 3px;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .band {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-block-start: 10px;
    padding-block-start: 10px;
    border-block-start: 1px solid var(--filet);
  }

  .act {
    flex: 1;
    min-block-size: 32px;
    padding: 0;
    font-size: 0.8rem;
    line-height: 1;
    border-radius: var(--radius-sm);
    border-color: transparent;
    background: var(--surface-panel);
    color: var(--text-muted);
  }

  .act:hover:not(:disabled) {
    background: var(--surface-attente);
    border-color: var(--filet-fort);
    color: var(--text-main);
  }

  .act.actif,
  .act[aria-pressed='true'] {
    background: var(--surface-conforme);
    border-color: var(--bord-conforme);
    color: var(--text-main);
  }

  .act.danger:hover:not(:disabled) {
    color: var(--non-conforme);
    border-color: var(--non-conforme);
  }

  .ajout {
    display: grid;
    place-items: center;
    gap: 12px;
    min-block-size: 206px;
    border: 1.5px dashed var(--filet-fort);
    border-radius: 16px;
    background: var(--surface-attente);
    color: var(--text-muted);
    font-size: 0.82rem;
    align-self: start;
  }

  .plus {
    font-size: 1.3rem;
    line-height: 1;
  }

  .sous-barre {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    flex-wrap: wrap;
  }


  .note-verrou {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-muted);
    max-inline-size: var(--mesure);
  }

  .advices {
    display: grid;
    gap: 0.6rem;
  }

  .advice {
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    background: var(--surface-panel);
    display: grid;
    gap: 0.25rem;
    justify-items: start;
  }

  .advice[data-kind='ok'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .advice-msg {
    margin: 0;
    font-weight: 500;
  }

  .advice-why {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .apply {
    margin-top: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    padding: 0.25rem 0.8rem;
  }

  .chip {
    inline-size: 0.9rem;
    block-size: 0.9rem;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }
</style>
