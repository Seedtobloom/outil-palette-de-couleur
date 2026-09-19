<script lang="ts">
  /**
   * LE parcours. Tout l'outil vit ici, étape par étape — rien n'est
   * ailleurs. Les étapes print n'apparaissent que si le projet en a
   * besoin (choix de l'usage à l'étape 1).
   */
  import {
    gamutMap,
    oklchToHex,
    parseToOklch,
    scorePalette,
    exportCss,
    exportTailwind,
    generatePalette,
    SCHEMES,
    type GeneratedPalette,
  } from '../engine';
  import { settings, MOODS, type StartMode, type UsageContext } from './state.svelte';
  import { parcours } from './parcours.svelte';
  import StepPalette from './StepPalette.svelte';
  import StepHarmony from './StepHarmony.svelte';
  import StepContrast from './StepContrast.svelte';
  import StepRoles from './StepRoles.svelte';
  import StepPrint from './StepPrint.svelte';
  import StepSocial from './StepSocial.svelte';
  import ShareLink from './ShareLink.svelte';
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

  const USAGES: { id: UsageContext; label: string; hint: string }[] = [
    { id: 'web', label: 'Un site', hint: 'écran, clair + sombre' },
    { id: 'identity', label: 'Une identité', hint: 'écran + papier' },
    { id: 'print', label: 'Un imprimé', hint: 'papier' },
    { id: 'dataviz', label: 'Des graphiques', hint: 'séries distinctes' },
  ];

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
  // La couleur de départ doit être lisible avant d'aller plus loin : une
  // valeur hex invalide ne construit aucune palette.
  const peutContinuer = $derived(
    parcours.peutContinuer && !(current.id === 'color' && !baseValid),
  );
  const report = $derived(palette ? scorePalette(palette) : null);

  const auditSummary = $derived.by(() => {
    if (!palette) return null;
    let tested = 0;
    let failures = 0;
    for (const t of [palette.themes.light, palette.themes.dark]) {
      for (const p of t.audit) {
        if (p.usage === 'decorative' || p.usage === 'surface') continue;
        tested++;
        if (!p.evaluation.wcag.passesAA) failures++;
      }
    }
    return { tested, failures };
  });

  let exportFormat: 'css' | 'tailwind' = $state('css');
  let copied = $state(false);
  const exportText = $derived(
    palette ? (exportFormat === 'css' ? exportCss(palette) : exportTailwind(palette)) : '',
  );

  async function copyExport(): Promise<void> {
    await navigator.clipboard.writeText(exportText);
    copied = true;
    setTimeout(() => (copied = false), 1600);
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
    <section class="stage">
      <header class="stage-head">
        <p class="etape-num">Étape {parcours.index + 1}</p>
        <h2>{@html current.title.replace(/(\w+)\.$/, '<i>$1</i>.')}</h2>
        {#if current.lead}<p class="lead">{current.lead}</p>{/if}
      </header>

      {#if current.id === 'usage'}
        <div class="choices two">
          {#each USAGES as u (u.id)}
            <button
              class="choice"
              role="radio"
              aria-checked={settings.usage === u.id}
              onclick={() => {
                settings.usage = u.id;
                next();
              }}
            >
              <strong>{u.label}</strong>
              <small>{u.hint}</small>
            </button>
          {/each}
        </div>
      {:else if current.id === 'start'}
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
      {:else if current.id === 'color'}
        <div class="pick">
          <label class="pick-swatch" style="background:{baseValid ? settings.baseColor : '#ccc'}">
            <input type="color" bind:value={settings.baseColor} aria-label="Choisir la couleur" />
          </label>
          <div class="pick-side">
            <input
              class="pick-hex"
              type="text"
              bind:value={settings.baseColor}
              spellcheck="false"
              aria-label="Couleur en hexadécimal"
            />
            <p class="muted">Conservée exactement — tout se construit autour.</p>
            {#if pipetteDisponible}
              <button onclick={pipette}>Pipeter une couleur à l’écran</button>
            {:else}
              <p class="note-pied">
                La pipette écran n’est pas disponible dans ce navigateur (Firefox et Safari ne
                l’exposent pas). Colle la valeur hex à la place.
              </p>
            {/if}
          </div>
        </div>
        {#if palette}
          <div class="big-ramp" aria-hidden="true">
            {#each palette.ramps.primary.steps as s (s.step)}
              <span style="background:{s.hex}" class:base={s.isBase}></span>
            {/each}
          </div>
        {/if}
      {:else if current.id === 'build'}
        {#if palette}
          <div class="ramps">
            {#each BRAND_RAMPS as [key, label] (key)}
              <div class="ramp-row">
                <span class="ramp-name">{label}</span>
                <span class="ramp-strip" aria-hidden="true">
                  {#each palette.ramps[key].steps as s (s.step)}
                    <span style="background:{s.hex}" class:base={s.isBase}></span>
                  {/each}
                </span>
              </div>
            {/each}
            <div class="ramp-row">
              <span class="ramp-name">Fonctionnelles</span>
              <span class="sem-group" aria-hidden="true">
                {#each SEM_RAMPS as [key, label] (key)}
                  <span class="sem" title={label}>
                    {#each palette.ramps[key].steps.slice(2, 9) as s (s.step)}
                      <span style="background:{s.hex}"></span>
                    {/each}
                  </span>
                {/each}
              </span>
            </div>
          </div>
        {/if}
        <div class="knobs">
          <label class="knob">
            <span class="knob-label">Caractère</span>
            <select bind:value={settings.scheme}>
              {#each SCHEMES as s (s.name)}<option value={s.name}>{s.label}</option>{/each}
            </select>
          </label>
          <div class="knob">
            <span class="knob-label">Roue</span>
            <div class="seg" role="group" aria-label="Roue">
              <button aria-pressed={settings.wheel === 'ryb'} onclick={() => (settings.wheel = 'ryb')}
                >Peintres</button
              >
              <button aria-pressed={settings.wheel === 'rgb'} onclick={() => (settings.wheel = 'rgb')}
                >Écrans</button
              >
            </div>
          </div>
          <label class="knob">
            <span class="knob-label"
              >Intensité <span class="num">{Math.round(settings.intensity * 100)}</span></span
            >
            <input type="range" min="0.5" max="1.2" step="0.05" bind:value={settings.intensity} />
          </label>
          <label class="knob">
            <span class="knob-label"
              >Gris teintés <span class="num">{settings.neutralInfluence}</span></span
            >
            <input type="range" min="0" max="100" step="5" bind:value={settings.neutralInfluence} />
          </label>
        </div>
        {#if auditSummary}
          <p class="verdict-line" data-ok={auditSummary.failures === 0}>
            {auditSummary.failures === 0
              ? `✓ Les ${auditSummary.tested} paires utilisées passent WCAG 2.2 AA, clair et sombre.`
              : `✗ ${auditSummary.failures} paires échouent.`}
            {#if report}· score {report.score}/100{/if}
          </p>
        {/if}
        <details class="why">
          <summary>Pourquoi ces couleurs&nbsp;?</summary>
          <ul>
            {#each palette?.explanations.slice(1, 5) ?? [] as e, i (i)}<li>{e}</li>{/each}
          </ul>
        </details>
      {:else if current.id === 'palette'}
        <StepPalette {palette} />
      {:else if current.id === 'harmony'}
        <StepHarmony />
      {:else if current.id === 'roles'}
        <StepRoles />
      {:else if current.id === 'contrast'}
        <StepContrast {showTechnical} />
      {:else if current.id === 'print'}
        <StepPrint />
      {:else if current.id === 'social'}
        <StepSocial />
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
          <div class="deliver-row">
            <div class="seg" role="group" aria-label="Format">
              <button aria-pressed={exportFormat === 'css'} onclick={() => (exportFormat = 'css')}
                >CSS</button
              >
              <button
                aria-pressed={exportFormat === 'tailwind'}
                onclick={() => (exportFormat = 'tailwind')}>Tailwind</button
              >
            </div>
            <button class="solid" onclick={copyExport}>{copied ? 'Copié ✓' : 'Copier le code'}</button>
          </div>
          <details class="why">
            <summary>Voir le code</summary>
            <textarea readonly rows="8" value={exportText} aria-label="Code exporté"></textarea>
          </details>
          <ShareLink />
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
    grid-template-columns: minmax(0, 1fr) 19rem;
    gap: 1.5rem;
    align-items: start;
    max-inline-size: 78rem;
    margin: 0 auto;
  }

  /* — Scène : carte blanche posée sur le fond doux — */
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

  .etape-num {
    margin: 0 0 0.1rem;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-muted);
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

  .choices.two {
    grid-template-columns: repeat(2, 1fr);
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

  .pick {
    display: grid;
    grid-template-columns: 10rem 1fr;
    gap: 1.5rem;
    align-items: center;
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

  .pick-side {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }

  .pick-hex {
    font-family: var(--font-ui);
    font-size: 1.4rem;
    inline-size: 8.5ch;
  }

  .muted {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  .big-ramp {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 3.2rem;
    border-radius: var(--radius);
    overflow: hidden;
  }

  .big-ramp .base,
  .ramp-strip .base {
    outline: 2px solid var(--surface-canvas);
    outline-offset: -5px;
  }

  .ramps {
    display: grid;
    gap: 0.45rem;
  }

  .ramp-row {
    display: grid;
    grid-template-columns: 6rem 1fr;
    align-items: center;
    gap: 0.9rem;
  }

  .ramp-name {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: right;
  }

  .ramp-strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 2rem;
    border-radius: var(--radius);
    overflow: hidden;
  }

  .sem-group {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.35rem;
  }

  .sem {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 1.5rem;
    border-radius: 4px;
    overflow: hidden;
  }

  .knobs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.9rem 1.5rem;
  }

  .knob {
    display: grid;
    gap: 0.3rem;
  }

  .knob-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    justify-content: space-between;
  }

  .seg {
    display: flex;
    gap: 0.3rem;
  }

  .seg button {
    flex: 1;
    /* Sans plancher, un libellé court (« CSS ») se referme en pastille
       ronde et ne se lit plus comme un segment. */
    min-inline-size: 5.5rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.86rem;
  }

  .verdict-line {
    margin: 0;
    font-size: 0.88rem;
  }

  .why {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .why summary {
    cursor: pointer;
    color: var(--text-main);
  }

  .why ul {
    margin: 0.6rem 0 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.35rem;
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

    .choices.two,
    .choices.three,
    .moods,
    .knobs,
    .previews,
    .pick {
      grid-template-columns: 1fr;
    }

  }
</style>
