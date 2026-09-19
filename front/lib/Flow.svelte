<script lang="ts">
  /**
   * LE parcours, en six étapes : Départ, Nuancier, Harmonie, Rôles,
   * Contraste, Livraison. Tout l'outil vit ici — rien n'est ailleurs.
   *
   * Il en a compté onze, dont un choix de projet, une étape de sélection
   * de la couleur de base, une étape de génération de rampes, une étape
   * d'impression et une de déclinaison réseaux sociaux. Elles sont
   * tombées pour ramener l'outil au périmètre de la référence.
   */
  import {
    gamutMap,
    oklchToHex,
    parseToOklch,
    exportCss,
    exportAse,
    exportPlancheSvg,
    generatePalette,
    type GeneratedPalette,
  } from '../engine';
  import { settings, MOODS, type StartMode } from './state.svelte';
  import { parcours } from './parcours.svelte';
  import { messages } from './messages.svelte';
  import StepPalette from './StepPalette.svelte';
  import StepHarmony from './StepHarmony.svelte';
  import StepContrast from './StepContrast.svelte';
  import StepRoles from './StepRoles.svelte';
  import SidePanel from './SidePanel.svelte';
  import ImportImage from './ImportImage.svelte';

  let {
    palette,
    showTechnical,
  }: {
    palette: GeneratedPalette | null;
    showTechnical: boolean;
  } = $props();

  // Par défaut, le panneau ouvert est celui du collage de palette : c'est
  // la porte d'entrée la plus fréquente, et elle doit être visible sans
  // avoir à cliquer quoi que ce soit.
  let startMode: StartMode = $state('palette');

  const current = $derived(parcours.courante);

  /**
   * Verse la palette générée dans le nuancier si la graphiste n'y a pas
   * encore touché.
   *
   * Branché sur le parcours plutôt que sur un seul bouton : quel que soit
   * le chemin d'entrée — « Continuer », clic dans le fil, saut depuis le
   * score de santé — l'étape s'ouvre avec de la matière à analyser.
   */
  parcours.onEntree = () => {
    if (settings.colors.length === 0 && palette) seedColors(palette);
  };

  function next(): void {
    parcours.suivant();
  }

  function seedColors(p: GeneratedPalette): void {
    const t = p.themes.light.tokens;
    settings.colors = [
      { id: 'g1', hex: t.primary.hex, label: 'Principale' },
      { id: 'g2', hex: t.secondary.hex, label: 'Secondaire' },
      { id: 'g3', hex: t.accent.hex, label: 'Accent' },
      { id: 'g4', hex: p.ramps.neutral.steps[1]!.hex, label: 'Gris clair' },
      { id: 'g5', hex: p.ramps.neutral.steps[9]!.hex, label: 'Gris foncé' },
    ];
  }

  /**
   * Les points de départ, dans l'ordre de fréquence réelle : on arrive
   * presque toujours avec quelque chose — une charte imposée, un logo,
   * une photo — et beaucoup plus rarement d'une page blanche.
   */
  const DEPARTS: { id: StartMode; label: string; hint: string; consigne: string }[] = [
    {
      id: 'palette',
      label: 'J’ai une palette',
      hint: 'à valider, à compléter',
      consigne: 'Colle tes couleurs — une par ligne, ou séparées par des espaces',
    },
    {
      id: 'color',
      label: 'J’ai une couleur',
      hint: 'un hex, un logo',
      consigne: 'Entre ta couleur — elle sera conservée exactement',
    },
    {
      id: 'image',
      label: 'J’ai une image',
      hint: 'photo, moodboard',
      consigne: 'Choisis une image — l’analyse reste dans ton navigateur',
    },
    {
      id: 'mood',
      label: 'Une ambiance',
      hint: 'au feeling',
      consigne: 'Choisis une ambiance de départ — tout reste modifiable ensuite',
    },
  ];

  const DEPART_COURANT = $derived(
    DEPARTS.find((d) => d.id === startMode) ?? (DEPARTS[0] as (typeof DEPARTS)[number]),
  );

  function moodHex(mood: (typeof MOODS)[number]): string {
    return oklchToHex(gamutMap({ l: mood.l, c: mood.c, h: mood.hue }, 'srgb'));
  }

  // Import d'une palette existante (le point d'entrée le plus fréquent :
  // une charte à valider ou à compléter).
  let pastedColors = $state('');
  const parsedPaste = $derived(
    pastedColors
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => parseToOklch(t))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => oklchToHex(gamutMap(c, 'srgb'))),
  );

  function importPasted(): void {
    if (parsedPaste.length === 0) return;
    settings.colors = parsedPaste.map((hex, i) => ({
      id: `p${i}`,
      hex,
      label: `Couleur ${i + 1}`,
    }));
    settings.baseColor = parsedPaste[0] as string;
    next();
  }

  // Pipette écran : API EyeDropper, avec repli explicite quand elle
  // n'est pas exposée (Firefox, Safari).
  const pipetteDisponible =
    typeof window !== 'undefined' && 'EyeDropper' in window;

  async function pipette(): Promise<void> {
    try {
      const Outil = (window as unknown as {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
      }).EyeDropper;
      const { sRGBHex } = await new Outil().open();
      settings.baseColor = sRGBHex;
    } catch {
      // Annulation par la personne : rien à signaler.
    }
  }

  const baseValid = $derived(parseToOklch(settings.baseColor) !== null);

  const etapeSuivante = $derived(parcours.suivante);
  const conditionSuivante = $derived(parcours.conditionSuivante);
  const peutContinuer = $derived(parcours.peutContinuer);

  /**
   * Un seul export de code : les variables CSS du système généré.
   * Tailwind, DTCG et SCSS sont tombés avec le reste — la référence ne
   * sort que du CSS, du SVG, du PNG, du PDF, de l'ASE et du JSON.
   */
  const FICHIER_CSS = 'nuancier.css';
  let copied = $state(false);

  const exportText = $derived(palette ? exportCss(palette) : '');

  async function copyExport(): Promise<void> {
    await navigator.clipboard.writeText(exportText);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

  /** Déclenche un téléchargement à partir d'un contenu en mémoire. */
  function telecharge(contenu: BlobPart, nom: string, type: string): void {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
  }

  function telechargeTexte(): void {
    telecharge(exportText, FICHIER_CSS, 'text/css;charset=utf-8');
    messages.succes(`${FICHIER_CSS} téléchargé.`);
  }

  function telechargeAse(): void {
    const octets = exportAse(settings.colors, 'Nuancier');
    telecharge(octets, 'nuancier.ase', 'application/octet-stream');
    messages.succes('nuancier.ase téléchargé — à ouvrir dans le panneau Nuancier d’Illustrator.');
  }

  const plancheSvg = $derived(exportPlancheSvg(settings.colors));

  function telechargePlancheSvg(): void {
    telecharge(plancheSvg, 'planche-nuancier.svg', 'image/svg+xml;charset=utf-8');
    messages.succes('planche-nuancier.svg téléchargée.');
  }

  /**
   * La même planche en PNG, pour les envois où un SVG n'est pas lisible
   * (messageries, présentations). Rasterisée à 2× via un canvas : le
   * dessin reste défini par la fonction pure du moteur, l'interface ne
   * fait que le mettre en pixels.
   */
  function telechargePlanchePng(): void {
    const echelle = 2;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([plancheSvg], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * echelle;
      canvas.height = image.height * echelle;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
        return;
      }
      ctx.scale(echelle, echelle);
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
          return;
        }
        telecharge(blob, 'planche-nuancier.png', 'image/png');
        messages.succes('planche-nuancier.png téléchargée.');
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
    };
    image.src = url;
  }

  const BRAND_RAMPS = [
    ['primary', 'Principale'],
    ['secondary', 'Secondaire'],
    ['accent', 'Accent'],
    ['neutral', 'Gris'],
  ] as const;

  const SEM_RAMPS = [
    ['success', 'Succès'],
    ['warning', 'Attention'],
    ['error', 'Erreur'],
    ['info', 'Info'],
  ] as const;

  void generatePalette; // (le calcul vit dans App, qui passe `palette`)
