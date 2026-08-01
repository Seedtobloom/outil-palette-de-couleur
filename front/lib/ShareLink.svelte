<script lang="ts">
  import { parseToOklch, gamutMap, oklchToHex } from '../engine';
  import { settings } from './state.svelte';

  // Adresse de l'API : vide = même domaine (service binding ou Pages
  // Functions) ; sinon VITE_API_BASE définie au build.
  const API_BASE: string = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(
    /\/$/,
    '',
  );

  let shareUrl = $state('');
  let shareState: 'idle' | 'busy' | 'error' = $state('idle');
  let copied = $state(false);

  async function sharePalette(): Promise<void> {
    shareState = 'busy';
    shareUrl = '';
    try {
      const oklch = parseToOklch(settings.baseColor);
      const response = await fetch(`${API_BASE}/api/palettes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseColor: oklch ? oklchToHex(gamutMap(oklch, 'srgb')) : settings.baseColor,
          options: {
            scheme: settings.scheme,
            wheel: settings.wheel,
            intensity: settings.intensity,
            neutralInfluence: settings.neutralInfluence / 100,
            hueTorsion: settings.hueTorsion,
          },
        }),
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
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }
</script>

<div class="share-row">
  <button onclick={sharePalette} disabled={shareState === 'busy'}>
    {shareState === 'busy' ? 'Création…' : 'Créer un lien de partage'}
  </button>
  {#if shareUrl}
    <input class="share-url" type="text" readonly value={shareUrl} aria-label="Lien de partage" />
    <button onclick={copyShareUrl}>{copied ? 'Copié ✓' : 'Copier'}</button>
  {/if}
</div>
{#if shareState === 'error'}
  <p class="share-error" role="alert">
    Le partage nécessite le back déployé et relié (voir le README, section déploiement).
  </p>
{/if}

<style>
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

  .share-error {
    color: var(--ink);
    background: var(--paper-sunken);
    border-left: 3px solid var(--hairline-strong);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    max-width: 46rem;
  }
</style>
