<script lang="ts">
  /**
   * Import d'une image → extraction des couleurs dominantes.
   * Le calcul tourne entièrement dans le navigateur (canvas + k-means
   * OKLab) : rien ne part sur un serveur, ta photo reste chez toi.
   */
  import {
    echantillonneRgba,
    kmeansOklab,
    oklchToOklab,
    parseToOklch,
    type CouleurExtraite,
  } from '../engine';
  import { settings } from './state.svelte';

  let { onImporte }: { onImporte: () => void } = $props();

  let apercu = $state('');
  let couleurs: CouleurExtraite[] = $state([]);
  let nombre = $state(5);
  let etat: 'vide' | 'calcul' | 'pret' | 'erreur' = $state('vide');
  let dernierPixels: Uint8ClampedArray | null = null;

  const versOklab = (r: number, g: number, b: number) => {
    const oklch = parseToOklch(
      `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`,
    );
    return oklch ? oklchToOklab(oklch) : { l: 0, a: 0, b: 0 };
  };

  async function lireFichier(fichier: File): Promise<void> {
    etat = 'calcul';
    try {
      const bitmap = await createImageBitmap(fichier);
      // On réduit avant d'analyser : 200 px de côté suffisent largement
      // pour les couleurs dominantes, et le calcul reste instantané.
      const cote = 200;
      const ratio = Math.min(cote / bitmap.width, cote / bitmap.height, 1);
      const w = Math.max(1, Math.round(bitmap.width * ratio));
      const h = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas indisponible');
      ctx.drawImage(bitmap, 0, 0, w, h);
      dernierPixels = ctx.getImageData(0, 0, w, h).data;
      apercu = canvas.toDataURL();
      calcule();
      etat = 'pret';
    } catch {
      etat = 'erreur';
    }
  }

  function calcule(): void {
    if (!dernierPixels) return;
    const points = echantillonneRgba(dernierPixels, versOklab);
    couleurs = kmeansOklab(points, nombre);
  }

  function importer(): void {
    settings.colors = couleurs.map((c, i) => ({
      id: `img${i}`,
      hex: c.hex,
      label: `Couleur ${i + 1}`,
    }));
    settings.baseColor = couleurs[0]?.hex ?? settings.baseColor;
    onImporte();
  }
</script>

<div class="import">
  <label class="depot">
    <input
      type="file"
      accept="image/*"
      onchange={(e) => {
        const f = e.currentTarget.files?.[0];
        if (f) void lireFichier(f);
      }}
    />
    <span>{apercu ? 'Choisir une autre image' : 'Choisir une image'}</span>
  </label>

  {#if etat === 'calcul'}
    <p class="explication">Analyse en cours…</p>
  {:else if etat === 'erreur'}
    <p class="explication">Cette image n’a pas pu être lue. Essaie un JPEG ou un PNG.</p>
  {:else if apercu}
    <div class="resultat">
      <img src={apercu} alt="Ce qui a été analysé" />
      <div class="extraites">
        <label class="reglage">
          Combien de couleurs <span class="value">{nombre}</span>
          <input
            type="range"
            min="3"
            max="8"
            bind:value={nombre}
            oninput={calcule}
          />
        </label>
        <div class="bande">
          {#each couleurs as c (c.hex)}
            <span
              class="part"
              style="background:{c.hex};flex:{Math.max(0.08, c.part)}"
              title="{c.hex} — {Math.round(c.part * 100)} % de l’image"
            ></span>
          {/each}
        </div>
        <ul class="liste">
          {#each couleurs as c (c.hex)}
            <li>
              <span class="pastille" style="background:{c.hex}"></span>
              <span class="hex value">{c.hex}</span>
              <span class="value part-txt">{Math.round(c.part * 100)} %</span>
            </li>
          {/each}
        </ul>
        <button class="principal" onclick={importer}>
          Importer ces {couleurs.length} couleurs
        </button>
      </div>
    </div>
    <p class="note-pied">
      L’analyse tourne dans ton navigateur : l’image ne quitte pas ton ordinateur. Les couleurs
      sont regroupées selon l’écart perçu, et pondérées par la surface qu’elles occupent.
    </p>
  {/if}
</div>

<style>
  .import {
    display: grid;
    gap: 0.9rem;
    justify-items: start;
  }

  .depot input {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    opacity: 0;
  }

  .depot span {
    display: inline-flex;
    align-items: center;
    min-block-size: 44px;
    padding: 0.4rem 1.1rem;
    border: 1px solid rgba(28, 18, 5, 0.16);
    border-radius: var(--radius-pill);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .depot:hover span {
    background: var(--surface-panel);
  }

  .depot:focus-within span {
    outline: 2px solid var(--text-main);
    outline-offset: 2px;
  }

  .resultat {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: 1.4rem;
    align-items: start;
    inline-size: 100%;
  }

  img {
    inline-size: 100%;
    border-radius: var(--radius);
    display: block;
  }

  .extraites {
    display: grid;
    gap: 0.7rem;
  }

  .reglage {
    display: grid;
    gap: 0.2rem;
    font-size: 0.82rem;
    color: var(--text-muted);
    max-inline-size: 16rem;
  }

  .bande {
    display: flex;
    gap: 2px;
    block-size: 3rem;
  }

  .bande .part {
    border-radius: 2px;
  }

  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
  }

  .liste li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .pastille {
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 2px;
  }

  .part-txt {
    color: var(--text-muted);
    margin-inline-start: auto;
  }

  .explication {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* Le remplissage Terre vient de la feuille globale. */
  button.principal {
    justify-self: start;
  }

  @media (max-width: 46rem) {
    .resultat {
      grid-template-columns: 1fr;
    }
  }
</style>
