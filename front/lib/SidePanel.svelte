<script lang="ts">
  /**
   * Panneau latéral droit, persistant — la troisième colonne.
   *
   * Il porte ce qui accompagne la décision en cours : l'assistant de
   * complétion (étape Nuancier), le guide d'attribution (Rôles), le
   * rappel de règle (Contraste)… et, en bas, l'aperçu de l'étape
   * suivante avec sa condition d'accès (brief §7).
   *
   * Chaque carte suit la structure du DS : micro-libellé en capitales,
   * contenu, phrase d'explication, actions.
   */
  import {
    analyzeCoverage,
    gamutMap,
    maxChroma,
    oklchToHex,
    parseToOklch,
    SEUILS,
    type PairUse,
  } from '../engine';
  import { settings } from './state.svelte';

  let {
    etapeId,
    suivante,
    peutContinuer,
    conditionSuivante,
    onContinuer,
    usageContraste = 'texte',
  }: {
    etapeId: string;
    suivante: { titre: string; court: string } | null;
    peutContinuer: boolean;
    conditionSuivante: string | null;
    onContinuer: () => void;
    usageContraste?: PairUse;
  } = $props();

  /** Suggestions de complétion — la carte la plus vue de l'application. */
  function suggereBande(band: 'light' | 'mid' | 'dark'): string {
    const base = parseToOklch(settings.baseColor) ?? { l: 0.6, c: 0.1, h: 260 };
    const l = band === 'light' ? 0.93 : band === 'dark' ? 0.26 : 0.6;
    const part = band === 'mid' ? 0.85 : 0.42;
    return oklchToHex(gamutMap({ l, c: part * maxChroma(l, base.h, 'srgb'), h: base.h }, 'srgb'));
  }

  const couverture = $derived(analyzeCoverage(settings.colors, suggereBande));
  const manques = $derived(couverture.advices.filter((a) => a.kind === 'gap' && a.suggestion));

  function ajouter(hex: string, nom: string): void {
    settings.colors = [
      ...settings.colors,
      { id: `s${settings.colors.length}${Date.now().toString(36)}`, hex, label: nom },
    ];
  }

  /** « Autre proposition » : on décale la clarté sans changer la famille. */
  let variante = $state(0);
  function autreHex(hex: string): string {
    const c = parseToOklch(hex);
    if (!c) return hex;
    const decalage = [0, 0.05, -0.05, 0.1][variante % 4] as number;
    const l = Math.min(0.97, Math.max(0.06, c.l + decalage));
    return oklchToHex(gamutMap({ l, c: Math.min(c.c, maxChroma(l, c.h, 'srgb')), h: c.h }, 'srgb'));
  }
</script>

<aside class="panneau" aria-label="Assistance">
  {#if etapeId === 'palette' || etapeId === 'color'}
    <section class="carte">
      <p class="micro">Compléter le système</p>
      {#if manques.length > 0}
        {#each manques as m (m.id)}
          {@const hex = autreHex(m.suggestion?.hex ?? '#888888')}
          <div class="suggestion">
            <span class="pastille" style="background:{hex}"></span>
            <span class="hex value">{hex}</span>
            <p class="explication">{m.why}</p>
            <div class="sug-actions">
              <button class="principal" onclick={() => ajouter(hex, m.suggestion?.label ?? 'Couleur')}>
                Ajouter
              </button>
              <button onclick={() => (variante += 1)}>Autre proposition</button>
            </div>
          </div>
        {/each}
      {:else}
        <p class="explication">
          Clair, moyen et foncé sont couverts. Tu as de quoi construire des fonds, des aplats et
          des textes sans inventer une couleur en cours de route.
        </p>
      {/if}
    </section>
  {/if}

  {#if etapeId === 'contrast'}
    <section class="carte">
      <p class="micro">Ce qu’on vérifie</p>
      <p class="explication">{SEUILS[usageContraste].regle}.</p>
      <ul class="rappels">
        <li><span class="value">4,5:1</span> texte courant (AA)</li>
        <li><span class="value">7:1</span> texte courant (AAA)</li>
        <li><span class="value">3:1</span> grand texte, icônes, bordures, focus</li>
      </ul>
      <p class="explication">
        Le 3:1 des éléments non textuels est un point de non-conformité fréquent : presque
        aucun outil ne le vérifie.
      </p>
    </section>
  {/if}

  {#if etapeId === 'roles'}
    <section class="carte">
      <p class="micro">Guide d’attribution</p>
      <dl class="guide">
        <dt>Dominante</dt>
        <dd>La couleur qu’on retient de la marque. Une seule, deux au maximum.</dd>
        <dt>Accent</dt>
        <dd>Boutons, liens, mises en avant. Elle doit porter du texte lisible.</dd>
        <dt>Neutres</dt>
        <dd>Fonds, surfaces et textes — la charpente. Teintés, jamais gris purs.</dd>
      </dl>
    </section>
  {/if}

  {#if etapeId === 'print'}
    <section class="carte">
      <p class="micro">Repères d’encrage</p>
      <ul class="rappels">
        <li><span class="value">200 %</span> face principale</li>
        <li><span class="value">150 %</span> faces secondaires</li>
        <li><span class="value">300 %</span> refus probable en offset</li>
      </ul>
      <p class="note-pied">
        Conversion indicative, à vérifier en profil ICC avant BAT.
      </p>
    </section>
  {/if}

  <!-- Aperçu de l'étape suivante, en bas à droite (brief §7) -->
  {#if suivante}
    <section class="carte suivante">
      <p class="micro">Prochaine étape</p>
      <p class="suivante-titre">{suivante.titre}</p>
      {#if conditionSuivante}
        <p class="condition"><span aria-hidden="true">✕</span> {conditionSuivante}</p>
      {/if}
      <button class="principal large" onclick={onContinuer} disabled={!peutContinuer}>
        Continuer →
      </button>
    </section>
  {/if}
</aside>

<style>
  .panneau {
    display: grid;
    gap: 0.6rem;
    align-content: start;
    position: sticky;
    top: 4.5rem;
  }

  .carte {
    background: var(--surface-canvas);
    border-radius: var(--radius);
    box-shadow: var(--ombre-carte);
    padding: 1rem 1.1rem;
    display: grid;
    gap: 0.5rem;
  }

  .carte .micro {
    margin: 0;
  }

  .suggestion {
    display: grid;
    gap: 0.35rem;
  }

  .pastille {
    inline-size: 100%;
    block-size: 2.4rem;
    border-radius: var(--radius);
  }

  .hex {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .explication {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--text-muted);
    max-inline-size: var(--mesure);
  }

  .sug-actions {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .sug-actions button {
    font-size: 0.78rem;
    padding: 0.25rem 0.7rem;
    min-block-size: 36px;
  }

  /* Le remplissage Terre vient de la feuille globale. */
  button.large {
    inline-size: 100%;
    justify-content: center;
  }

  .rappels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.8rem;
  }

  .rappels .value {
    display: inline-block;
    min-inline-size: 3.4rem;
    color: var(--text-main);
  }

  .rappels li {
    color: var(--text-muted);
  }

  .guide {
    margin: 0;
    display: grid;
    gap: 0.15rem;
  }

  .guide dt {
    font-size: 0.82rem;
    font-weight: 600;
  }

  .guide dd {
    margin: 0 0 0.4rem;
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .suivante-titre {
    margin: 0;
    font-family: var(--font-titre);
    font-size: 1.05rem;
  }

  .condition {
    margin: 0;
    font-size: 0.76rem;
    font-style: italic;
    color: var(--text-muted);
  }
</style>
