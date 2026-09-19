<script lang="ts">
  /**
   * La pile de messages éphémères, en bas à droite.
   *
   * Le conteneur est une région `status` : chaque message est annoncé aux
   * lecteurs d'écran sans voler le focus. Le signe et le mot portent
   * l'information ; la teinte de la bordure ne fait que la renforcer
   * (même règle que les verdicts de contraste).
   */
  import { messages } from './messages.svelte';

  const SIGNES = { info: '·', succes: '✓', refus: '✕' } as const;
</script>

<!--
  Le survol et le focus suspendent le compte à rebours de TOUTE la pile,
  pas seulement du message pointé : on lit la pile, pas une ligne, et un
  message voisin ne doit pas s'effacer pendant qu'on lit celui du dessus
  (WCAG 2.2, SC 2.2.1).
-->
<div
  class="pile"
  role="status"
  aria-live="polite"
  aria-label="Messages"
  onmouseenter={() => messages.suspendTout()}
  onmouseleave={() => messages.relanceTout()}
  onfocusin={() => messages.suspendTout()}
  onfocusout={() => messages.relanceTout()}
>
  {#each messages.liste as m (m.id)}
    <div class="message" data-ton={m.ton}>
      <span class="signe" aria-hidden="true">{SIGNES[m.ton]}</span>
      <span class="texte">{m.texte}</span>
      {#if m.action}
        <button
          class="action"
          onclick={() => {
            m.action?.faire();
            messages.ferme(m.id);
          }}>{m.action.libelle}</button
        >
      {/if}
      <button class="fermer" onclick={() => messages.ferme(m.id)} aria-label="Fermer ce message">
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .pile {
    position: fixed;
    inset-block-end: 1.1rem;
    inset-inline-end: 1.1rem;
    z-index: 60;
    display: grid;
    gap: 0.5rem;
    justify-items: end;
    pointer-events: none;
    max-inline-size: min(26rem, calc(100vw - 2rem));
  }

  .message {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.6rem 0.55rem 0.85rem;
    border-radius: var(--radius);
    background: var(--surface-chrome);
    color: var(--text-on-chrome);
    box-shadow: var(--ombre-flottante);
    font-size: 0.85rem;
    border-inline-start: 3px solid transparent;
  }

  /* La bordure colorée ne fait que doubler le signe : un message reste
     entièrement lisible sans elle. */
  .message[data-ton='succes'] {
    border-inline-start-color: var(--conforme);
  }

  .message[data-ton='refus'] {
    border-inline-start-color: var(--non-conforme);
  }

  .signe {
    font-weight: 600;
    line-height: 1;
  }

  .texte {
    flex: 1;
  }

  .message button {
    background: none;
    border: none;
    color: var(--text-on-chrome);
    min-block-size: 0;
    padding: 0.2rem 0.4rem;
    font-size: 0.82rem;
    border-radius: var(--radius-sm);
  }

  .message .action {
    text-decoration: underline;
    white-space: nowrap;
  }

  .message button:hover {
    background: rgba(242, 229, 194, 0.18);
    color: var(--text-on-chrome);
  }

  .fermer {
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: no-preference) {
    .message {
      animation: entree 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes entree {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  }
</style>