</script>

<div class="flow">
  {#key current.id}
    <section class="stage zone-evaluation">
      <header class="stage-head">
        <p class="etape-num">Étape {parcours.index + 1}</p>
        <h2>{@html current.title.replace(/(\w+)\.$/, '<i>$1</i>.')}</h2>
        {#if current.lead}<p class="lead">{current.lead}</p>{/if}
      </header>

      {#if current.id === 'start'}
        <!--
          Les quatre entrées se comportent à l'identique : on choisit, le
          panneau s'ouvre juste en dessous, on fait la chose. Avant, « j'ai
          une couleur » sautait à l'étape suivante pendant que les trois
          autres ouvraient un panneau : cliquer « j'ai une palette » avait
          donc l'air de ne rien faire.
          « J'ai une palette » vient en premier : c'est l'entrée la plus
          fréquente — on arrive avec une charte à valider, pas de zéro.
        -->
        <div class="choices three" role="radiogroup" aria-label="Point de départ">
          {#each DEPARTS as d (d.id)}
            <button
              class="choice"
              role="radio"
              aria-checked={startMode === d.id}
              onclick={() => (startMode = d.id)}
            >
              <strong>{d.label}</strong><small>{d.hint}</small>
            </button>
          {/each}
        </div>

        <div class="panneau-depart">
          <p class="micro">{DEPART_COURANT.consigne}</p>

          {#if startMode === 'palette'}
            <div class="paste">
              <label class="vh" for="paste-hex">Tes couleurs en hexadécimal</label>
              <textarea
                id="paste-hex"
                rows="4"
                bind:value={pastedColors}
                placeholder="#1a1a2e&#10;#f7f5ef&#10;#c0392b"
                spellcheck="false"
              ></textarea>
              {#if parsedPaste.length > 0}
                <span class="paste-preview" aria-hidden="true">
                  {#each parsedPaste as hex (hex)}<span style="background:{hex}"></span>{/each}
                </span>
              {/if}
              <button class="solid" onclick={importPasted} disabled={parsedPaste.length === 0}>
                {parsedPaste.length === 0
                  ? 'Importer'
                  : `Importer ${parsedPaste.length} couleur${parsedPaste.length > 1 ? 's' : ''}`}
              </button>
              {#if pastedColors.trim() !== '' && parsedPaste.length === 0}
                <p class="note-pied">
                  Aucune couleur reconnue là-dedans. Les formats lus sont le hexadécimal
                  (#1a1a2e), rgb(), hsl() et oklch().
                </p>
              {/if}
            </div>
          {:else if startMode === 'color'}
            <div class="depart-couleur">
              <label class="pick-swatch petite" style="background:{baseValid ? settings.baseColor : '#ccc'}">
                <input type="color" bind:value={settings.baseColor} aria-label="Choisir la couleur" />
              </label>
              <input
                class="pick-hex"
                type="text"
                bind:value={settings.baseColor}
                spellcheck="false"
                aria-label="Couleur en hexadécimal"
              />
              {#if pipetteDisponible}
                <button onclick={pipette}>Pipeter à l’écran</button>
              {/if}
              <button class="solid" onclick={next} disabled={!baseValid}>Continuer</button>
            </div>
          {:else if startMode === 'image'}
            <ImportImage onImporte={next} />
          {:else}
            <div class="moods">
              {#each MOODS as mood (mood.id)}
                <button
                  class="mood"
                  style="--mood:{moodHex(mood)}"
                  onclick={() => { settings.baseColor = moodHex(mood); next(); }}
                >
                  <span class="mood-fill" aria-hidden="true"></span>
                  <span class="mood-name">{mood.label}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if current.id === 'palette'}
        <StepPalette {palette} />
      {:else if current.id === 'harmony'}
        <StepHarmony />
      {:else if current.id === 'roles'}
        <StepRoles />
      {:else if current.id === 'contrast'}
        <StepContrast {showTechnical} />
      {:else if current.id === 'deliver'}
        {#if palette}
          <div class="previews">
            {#each ['light', 'dark'] as const as mode (mode)}
              {@const t = palette.themes[mode].tokens}
              <div class="preview" style="background:{t.background.hex}">
                <div
                  class="preview-card"
                  style="background:{t.surface.hex};border-color:{t['border-default'].hex}"
                >
                  <p class="preview-title" style="color:{t['text-primary'].hex}">
                    {mode === 'light' ? 'Clair' : 'Sombre'}
                  </p>
                  <p class="preview-body" style="color:{t['text-secondary'].hex}">
                    Un texte, un <span style="color:{t['text-muted'].hex}">détail</span>.
                  </p>
                  <p class="preview-actions">
                    <span style="background:{t.primary.hex};color:{t['on-primary'].hex}">Action</span>
                    <span
                      style="background:{t['success-surface'].hex};color:{t['success-content']
                        .hex};border:1px solid {t['success-border'].hex}">✓</span
                    >
                    <span
                      style="background:{t['error-surface'].hex};color:{t['error-content']
                        .hex};border:1px solid {t['error-border'].hex}">✗</span
                    >
                  </p>
                </div>
              </div>
            {/each}
          </div>
          <div class="panel">
            <p class="panel-tete">
              Pour l’intégration
              <span class="panel-compte">{FICHIER_CSS}</span>
            </p>
            <div class="deliver-row">
              <button class="solid" onclick={copyExport}>
                {copied ? 'Copié ✓' : 'Copier le code'}
              </button>
              <button onclick={telechargeTexte}>Télécharger</button>
            </div>
            <p class="note-pied">
              Variables CSS : rampes, rôles, thèmes clair et sombre, prêtes à coller.
            </p>
            <details class="why">
              <summary>Voir le code</summary>
              <textarea readonly rows="8" value={exportText} aria-label="Code exporté"></textarea>
            </details>
          </div>

          <!--
            Les deux livrables qui n'ont rien à voir avec du code : le
            nuancier qui s'ouvre dans Illustrator, et la planche qu'on
            envoie au client. Ce sont ceux qu'une graphiste utilise le
            plus souvent, donc ils ont leur propre bloc.
          -->
          <div class="panel">
            <p class="panel-tete">
              Pour la création
              <span class="panel-compte">{settings.colors.length} couleurs</span>
            </p>
            <div class="deliver-row">
              <button class="solid" onclick={telechargeAse} disabled={settings.colors.length === 0}>
                Nuancier .ase
              </button>
              <button onclick={telechargePlanchePng} disabled={settings.colors.length === 0}>
                Planche PNG
              </button>
              <button onclick={telechargePlancheSvg} disabled={settings.colors.length === 0}>
                Planche SVG
              </button>
            </div>
            <p class="note-pied">
              Le .ase s’ouvre dans Illustrator, InDesign et Photoshop, avec tes noms. La planche
              porte les deux contrastes de référence de chaque couleur, sur blanc et sur noir.
            </p>
          </div>

        {/if}
      {/if}

      <footer class="stage-foot">
        {#if parcours.index > 0}
          <button class="ghost" onclick={() => parcours.precedent()}>← Retour</button>
        {:else}<span></span>{/if}

      </footer>
    </section>
  {/key}

  <SidePanel
    etapeId={current.id}
    suivante={etapeSuivante ? { titre: etapeSuivante.title, court: etapeSuivante.short } : null}
    {peutContinuer}
    {conditionSuivante}
    onContinuer={next}
  />
</div>

<style>
  /*
   * Deux colonnes : la scène, et le panneau d'accompagnement. La
   * navigation a quitté cette grille pour la barre de tête — elle
   * mangeait une colonne entière sans rien apporter au travail en cours.
   */
  .flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20rem;
    gap: 1.6rem;
    align-items: start;
    max-inline-size: var(--largeur-max);
    margin: 0 auto;
  }

  /*
   * — Scène : carte BLANCHE OPAQUE posée sur le fond doux —
   *
   * Le reste du chrome est en verre dépoli. Pas ici : c'est la zone
   * d'évaluation. Une carte translucide laisserait le dégradé passer
   * derrière les échantillons, et la règle des deux zones (brief §9.1)
   * tomberait — l'outil jugerait des couleurs sur un fond qui n'est pas
   * celui qu'il annonce. `zone-evaluation` rétablit aussi les tokens
   * clairs quand l'interface est en thème sombre.
   */
  .stage {
    inline-size: 100%;
    background: var(--surface-canvas);
    border-radius: var(--radius-carte);
    box-shadow: var(--ombre-carte);
    padding: 1.9rem 2rem 1.6rem;
    display: grid;
    gap: 1.5rem;
    align-content: start;
    min-block-size: 22rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .stage {
      animation: rise 240ms cubic-bezier(0.2, 0.7, 0.3, 1);
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }

  .stage-head {
    display: grid;
    gap: 0.15rem;
    padding-block-end: 1.2rem;
    border-block-end: 1px solid var(--filet);
  }

  /* Sur-titre : c'est la seule marque de couleur de la tête de scène,
     en Terre. Il donne le repère de progression sans concurrencer le
     titre, qui reste en Ébène. */
  .etape-num {
    margin: 0 0 0.1rem;
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--surface-chrome);
  }

  .stage-head h2 {
    font-size: 2rem;
    line-height: 1.15;
  }

  .lead {
    margin: 0.3rem 0 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    max-inline-size: 46rem;
  }

  .choices {
    display: grid;
    gap: 0.6rem;
  }

  .choices.three {
    grid-template-columns: repeat(2, 1fr);
  }

  .choice {
    display: grid;
    gap: 0.1rem;
    justify-items: start;
    text-align: left;
    padding: 1.1rem 1.2rem;
    border: 1px solid rgba(28, 18, 5, 0.12);
    border-radius: var(--radius);
    background: var(--surface-panel);
  }

  .choice strong {
    font-size: 1.02rem;
    font-weight: 500;
  }

  .choice small {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .choice:hover {
    border-color: var(--text-muted);
    background: var(--surface-canvas);
  }

  .choice[aria-checked='true'] {
    border-color: var(--text-main);
    background: var(--surface-canvas);
  }

  /* Le panneau de départ est visuellement rattaché aux cartes de choix :
     on doit voir que c'est la suite du clic, pas un bloc indépendant. */
  .panneau-depart {
    display: grid;
    gap: 0.7rem;
    background: var(--surface-panel);
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
  }

  .panneau-depart .micro {
    margin: 0;
  }

  .depart-couleur {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .pick-swatch.petite {
    block-size: 3rem;
    inline-size: 3rem;
    flex-shrink: 0;
  }

  .paste {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }

  .paste textarea {
    inline-size: 100%;
    font-family: var(--font-ui);
    font-size: 0.85rem;
  }

  .paste-preview {
    display: flex;
    gap: 3px;
  }

  .paste-preview span {
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 4px;
  }

  .moods {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }

  .mood {
    border: none;
    background: none;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  .mood-fill {
    block-size: 4.2rem;
    border-radius: var(--radius);
    background: var(--mood);
  }

  .mood-name {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
  }

  .pick-swatch {
    position: relative;
    block-size: 10rem;
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .pick-swatch input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    border: none;
    cursor: pointer;
  }

  .pick-hex {
    font-family: var(--font-ui);
    font-size: 1.4rem;
    inline-size: 8.5ch;
  }
  .why {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .why summary {
    cursor: pointer;
    color: var(--text-main);
  }

  .why textarea {
    inline-size: 100%;
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
  }

  .previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }

  .preview {
    border-radius: var(--radius);
    padding: 1rem;
  }

  .preview-card {
    border: 1px solid;
    border-radius: var(--radius);
    padding: 0.85rem 0.95rem;
  }

  .preview-title {
    margin: 0 0 0.25rem;
    font-weight: 600;
  }

  .preview-body {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
  }

  .preview-actions {
    display: flex;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.78rem;
  }

  .preview-actions span {
    padding: 0.2rem 0.7rem;
    border-radius: 100px;
  }

  .deliver-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .stage-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.3rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(28, 18, 5, 0.09);
  }

  /* Le remplissage vient de la feuille globale (Terre) ; ici, seulement
     la générosité du gabarit. */
  button.solid {
    padding: 0.45rem 1.3rem;
  }

  button.solid:disabled {
    opacity: 0.35;
    cursor: default;
  }

  button.ghost {
    border-color: transparent;
    color: var(--text-muted);
    padding-inline: 0.6rem;
  }

  button.ghost:hover {
    color: var(--text-main);
    border-color: var(--ink-muted);
  }

  /* Le panneau passe sous la scène : il accompagne la décision, il ne
     la porte pas — il peut donc descendre. */
  @media (max-width: 68rem) {
    .flow {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 46rem) {
    .stage {
      padding: 1.1rem 1.1rem 1rem;
    }

    .choices.three,
    .moods,
    .previews {
      grid-template-columns: 1fr;
    }
  }
</style>
