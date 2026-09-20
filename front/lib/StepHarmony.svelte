<script lang="ts">
  /**
   * Étape « Analyser l'harmonie ».
   *
   * La scène montre le VERDICT et le nuancier, en grand et toujours
   * éditable — les couleurs qui sortent de la logique du groupe portent
   * une pastille « ! ». Les corrections et les réglages d'ensemble sont
   * dans le panneau de droite (`PanneauHarmonie.svelte`) : on voit ce
   * qu'on corrige pendant qu'on le corrige, au lieu de faire défiler
   * entre la liste et la palette.
   */
  import { analyzeHarmony, AXIS_LABELS, SCHEME_LABELS } from '../engine';
  import { settings } from './state.svelte';
  import StepPalette from './StepPalette.svelte';
  import { harmonie } from './harmonie.svelte';

  const analysis = $derived(analyzeHarmony(settings.colors));
  const marques = $derived(analysis.offNotes.map((n) => n.id));
</script>

<div class="wrap">
  <div class="verdict" data-ok={analysis.offNotes.length === 0}>
    <div class="verdict-main">
      <p class="scheme">{SCHEME_LABELS[analysis.scheme]}</p>
      <p class="verdict-text">{analysis.verdict}</p>
    </div>
    <div class="verdict-score">
      <span class="score-num num">{analysis.score}</span>
      <span class="score-cap">harmonie</span>
    </div>
  </div>

  <div class="regularity">
    {#each [['lightness', analysis.regularity.lightness], ['chroma', analysis.regularity.chroma], ['hue', analysis.regularity.hue]] as [axis, value] (axis)}
      <div class="reg">
        <span class="reg-label">Régularité de {AXIS_LABELS[axis as 'hue' | 'chroma' | 'lightness']}</span>
        <span class="reg-bar" aria-hidden="true">
          <span style="inline-size:{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}%"></span>
        </span>
        <span class="reg-value num">{Math.round(Math.min(1, Math.max(0, value as number)) * 100)}</span>
      </div>
    {/each}
  </div>

  {#if harmonie.actif}
    <p class="en-apercu">
      <span aria-hidden="true">≋</span>
      Aperçu des réglages — {harmonie.nbModifiees} couleur{harmonie.nbModifiees > 1 ? 's' : ''}
      changerai{harmonie.nbModifiees > 1 ? 'ent' : 't'}. Rien n’est encore écrit : valide à droite.
    </p>
  {/if}

  <!-- Le même nuancier qu'à l'étape 1, entièrement éditable : corriger
       une harmonie, c'est souvent changer une couleur à la main. Les
       curseurs de droite s'y voient EN DIRECT, sans rien y écrire. -->
  <StepPalette
    conseils={false}
    {marques}
    apercu={harmonie.actif ? harmonie.apercu : null}
  />
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.2rem;
  }

  .verdict {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.1rem 1.3rem;
    border-radius: var(--radius);
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
  }

  .verdict[data-ok='true'] {
    background: var(--surface-conforme);
    border-color: var(--bord-conforme);
  }

  .scheme {
    margin: 0 0 0.15rem;
    font-family: var(--font-titre);
    font-weight: 300;
    font-size: 20px;
  }

  .verdict-text {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    max-inline-size: var(--mesure);
  }

  .verdict-score {
    display: grid;
    justify-items: center;
    flex: none;
  }

  .score-num {
    font-size: 34px;
    font-weight: 750;
    line-height: 1;
  }

  .score-cap {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  /* Bandeau d'aperçu : il dit en toutes lettres que ce qu'on voit n'est
     pas encore enregistré. Sans lui, on croirait la palette déjà
     modifiée et on partirait à l'étape suivante. */
  .en-apercu {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 0.85rem;
    border-radius: var(--radius);
    background: var(--etape-active);
    color: var(--ebene);
    font-size: 12.5px;
  }

  .regularity {
    display: grid;
    gap: 0.3rem;
  }

  .reg {
    display: grid;
    grid-template-columns: 11rem 1fr 2.2rem;
    align-items: center;
    gap: 0.6rem;
    font-size: 12.5px;
  }

  .reg-label {
    color: var(--text-muted);
  }

  .reg-bar {
    display: block;
    block-size: 5px;
    border-radius: var(--radius-pill);
    background: var(--surface-attente);
    overflow: hidden;
  }

  .reg-bar span {
    display: block;
    block-size: 100%;
    background: var(--surface-chrome);
    transition: inline-size 500ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .reg-value {
    text-align: end;
    color: var(--text-muted);
  }
</style>
