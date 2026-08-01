<script lang="ts">
  import {
    gamutMap,
    oklchToHex,
    parseToOklch,
    scorePalette,
    exportCss,
    exportTailwind,
    SCHEMES,
    type GeneratedPalette,
  } from '../engine';
  import { settings, MOODS, type StartMode, type UsageContext } from './state.svelte';
  import ShareLink from './ShareLink.svelte';

  let {
    palette,
    onAtelier,
  }: {
    palette: GeneratedPalette | null;
    showTechnical: boolean;
    onAtelier: () => void;
  } = $props();

  const STEPS = [
    { n: 1, short: 'Usage', title: 'À quoi ça sert ?' },
    { n: 2, short: 'Départ', title: 'D’où on part ?' },
    { n: 3, short: 'Couleur', title: 'Votre couleur' },
    { n: 4, short: 'Réglages', title: 'Affinez' },
    { n: 5, short: 'Contrôle', title: 'Tout est vérifié' },
    { n: 6, short: 'Livraison', title: 'C’est à vous' },
  ];

  let step = $state(1);
  let maxReached = $state(1);
  let startMode: StartMode = $state('color');

  function goTo(n: number): void {
    if (n >= 1 && n <= maxReached) step = n;
  }

  function next(): void {
    if (step < 6) {
      step += 1;
      maxReached = Math.max(maxReached, step);
    }
  }

  const USAGES: { id: UsageContext; label: string; hint: string }[] = [
    { id: 'web', label: 'Un site', hint: 'clair + sombre' },
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
  const report = $derived(step >= 5 && palette ? scorePalette(palette) : null);

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

  const cvdOk = $derived(
    report
      ? !report.diagnostics.some((d) => d.status === 'fail' && d.id.startsWith('constraint:cvd'))
      : true,
  );

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

  const SEMANTIC_RAMPS_UI = [
    ['success', 'Succès'],
    ['warning', 'Attention'],
    ['error', 'Erreur'],
    ['info', 'Info'],
  ] as const;
</script>

<div class="flow">
  <!-- Progression : fine, horizontale, cliquable -->
  <nav class="progress" aria-label="Étapes">
    {#each STEPS as s (s.n)}
      <button
        class="dot"
        class:current={step === s.n}
        class:done={maxReached > s.n}
        disabled={s.n > maxReached}
        aria-current={step === s.n ? 'step' : undefined}
        onclick={() => goTo(s.n)}
        title={s.title}
      >
        <span class="dot-mark" aria-hidden="true"></span>
        <span class="dot-label">{s.short}</span>
      </button>
    {/each}
  </nav>

  {#key step}
    <section class="stage" aria-labelledby="stage-title">
      <header class="stage-head">
        <h2 id="stage-title">{STEPS[step - 1]?.title}</h2>
        <span class="stage-count num">{step}/6</span>
      </header>

      {#if step === 1}
        <div class="choices four">
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
      {:else if step === 2}
        <div class="choices three">
          <button
            class="choice"
            role="radio"
            aria-checked={startMode === 'color'}
            onclick={() => {
              startMode = 'color';
              next();
            }}
          >
            <strong>J’ai une couleur</strong>
            <small>un hex, un logo</small>
          </button>
          <button
            class="choice"
            role="radio"
            aria-checked={startMode === 'mood'}
            onclick={() => (startMode = 'mood')}
          >
            <strong>Une ambiance</strong>
            <small>choisir au feeling</small>
          </button>
          <button
            class="choice"
            role="radio"
            aria-checked={startMode === 'surprise'}
            onclick={() => {
              startMode = 'surprise';
              surprise();
              next();
            }}
          >
            <strong>Surprends-moi</strong>
            <small>au hasard</small>
          </button>
        </div>

        {#if startMode === 'mood'}
          <div class="moods">
            {#each MOODS as mood (mood.id)}
              <button
                class="mood"
                onclick={() => {
                  settings.baseColor = moodHex(mood);
                  next();
                }}
                style="--mood:{moodHex(mood)}"
              >
                <span class="mood-fill" aria-hidden="true"></span>
                <span class="mood-name">{mood.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      {:else if step === 3}
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
            <p class="pick-note">Conservée exactement — tout se construit autour.</p>
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
      {:else if step === 4}
        {#if palette}
          <div class="ramps-grid">
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
            <div class="ramp-row semantics">
              <span class="ramp-name">Fonctionnelles</span>
              <span class="sem-group" aria-hidden="true">
                {#each SEMANTIC_RAMPS_UI as [key, label] (key)}
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
              {#each SCHEMES as s (s.name)}
                <option value={s.name}>{s.label}</option>
              {/each}
            </select>
          </label>
          <div class="knob">
            <span class="knob-label">Roue</span>
            <div class="seg" role="group" aria-label="Roue chromatique">
              <button
                aria-pressed={settings.wheel === 'ryb'}
                onclick={() => (settings.wheel = 'ryb')}>Peintres</button
              >
              <button
                aria-pressed={settings.wheel === 'rgb'}
                onclick={() => (settings.wheel = 'rgb')}>Écrans</button
              >
            </div>
          </div>
          <label class="knob">
            <span class="knob-label">
              Intensité <span class="num">{Math.round(settings.intensity * 100)}</span>
            </span>
            <input type="range" min="0.5" max="1.2" step="0.05" bind:value={settings.intensity} />
          </label>
          <label class="knob">
            <span class="knob-label">
              Gris teintés <span class="num">{settings.neutralInfluence}</span>
            </span>
            <input type="range" min="0" max="100" step="5" bind:value={settings.neutralInfluence} />
          </label>
        </div>
        <details class="why">
          <summary>Pourquoi ces couleurs&nbsp;?</summary>
          <ul>
            {#each palette?.explanations.slice(1, 5) ?? [] as e, i (i)}
              <li>{e}</li>
            {/each}
          </ul>
        </details>
      {:else if step === 5}
        <div class="verdicts">
          <div class="verdict" data-ok={auditSummary?.failures === 0}>
            <span class="verdict-mark" aria-hidden="true"></span>
            <strong>Lisible</strong>
            <small>{auditSummary?.tested ?? 0} paires · WCAG 2.2 AA · clair + sombre</small>
          </div>
          <div class="verdict" data-ok={cvdOk}>
            <span class="verdict-mark" aria-hidden="true"></span>
            <strong>Daltonisme</strong>
            <small>succès et erreur restent distincts</small>
          </div>
          <div class="verdict" data-ok={true}>
            <span class="verdict-mark" aria-hidden="true"></span>
            <strong>Complète</strong>
            <small>{palette ? Object.keys(palette.themes.light.tokens).length : 0} rôles · 88 valeurs</small>
          </div>
          <div class="verdict" data-pending={true}>
            <span class="verdict-mark" aria-hidden="true"></span>
            <strong>Encre & énergie</strong>
            <small>à venir — aucun chiffre inventé</small>
          </div>
        </div>

        {#if report}
          <div class="score-line">
            <span class="score-num num">{report.score}</span>
            <span class="score-bar" aria-hidden="true">
              <span style="inline-size:{report.score}%"></span>
            </span>
            <span class="score-cap">score de contraintes</span>
          </div>
          {#if report.diagnostics.length > 0}
            <details class="why">
              <summary>
                {report.diagnostics.length} remarque{report.diagnostics.length > 1 ? 's' : ''}
              </summary>
              <ul>
                {#each report.diagnostics as d (d.id)}
                  <li data-status={d.status}>{d.plain}</li>
                {/each}
              </ul>
            </details>
          {/if}
        {/if}
      {:else if step === 6}
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
                    Un texte, un <span style="color:{t['text-muted'].hex}">détail atténué</span>.
                  </p>
                  <p class="preview-actions">
                    <span style="background:{t.primary.hex};color:{t['on-primary'].hex}">Action</span
                    >
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

          <div class="deliver">
            <div class="seg" role="group" aria-label="Format d’export">
              <button aria-pressed={exportFormat === 'css'} onclick={() => (exportFormat = 'css')}
                >CSS</button
              >
              <button
                aria-pressed={exportFormat === 'tailwind'}
                onclick={() => (exportFormat = 'tailwind')}>Tailwind</button
              >
            </div>
            <button class="solid" onclick={copyExport}>{copied ? 'Copié ✓' : 'Copier le code'}</button
            >
          </div>
          <details class="why">
            <summary>Voir le code</summary>
            <textarea readonly rows="9" value={exportText} aria-label="Code exporté"></textarea>
          </details>
          <div class="deliver">
            <ShareLink />
          </div>
        {/if}
      {/if}

      <footer class="stage-foot">
        {#if step > 1}
          <button class="ghost" onclick={() => (step -= 1)}>← Retour</button>
        {:else}
          <button class="ghost" onclick={onAtelier}>Tout ouvrir (atelier)</button>
        {/if}
        {#if step < 6}
          <button class="solid" onclick={next} disabled={step === 3 && !baseValid}>
            Continuer →
          </button>
        {:else}
          <button class="ghost" onclick={onAtelier}>Affiner en atelier →</button>
        {/if}
      </footer>
    </section>
  {/key}
</div>

<style>
  .flow {
    display: grid;
    gap: 1.6rem;
    justify-items: center;
  }

  /* — Progression — */
  .progress {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  .dot {
    border: none;
    background: none;
    padding: 0.3rem 0.55rem;
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    border-radius: var(--radius-sm);
  }

  .dot:hover {
    background: transparent;
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
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: var(--hairline-strong);
  }

  .dot.done .dot-label {
    color: var(--ink-2);
  }

  .dot.current .dot-label {
    color: var(--ink);
  }

  /* — Scène — */
  .stage {
    inline-size: 100%;
    max-inline-size: 44rem;
    background: var(--paper);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 2.2rem 2.4rem 1.4rem;
    display: grid;
    gap: 1.5rem;
    align-content: start;
    min-block-size: 25rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .stage {
      animation: rise 260ms cubic-bezier(0.2, 0.7, 0.3, 1);
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(10px);
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
    font-size: 1.9rem;
  }

  .stage-count {
    color: var(--hairline-strong);
    font-size: 0.85rem;
  }

  /* — Choix — */
  .choices {
    display: grid;
    gap: 0.6rem;
  }

  .choices.four {
    grid-template-columns: repeat(2, 1fr);
  }

  .choices.three {
    grid-template-columns: repeat(3, 1fr);
  }

  .choice {
    display: grid;
    gap: 0.15rem;
    justify-items: start;
    text-align: left;
    padding: 1.15rem 1.25rem;
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
    background: var(--paper-sunken);
  }

  .choice strong {
    font-size: 1.05rem;
    font-weight: 500;
  }

  .choice small {
    color: var(--ink-2);
    font-size: 0.82rem;
  }

  .choice:hover {
    border-color: var(--ink-2);
    background: var(--paper);
    transform: translateY(-1px);
  }

  .choice[aria-checked='true'] {
    border-color: var(--ink);
    background: var(--paper);
  }

  /* — Ambiances — */
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
    gap: 0.4rem;
    justify-items: stretch;
  }

  .mood-fill {
    display: block;
    block-size: 4.5rem;
    border-radius: var(--radius);
    background: var(--mood);
  }

  .mood:hover .mood-fill {
    transform: scale(1.02);
  }

  .mood-name {
    font-size: 0.82rem;
    color: var(--ink-2);
    text-align: center;
  }

  /* — Choix de la couleur — */
  .pick {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1.6rem;
    align-items: center;
  }

  .pick-swatch {
    position: relative;
    block-size: 11rem;
    border-radius: var(--radius);
    cursor: pointer;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.08);
  }

  .pick-swatch input[type='color'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
  }

  .pick-side {
    display: grid;
    gap: 0.7rem;
    justify-items: start;
  }

  .pick-hex {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    padding: 0.35rem 0.7rem;
    inline-size: 8.5ch;
    text-transform: lowercase;
  }

  .pick-note {
    margin: 0;
    color: var(--ink-2);
    font-size: 0.88rem;
  }

  .big-ramp {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 3.4rem;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .big-ramp .base {
    outline: 2px solid var(--paper);
    outline-offset: -6px;
  }

  /* — Rampes — */
  .ramps-grid {
    display: grid;
    gap: 0.45rem;
  }

  .ramp-row {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
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
    block-size: 2.1rem;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .ramp-strip .base {
    outline: 2px solid var(--paper);
    outline-offset: -4px;
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

  /* — Réglages — */
  .knobs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.9rem 1.6rem;
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

  /* — Verdicts — */
  .verdicts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }

  .verdict {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'mark title' 'mark sub';
    column-gap: 0.7rem;
    align-items: center;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    background: var(--paper-sunken);
  }

  .verdict-mark {
    grid-area: mark;
    inline-size: 1.4rem;
    block-size: 1.4rem;
    border-radius: 50%;
    background: var(--ink);
    position: relative;
  }

  .verdict-mark::after {
    content: '✓';
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--paper);
    font-size: 0.8rem;
  }

  .verdict[data-ok='false'] .verdict-mark::after {
    content: '✗';
  }

  .verdict[data-pending] .verdict-mark {
    background: var(--hairline-strong);
  }

  .verdict[data-pending] .verdict-mark::after {
    content: '…';
  }

  .verdict strong {
    grid-area: title;
    font-weight: 500;
  }

  .verdict small {
    grid-area: sub;
    color: var(--ink-2);
    font-size: 0.78rem;
  }

  /* — Score — */
  .score-line {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .score-num {
    font-size: 1.6rem;
  }

  .score-bar {
    flex: 1;
    block-size: 4px;
    background: var(--hairline);
    border-radius: 2px;
    overflow: hidden;
  }

  .score-bar span {
    display: block;
    block-size: 100%;
    background: var(--ink);
  }

  .score-cap {
    font-size: 0.78rem;
    color: var(--ink-2);
  }

  /* — Aperçus — */
  .previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }

  .preview {
    border-radius: var(--radius);
    padding: 1.1rem;
  }

  .preview-card {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 0.9rem 1rem;
  }

  .preview-title {
    margin: 0 0 0.25rem;
    font-weight: 600;
  }

  .preview-body {
    margin: 0 0 0.7rem;
    font-size: 0.85rem;
  }

  .preview-actions {
    display: flex;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.8rem;
  }

  .preview-actions span {
    padding: 0.2rem 0.7rem;
    border-radius: 100px;
  }

  .deliver {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }

  /* — Pied — */
  .stage-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.4rem;
    padding-top: 1.2rem;
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

  @media (max-width: 44rem) {
    .stage {
      padding: 1.5rem 1.3rem 1.1rem;
    }

    .choices.four,
    .choices.three,
    .knobs,
    .verdicts,
    .previews,
    .moods {
      grid-template-columns: 1fr;
    }

    .pick {
      grid-template-columns: 1fr;
    }

    .dot-label {
      display: none;
    }
  }
</style>
