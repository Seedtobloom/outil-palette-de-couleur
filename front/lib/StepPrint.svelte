<script lang="ts">
  /**
   * Étape « Impression » : estimation CMJN, taux d'encrage, aperçu sur le
   * blanc du papier choisi — avec l'avertissement obligatoire sur le
   * caractère indicatif des valeurs (règle de justesse n°7 du brief).
   */
  import { estimateCmyk, PROCESSES, SUBSTRATES, CMYK_DISCLAIMER, SUBSTRATE_DISCLAIMER } from '../engine';
  import { settings } from './state.svelte';

  const process = $derived(PROCESSES.find((p) => p.id === settings.printProcess) ?? PROCESSES[1]!);
  const substrate = $derived(SUBSTRATES.find((s) => s.id === settings.substrate) ?? SUBSTRATES[1]);

  const rows = $derived(
    settings.colors.map((c) => ({
      entry: c,
      est: estimateCmyk(c.hex, process.tacLimit),
    })),
  );

  const avgTac = $derived.by(() => {
    const values = rows.map((r) => r.est?.tac ?? 0);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  });

  const allAdvice = $derived([...new Set(rows.flatMap((r) => r.est?.advice ?? []))]);
</script>

<div class="wrap">
  <div class="setup">
    <label class="field">
      <span>Procédé</span>
      <select bind:value={settings.printProcess}>
        {#each PROCESSES as p (p.id)}
          <option value={p.id}>{p.label} — max {p.tacLimit} %</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Papier</span>
      <select bind:value={settings.substrate}>
        {#each SUBSTRATES as s (s.id)}
          <option value={s.id}>{s.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <!-- Aperçu sur le blanc du papier, jamais sur #FFFFFF -->
  <div class="paper" style="background:{substrate?.paper}">
    <p class="paper-label">Sur {substrate?.label.toLowerCase()}</p>
    <div class="paper-swatches">
      {#each settings.colors as c (c.id)}
        <span style="background:{c.hex}" title={c.label}></span>
      {/each}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th scope="col">Couleur</th>
        <th scope="col">C</th>
        <th scope="col">M</th>
        <th scope="col">J</th>
        <th scope="col">N</th>
        <th scope="col">Encrage</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as { entry, est } (entry.id)}
        {#if est}
          <tr data-over={est.overLimit}>
            <th scope="row">
              <span class="dot" style="background:{entry.hex}" aria-hidden="true"></span>
              {entry.label}
            </th>
            <td class="num">{est.c}</td>
            <td class="num">{est.m}</td>
            <td class="num">{est.y}</td>
            <td class="num">{est.k}</td>
            <td class="num tac">{est.tac} %</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>

  <p class="avg">
    Encrage moyen de la palette : <strong class="num">{avgTac} %</strong> ·
    plafond {process.label.toLowerCase()} : <span class="num">{process.tacLimit} %</span>
  </p>

  {#if allAdvice.length > 0}
    <div class="advices">
      <p class="advices-title">Pour encrer moins</p>
      <ul>
        {#each allAdvice as a, i (i)}
          <li>{a}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <p class="disclaimer">{CMYK_DISCLAIMER}</p>
  <p class="disclaimer">{SUBSTRATE_DISCLAIMER}</p>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1rem;
  }

  .setup {
    display: flex;
    gap: 1.2rem;
    flex-wrap: wrap;
  }

  .field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
  }

  .field span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .paper {
    border-radius: var(--radius);
    padding: 1.1rem 1.2rem;
    display: grid;
    gap: 0.7rem;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .paper-label {
    margin: 0;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .paper-swatches {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .paper-swatches span {
    inline-size: 3.4rem;
    block-size: 3.4rem;
    border-radius: var(--radius);
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    text-align: right;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--ink-muted);
  }

  thead th {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  tbody th {
    text-align: left;
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .dot {
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px var(--ink-muted);
  }

  .tac {
    font-weight: 600;
  }

  tr[data-over='true'] .tac::after {
    content: ' ⚠';
  }

  .avg {
    margin: 0;
    font-size: 0.88rem;
  }

  .advices {
    background: var(--surface-panel);
    border-radius: var(--radius);
    padding: 0.8rem 1rem;
  }

  .advices-title {
    margin: 0 0 0.35rem;
    font-weight: 500;
    font-size: 0.88rem;
  }

  .advices ul {
    margin: 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.3rem;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .disclaimer {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.45;
  }
</style>
