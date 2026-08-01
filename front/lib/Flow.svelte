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
  import StepContrast from './StepContrast.svelte';
  import StepRoles from './StepRoles.svelte';
  import StepPrint from './StepPrint.svelte';
  import StepSocial from './StepSocial.svelte';
  import ShareLink from './ShareLink.svelte';

  let { palette, showTechnical }: { palette: GeneratedPalette | null; showTechnical: boolean } =
    $props();

  type StepDef = { id: string; short: string; title: string; lead?: string };

  const ALL_STEPS: StepDef[] = [
    { id: 'usage', short: 'Projet', title: 'C’est pour quoi ?' },
    { id: 'start', short: 'Départ', title: 'D’où on part ?' },
    { id: 'color', short: 'Couleur', title: 'Votre couleur' },
    {
      id: 'build',
      short: 'Génération',
      title: 'La palette se construit',
      lead: 'Trois teintes de marque, des gris teintés, quatre couleurs fonctionnelles.',
    },
    {
      id: 'palette',
      short: 'Nuancier',
      title: 'Votre nuancier',
      lead: 'Ajoutez, retirez, renommez. L’outil vous dit ce qui manque.',
    },
    {
      id: 'roles',
      short: 'Rôles',
      title: 'À quoi sert chaque couleur',
      lead: 'Déduit des contrastes réels, pas de l’intention.',
    },
    {
      id: 'contrast',
      short: 'Contraste',
      title: 'Lisibilité, couleur par couleur',
      lead: 'Les quatre tests qui décident de tous les usages, et les niveaux atteints.',
    },
    {
      id: 'print',
      short: 'Impression',
      title: 'À l’impression',
      lead: 'Estimation des encres, taux d’encrage, rendu sur le papier choisi.',
    },
    {
      id: 'social',
      short: 'Réseaux',
      title: 'Pour les réseaux sociaux',
      lead: 'Des couleurs de la même famille, mais qui tiennent dans un flux.',
    },
    { id: 'deliver', short: 'Livraison', title: 'C’est à vous' },
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
    if (i >= 0 && i <= maxReached && i < steps.length) index = i;
  }

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

  function surprise(): void {
    const h = Math.random() * 360;
    const l = 0.45 + Math.random() * 0.25;
    const c = 0.1 + Math.random() * 0.1;
    settings.baseColor = oklchToHex(gamutMap({ l, c, h }, 'srgb'));
  }

  const baseValid = $derived(parseToOklch(settings.baseColor) !== null);
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
  <nav class="progress" aria-label="Étapes">
    {#each steps as s, i (s.id)}
      <button
        class="dot"
        class:current={index === i}
        class:done={maxReached > i}
        disabled={i > maxReached}
        aria-current={index === i ? 'step' : undefined}
        onclick={() => go(i)}
      >
        <span class="dot-mark" aria-hidden="true"></span>
        <span class="dot-label">{s.short}</span>
      </button>
    {/each}
  </nav>

  {#key current.id}
    <section class="stage" class:wide={['palette', 'contrast', 'roles', 'print', 'social'].includes(current.id)}>
      <header class="stage-head">
        <div>
          <h2>{current.title}</h2>
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
          <button class="choice" onclick={() => { surprise(); next(); }}>
            <strong>Surprends-moi</strong><small>au hasard</small>
          </button>
        </div>
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
            <button onclick={surprise}>Une autre au hasard</button>
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
        {#if index < steps.length - 1}
          <button class="solid" onclick={next} disabled={current.id === 'color' && !baseValid}>
            Continuer →
          </button>
        {/if}
      </footer>
    </section>
  {/key}
</div>

<style>
  .flow {
    display: grid;
    gap: 1.5rem;
    justify-items: center;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 0.1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dot {
    border: none;
    background: none;
    padding: 0.3rem 0.5rem;
    display: grid;
    justify-items: center;
    gap: 0.35rem;
  }

  .dot:hover {
    background: none;
  }

  .dot:disabled {
    cursor: default;
  }

  .dot-mark {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: var(--hairline-strong);
  }

  .dot.done .dot-mark {
    background: var(--ink-2);
  }

  .dot.current .dot-mark {
    background: var(--ink);
    transform: scale(1.6);
  }

  .dot-label {
    font-size: 0.68rem;
    color: var(--hairline-strong);
  }

  .dot.done .dot-label {
    color: var(--ink-2);
  }

  .dot.current .dot-label {
    color: var(--ink);
  }

  .stage {
    inline-size: 100%;
    max-inline-size: 44rem;
    background: var(--paper);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 2rem 2.2rem 1.3rem;
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
    color: var(--ink-2);
    font-size: 0.88rem;
  }

  .count {
    color: var(--hairline-strong);
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
    grid-template-columns: repeat(3, 1fr);
  }

  .choice {
    display: grid;
    gap: 0.1rem;
    justify-items: start;
    text-align: left;
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
    background: var(--paper-sunken);
  }

  .choice strong {
    font-size: 1.02rem;
    font-weight: 500;
  }

  .choice small {
    color: var(--ink-2);
    font-size: 0.8rem;
  }

  .choice:hover {
    border-color: var(--ink-2);
    background: var(--paper);
  }

  .choice[aria-checked='true'] {
    border-color: var(--ink);
    background: var(--paper);
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
    color: var(--ink-2);
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
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.08);
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
    font-family: var(--font-mono);
    font-size: 1.4rem;
    inline-size: 8.5ch;
  }

  .muted {
    margin: 0;
    color: var(--ink-2);
    font-size: 0.86rem;
  }

  .big-ramp {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 3.2rem;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .big-ramp .base,
  .ramp-strip .base {
    outline: 2px solid var(--paper);
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
    color: var(--ink-2);
    text-align: right;
  }

  .ramp-strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 2rem;
    border-radius: var(--radius-sm);
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
    color: var(--ink-2);
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
    color: var(--ink-2);
  }

  .why summary {
    cursor: pointer;
    color: var(--ink);
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
    font-family: var(--font-mono);
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
    border-radius: var(--radius-sm);
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
    border-top: 1px solid var(--hairline);
  }

  button.solid {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
    padding: 0.45rem 1.3rem;
  }

  button.solid:hover {
    background: var(--ink-2);
    border-color: var(--ink-2);
  }

  button.solid:disabled {
    opacity: 0.35;
    cursor: default;
  }

  button.ghost {
    border-color: transparent;
    color: var(--ink-2);
    padding-inline: 0.6rem;
  }

  button.ghost:hover {
    color: var(--ink);
    border-color: var(--hairline-strong);
  }

  @media (max-width: 46rem) {
    .stage {
      padding: 1.4rem 1.2rem 1rem;
    }

    .choices.two,
    .choices.three,
    .moods,
    .knobs,
    .previews,
    .pick {
      grid-template-columns: 1fr;
    }

    .dot-label {
      display: none;
    }
  }
</style>
