<script lang="ts">
  /**
   * Étape « Votre palette » : la liste complète des couleurs, éditable
   * (ajouter, retirer, modifier), avec les conseils de couverture —
   * clair / moyen / foncé, doublons, palette trop maigre.
   */
  import {
    analyzeCoverage,
    bandOf,
    BAND_LABELS,
    gamutMap,
    maxChroma,
    oklchToHex,
    parseToOklch,
    type GeneratedPalette,
  } from '../engine';
  import { settings, type PaletteEntry } from './state.svelte';

  let { palette }: { palette: GeneratedPalette | null } = $props();

  /** Génère une couleur de remplacement dans la bande manquante, en
   * restant dans la famille de la marque. */
  function suggestFor(band: 'light' | 'mid' | 'dark'): string {
    const base = parseToOklch(settings.baseColor) ?? { l: 0.6, c: 0.1, h: 260 };
    const l = band === 'light' ? 0.93 : band === 'dark' ? 0.28 : 0.6;
    const ratio = band === 'mid' ? 0.85 : 0.45;
    return oklchToHex(gamutMap({ l, c: ratio * maxChroma(l, base.h, 'srgb'), h: base.h }, 'srgb'));
  }

  const report = $derived(analyzeCoverage(settings.colors, suggestFor));

  function add(hex?: string): void {
    const next = hex ?? suggestFor('mid');
    settings.colors = [
      ...settings.colors,
      { id: `c${Date.now().toString(36)}`, hex: next, label: `Couleur ${settings.colors.length + 1}` },
    ];
  }

  function remove(id: string): void {
    settings.colors = settings.colors.filter((c) => c.id !== id);
  }

  function update(id: string, hex: string): void {
    settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, hex } : c));
  }

  function rename(id: string, label: string): void {
    settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, label } : c));
  }

  function importFromGenerated(): void {
    if (!palette) return;
    const t = palette.themes.light.tokens;
    const picks: PaletteEntry[] = [
      { id: 'g1', hex: t.primary.hex, label: 'Principale' },
      { id: 'g2', hex: t.secondary.hex, label: 'Secondaire' },
      { id: 'g3', hex: t.accent.hex, label: 'Accent' },
      { id: 'g4', hex: palette.ramps.neutral.steps[1]!.hex, label: 'Gris clair' },
      { id: 'g5', hex: palette.ramps.neutral.steps[9]!.hex, label: 'Gris foncé' },
    ];
    settings.colors = picks;
  }

  const bandOfHex = (hex: string) => {
    const c = parseToOklch(hex);
    return c ? bandOf(c) : 'mid';
  };
</script>

<div class="wrap">
  <div class="grid">
    {#each settings.colors as color (color.id)}
      <article class="card">
        <label class="swatch" style="background:{color.hex}">
          <input
            type="color"
            value={color.hex}
            oninput={(e) => update(color.id, e.currentTarget.value)}
            aria-label={`Modifier ${color.label}`}
          />
        </label>
        <input
          class="name"
          value={color.label}
          oninput={(e) => rename(color.id, e.currentTarget.value)}
          aria-label="Nom de la couleur"
        />
        <div class="meta">
          <code>{color.hex}</code>
          <span class="band">{BAND_LABELS[bandOfHex(color.hex)].replace(/s$/, '')}</span>
        </div>
        <button class="remove" onclick={() => remove(color.id)} aria-label={`Retirer ${color.label}`}
          >Retirer</button
        >
      </article>
    {/each}
    <button class="card add" onclick={() => add()}>
      <span class="plus" aria-hidden="true">+</span>
      Ajouter une couleur
    </button>
  </div>

  {#if palette}
    <button class="import" onclick={importFromGenerated}>
      Repartir des couleurs générées à l’étape précédente
    </button>
  {/if}

  <div class="advices">
    {#each report.advices as a (a.id)}
      <div class="advice" data-kind={a.kind}>
        <p class="advice-msg">{a.message}</p>
        <p class="advice-why">{a.why}</p>
        {#if a.suggestion}
          <button class="apply" onclick={() => add(a.suggestion?.hex)}>
            <span class="chip" style="background:{a.suggestion.hex}" aria-hidden="true"></span>
            Ajouter cette {a.suggestion.label}
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.7rem;
  }

  .card {
    display: grid;
    gap: 0.35rem;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    justify-items: stretch;
  }

  .swatch {
    position: relative;
    display: block;
    block-size: 5rem;
    border-radius: var(--radius);
    cursor: pointer;
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.08);
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

  .name {
    border: none;
    background: none;
    padding: 0;
    font-size: 0.9rem;
    font-weight: 500;
    inline-size: 100%;
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
    color: var(--ink-2);
  }

  .band {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .remove {
    border: none;
    background: none;
    padding: 0;
    font-size: 0.72rem;
    color: var(--ink-2);
    justify-self: start;
    text-decoration: underline;
  }

  .remove:hover {
    color: var(--ink);
    background: none;
  }

  .add {
    display: grid;
    place-items: center;
    gap: 0.3rem;
    block-size: 5rem;
    border: 1px dashed var(--hairline-strong);
    border-radius: var(--radius);
    color: var(--ink-2);
    font-size: 0.82rem;
    align-self: start;
  }

  .plus {
    font-size: 1.3rem;
    line-height: 1;
  }

  .import {
    justify-self: start;
    font-size: 0.82rem;
    padding: 0.3rem 0.9rem;
  }

  .advices {
    display: grid;
    gap: 0.6rem;
  }

  .advice {
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    background: var(--paper-sunken);
    display: grid;
    gap: 0.25rem;
    justify-items: start;
  }

  .advice[data-kind='ok'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--hairline);
  }

  .advice-msg {
    margin: 0;
    font-weight: 500;
  }

  .advice-why {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
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
    box-shadow: inset 0 0 0 1px oklch(20% 0.01 260 / 0.12);
  }
</style>
