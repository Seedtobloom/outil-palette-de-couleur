<script lang="ts">
  /**
   * Panneau d'accompagnement, colonne de droite.
   *
   * Il porte ce qui aide la décision en cours : l'assistant de
   * complétion (Nuancier), le guide d'attribution (Rôles), le rappel de
   * règle (Contraste), l'état de santé (Livraison) — et, en bas,
   * l'étape suivante avec sa condition.
   *
   * Chaque bloc suit la même structure : un intitulé en capitales posé
   * au-dessus, puis une carte blanche. L'intitulé vit hors de la carte :
   * c'est ce qui donne au panneau sa lecture en colonne.
   */
  import {
    analyzeCoverage,
    gamutMap,
    healthScore,
    maxChroma,
    oklchToHex,
    parseToOklch,
  } from '../engine';
  import { settings } from './state.svelte';
  import { journal } from './journal.svelte';
  import PanneauHarmonie from './PanneauHarmonie.svelte';

  let {
    etapeId,
    suivante,
    peutContinuer,
    conditionSuivante,
    onContinuer,
  }: {
    etapeId: string;
    suivante: { titre: string; court: string } | null;
    peutContinuer: boolean;
    conditionSuivante: string | null;
    onContinuer: () => void;
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

  /** État de la palette, à l'étape de livraison : ce qui est acquis, ce
   *  qui reste. Un constat par ligne, le signe avant la couleur. */
  const sante = $derived(healthScore(settings.colors));
  const constats = $derived(
    couverture.advices.map((a) => ({
      id: a.id,
      ok: a.kind === 'ok',
      texte: a.message,
    })),
  );

  function ajouter(hex: string, nom: string): void {
    journal.agis(`Ajout de ${nom}`, () => {
      settings.colors = [
        ...settings.colors,
        { id: `s${settings.colors.length}${Date.now().toString(36)}`, hex, label: nom },
      ];
    });
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
  {#if etapeId === 'palette'}
    <section class="bloc">
      <p class="section-titre"><span class="glyphe" aria-hidden="true">✦</span> Suggestions intelligentes</p>
      <!-- Seule carte opaque du panneau : elle montre des couleurs à
           juger, pas seulement du texte d'accompagnement. -->
      <div class="carte opaque zone-evaluation">
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
      </div>
    </section>
  {/if}

  <!-- L'harmonie a son propre panneau : corrections et réglages
       d'ensemble, à côté du nuancier qu'ils modifient. -->
  {#if etapeId === 'harmony'}
    <PanneauHarmonie />
  {/if}

  {#if etapeId === 'contrast'}
    <section class="bloc">
      <p class="section-titre"><span class="glyphe" aria-hidden="true">◐</span> Les seuils</p>
      <div class="carte">
        <ul class="rappels">
          <li><span class="value">7:1</span> texte courant — AAA</li>
          <li><span class="value">4,5:1</span> texte courant — AA</li>
          <li><span class="value">3:1</span> grand texte, icônes, bordures, focus</li>
        </ul>
        <p class="explication">
          Le 3:1 des éléments non textuels (SC 1.4.11) est un point de non-conformité fréquent :
          presque aucun outil ne le vérifie.
        </p>
        <p class="explication">
          Il n’existe pas de « niveau A » de contraste. Le seul critère de niveau A lié à la
          couleur, SC 1.4.1, n’impose aucun ratio : 3:1 est un seuil AA.
        </p>
      </div>
    </section>
  {/if}

  {#if etapeId === 'roles'}
    <section class="bloc">
      <p class="section-titre"><span class="glyphe" aria-hidden="true">◎</span> Guide d’attribution</p>
      <div class="carte">
        <dl class="guide">
          <dt>Dominante</dt>
          <dd>La couleur qu’on retient de la marque. Une seule, deux au maximum.</dd>
          <dt>Accent</dt>
          <dd>Boutons, liens, mises en avant. Elle doit porter du texte lisible.</dd>
          <dt>Neutres</dt>
          <dd>Fonds, surfaces et textes — la charpente. Teintés, jamais gris purs.</dd>
        </dl>
      </div>
    </section>
  {/if}

  <!-- État de la palette, à la livraison : le bilan d'un coup d'œil. -->
  {#if etapeId === 'deliver' && settings.colors.length > 0}
    <section class="bloc">
      <p class="section-titre"><span class="glyphe" aria-hidden="true">✛</span> État de la palette</p>
      <div class="carte">
        <p class="score-ligne">
          <span>Score global</span>
          <span class="score-val value">{sante.total} %</span>
        </p>
        <span class="score-barre" aria-hidden="true">
          <span style="inline-size:{sante.total}%"></span>
        </span>
        <ul class="constats">
          {#each constats as c (c.id)}
            <li class="pastille-etat" data-ok={c.ok}>
              <span class="signe" aria-hidden="true">{c.ok ? '✓' : '·'}</span>
              <span>{c.texte}</span>
            </li>
          {/each}
        </ul>
      </div>
    </section>
  {/if}

  <!-- Aperçu de l'étape suivante (brief §7) -->
  {#if suivante}
    <section class="bloc">
      <p class="section-titre"><span class="glyphe" aria-hidden="true">→</span> Prochaine étape</p>
      <div class="carte suivante" class:sur-glycine={peutContinuer} class:fermee={!peutContinuer}>
        <p class="suivante-titre">{suivante.titre}</p>
        {#if conditionSuivante}
          <p class="condition">
            <span aria-hidden="true">{peutContinuer ? '✓' : '🔒'}</span>
            {conditionSuivante}
          </p>
        {/if}
        <button class="principal large" onclick={onContinuer} disabled={!peutContinuer}>
          Continuer →
        </button>
      </div>
    </section>
  {/if}
</aside>

<style>
  .panneau {
    display: grid;
    gap: 1.1rem;
    align-content: start;
    position: sticky;
    top: 5.5rem;
  }

  .bloc {
    display: grid;
  }

  /*
   * Verre dépoli : le panneau accompagne, il ne juge pas. C'est du
   * chrome, il peut donc laisser passer le fond. Les échantillons de
   * suggestion, eux, restent posés sur un fond blanc opaque juste en
   * dessous (`.pastille`), pour ne pas juger une couleur au travers du
   * dégradé (brief §9.1).
   */
  .carte {
    background: var(--verre);
    backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid var(--verre-bord);
    border-radius: var(--radius-carte);
    padding: 1.05rem 1.15rem;
    display: grid;
    gap: 0.6rem;
  }

  .suggestion {
    display: grid;
    gap: 0.35rem;
  }

  .carte.opaque {
    background: var(--surface-canvas);
    backdrop-filter: none;
    border-color: var(--filet);
    box-shadow: var(--ombre-carte);
  }

  .pastille {
    display: block;
    inline-size: 100%;
    block-size: 2.6rem;
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px var(--filet-fort);
  }

  .hex {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .explication {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-muted);
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

  button.large {
    inline-size: 100%;
    justify-content: center;
  }

  .rappels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
    font-size: 0.82rem;
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
    font-size: 0.84rem;
    font-weight: 600;
  }

  .guide dd {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.45;
  }

  /* — État de la palette — */
  .score-ligne {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0;
    font-size: 0.85rem;
  }

  .score-val {
    font-size: 1rem;
    font-weight: 600;
  }

  .score-barre {
    display: block;
    block-size: 6px;
    border-radius: 3px;
    background: var(--surface-attente);
    overflow: hidden;
  }

  .score-barre span {
    display: block;
    block-size: 100%;
    background: var(--surface-chrome);
  }

  .constats {
    list-style: none;
    margin: 0.2rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  /*
   * Prochaine étape : le seul bloc en couleur pleine de la page, et donc
   * son aimant visuel. Dégradé à 135°, halo coloré — la seule chose qui
   * « flotte » vraiment ici.
   *
   * Le texte y passe en Ébène (13:1 sur Glycine). Le bouton doit se
   * détacher DE la Glycine : Terre plein, 8,98:1 — les deux écarts sont
   * verrouillés dans chrome.test.ts.
   */
  .carte.suivante {
    background: linear-gradient(
      135deg,
      var(--glycine),
      color-mix(in oklab, var(--glycine) 78%, var(--paille)) 58%,
      color-mix(in oklab, var(--glycine) 62%, var(--blanc))
    );
    border-color: transparent;
    backdrop-filter: none;
    box-shadow: 0 12px 28px color-mix(in oklab, var(--glycine) 46%, transparent);
    color: var(--ebene);
  }

  /*
   * Verrouillée, elle se VIDE : plus de dégradé, plus de halo, plus de
   * couleur — une surface de verre banale. Le contraste entre les deux
   * états est volontairement brutal : la carte s'allume quand l'étape
   * se débloque, et c'est ce qui fait comprendre qu'il reste quelque
   * chose à faire avant.
   */
  .carte.suivante.fermee {
    background: var(--verre);
    backdrop-filter: blur(10px);
    border-color: var(--filet);
    box-shadow: none;
  }

  .suivante-titre {
    margin: 0;
    font-family: var(--font-titre);
    font-size: 1.15rem;
  }

  /* La condition est un « verre dans le verre » : un bloc translucide
     posé sur la carte colorée, qui reste lisible dans les deux états. */
  .condition {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: 0.78rem;
    padding: 9px 11px;
    border-radius: 10px;
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    color: var(--text-main);
  }

  .carte.suivante:not(.fermee) .condition {
    background: rgba(255, 255, 255, 0.42);
    border-color: rgba(255, 255, 255, 0.6);
    color: var(--ebene);
  }
</style>
