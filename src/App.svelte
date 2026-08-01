<script lang="ts">
  import {
    parseToOklch,
    oklchToHex,
    gamutMap,
    formatOklch,
    contrastMatrix,
    diagnoseContrast,
    diagnoseCvd,
    simulateCvd,
    CVD_TYPES,
    type PairUsage,
    type Diagnostic,
  } from './engine';
  import MatrixTable from './lib/MatrixTable.svelte';
  import DiagnosticPanel from './lib/DiagnosticPanel.svelte';

  const USAGE_OPTIONS: { value: PairUsage; label: string; hint: string }[] = [
    {
      value: 'body-text',
      label: 'Texte courant',
      hint: 'Paragraphes, labels — il faut 4,5:1 (AA) ou 7:1 (AAA).',
    },
    {
      value: 'large-text',
      label: 'Grand texte',
      hint: 'Titres ≥ 24 px (ou 18,66 px gras) — il faut 3:1 (AA) ou 4,5:1 (AAA).',
    },
    {
      value: 'ui-component',
      label: 'Composant',
      hint: 'Icônes, bordures de champ — il faut 3:1 (AA).',
    },
    {
      value: 'focus-ring',
      label: 'Anneau de focus',
      hint: 'Le repère des personnes qui naviguent au clavier — il faut 3:1 (AA).',
    },
  ];

  const INITIAL_PALETTE = '#1a1a2e\n#fafafa\n#2563eb\n#9ca3af\n#b45309';
  let rawInput = $state(INITIAL_PALETTE);
  let usage: PairUsage = $state('body-text');
  let showTechnical = $state(false);
  let severity = $state(100);
  let selectedPair: { fgIndex: number; bgIndex: number } | null = $state(null);
  let parseErrors: string[] = $state([]);

  type UiColor = { id: string; hex: string; label: string };

  let colors: UiColor[] = $state([]);

  function readPalette(input: string): void {
    const tokens = input
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const next: UiColor[] = [];
    const errors: string[] = [];
    for (const token of tokens) {
      const oklch = parseToOklch(token);
      if (!oklch) {
        errors.push(token);
        continue;
      }
      const hex = oklchToHex(gamutMap(oklch, 'srgb'));
      const n = next.length + 1;
      next.push({ id: `couleur-${n}`, hex, label: `couleur ${n}` });
    }
    colors = next;
    parseErrors = errors;
    selectedPair = null;
  }

  // Palette initiale.
  readPalette(INITIAL_PALETTE);

  const matrix = $derived(contrastMatrix(colors, usage));

  const diagnostic: Diagnostic | null = $derived.by(() => {
    if (!selectedPair) return null;
    const fg = colors[selectedPair.fgIndex];
    const bg = colors[selectedPair.bgIndex];
    if (!fg || !bg) return null;
    return diagnoseContrast(fg, bg, usage);
  });

  const cvdDiagnostics = $derived(
    colors.length >= 2
      ? CVD_TYPES.filter((t) => t.type !== 'achromatopsia').map((t) => ({
          ...t,
          diag: diagnoseCvd(colors, t.type, severity),
          swatches: colors.map((c) => simulateCvd(c.hex, t.type, severity)),
        }))
      : [],
  );

  function applyRemedy(changes: { target: string; to: string }[]): void {
    colors = colors.map((c) => {
      const change = changes.find((ch) => ch.target === c.id);
      return change ? { ...c, hex: change.to } : c;
    });
    rawInput = colors.map((c) => c.hex).join('\n');
  }

  const usageHint = $derived(USAGE_OPTIONS.find((o) => o.value === usage)?.hint ?? '');
</script>

