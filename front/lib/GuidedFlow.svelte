<script lang="ts">
  import {
    gamutMap,
    oklchToHex,
    parseToOklch,
    scorePalette,
    exportCss,
    exportTailwind,
    SCHEMES,
    SEMANTIC_RAMPS,
    type GeneratedPalette,
  } from '../engine';
  import { settings, MOODS, type StartMode, type UsageContext } from './state.svelte';
  import RampStrip from './RampStrip.svelte';
  import ShareLink from './ShareLink.svelte';

  let {
    palette,
    showTechnical,
    onAtelier,
  }: {
    palette: GeneratedPalette | null;
    showTechnical: boolean;
    onAtelier: () => void;
  } = $props();

  const STEPS = [
    { n: 1, short: 'Usage', title: 'À quoi ça sert ?' },
    { n: 2, short: 'Départ', title: 'D’où on part ?' },
    { n: 3, short: 'Couleur', title: 'La couleur de base' },
    { n: 4, short: 'Palette', title: 'La palette se construit' },
    { n: 5, short: 'Vérification', title: 'Tout est vérifié' },
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

  const USAGES: { id: UsageContext; label: string; detail: string }[] = [
    {
      id: 'web',
      label: 'Un site web',
      detail: 'Thèmes clair et sombre, lisibilité vérifiée pour l’écran.',
    },
    {
      id: 'identity',
      label: 'Une identité complète',
      detail: 'Web + print. Les vérifications d’imprimerie arrivent bientôt — la palette reste vérifiée pour l’écran.',
    },
    {
      id: 'print',
      label: 'Un imprimé seul',
      detail: 'Encrage et papier arrivent bientôt ; en attendant, tout est vérifié comme à l’écran.',
    },
    {
      id: 'dataviz',
      label: 'De la data-visualisation',
      detail: 'Des séries distinguables par tout le monde, daltonisme compris.',
    },
  ];

  function moodHex(mood: (typeof MOODS)[number]): string {
    return oklchToHex(gamutMap({ l: mood.l, c: mood.c, h: mood.hue }, 'srgb'));
  }

  function pickMood(mood: (typeof MOODS)[number]): void {
    settings.baseColor = moodHex(mood);
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
    report ? !report.diagnostics.some((d) => d.status === 'fail' && d.id.startsWith('constraint:cvd')) : true,
  );

  const valueCount = $derived(palette ? Object.keys(palette.ramps).length * 11 : 0);

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

  const RAMP_LABELS = [
    ['primary', 'principale'],
    ['secondary', 'secondaire'],
    ['accent', 'accent'],
    ['neutral', 'neutres'],
  ] as const;
</script>

<div class="guided">
  <!-- Rail des étapes -->
  <nav class="rail" aria-label="Étapes du parcours">
    <p class="rail-title">Parcours</p>
    <ol>
      {#each STEPS as s (s.n)}
        <li>
          <button
            class="rail-step"
            class:current={step === s.n}
            class:done={maxReached > s.n}
            disabled={s.n > maxReached}
            aria-current={step === s.n ? 'step' : undefined}
            onclick={() => goTo(s.n)}
          >
            <span class="rail-num" aria-hidden="true">{maxReached > s.n ? '✓' : s.n}</span>
            <span class="rail-label">
              {s.short}
              <small>Étape {s.n}</small>
            </span>
          </button>
        </li>
      {/each}
    </ol>
    <button class="rail-atelier" onclick={onAtelier}>
      Mode atelier →
      <small>tous les réglages, sans rien perdre</small>
    </button>
  </nav>

  <!-- Panneau de l'étape -->
  {#key step}
    <section class="panel" aria-labelledby="panel-title">
      <p class="panel-kicker">Étape {step} / 6</p>
      <h2 id="panel-title">{STEPS[step - 1]?.title}</h2>

      {#if step === 1}
        <p class="panel-lead">Le point de départ, ce n’est jamais la couleur : c’est l’usage.</p>
        <div class="cards" role="radiogroup" aria-label="Usage de la palette">
          {#each USAGES as u (u.id)}
            <button
              class="card"
              role="radio"
              aria-checked={settings.usage === u.id}
              onclick={() => (settings.usage = u.id)}
            >
              <strong>{u.label}</strong>
              <span>{u.detail}</span>
            </button>
          {/each}
        </div>
      {:else if step === 2}
        <p class="panel-lead">Trois façons de commencer — vous pourrez tout changer ensuite.</p>
        <div class="cards" role="radiogroup" aria-label="Point de départ">
          <button
            class="card"
            role="radio"
            aria-checked={startMode === 'color'}
            onclick={() => (startMode = 'color')}
          >
            <strong>Une couleur que j’ai</strong>
            <span>Un hex, une couleur pipetée, une couleur de logo.</span>
          </button>
          <button
            class="card"
            role="radio"
            aria-checked={startMode === 'mood'}
            onclick={() => (startMode = 'mood')}
          >
            <strong>Une ambiance</strong>
            <span>Quelques mots → une couleur de départ, par correspondances documentées.</span>
          </button>
          <button
            class="card"
            role="radio"
            aria-checked={startMode === 'surprise'}
            onclick={() => {
              startMode = 'surprise';
              surprise();
            }}
          >
            <strong>Rien — surprends-moi</strong>
            <span>Une couleur tirée au sort, dans des clartés raisonnables.</span>
          </button>
          <button class="card" disabled>
            <strong>Une image / un moodboard</strong>
            <span>Bientôt : extraction des couleurs dominantes d’une photo.</span>
          </button>
        </div>

        {#if startMode === 'mood'}
          <div class="moods" role="radiogroup" aria-label="Ambiances">
            {#each MOODS as mood (mood.id)}
              <button
                class="mood"
                role="radio"
                aria-checked={settings.baseColor === moodHex(mood)}
                onclick={() => pickMood(mood)}
              >
                <span class="mood-swatch" style="background:{moodHex(mood)}" aria-hidden="true"
                ></span>
                <span class="mood-label">{mood.label}<small>{mood.why}</small></span>
              </button>
            {/each}
          </div>
        {/if}
        {#if startMode === 'surprise'}
          <p class="surprise-row">
            <span class="mood-swatch big" style="background:{settings.baseColor}" aria-hidden="true"
            ></span>
            <code>{settings.baseColor}</code>
            <button onclick={surprise}>Retirer au sort</button>
          </p>
        {/if}
      {:else if step === 3}
        <p class="panel-lead">
          Elle sera conservée <em>exactement</em> — tout le reste se construit autour.
        </p>
        <div class="color-pick">
          <input type="color" bind:value={settings.baseColor} aria-label="Sélecteur de couleur" />
          <input
            type="text"
            bind:value={settings.baseColor}
            size="9"
            spellcheck="false"
            aria-label="Couleur de base en hexadécimal"
          />
        </div>
        {#if !baseValid}
          <p class="alert" role="alert">Couleur illisible — un hex comme #2563eb.</p>
        {/if}
      {:else if step === 4}
        <p class="panel-lead">
          Quatre réglages, chacun explique son effet. Le reste — gris teintés, couleurs
          fonctionnelles, thème sombre — se construit tout seul.
        </p>
        <div class="tune">
          <label class="ctrl">
            <span>Caractère<small>Comment les deux teintes compagnes sont choisies.</small></span>
            <select bind:value={settings.scheme}>
              {#each SCHEMES as s (s.name)}
                <option value={s.name}>{s.label}</option>
              {/each}
            </select>
            <small class="effect">{SCHEMES.find((s) => s.name === settings.scheme)?.effect}</small>
          </label>
          <fieldset class="ctrl">
            <legend>Roue</legend>
            <span class="radio-row">
              <label>
                <input type="radio" bind:group={settings.wheel} value="ryb" /> Peintres (RYB)
              </label>
              <label>
                <input type="radio" bind:group={settings.wheel} value="rgb" /> Écrans (RGB)
              </label>
            </span>
            <small class="effect">
              {settings.wheel === 'ryb'
                ? 'Le complémentaire du rouge est le vert — la roue apprise en atelier.'
                : 'Le complémentaire du rouge est le cyan — la roue de la lumière.'}
            </small>
          </fieldset>
          <label class="ctrl">
            <span>
              Intensité <span class="num">{Math.round(settings.intensity * 100)}&nbsp;%</span>
            </span>
            <input type="range" min="0.5" max="1.2" step="0.05" bind:value={settings.intensity} />
            <small class="effect">La vivacité générale, sans toucher aux clartés.</small>
          </label>
          <label class="ctrl">
            <span>Chaleur des gris <span class="num">{settings.neutralInfluence}&nbsp;%</span></span>
            <input type="range" min="0" max="100" step="5" bind:value={settings.neutralInfluence} />
            <small class="effect">À 0, les gris sont purs et paraissent étrangers à la marque.</small>
          </label>
        </div>
        {#if palette}
          <div class="mini-ramps">
            {#each RAMP_LABELS as [key, label] (key)}
              <RampStrip name={label} ramp={palette.ramps[key]} {showTechnical} />
            {/each}
            <p class="more-ramps">+ 4 rampes fonctionnelles (succès, avertissement, erreur, information)</p>
          </div>
        {/if}
      {:else if step === 5}
        <p class="panel-lead">
          Chaque garantie est mesurée — et expliquée. Rien à croire sur parole.
        </p>
        <ul class="checks">
          <li data-ok={true}>
            <strong>Fonctionnelle</strong>
            <span>
              {palette ? Object.keys(palette.themes.light.tokens).length : 0} rôles couverts —
              fonds, textes, bordures, focus, états — en clair et en sombre.
            </span>
          </li>
          <li data-ok={auditSummary?.failures === 0}>
            <strong>Lisible et contrastée</strong>
            <span>
              {#if auditSummary}
                {auditSummary.failures === 0
                  ? `Les ${auditSummary.tested} paires réellement utilisées passent WCAG 2.2 AA, dans les deux thèmes.`
                  : `${auditSummary.failures} paires échouent — c’est un bug du générateur, pas votre palette.`}
              {/if}
            </span>
          </li>
          <li data-ok={cvdOk}>
            <strong>Daltonisme</strong>
            <span>
              {cvdOk
                ? 'Succès et erreur restent distinguables en deutéranopie et protanopie.'
                : 'Deux états sémantiques se confondent — voir le détail ci-dessous.'}
            </span>
          </li>
          <li data-ok={true}>
            <strong>Fournie</strong>
            <span>{valueCount} valeurs (8 rampes × 11 pas), 2 thèmes complets.</span>
          </li>
          <li data-warn={true}>
            <strong>Responsable</strong>
            <span>Les indicateurs encre et énergie écran arrivent dans une prochaine étape — aucun chiffre inventé d’ici là.</span>
          </li>
        </ul>
        {#if report && report.diagnostics.length > 0}
          <details class="diag-details" open={report.diagnostics.some((d) => d.status === 'fail')}>
            <summary>
              Score de contraintes : <strong class="num">{report.score}/100</strong> —
              {report.diagnostics.length} remarque{report.diagnostics.length > 1 ? 's' : ''}
            </summary>
            <ul class="diag-list">
              {#each report.diagnostics as d (d.id)}
                <li data-status={d.status}>
                  <span class="badge">{d.status === 'fail' ? '✗' : '⚠'}</span>
                  <span>
                    {d.plain}
                    <small class="rule-ref">{d.rule}</small>
                  </span>
                </li>
              {/each}
            </ul>
          </details>
        {:else if report}
          <p class="all-good">Score de contraintes : <strong class="num">{report.score}/100</strong> — aucune remarque.</p>
        {/if}
      {:else if step === 6}
        <p class="panel-lead">Aperçu, exports, partage — la palette est à vous.</p>
        {#if palette}
          <div class="finals">
            {#each ['light', 'dark'] as const as mode (mode)}
              {@const t = palette.themes[mode].tokens}
              <div class="final-sample" style="background:{t.background.hex}">
                <div
                  class="final-card"
                  style="background:{t.surface.hex};border-color:{t['border-default'].hex}"
                >
                  <p class="final-title" style="color:{t['text-primary'].hex}">
                    Thème {mode === 'light' ? 'clair' : 'sombre'}
                  </p>
                  <p class="final-body" style="color:{t['text-secondary'].hex}">
                    Du texte, un
                    <span style="color:{t['text-muted'].hex}">passage atténué</span>, et des états :
                  </p>
                  <p class="final-actions">
                    <span
                      class="final-btn"
                      style="background:{t.primary.hex};color:{t['on-primary'].hex}">Action</span
                    >
                    <span
                      class="final-alert"
                      style="background:{t['success-surface'].hex};color:{t['success-content']
                        .hex};border-color:{t['success-border'].hex}">✓ Enregistré</span
                    >
                    <span
                      class="final-alert"
                      style="background:{t['error-surface'].hex};color:{t['error-content']
                        .hex};border-color:{t['error-border'].hex}">✗ Échec</span
                    >
                  </p>
                </div>
              </div>
            {/each}
          </div>

          <h3>Exporter</h3>
          <div class="export-row" role="group" aria-label="Format d’export">
            <button aria-pressed={exportFormat === 'css'} onclick={() => (exportFormat = 'css')}>
              Variables CSS
            </button>
            <button
              aria-pressed={exportFormat === 'tailwind'}
              onclick={() => (exportFormat = 'tailwind')}
            >
              Tailwind v4
            </button>
            <button onclick={copyExport}>{copied ? 'Copié ✓' : 'Copier'}</button>
          </div>
          <textarea class="export-area" readonly rows="8" value={exportText} aria-label="Code exporté"
          ></textarea>

          <h3>Partager</h3>
          <p class="help">Un lien qui rouvre exactement cette palette.</p>
          <ShareLink />
        {/if}
      {/if}

      <div class="panel-nav">
        {#if step > 1}
          <button onclick={() => (step -= 1)}>← Retour</button>
        {/if}
        {#if step < 6}
          <button class="primary" onclick={next} disabled={step === 3 && !baseValid}>
            Continuer →
          </button>
        {/if}
      </div>
    </section>
  {/key}

  <!-- Colonne de droite : prochaine étape + aperçu vivant -->
  <aside class="side">
    {#if step < 6}
      <div class="side-card next">
        <p class="side-kicker">Prochaine étape</p>
        <p class="side-title">{step + 1}. {STEPS[step]?.title}</p>
        <button class="primary" onclick={next} disabled={step === 3 && !baseValid}>
          Continuer →
        </button>
      </div>
    {/if}
    {#if palette && step >= 3}
      <div class="side-card">
        <p class="side-kicker">Votre couleur, en direct</p>
        <div class="side-strip" aria-hidden="true">
          {#each palette.ramps.primary.steps as s (s.step)}
            <span style="background:{s.hex}" class:base={s.isBase}></span>
          {/each}
        </div>
        <p class="side-note">
          Le pas encadré est votre couleur, exacte. Les autres sont ses déclinaisons.
        </p>
      </div>
    {/if}
    {#if palette && step >= 4}
      <div class="side-card">
        <p class="side-kicker">Ce que l’outil construit</p>
        <ul class="side-list">
          {#each palette.explanations.slice(1, 5) as e, i (i)}
            <li>{e}</li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if step === 1}
      <div class="side-card">
        <p class="side-kicker">Pourquoi cette question</p>
        <p class="side-note">
          Un imprimé, un écran et un graphique n’imposent pas les mêmes contraintes. Répondre
          d’abord à l’usage évite de tomber amoureuse d’une couleur qui ne tiendra pas la route.
        </p>
      </div>
    {/if}
  </aside>
</div>

<style>
  .guided {
    display: grid;
    grid-template-columns: 13rem minmax(0, 1fr) 17rem;
    gap: 1.6rem;
    align-items: start;
  }

  /* — Rail — */
  .rail {
    position: sticky;
    top: 1rem;
  }

  .rail-title {
    margin: 0 0 0.5rem;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .rail ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }

  .rail-step {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    border: 1px solid transparent;
    background: none;
    padding: 0.4rem 0.5rem;
    border-radius: 3px;
    text-align: left;
  }

  .rail-step:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .rail-step.current {
    border-color: var(--accent);
    background: #fff;
  }

  .rail-num {
    display: grid;
    place-items: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 50%;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .rail-step.current .rail-num {
    border-color: var(--accent);
    color: var(--accent);
  }

  .rail-step.done .rail-num {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }

  .rail-label {
    display: grid;
    font-size: 0.85rem;
    line-height: 1.25;
  }

  .rail-label small {
    color: var(--ink-2);
    font-size: 0.7rem;
  }

  .rail-atelier {
    margin-top: 1rem;
    width: 100%;
    text-align: left;
    display: grid;
    gap: 0.1rem;
    font-size: 0.85rem;
  }

  .rail-atelier small {
    color: var(--ink-2);
    font-size: 0.72rem;
  }

  /* — Panneau — */
  .panel {
    background: #fff;
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    padding: 1.6rem 1.9rem 1.4rem;
    min-height: 24rem;
    display: flex;
    flex-direction: column;
  }

  @media (prefers-reduced-motion: no-preference) {
    .panel {
      animation: panel-in 220ms ease;
    }

    @keyframes panel-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }

  .panel-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: var(--ink-2);
  }

  .panel h2 {
    font-size: 1.5rem;
    margin: 0.2rem 0 0.4rem;
  }

  .panel-lead {
    margin: 0 0 1.2rem;
    color: var(--ink-2);
    max-width: 34rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.7rem;
  }

  .card {
    display: grid;
    gap: 0.3rem;
    text-align: left;
    padding: 0.85rem 1rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    background: var(--paper);
    line-height: 1.4;
  }

  .card span {
    font-size: 0.82rem;
    color: var(--ink-2);
  }

  .card[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: #fff;
  }

  .card:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .moods {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .mood {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    background: var(--paper);
    text-align: left;
  }

  .mood[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .mood-swatch {
    inline-size: 1.7rem;
    block-size: 1.7rem;
    border-radius: 3px;
    border: 1px solid var(--hairline);
    flex-shrink: 0;
  }

  .mood-swatch.big {
    inline-size: 2.4rem;
    block-size: 2.4rem;
  }

  .mood-label {
    display: grid;
    font-size: 0.85rem;
  }

  .mood-label small {
    color: var(--ink-2);
    font-size: 0.72rem;
  }

  .surprise-row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1rem;
  }

  .color-pick {
    display: flex;
    gap: 0.8rem;
    align-items: center;
  }

  .color-pick input[type='color'] {
    inline-size: 5.5rem;
    block-size: 4rem;
    padding: 0.2rem;
  }

  .color-pick input[type='text'] {
    font-family: var(--font-mono);
    font-size: 1.05rem;
  }

  .alert {
    background: var(--paper-sunken);
    border-left: 3px solid var(--hairline-strong);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
  }

  .tune {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.9rem 1.4rem;
  }

  .ctrl {
    display: grid;
    gap: 0.25rem;
    font-size: 0.88rem;
    border: none;
    padding: 0;
    margin: 0;
  }

  .ctrl legend {
    padding: 0;
    font-size: 0.88rem;
  }

  .ctrl .effect {
    color: var(--ink-2);
    font-size: 0.76rem;
    line-height: 1.35;
  }

  .ctrl span small {
    display: block;
    color: var(--ink-2);
    font-weight: 400;
    font-size: 0.72rem;
  }

  .radio-row {
    display: flex;
    gap: 1rem;
  }

  .mini-ramps {
    margin-top: 1.2rem;
    display: grid;
    gap: 0.4rem;
  }

  .more-ramps {
    margin: 0.1rem 0 0;
    font-size: 0.75rem;
    color: var(--ink-2);
    padding-left: 7.1rem;
  }

  /* — Vérification — */
  .checks {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.55rem;
    max-width: 40rem;
  }

  .checks li {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 0.8rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--hairline);
    border-radius: 3px;
    font-size: 0.88rem;
    align-items: baseline;
  }

  .checks li strong::before {
    content: '✓ ';
  }

  .checks li[data-ok='false'] strong::before {
    content: '✗ ';
  }

  .checks li[data-warn='true'] strong::before {
    content: '… ';
  }

  .checks li span {
    color: var(--ink-2);
  }

  .diag-details {
    margin-top: 1rem;
    font-size: 0.88rem;
  }

  .diag-details summary {
    cursor: pointer;
  }

  .diag-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    display: grid;
    gap: 0.4rem;
  }

  .diag-list li {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
    border-left: 3px solid var(--hairline-strong);
    padding-left: 0.6rem;
  }

  .diag-list li[data-status='fail'] {
    border-left-color: var(--ink);
    font-weight: 500;
  }

  .rule-ref {
    display: block;
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .all-good {
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  /* — Livraison — */
  .finals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 0.8rem;
  }

  .final-sample {
    border: 1px solid var(--hairline-strong);
    border-radius: 3px;
    padding: 1rem;
  }

  .final-card {
    border: 1px solid;
    border-radius: 3px;
    padding: 0.8rem 0.9rem;
  }

  .final-title {
    margin: 0 0 0.25rem;
    font-weight: 600;
  }

  .final-body {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
  }

  .final-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0;
    font-size: 0.8rem;
  }

  .final-btn {
    padding: 0.22rem 0.7rem;
    border-radius: 2px;
  }

  .final-alert {
    padding: 0.22rem 0.55rem;
    border: 1px solid;
    border-radius: 2px;
  }

  h3 {
    font-size: 1rem;
    margin: 1.3rem 0 0.4rem;
  }

  .help {
    margin: 0 0 0.5rem;
    color: var(--ink-2);
    font-size: 0.85rem;
  }

  .export-row {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .export-area {
    inline-size: 100%;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  /* — Navigation du panneau — */
  .panel-nav {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: auto;
    padding-top: 1.4rem;
  }

  .panel-nav :only-child {
    margin-left: auto;
  }

  button.primary {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--paper);
    padding: 0.35rem 1rem;
  }

  button.primary:hover {
    background: var(--ink-2);
  }

  button.primary:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* — Colonne droite — */
  .side {
    display: grid;
    gap: 0.8rem;
    position: sticky;
    top: 1rem;
  }

  .side-card {
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    background: #fff;
    padding: 0.8rem 0.95rem;
  }

  .side-card.next {
    border-color: var(--accent);
  }

  .side-kicker {
    margin: 0 0 0.3rem;
    font-size: 0.7rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .side-title {
    margin: 0 0 0.6rem;
    font-weight: 600;
    font-size: 0.92rem;
  }

  .side-strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 1.6rem;
    border: 1px solid var(--hairline);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.4rem;
  }

  .side-strip .base {
    outline: 2px solid var(--ink);
    outline-offset: -3px;
  }

  .side-note {
    margin: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
  }

  .side-list {
    margin: 0;
    padding-left: 1rem;
    font-size: 0.78rem;
    color: var(--ink-2);
    display: grid;
    gap: 0.35rem;
  }

  @media (max-width: 60rem) {
    .guided {
      grid-template-columns: 1fr;
    }

    .rail,
    .side {
      position: static;
    }

    .rail ol {
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      overflow-x: auto;
    }

    .rail-label small {
      display: none;
    }
  }
</style>
