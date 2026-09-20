<script lang="ts">
  import { generatePalette, type GeneratedPalette } from './engine';
  import { settings } from './lib/state.svelte';
  import { parcours } from './lib/parcours.svelte';
  import { journal } from './lib/journal.svelte';
  import { messages } from './lib/messages.svelte';
  import { theme } from './lib/theme.svelte';
  import { restaure, sauvegarde } from './lib/persistance.svelte';
  import { appliqueAmbiance } from './lib/ambiance.svelte';
  import Flow from './lib/Flow.svelte';
  import HealthBadge from './lib/HealthBadge.svelte';
  import Messages from './lib/Messages.svelte';
  import Aide from './lib/Aide.svelte';

  let aideOuverte = $state(false);

  const palette: GeneratedPalette | null = $derived.by(() => {
    try {
      return generatePalette(settings.baseColor, {
        scheme: settings.scheme,
        wheel: settings.wheel,
        intensity: settings.intensity,
        neutralInfluence: settings.neutralInfluence / 100,
        hueTorsion: settings.hueTorsion,
      });
    } catch {
      return null;
    }
  });

  // Le parcours a besoin de savoir qu'une palette existe : c'est ce qui
  // déverrouille les étapes d'analyse avant que le nuancier soit rempli.
  $effect(() => {
    parcours.paletteDisponible = palette !== null;
  });

  // Le fond se teinte de la palette en cours. L'effet LIT l'état et
  // n'écrit que dans le DOM : il ne peut donc pas se relancer lui-même.
  $effect(() => {
    void settings.colors;
    appliqueAmbiance();
  });

  // — Thème : écoute du réglage système, application sur <html> —
  $effect(() => theme.ecoute());

  $effect(() => {
    document.documentElement.dataset.theme = theme.effectif;
  });

  // — Mémoire locale —
  //
  // ⚠ HORS de tout $effect, et c'est la raison d'être de ce commentaire.
  // `restaure()` ÉCRIT dans `settings`, dans le parcours et dans le
  // thème. Placée dans un effet, elle relançait donc l'effet qui venait
  // de l'exécuter : boucle infinie, et une pile de messages « ton
  // nuancier a été retrouvé » qui recouvrait l'écran.
  //
  // Ici, le code s'exécute une fois à l'initialisation du composant. Le
  // journal est vidé juste après : la première chose annulable doit être
  // une action de la graphiste, pas le rechargement de son travail.
  const nuancierRetrouve = restaure();
  journal.oublie();
  if (nuancierRetrouve) {
    messages.montre('Ton nuancier a été retrouvé, tu reprends où tu t’étais arrêtée.', 'info');
  }

  // Enregistrement à chaque changement. La lecture de `settings.colors`
  // et de l'étape courante suffit à abonner l'effet ; `sauvegarde()`
  // prend l'instantané complet.
  $effect(() => {
    void settings.colors;
    void settings.baseColor;
    void parcours.index;
    void theme.mode;
    sauvegarde();
  });

  // — Raccourcis clavier —
  function estChampDeSaisie(cible: EventTarget | null): boolean {
    if (!(cible instanceof HTMLElement)) return false;
    return (
      cible.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)
    );
  }

  function auClavier(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === 'z') {
      // Dans un champ de texte, on laisse l'annulation native du
      // navigateur faire son travail sur la frappe en cours.
      if (estChampDeSaisie(e.target)) return;
      e.preventDefault();
      const refaire = e.shiftKey;
      const label = refaire ? journal.refais() : journal.annule();
      if (label) messages.montre(`${refaire ? 'Rétabli' : 'Annulé'} : ${label}.`, 'info');
      else messages.montre(refaire ? 'Rien à rétablir.' : 'Rien à annuler.', 'info');
      return;
    }

    if (mod && e.key.toLowerCase() === 'y' && !e.shiftKey) {
      if (estChampDeSaisie(e.target)) return;
      e.preventDefault();
      const label = journal.refais();
      if (label) messages.montre(`Rétabli : ${label}.`, 'info');
      return;
    }

    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') parcours.precedent();
      else if (parcours.peutContinuer) parcours.suivant();
      return;
    }

    if (e.key === '?' && !estChampDeSaisie(e.target)) {
      e.preventDefault();
      aideOuverte = true;
    }
  }

  function annuleDepuisBarre(refaire: boolean): void {
    const label = refaire ? journal.refais() : journal.annule();
    if (label) messages.montre(`${refaire ? 'Rétabli' : 'Annulé'} : ${label}.`, 'info');
  }

</script>

<svelte:window onkeydown={auClavier} />

