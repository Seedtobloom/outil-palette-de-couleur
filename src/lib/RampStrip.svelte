<script lang="ts">
  import type { Ramp } from '../engine';
  import { formatOklch } from '../engine';

  let {
    name,
    ramp,
    showTechnical,
  }: {
    name: string;
    ramp: Ramp;
    showTechnical: boolean;
  } = $props();
</script>

<div class="ramp">
  <span class="name">{name}</span>
  <div class="strip">
    {#each ramp.steps as s (s.step)}
      <div
        class="cell"
        class:base={s.isBase}
        style="background:{s.hex}"
        title={showTechnical ? `${s.step} · ${s.hex} · ${formatOklch(s.color)}` : `${s.step} · ${s.hex}`}
      >
        <span class="step-label" style="color:{s.color.l > 0.6 ? '#1a1a1a' : '#f5f5f5'}"
          >{s.step}</span
        >
      </div>
    {/each}
  </div>
</div>

<style>
  .ramp {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 0.6rem;
    align-items: center;
  }

  .name {
    font-size: 0.85rem;
    text-align: right;
  }

  .strip {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    border: 1px solid var(--hairline-strong);
    border-radius: 2px;
    overflow: hidden;
  }

  .cell {
    aspect-ratio: 1.6 / 1;
    display: grid;
    place-items: center;
    position: relative;
  }

  .cell.base::after {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1.5px solid currentColor;
    border-radius: 1px;
    pointer-events: none;
  }

  .step-label {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }
</style>
