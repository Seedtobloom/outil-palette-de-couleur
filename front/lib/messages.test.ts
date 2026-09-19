/**
 * La pile de messages éphémères.
 *
 * Ces tests existent à cause d'un bug réel : un effet réactif qui
 * restaurait la mémoire locale se relançait indéfiniment et empilait des
 * dizaines de fois le message « ton nuancier a été retrouvé », jusqu'à
 * recouvrir l'interface. La cause a été corrigée à la source, mais la
 * pile devait cesser d'être un amplificateur : bornée, et sans doublon.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from './messages.svelte';

beforeEach(() => {
  for (const m of [...messages.liste]) messages.ferme(m.id);
});

describe('pile de messages', () => {
  it('affiche un message', () => {
    messages.montre('Bonjour', 'info');
    expect(messages.liste).toHaveLength(1);
    expect(messages.liste[0]!.texte).toBe('Bonjour');
  });

  it('n’empile jamais deux fois le même message', () => {
    for (let i = 0; i < 20; i++) messages.montre('Nuancier retrouvé.', 'info');
    expect(messages.liste).toHaveLength(1);
  });

  it('distingue deux messages de même texte mais de ton différent', () => {
    messages.montre('Terminé', 'succes');
    messages.montre('Terminé', 'refus');
    expect(messages.liste).toHaveLength(2);
  });

  /** Le garde-fou : même une boucle ne peut plus remplir l'écran. */
  it('ne dépasse jamais quatre messages visibles', () => {
    for (let i = 0; i < 40; i++) messages.montre(`Message ${i}`, 'info');
    expect(messages.liste.length).toBeLessThanOrEqual(4);
  });

  it('garde les plus récents quand la pile déborde', () => {
    for (let i = 0; i < 10; i++) messages.montre(`Message ${i}`, 'info');
    expect(messages.liste.at(-1)!.texte).toBe('Message 9');
    expect(messages.liste.some((m) => m.texte === 'Message 0')).toBe(false);
  });

  it('se ferme tout seul au bout de son délai', () => {
    vi.useFakeTimers();
    messages.montre('Éphémère', 'info');
    expect(messages.liste).toHaveLength(1);
    vi.advanceTimersByTime(4100);
    expect(messages.liste).toHaveLength(0);
    vi.useRealTimers();
  });

  /** SC 2.2.1 : un message qu'on est en train de lire ne s'efface pas. */
  it('le survol suspend le compte à rebours', () => {
    vi.useFakeTimers();
    messages.montre('À lire', 'info');
    messages.suspendTout();
    vi.advanceTimersByTime(20000);
    expect(messages.liste).toHaveLength(1);
    messages.relanceTout();
    vi.advanceTimersByTime(4100);
    expect(messages.liste).toHaveLength(0);
    vi.useRealTimers();
  });

  it('un refus reste affiché plus longtemps qu’une confirmation', () => {
    vi.useFakeTimers();
    messages.montre('Raté', 'refus');
    vi.advanceTimersByTime(4100);
    expect(messages.liste).toHaveLength(1);
    vi.advanceTimersByTime(4100);
    expect(messages.liste).toHaveLength(0);
    vi.useRealTimers();
  });
});
