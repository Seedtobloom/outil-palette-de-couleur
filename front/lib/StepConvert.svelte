<script lang="ts">
  /**
   * Étape « Convertir » : une fiche par couleur, dans tous les formats
   * utiles, chaque valeur copiable d'un clic.
   *
   * ⚠ PAS DE BIBLIOTHÈQUE PANTONE, ET C'EST DÉLIBÉRÉ.
   * L'outil de référence embarque une table d'environ 145 références
   * Pantone et affiche « la plus proche ». Le brief §5.4 est explicite :
   * republier les valeurs Lab ou hex d'un nuancier déposé expose
   * juridiquement, même dans un outil gratuit — Adobe a retiré le
   * support natif Pantone de ses applications pour cette raison. La
   * ligne « Ton direct » est donc un champ libre : la graphiste y saisit
   * la référence qu'elle lit sur SON nuancier papier. C'est d'ailleurs
   * la seule valeur juste, une correspondance calculée n'étant jamais
   * qu'une approximation.
   */
  import {
    formatCmjn,
    formatOklch,
    hexToRgb255,
    parseToOklch,
    rgbToCmjn,
    CMJN_RESERVE,
  } from '../engine';
  import { settings, type PaletteEntry } from './state.svelte';
  import { journal } from './journal.svelte';
  import { messages } from './messages.svelte';

  type Format = 'hex' | 'rvb' | 'hsl' | 'oklch' | 'cmjn' | 'reference';

  const FORMATS: { id: Format; label: string }[] = [
    { id: 'hex', label: 'HEX' },
    { id: 'rvb', label: 'RVB' },
    { id: 'hsl', label: 'HSL' },
    { id: 'oklch', label: 'OKLCH' },
    { id: 'cmjn', label: 'CMJN' },
    { id: 'reference', label: 'Ton direct' },
  ];

  let visibles = $state<Format[]>(['hex', 'rvb', 'cmjn', 'oklch', 'reference']);

  function bascule(f: Format): void {
    if (visibles.includes(f)) {
      if (visibles.length === 1) {
        messages.refus('Garde au moins un format affiché.');
        return;
      }
      visibles = visibles.filter((v) => v !== f);
    } else {
      visibles = [...visibles, f];
    }
  }

  /** HSL est donné pour les intégrations qui en demandent — le travail
   *  de l'outil, lui, se fait en OKLCH. */
  function hsl(hex: string): string {
    const rgb = hexToRgb255(hex);
    if (!rgb) return '—';
    const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  }

  function valeur(entree: PaletteEntry, f: Format): string {
    switch (f) {
      case 'hex':
        return entree.hex.toUpperCase();
      case 'rvb': {
        const rgb = hexToRgb255(entree.hex);
        return rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : '—';
      }
      case 'hsl':
        return hsl(entree.hex);
      case 'oklch': {
        const c = parseToOklch(entree.hex);
        return c ? formatOklch(c) : '—';
      }
      case 'cmjn': {
        const c = rgbToCmjn(entree.hex);
        return c ? formatCmjn(c) : '—';
      }
      case 'reference':
        return entree.reference?.trim() || '';
    }
  }

  async function copie(texte: string, quoi: string): Promise<void> {
    if (!texte) return;
    try {
      await navigator.clipboard.writeText(texte);
      messages.succes(`${quoi} copié.`);
    } catch {
      messages.refus('Le navigateur a refusé l’accès au presse-papier.');
    }
  }

  async function copieFiche(entree: PaletteEntry): Promise<void> {
    const lignes = FORMATS.filter((f) => visibles.includes(f.id))
      .map((f) => {
        const v = valeur(entree, f.id);
        return v ? `${f.label} : ${v}` : null;
      })
      .filter(Boolean);
    await copie(`${entree.label}\n${lignes.join('\n')}`, `Fiche « ${entree.label} »`);
  }

  function noteReference(entree: PaletteEntry, texte: string): void {
    journal.agis(`Référence de ${entree.label}`, () => {
      settings.colors = settings.colors.map((c) =>
        c.id === entree.id ? { ...c, reference: texte } : c,
      );
    });
  }
