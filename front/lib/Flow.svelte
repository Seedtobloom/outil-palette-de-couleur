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
    goToStepId = $bindable(),
  }: {
    palette: GeneratedPalette | null;
    showTechnical: boolean;
    goToStepId?: ((id: string) => void) | undefined;
  } = $props();

  type StepDef = {
    id: string;
    short: string;
    title: string;
    lead?: string;
    /** Ce qu'il faut avoir fait pour déverrouiller cette étape. */
    condition?: { met: () => boolean; texte: string };
  };

  const ALL_STEPS: StepDef[] = [
    { id: 'usage', short: 'Projet', title: 'C’est pour quoi ?' },
    { id: 'start', short: 'Départ', title: 'D’où on part ?' },
    { id: 'color', short: 'Couleur', title: 'Ta couleur' },
    {
      id: 'build',
      short: 'Génération',
      title: 'Le système se construit.',
      lead: 'Trois teintes de marque, des gris teintés, quatre couleurs fonctionnelles.',
    },
    {
      id: 'palette',
      short: 'Nuancier',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      title: 'Ton nuancier, complet.',
      lead: 'Ajoute, retirez, renommez. L’outil te dit ce qui manque.',
    },
    {
      id: 'harmony',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      short: 'Harmonie',
      title: 'Le groupe, accordé.',
      lead: 'Le schéma réellement suivi, et les couleurs qui en sortent.',
    },
    {
      id: 'roles',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      short: 'Rôles',
      title: 'Chaque couleur, à sa place.',
      lead: 'Déduit des contrastes réels, pas de l’intention.',
    },
    {
      id: 'contrast',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      short: 'Contraste',
      title: 'Chaque paire, vérifiée.',
      lead: 'Le spécimen d’abord, le chiffre en preuve. Une correction à la fois.',
    },
    {
      id: 'print',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      short: 'Impression',
      title: 'Sur le papier, vraiment.',
      lead: 'Estimation des encres, taux d’encrage, rendu sur le papier choisi.',
    },
    {
      id: 'social',
      condition: { met: () => settings.colors.length >= 3, texte: 'Il faut au moins 3 couleurs' },
      short: 'Réseaux',
      title: 'En situation.',
      lead: 'Des couleurs de la même famille, mais qui tiennent dans un flux.',
    },
    { id: 'deliver', short: 'Livraison', title: 'À toi de jouer.' },
  ];

  const steps = $derived(
    ALL_STEPS.filter((s) => {
      if (s.id === 'print') return settings.usage === 'print' || settings.usage === 'identity';
      return true;
    }),
  );

  let index = $state(0);
  let maxReached = $state(0);
  let startMode: StartMode = $state('color');

  const current = $derived(steps[Math.min(index, steps.length - 1)] as StepDef);

  function go(i: number): void {
    if (i < 0 || i > maxReached || i >= steps.length) return;
    const cible = steps[i];
    if (cible?.condition && !cible.condition.met()) return;
    index = i;
  }

  // Permet au score de santé d'ouvrir l'étape qui fait perdre des points.
  goToStepId = (id: string) => {
    const i = steps.findIndex((s) => s.id === id);
    if (i >= 0) {
      maxReached = Math.max(maxReached, i);
      index = i;
    }
  };

  function next(): void {
    // En entrant dans le nuancier, on le pré-remplit depuis la palette
    // générée si la graphiste n'y a pas encore touché.
    const upcoming = steps[index + 1];
    if (upcoming?.id === 'palette' && settings.colors.length === 0 && palette) {
      seedColors(palette);
    }
    if (index < steps.length - 1) {
      index += 1;
      maxReached = Math.max(maxReached, index);
    }
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

  const etapeSuivante = $derived(steps[index + 1] ?? null);
  const conditionSuivante = $derived.by(() => {
    const suiv = etapeSuivante;
    if (!suiv?.condition) return null;
    return suiv.condition.met() ? null : suiv.condition.texte;
  });
  const peutContinuer = $derived(
    etapeSuivante !== null && conditionSuivante === null && !(current.id === 'color' && !baseValid),
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
  <nav class="rail" aria-label="Étapes">
    <ol>
      {#each steps as s, i (s.id)}
        {@const conditionKo = s.condition ? !s.condition.met() : false}
        {@const verrouille = i > maxReached || conditionKo}
        <li>
          <button
            class="etape"
            class:courante={index === i}
            class:faite={maxReached > i && !verrouille}
            disabled={verrouille}
            aria-current={index === i ? 'step' : undefined}
            onclick={() => go(i)}
          >
            <span class="numero" aria-hidden="true">{i + 1}</span>
            <span class="libelle">
              {s.short}
              {#if conditionKo && s.condition}
                <small class="condition">{s.condition.texte}</small>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ol>
  </nav>

  {#key current.id}
    <section class="stage" class:wide={['palette', 'contrast', 'roles', 'print', 'social'].includes(current.id)}>
      <header class="stage-head">
        <div>
          <h2>{@html current.title.replace(/(\w+)\.$/, '<i>$1</i>.')}</h2>
          {#if current.lead}<p class="lead">{current.lead}</p>{/if}
        </div>
        <span class="count num">{index + 1}/{steps.length}</span>
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
        <div class="choices three">
          <button class="choice" onclick={() => { startMode = 'color'; next(); }}>
            <strong>J’ai une couleur</strong><small>un hex, un logo</small>
          </button>
          <button
            class="choice"
            aria-checked={startMode === 'mood'}
            role="radio"
            onclick={() => (startMode = 'mood')}
          >
            <strong>Une ambiance</strong><small>au feeling</small>
          </button>
          <button
            class="choice"
            role="radio"
            aria-checked={startMode === 'palette'}
            onclick={() => (startMode = 'palette')}
          >
            <strong>J’ai une palette</strong><small>à valider, à compléter</small>
          </button>
          <button
            class="choice"
            role="radio"
            aria-checked={startMode === 'image'}
            onclick={() => (startMode = 'image')}
          >
            <strong>J’ai une image</strong><small>photo, moodboard</small>
          </button>
        </div>
        {#if startMode === 'image'}
          <ImportImage onImporte={next} />
        {/if}
        {#if startMode === 'palette'}
          <div class="paste">
            <label class="paste-label" for="paste-hex">
              Colle tes couleurs (hex, une par ligne ou séparées par des espaces)
            </label>
            <textarea
              id="paste-hex"
              rows="4"
              bind:value={pastedColors}
              placeholder="#1a1a2e&#10;#f7f5ef&#10;#c0392b"
              spellcheck="false"
            ></textarea>
            <button class="solid" onclick={importPasted} disabled={parsedPaste.length === 0}>
              Importer {parsedPaste.length > 0 ? `${parsedPaste.length} couleur${parsedPaste.length > 1 ? 's' : ''}` : ''}
            </button>
            {#if parsedPaste.length > 0}
              <span class="paste-preview" aria-hidden="true">
                {#each parsedPaste as hex (hex)}<span style="background:{hex}"></span>{/each}
              </span>
            {/if}
          </div>
        {/if}
        {#if startMode === 'mood'}
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
        {#if index > 0}
          <button class="ghost" onclick={() => (index -= 1)}>← Retour</button>
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
  .flow {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr) 17rem;
    gap: var(--gap-bloc);
    align-items: start;
    max-inline-size: 78rem;
    margin: 0 auto;
  }

  /* — Rail d'étapes : colonne de gauche, chrome Terre — */
  .rail {
    background: var(--surface-chrome);
    border-radius: var(--radius);
    padding: 1rem 0.6rem;
    position: sticky;
    top: 1rem;
  }

  .rail ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.1rem;
  }

  .etape {
    inline-size: 100%;
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    border: none;
    background: none;
    color: var(--text-on-chrome-muted);
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius);
    text-align: left;
    min-block-size: 44px;
  }

  .etape:hover:not(:disabled) {
    background: rgba(242, 229, 194, 0.1);
    color: var(--text-on-chrome);
  }

  .etape:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Numéros en Alegreya italique — motif de la section process. */
  .numero {
    font-family: var(--font-titre);
    font-style: italic;
    font-size: 1.05rem;
    inline-size: 1.1rem;
    flex-shrink: 0;
  }

  .libelle {
    display: grid;
    font-size: 0.88rem;
    line-height: 1.25;
  }

  .condition {
    font-size: 0.68rem;
    font-style: italic;
    opacity: 0.8;
  }

  .etape.faite {
    color: var(--text-on-chrome);
  }

  .etape.courante {
    background: var(--etape-active);
    color: var(--ebene);
  }

  .stage {
    inline-size: 100%;
    background: var(--surface-canvas);
    padding: 0 0 1.3rem;
    display: grid;
    gap: 1.4rem;
    align-content: start;
    min-block-size: 22rem;
  }

  .stage.wide {
    max-inline-size: 60rem;
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .stage-head h2 {
    font-size: 1.75rem;
  }

  .lead {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  .count {
    color: var(--ink-muted);
    font-size: 0.82rem;
    white-space: nowrap;
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
    border: 1px solid var(--ink-muted);
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

  .paste {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }

  .paste-label {
    font-size: 0.85rem;
    color: var(--text-muted);
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
    border-top: 1px solid var(--ink-muted);
  }

  button.solid {
    background: var(--text-main);
    border-color: var(--text-main);
    color: var(--surface-canvas);
    padding: 0.45rem 1.3rem;
  }

  button.solid:hover {
    background: var(--text-muted);
    border-color: var(--text-muted);
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

  @media (max-width: 68rem) {
    .flow {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 46rem) {
    .stage {
      padding: 0 0 1rem;
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