<!--
  Grain. Une turbulence fractale en superposition douce, fixée à l'écran :
  elle casse le lissé du dégradé sans rien coûter en réseau ni ajouter de
  couleur. `pointer-events: none` et `aria-hidden` : elle n'existe que
  pour l'œil. Elle disparaît en contraste élevé forcé (voir app.css), où
  elle ne ferait que brouiller.
-->
<svg class="grain" aria-hidden="true" focusable="false">
  <filter id="grain-nuancier">
    <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#grain-nuancier)" />
</svg>

<div class="shell">
  <header class="barre">
    <div class="rang">
      <div class="marque">
        <span class="sigle" aria-hidden="true">N</span>
        <span class="nom">Nuancier</span>
      </div>

      <!--
        Le fil des étapes, au centre de la barre. Il remplace le rail
        vertical : la navigation reste visible en permanence sans manger
        une colonne entière du plan de travail. Seule l'étape en cours
        porte son nom ; les autres se réduisent à leur pastille.
      -->
      <nav class="fil" aria-label="Étapes du parcours">
        <ol>
          {#each parcours.etapes as etape, i (etape.id)}
            {@const active = parcours.index === i}
            {@const ouverte = parcours.accessible(i)}
            {@const faite = i < parcours.maxAtteint && ouverte && !active}
            <li>
              <button
                class="jalon"
                class:sur-glycine={active}
                class:active
                class:faite
                disabled={!ouverte}
                aria-current={active ? 'step' : undefined}
                onclick={() => parcours.va(i)}
              >
                <span class="pastille" aria-hidden="true">{faite ? '✓' : i + 1}</span>
                <span class="vh">Étape {i + 1} : {etape.short}</span>
                {#if active}<span class="jalon-nom">{etape.short}</span>{/if}
              </button>
            </li>
          {/each}
        </ol>
      </nav>

      <div class="meta">
        <HealthBadge onGoToStep={(id) => parcours.versId(id)} />

        <!-- Historique, thème, aide : trois outils, jamais du contenu.
             Ils restent en icônes pour ne pas concurrencer le fil. -->
        <div class="outils">
          <button
            class="outil"
            disabled={!journal.peutAnnuler}
            title={journal.prochaineAnnulation
              ? `Annuler : ${journal.prochaineAnnulation}`
              : 'Rien à annuler'}
            aria-label={journal.prochaineAnnulation
              ? `Annuler : ${journal.prochaineAnnulation}`
              : 'Rien à annuler'}
            onclick={() => annuleDepuisBarre(false)}>↶</button
          >
          <button
            class="outil"
            disabled={!journal.peutRefaire}
            title={journal.prochaineReprise
              ? `Rétablir : ${journal.prochaineReprise}`
              : 'Rien à rétablir'}
            aria-label={journal.prochaineReprise
              ? `Rétablir : ${journal.prochaineReprise}`
              : 'Rien à rétablir'}
            onclick={() => annuleDepuisBarre(true)}>↷</button
          >
          <button
            class="outil"
            title={theme.effectif === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
            aria-label={theme.effectif === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
            onclick={() => theme.bascule()}>{theme.effectif === 'sombre' ? '☀' : '☾'}</button
          >
          <button
            class="outil"
            title="Aide et raccourcis"
            aria-label="Aide et raccourcis"
            onclick={() => (aideOuverte = true)}>?</button
          >
        </div>

      </div>
    </div>

  </header>

  <main>
    <Flow {palette} />
  </main>

  <footer>
    <p>
      L’outil vérifie les critères d’accessibilité liés à la couleur (WCAG&nbsp;2.2)&nbsp;;
      il ne constitue pas un audit d’accessibilité complet.
    </p>
  </footer>
</div>

<Messages />
<Aide bind:ouvert={aideOuverte} />

<style>
  /* — Grain — posé sur toute la fenêtre, sous l'interface. */
  /* Le grain : un bruit fractal fixe, en superposition douce à 50 %.
     C'est lui qui donne la matière « papier » et empêche les dégradés
     de bander. Il se pose SOUS l'interface (z-index négatif) pour ne
     jamais grisailler un échantillon. */
  .grain {
    position: fixed;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    z-index: -1;
    pointer-events: none;
    opacity: 0.5;
    mix-blend-mode: soft-light;
  }

  /* En contraste élevé forcé, le grain ne ferait que salir. */
  @media (forced-colors: active), (prefers-contrast: more) {
    .grain {
      display: none;
    }
  }

  .shell {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-block-size: 100vh;
    /* Au-dessus du grain. */
    position: relative;
    z-index: 1;
  }

  /* — Barre de tête : claire et translucide, posée sur le dégradé. — */
  /* La barre : verre dépoli au flou le plus fort de l'interface — c'est
     ce qui la pose au-dessus de tout le reste, puisqu'il n'y a pas
     d'ombre. Une simple bordure basse, jamais d'ombre portée. */
  .barre {
    background: var(--verre);
    backdrop-filter: blur(18px) saturate(1.2);
    border-block-end: 1px solid var(--filet);
    padding: 12px var(--pad-lat);
    position: sticky;
    top: 0;
    z-index: 30;
    display: grid;
    gap: 0.5rem;
  }

  .rang {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    inline-size: 100%;
    max-inline-size: var(--largeur-max);
    margin: 0 auto;
  }

  .marque {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* Sigle carré plein — l'unique aplat Terre de la barre. */
  .sigle {
    inline-size: 2rem;
    block-size: 2rem;
    display: grid;
    place-items: center;
    background: var(--surface-chrome);
    color: var(--text-on-chrome);
    border-radius: var(--radius-sm);
    font-family: var(--font-titre);
    font-size: 1.1rem;
    line-height: 1;
  }

  .nom {
    font-family: var(--font-titre);
    font-size: 1.2rem;
    color: var(--text-main);
  }

  /* — Le fil — */
  .fil ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .jalon {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid transparent;
    background: none;
    padding: 0.15rem;
    border-radius: var(--radius-pill);
    min-block-size: 0;
  }

  .jalon:hover:not(:disabled) {
    background: var(--surface-panel);
    border-color: transparent;
  }

  .jalon:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pastille {
    inline-size: 26px;
    block-size: 26px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  /* Étape franchie : la coche remplace le chiffre, sur fond vert pâle.
     Le signe porte l'information, la couleur la renforce. */
  .jalon.faite .pastille {
    background: var(--surface-conforme);
    border-color: var(--bord-conforme);
    color: var(--conforme);
  }

  /*
   * Étape en cours : elle s'ouvre pour porter son nom, en Glycine.
   * La Glycine ne donne que 1,3:1 sur le fond clair — elle ne peut donc
   * pas marquer l'état à elle seule. Ce sont la largeur, le nom affiché
   * et la pastille Terre pleine qui le font ; la teinte ne fait que
   * confirmer (voir chrome.test.ts).
   */
  .jalon.active {
    background: var(--etape-active);
    border-color: color-mix(in oklab, var(--glycine) 70%, var(--ink));
    padding-inline-end: 0.8rem;
  }

  /* L'étape en cours change aussi de FORME : le rond devient un carré
     arrondi. Une différence de forme reste lisible sans la couleur, et
     tient en contraste élevé forcé — ce que la Glycine seule ne fait
     pas (1,31:1, voir chrome.test.ts). */
  /* L'étape en cours : la pastille RÉTRÉCIT et change de forme, de
     26 px ronds à 22 px en carré arrondi. C'est un morphing, pas un
     changement de couleur — il reste lisible en contraste élevé forcé,
     ce que la Glycine seule ne fait pas (1,31:1, voir chrome.test.ts). */
  .jalon.active .pastille {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
    inline-size: 22px;
    block-size: 22px;
    border-radius: 7px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .pastille {
      transition:
        inline-size 160ms ease,
        block-size 160ms ease,
        border-radius 160ms ease,
        background-color 160ms ease;
    }
  }

  .jalon-nom {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--ebene);
    white-space: nowrap;
  }

  .meta {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  /* — Outils : historique, thème, aide — */
  .outils {
    display: flex;
    gap: 0.15rem;
  }

  .outil {
    inline-size: 2rem;
    block-size: 2rem;
    min-block-size: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    border-color: transparent;
    background: none;
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1;
  }

  .outil:hover:not(:disabled) {
    background: var(--surface-panel);
    border-color: var(--filet);
    color: var(--text-main);
  }


  /* — Plan de travail : le fond dégradé vient de html, les cartes
       portent le blanc. — */
  main {
    padding: var(--gap-bloc) var(--pad-lat) 3rem;
  }


  footer {
    border-block-start: 1px solid var(--filet);
    color: var(--text-muted);
    padding: 1rem var(--pad-lat);
    font-size: 0.75rem;
  }

  footer p {
    margin: 0 auto;
    max-inline-size: var(--largeur-max);
  }

  /* Sous 64rem, le fil déborderait : il défile horizontalement plutôt
     que de repousser la marque et le score sur trois lignes. */
  @media (max-width: 64rem) {
    .rang {
      grid-template-columns: 1fr auto;
      row-gap: 0.5rem;
    }

    .fil {
      order: 3;
      grid-column: 1 / -1;
      overflow-x: auto;
      padding-block-end: 0.2rem;
    }
  }
</style>