</script>

<div class="wrap">
  <div class="fiches">
    {#each settings.colors as color (color.id)}
      <article class="fiche">
        <div class="tete">
          <span class="aplat" style="background:{color.hex}" aria-hidden="true"></span>
          <div class="identite">
            <p class="nom">{color.label}</p>
            {#if settings.roles[color.id]}
              <p class="role">{settings.roles[color.id]}</p>
            {/if}
          </div>
          <button class="copier-fiche" onclick={() => copieFiche(color)}>Copier la fiche</button>
        </div>

        <dl class="valeurs">
          {#each FORMATS.filter((f) => visibles.includes(f.id)) as f (f.id)}
            <dt>{f.label}</dt>
            <dd>
              {#if f.id === 'reference'}
                <input
                  class="ref"
                  value={color.reference ?? ''}
                  placeholder="lis-la sur ton nuancier"
                  oninput={(e) => noteReference(color, e.currentTarget.value)}
                  aria-label={`Référence de ton direct pour ${color.label}`}
                />
              {:else}
                <button
                  class="valeur value"
                  onclick={() => copie(valeur(color, f.id), f.label)}
                  title="Copier"
                >
                  {valeur(color, f.id)}
                </button>
              {/if}
            </dd>
          {/each}
        </dl>
      </article>
    {/each}
  </div>

  <div class="panel">
    <p class="panel-tete">
      Données affichées
      <span class="panel-compte">{visibles.length} sur {FORMATS.length}</span>
    </p>
    <div class="choix" role="group" aria-label="Formats affichés">
      {#each FORMATS as f (f.id)}
        <button
          aria-pressed={visibles.includes(f.id)}
          class:choisi={visibles.includes(f.id)}
          onclick={() => bascule(f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <p class="note-pied">
      HEX pour le web · RVB pour l’écran · OKLCH pour travailler la couleur · CMJN pour une
      première estimation d’impression · Ton direct pour l’identité imprimée.
    </p>
    <p class="note-pied">{CMJN_RESERVE}</p>
    <p class="note-pied">
      Aucune correspondance Pantone n’est calculée : les nuanciers déposés ne peuvent pas être
      redistribués (brief §5.4). Saisis la référence que tu lis sur ton propre nuancier — c’est
      de toute façon la seule valeur exacte.
    </p>
  </div>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.2rem;
  }

  .fiches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 0.8rem;
  }

  .fiche {
    border: 1px solid var(--filet);
    border-radius: var(--radius);
    padding: 0.85rem 0.95rem;
    display: grid;
    gap: 0.7rem;
  }

  .tete {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .aplat {
    inline-size: 2.4rem;
    block-size: 2.4rem;
    flex: none;
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px var(--filet-fort);
  }

  .identite {
    flex: 1;
    min-inline-size: 0;
  }

  .nom {
    margin: 0;
    font-weight: 500;
    font-size: 0.95rem;
  }

  .role {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .copier-fiche {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    min-block-size: 32px;
    white-space: nowrap;
  }

  .valeurs {
    display: grid;
    grid-template-columns: 4.6rem 1fr;
    gap: 0.25rem 0.5rem;
    margin: 0;
    align-items: center;
  }

  .valeurs dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .valeurs dd {
    margin: 0;
    min-inline-size: 0;
  }

  .valeur {
    inline-size: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 0.15rem 0.3rem;
    min-block-size: 28px;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
    color: var(--text-main);
  }

  .valeur:hover {
    background: var(--surface-panel);
    border-color: transparent;
  }

  .ref {
    inline-size: 100%;
    min-block-size: 30px;
    font-size: 0.8rem;
    padding: 0.15rem 0.4rem;
  }

  .choix {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .choix button {
    font-size: 0.78rem;
    padding: 0.2rem 0.75rem;
    min-block-size: 34px;
  }

  .choix button.choisi {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
  }
</style>