<div class="layout">
  <header>
    <h1>Nuancier</h1>
    <p class="tagline">
      Atelier de couleur — Phase 0 : la matrice de contraste qui ne ment pas.
    </p>
    <label class="tech-toggle">
      <input type="checkbox" bind:checked={showTechnical} />
      Afficher les valeurs techniques
    </label>
  </header>

  <section class="input-zone" aria-labelledby="titre-palette">
    <h2 id="titre-palette">Vos couleurs</h2>
    <p class="help">
      Collez vos couleurs (hex, <code>rgb()</code> ou <code>oklch()</code>), une par ligne ou
      séparées par des espaces.
    </p>
    <textarea
      rows="5"
      bind:value={rawInput}
      onchange={() => readPalette(rawInput)}
      aria-label="Couleurs de la palette"
    ></textarea>
    <button onclick={() => readPalette(rawInput)}>Analyser la palette</button>
    {#if parseErrors.length > 0}
      <p class="parse-error" role="alert">
        Illisible&nbsp;: {parseErrors.join(', ')} — ces valeurs ont été ignorées.
      </p>
    {/if}
    {#if colors.length > 0}
      <ul class="chips" aria-label="Couleurs analysées">
        {#each colors as color (color.id)}
          <li>
            <span class="swatch" style="background:{color.hex}" aria-hidden="true"></span>
            <span>{color.label}</span>
            <code>{color.hex}</code>
            {#if showTechnical}
              <code class="tech">{formatOklch(parseToOklch(color.hex)!)}</code>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if colors.length >= 2}
    <section aria-labelledby="titre-matrice">
      <h2 id="titre-matrice">Matrice de contraste</h2>
      <div class="usage-row" role="group" aria-label="Type d’usage des paires">
        {#each USAGE_OPTIONS as option (option.value)}
          <button
            aria-pressed={usage === option.value}
            onclick={() => (usage = option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
      <p class="help">{usageHint}</p>

      <MatrixTable
        {matrix}
        {showTechnical}
        selected={selectedPair}
        onselect={(fgIndex, bgIndex) => (selectedPair = { fgIndex, bgIndex })}
      />

      <p class="summary">
        {matrix.summary.pairsTested} paires testées ·
        {#if matrix.summary.failures > 0}
          <strong>{matrix.summary.failures} sous le seuil</strong> ·
        {/if}
        {#if matrix.summary.warnings > 0}
          {matrix.summary.warnings} conformes mais perceptuellement faibles ·
        {/if}
        verdict global&nbsp;: <strong>{matrix.summary.level}</strong>.
        Cliquez une case pour comprendre et corriger.
      </p>

      {#if diagnostic}
        <DiagnosticPanel {diagnostic} {showTechnical} onapply={applyRemedy} />
      {/if}
    </section>

    <section aria-labelledby="titre-cvd">
      <h2 id="titre-cvd">Daltonisme</h2>
      <p class="help">
        Vos couleurs, vues avec une perception réduite des couleurs. La plupart des personnes
        concernées ont une forme <em>partielle</em> — réglez la sévérité pour en juger.
      </p>
      <label class="severity">
        Sévérité&nbsp;: <span class="num">{severity}&nbsp;%</span>
        <input type="range" min="10" max="100" step="10" bind:value={severity} />
      </label>
      <div class="cvd-grid">
        {#each cvdDiagnostics as row (row.type)}
          <div class="cvd-row">
            <span class="cvd-label">{row.label}</span>
            <span class="cvd-swatches" aria-hidden="true">
              {#each row.swatches as sim, i (i)}
                <span class="swatch" style="background:{sim}"></span>
              {/each}
            </span>
            <span class="cvd-verdict" data-status={row.diag.status}>
              {row.diag.status === 'pass' ? 'Distinguables' : 'Couleurs qui se confondent'}
            </span>
            {#if row.diag.status !== 'pass'}
              <p class="cvd-plain">{row.diag.plain}</p>
            {/if}
            {#if showTechnical && row.diag.technical}
              <p class="cvd-plain tech">{row.diag.technical}</p>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <footer>
    <p>
      L’outil vérifie les critères d’accessibilité liés à la couleur (WCAG&nbsp;2.2)&nbsp;;
      il ne constitue pas un audit d’accessibilité complet.
    </p>
  </footer>
</div>

<style>
  .layout {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    display: grid;
    gap: 2rem;
  }

  header {
    border-bottom: 1px solid var(--hairline-strong);
    padding-bottom: 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 0.25rem 1rem;
  }

  h1 {
    font-size: 1.6rem;
  }

  .tagline {
    margin: 0;
    grid-column: 1;
    color: var(--ink-2);
  }

  .tech-toggle {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-2);
  }

  h2 {
    font-size: 1.15rem;
    margin-bottom: 0.35rem;
  }

  .help {
    margin: 0.15rem 0 0.6rem;
    color: var(--ink-2);
    font-size: 0.85rem;
  }

  textarea {
    width: 100%;
    max-width: 32rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .parse-error {
    color: var(--ink);
    background: var(--paper-sunken);
    border-left: 3px solid var(--hairline-strong);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
  }

  .chips {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
    padding: 0;
    margin: 0.75rem 0 0;
  }

  .chips li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .swatch {
    display: inline-block;
    inline-size: 1.05rem;
    block-size: 1.05rem;
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
  }

  .tech {
    color: var(--ink-2);
  }

  .usage-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }

  .summary {
    font-size: 0.9rem;
    color: var(--ink-2);
    margin: 0.75rem 0 0;
  }

  .summary strong {
    color: var(--ink);
  }

  .severity {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .severity input {
    max-width: 14rem;
  }

  .cvd-grid {
    display: grid;
    gap: 0.6rem;
  }

  .cvd-row {
    display: grid;
    grid-template-columns: 14rem auto 1fr;
    gap: 0.3rem 1rem;
    align-items: center;
    border-top: 1px solid var(--hairline);
    padding-top: 0.6rem;
  }

  .cvd-label {
    font-size: 0.9rem;
  }

  .cvd-swatches {
    display: flex;
    gap: 0.25rem;
  }

  .cvd-verdict {
    font-size: 0.85rem;
  }

  .cvd-verdict[data-status='fail'] {
    font-weight: 600;
  }

  .cvd-verdict[data-status='fail']::before {
    content: '✗ ';
  }

  .cvd-verdict[data-status='pass']::before {
    content: '✓ ';
  }

  .cvd-plain {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
    max-width: 60rem;
  }

  footer {
    border-top: 1px solid var(--hairline);
    padding-top: 0.75rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }

  footer p {
    margin: 0;
  }

  @media (max-width: 40rem) {
    .cvd-row {
      grid-template-columns: 1fr;
    }
  }
</style>
