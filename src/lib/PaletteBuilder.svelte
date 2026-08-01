<script lang="ts">
  import {
    generatePalette,
    scorePalette,
    exportCss,
    exportTailwind,
    parseToOklch,
    gamutMap,
    oklchToHex,
    SCHEMES,
    ROLE_LABELS,
    type SchemeName,
    type WheelName,
    type ThemeMode,
    type RoleName,
    type TokenRef,
  } from '../engine';
  import RampStrip from './RampStrip.svelte';

  let { showTechnical }: { showTechnical: boolean } = $props();

  let baseColor = $state('#2563eb');
  let scheme: SchemeName = $state('split-complementary');
  let wheel: WheelName = $state('ryb');
  let intensity = $state(1);
  let neutralInfluence = $state(50);
  let hueTorsion = $state(0);
  let previewMode: ThemeMode = $state('light');
  let exportFormat: 'css' | 'tailwind' = $state('css');
  let copied = $state(false);

  // — Partage via le Worker (back : /api/palettes, stockage KV) —
  let shareUrl = $state('');
  let shareState: 'idle' | 'busy' | 'error' = $state('idle');
  let shareCopied = $state(false);
  let loadNotice = $state('');

  function currentRecipe() {
    const oklch = parseToOklch(baseColor);
    return {
      baseColor: oklch ? oklchToHex(gamutMap(oklch, 'srgb')) : baseColor,
      options: {
        scheme,
        wheel,
        intensity,
        neutralInfluence: neutralInfluence / 100,
        hueTorsion,
      },
    };
  }

  async function sharePalette(): Promise<void> {
    shareState = 'busy';
    shareUrl = '';
    try {
      const response = await fetch('/api/palettes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(currentRecipe()),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { id } = (await response.json()) as { id: string };
      shareUrl = `${location.origin}${location.pathname}?p=${id}`;
      shareState = 'idle';
    } catch {
      shareState = 'error';
    }
  }

  async function copyShareUrl(): Promise<void> {
    await navigator.clipboard.writeText(shareUrl);
    shareCopied = true;
    setTimeout(() => (shareCopied = false), 1600);
  }

  // Chargement d'une palette partagée (?p=identifiant).
  $effect(() => {
    const id = new URLSearchParams(location.search).get('p');
    if (!id || !/^[0-9a-z]{16}$/.test(id)) return;
    void (async () => {
      try {
        const response = await fetch(`/api/palettes/${id}`);
        if (!response.ok) throw new Error(String(response.status));
        const stored = (await response.json()) as {
          baseColor: string;
          options: {
            scheme: SchemeName;
            wheel: WheelName;
            intensity: number;
            neutralInfluence: number;
            hueTorsion: number;
          };
        };
        baseColor = stored.baseColor;
        scheme = stored.options.scheme;
        wheel = stored.options.wheel;
        intensity = stored.options.intensity;
        neutralInfluence = Math.round(stored.options.neutralInfluence * 100);
        hueTorsion = stored.options.hueTorsion;
        loadNotice = 'Palette partagée chargée.';
      } catch {
        loadNotice = 'Impossible de charger la palette partagée (lien expiré ou service indisponible).';
      }
    })();
  });

  const palette = $derived.by(() => {
    try {
      return generatePalette(baseColor, {
        scheme,
        wheel,
        intensity,
        neutralInfluence: neutralInfluence / 100,
        hueTorsion,
      });
    } catch {
      return null;
    }
  });

  const report = $derived(palette ? scorePalette(palette) : null);
  const theme = $derived(palette ? palette.themes[previewMode] : null);
  const exportText = $derived(
    palette ? (exportFormat === 'css' ? exportCss(palette) : exportTailwind(palette)) : '',
  );

  const RAMP_LABELS: [keyof NonNullable<typeof palette>['ramps'], string][] = [
    ['primary', 'principale'],
    ['secondary', 'secondaire'],
    ['accent', 'accent'],
    ['neutral', 'neutres'],
    ['success', 'succès'],
    ['warning', 'avertissement'],
    ['error', 'erreur'],
    ['info', 'information'],
  ];

  const ROLE_GROUPS: { title: string; roles: RoleName[] }[] = [
    { title: 'Surfaces', roles: ['background', 'surface', 'surface-sunken', 'overlay'] },
    { title: 'Contenu', roles: ['text-primary', 'text-secondary', 'text-muted', 'text-disabled'] },
    { title: 'Marque', roles: ['primary', 'on-primary', 'secondary', 'on-secondary', 'accent', 'on-accent'] },
    { title: 'Structure & interaction', roles: ['border-strong', 'border-default', 'focus-ring', 'hover', 'selected'] },
    {
      title: 'Sémantique',
      roles: [
        'success-surface', 'success-content',
        'warning-surface', 'warning-content',
        'error-surface', 'error-content',
        'info-surface', 'info-content',
      ],
    },
  ];

  function tokenOf(role: RoleName): TokenRef | null {
    return theme ? theme.tokens[role] : null;
  }

  async function copyExport(): Promise<void> {
    await navigator.clipboard.writeText(exportText);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

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
</script>

<section aria-labelledby="titre-construire">
  <h2 id="titre-construire">Construire une palette</h2>
  <p class="help">
    Donnez une seule couleur : l’outil construit le système complet — teintes de marque,
    gris, couleurs fonctionnelles — et garantit la lisibilité de chaque usage.
  </p>

  <div class="controls">
    <label class="ctrl">
      <span>Votre couleur</span>
      <span class="color-input">
        <input type="color" bind:value={baseColor} aria-label="Sélecteur de couleur" />
        <input
          type="text"
          bind:value={baseColor}
          size="9"
          spellcheck="false"
          aria-label="Couleur de base en hexadécimal"
        />
      </span>
      <small>Le point de départ. Elle est conservée exactement.</small>
    </label>

    <label class="ctrl">
      <span>Schéma d’harmonie</span>
      <select bind:value={scheme}>
        {#each SCHEMES as s (s.name)}
          <option value={s.name}>{s.label}</option>
        {/each}
      </select>
      <small>{SCHEMES.find((s) => s.name === scheme)?.effect}</small>
    </label>

    <fieldset class="ctrl">
      <legend>Roue</legend>
      <span class="radio-row">
        <label><input type="radio" bind:group={wheel} value="ryb" /> Peintres (RYB)</label>
        <label><input type="radio" bind:group={wheel} value="rgb" /> Écrans (RGB)</label>
      </span>
      <small>
        {wheel === 'ryb'
          ? 'La roue des pigments : le complémentaire du rouge est le vert.'
          : 'La roue de la lumière : le complémentaire du rouge est le cyan.'}
      </small>
    </fieldset>

    <label class="ctrl">
      <span>Intensité générale <span class="num">{Math.round(intensity * 100)}&nbsp;%</span></span>
      <input type="range" min="0.5" max="1.2" step="0.05" bind:value={intensity} />
      <small>Monte ou baisse la vivacité de toutes les couleurs, sans toucher aux clartés.</small>
    </label>

    <label class="ctrl">
      <span>Chaleur des gris <span class="num">{neutralInfluence}&nbsp;%</span></span>
      <input type="range" min="0" max="100" step="5" bind:value={neutralInfluence} />
      <small>À 0, les gris sont purs et paraissent étrangers à la marque.</small>
    </label>

    <label class="ctrl">
      <span>Torsion de teinte <span class="num">{hueTorsion}°</span></span>
      <input type="range" min="-15" max="15" step="1" bind:value={hueTorsion} />
      <small>Fait glisser la teinte le long de la rampe : positif = plus froid vers le sombre.</small>
    </label>
  </div>

  {#if loadNotice}
    <p class="notice" role="status">{loadNotice}</p>
  {/if}

  {#if !palette}
    <p class="parse-error" role="alert">Couleur illisible — donnez un hex comme #2563eb.</p>
  {:else}
    <div class="ramps">
      {#each RAMP_LABELS as [key, label] (key)}
        <RampStrip name={label} ramp={palette.ramps[key]} {showTechnical} />
      {/each}
    </div>

    {#if auditSummary}
      <p class="audit" data-ok={auditSummary.failures === 0}>
        {#if auditSummary.failures === 0}
          ✓ Les {auditSummary.tested} paires réellement utilisées passent WCAG&nbsp;2.2 AA,
          en clair et en sombre, sans intervention.
        {:else}
          ✗ {auditSummary.failures} paires sur {auditSummary.tested} échouent — c’est un bug
          du générateur, pas de votre palette.
        {/if}
        {#if report}
          · Score de contraintes&nbsp;: <strong class="num">{report.score}/100</strong>
        {/if}
      </p>
    {/if}

    {#if report && report.diagnostics.length > 0}
      <ul class="constraint-list">
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
    {/if}

    <details class="explain">
      <summary>Ce que l’outil a construit, et pourquoi</summary>
      <ul>
        {#each palette.explanations as e, i (i)}
          <li>{e}</li>
        {/each}
      </ul>
    </details>

    <h3>Les rôles</h3>
    <div class="theme-toggle" role="group" aria-label="Thème d’aperçu">
      <button aria-pressed={previewMode === 'light'} onclick={() => (previewMode = 'light')}>
        Thème clair
      </button>
      <button aria-pressed={previewMode === 'dark'} onclick={() => (previewMode = 'dark')}>
        Thème sombre
      </button>
    </div>

    {#if theme}
      <div class="sample" style="background:{theme.tokens.background.hex}">
        <div
          class="sample-card"
          style="background:{theme.tokens.surface.hex};border-color:{theme.tokens['border-default'].hex}"
        >
          <p class="sample-title" style="color:{theme.tokens['text-primary'].hex}">
            Un titre de carte
          </p>
          <p class="sample-body" style="color:{theme.tokens['text-secondary'].hex}">
            Du texte secondaire, posé sur la surface, avec un
            <span style="color:{theme.tokens['text-muted'].hex}">passage atténué</span>.
          </p>
          <p class="sample-actions">
            <span
              class="sample-btn"
              style="background:{theme.tokens.primary.hex};color:{theme.tokens['on-primary'].hex}"
              >Action</span
            >
            <span
              class="sample-alert"
              style="background:{theme.tokens['success-surface'].hex};color:{theme.tokens['success-content'].hex};border-color:{theme.tokens['success-border'].hex}"
              >✓ Enregistré</span
            >
            <span
              class="sample-alert"
              style="background:{theme.tokens['error-surface'].hex};color:{theme.tokens['error-content'].hex};border-color:{theme.tokens['error-border'].hex}"
              >✗ Échec de l’envoi</span
            >
          </p>
        </div>
      </div>

      <div class="roles">
        {#each ROLE_GROUPS as group (group.title)}
          <div class="role-group">
            <h4>{group.title}</h4>
            <ul>
              {#each group.roles as role (role)}
                {@const token = tokenOf(role)}
                {#if token}
                  <li>
                    <span class="swatch" style="background:{token.hex}" aria-hidden="true"></span>
                    <span class="role-name">{ROLE_LABELS[role] ?? role}</span>
                    <code>{token.ramp}·{token.step}</code>
                    {#if showTechnical}<code class="tech">{token.hex}</code>{/if}
                  </li>
                {/if}
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}

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
    <textarea class="export-area" readonly rows="10" value={exportText} aria-label="Code exporté"
    ></textarea>

    <h3>Partager</h3>
    <p class="help">
      Crée un lien qui rouvre exactement cette palette (la recette est sauvegardée côté
      serveur, la palette est régénérée à l’identique à l’ouverture).
    </p>
    <div class="share-row">
      <button onclick={sharePalette} disabled={shareState === 'busy'}>
        {shareState === 'busy' ? 'Création…' : 'Créer un lien de partage'}
      </button>
      {#if shareUrl}
        <input class="share-url" type="text" readonly value={shareUrl} aria-label="Lien de partage" />
        <button onclick={copyShareUrl}>{shareCopied ? 'Copié ✓' : 'Copier'}</button>
      {/if}
    </div>
    {#if shareState === 'error'}
      <p class="parse-error" role="alert">
        Le partage nécessite le back déployé avec son stockage (binding KV
        «&nbsp;NUANCIER_KV&nbsp;» — voir le README, section déploiement).
      </p>
    {/if}
  {/if}
</section>

<style>
  h2 {
    font-size: 1.15rem;
    margin-bottom: 0.35rem;
  }

  h3 {
    font-size: 1rem;
    margin: 1.4rem 0 0.5rem;
  }

  .help {
    margin: 0.15rem 0 0.9rem;
    color: var(--ink-2);
    font-size: 0.85rem;
    max-width: 46rem;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.9rem 1.4rem;
    margin-bottom: 1.2rem;
    max-width: 60rem;
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

  .ctrl small {
    color: var(--ink-2);
    font-size: 0.76rem;
    line-height: 1.35;
  }

  .color-input {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .color-input input[type='color'] {
    inline-size: 2.3rem;
    block-size: 1.9rem;
    padding: 0.1rem;
  }

  .radio-row {
    display: flex;
    gap: 1rem;
  }

  .ramps {
    display: grid;
    gap: 0.45rem;
    max-width: 56rem;
  }

  .audit {
    font-size: 0.9rem;
    margin: 0.9rem 0 0.3rem;
  }

  .audit[data-ok='false'] {
    font-weight: 600;
  }

  .constraint-list {
    list-style: none;
    padding: 0;
    margin: 0.3rem 0 0;
    display: grid;
    gap: 0.4rem;
    max-width: 52rem;
  }

  .constraint-list li {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
    border-left: 3px solid var(--hairline-strong);
    padding-left: 0.6rem;
  }

  .constraint-list li[data-status='fail'] {
    border-left-color: var(--ink);
    font-weight: 500;
  }

  .rule-ref {
    display: block;
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .explain {
    margin: 0.9rem 0;
    font-size: 0.88rem;
    max-width: 52rem;
  }

  .explain summary {
    cursor: pointer;
  }

  .explain ul {
    margin: 0.5rem 0 0;
    padding-left: 1.2rem;
    color: var(--ink-2);
    display: grid;
    gap: 0.3rem;
  }

  .theme-toggle,
  .export-row {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }

  .sample {
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
    padding: 1.2rem;
    max-width: 34rem;
    margin-bottom: 0.9rem;
  }

  .sample-card {
    border: 1px solid;
    border-radius: 3px;
    padding: 0.9rem 1rem;
  }

  .sample-title {
    margin: 0 0 0.3rem;
    font-weight: 600;
  }

  .sample-body {
    margin: 0 0 0.7rem;
    font-size: 0.9rem;
  }

  .sample-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.85rem;
  }

  .sample-btn {
    padding: 0.25rem 0.8rem;
    border-radius: 2px;
  }

  .sample-alert {
    padding: 0.25rem 0.6rem;
    border: 1px solid;
    border-radius: 2px;
  }

  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem 1.6rem;
    max-width: 62rem;
  }

  .role-group h4 {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-2);
    font-family: var(--font-ui);
  }

  .role-group ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.25rem;
  }

  .role-group li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
  }

  .swatch {
    display: inline-block;
    inline-size: 1rem;
    block-size: 1rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .role-name {
    min-inline-size: 11rem;
  }

  .tech {
    color: var(--ink-2);
  }

  .export-area {
    inline-size: 100%;
    max-inline-size: 56rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .parse-error,
  .notice {
    color: var(--ink);
    background: var(--paper-sunken);
    border-left: 3px solid var(--hairline-strong);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    max-width: 46rem;
  }

  .share-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .share-url {
    flex: 1;
    min-inline-size: 16rem;
    max-inline-size: 34rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
</style>
