<script lang="ts">
  /**
   * Étape « Tester le contraste », calquée sur l'outil de référence.
   *
   * Un seul objet : la liste de TOUTES les associations possibles,
   * rendues en conditions réelles, avec leur ratio et leur niveau — et
   * une case pour retenir celles qu'on compte utiliser.
   *
   * Cette étape portait aussi un correcteur guidé : une décision à la
   * fois, des pistes de correction classées par coût, un ajustement
   * automatique de toute la palette. Il a été retiré d'ici pour revenir
   * au périmètre de la référence. La correction automatique n'a pas
   * disparu de l'outil : elle vit à l'étape Harmonie, sous « Tout
   * corriger » et sous les réglages d'ensemble.
   *
   * ⚠ IL N'Y A PAS D'ONGLET « A ».
   * La référence en propose un et étiquette 3:1 « niveau A ». Il
   * n'existe pas de niveau A de contraste : le seul critère de niveau A
   * lié à la couleur, SC 1.4.1, n'impose aucun ratio. 3:1 est un seuil
   * AA — celui du grand texte (SC 1.4.3) et des éléments non textuels
   * (SC 1.4.11). L'onglet porte donc son vrai nom. C'est le §3.1 du
   * brief, et le §9.8 impose que l'outil passe les tests qu'il fait
   * passer aux autres.
   */
  import { contrastRatio, parseToOklch } from '../engine';
  import { settings } from './state.svelte';
  import { journal } from './journal.svelte';
  import { PAIRINGS_REQUIS } from './parcours.svelte';

  type Paire = {
    id: string;
    fond: { id: string; hex: string; label: string };
    texte: { id: string; hex: string; label: string };
    ratio: number;
    niveau: 'AAA' | 'AA' | 'grand-texte' | 'echec';
  };

  const NIVEAUX: Record<Paire['niveau'], string> = {
    AAA: 'AAA',
    AA: 'AA',
    'grand-texte': 'Grand texte',
    echec: 'Échec',
  };

  const ONGLETS: { id: 'tout' | 'grand-texte' | 'aa' | 'aaa'; label: string; seuil: number }[] = [
    { id: 'tout', label: 'Tout', seuil: 0 },
    { id: 'grand-texte', label: 'Grand texte', seuil: 3 },
    { id: 'aa', label: 'AA', seuil: 4.5 },
    { id: 'aaa', label: 'AAA', seuil: 7 },
  ];

  let onglet: (typeof ONGLETS)[number]['id'] = $state('tout');

  function niveauDe(ratio: number): Paire['niveau'] {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'grand-texte';
    return 'echec';
  }

  /** Clarté OKLCH : c'est elle qui décide qui sert de fond. */
  function clarte(hex: string): number {
    return parseToOklch(hex)?.l ?? 0.5;
  }

  /**
   * Toutes les combinaisons, chacune une seule fois. La plus claire des
   * deux sert de fond, l'autre de texte : c'est l'usage réel, et
   * afficher les deux sens doublerait la liste sans rien ajouter — le
   * ratio est le même dans les deux sens.
   */
  const paires = $derived.by(() => {
    const out: Paire[] = [];
    const cs = settings.colors;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i]!;
        const b = cs[j]!;
        const [fond, texte] = clarte(a.hex) >= clarte(b.hex) ? [a, b] : [b, a];
        const ratio = contrastRatio(texte.hex, fond.hex);
        out.push({
          id: `${texte.id}|${fond.id}`,
          fond,
          texte,
          ratio,
          niveau: niveauDe(ratio),
        });
      }
    }
    return out.sort((x, y) => y.ratio - x.ratio);
  });

  const seuilCourant = $derived(ONGLETS.find((o) => o.id === onglet)?.seuil ?? 0);
  const visibles = $derived(paires.filter((p) => p.ratio >= seuilCourant));

  const compte = (seuil: number) => paires.filter((p) => p.ratio >= seuil).length;

  /** Tronqué vers le bas : 4,497 n'est pas 4,50 et ne passe donc pas AA. */
  function fmt(r: number): string {
    return (Math.floor(r * 100) / 100).toFixed(2).replace('.', ',');
  }

  const retenue = (p: Paire) => settings.pairings.includes(p.id);

  function bascule(p: Paire): void {
    const deja = retenue(p);
    journal.agis(deja ? 'Association retirée' : 'Association retenue', () => {
      settings.pairings = deja
        ? settings.pairings.filter((x) => x !== p.id)
        : [...settings.pairings, p.id];
    });
  }

  const toutesRetenues = $derived(visibles.length > 0 && visibles.every(retenue));

  function basculeToutes(): void {
    const cles = visibles.map((p) => p.id);
    const retirer = toutesRetenues;
    journal.agis(retirer ? 'Associations retirées' : 'Associations retenues', () => {
      settings.pairings = retirer
        ? settings.pairings.filter((x) => !cles.includes(x))
        : [...new Set([...settings.pairings, ...cles])];
    });
  }

  /** Une couleur est « couverte » si elle a au moins un partenaire en AA. */
  const couvertes = $derived(
    settings.colors.filter((c) =>
      paires.some((p) => p.ratio >= 4.5 && (p.fond.id === c.id || p.texte.id === c.id)),
    ).length,
  );

  const retenues = $derived(settings.pairings.length);
  const debloque = $derived(retenues >= PAIRINGS_REQUIS);
</script>

<div class="wrap">
  <section class="testeur">
    <div class="testeur-tete">
      <p class="panel-tete">
        Testeur de palette
        <span class="panel-compte">
          {visibles.length} paire{visibles.length > 1 ? 's' : ''}
        </span>
      </p>
      {#if visibles.length > 0}
        <button class="lien" onclick={basculeToutes}>
          {toutesRetenues ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      {/if}
    </div>

    <div class="onglets" role="group" aria-label="Filtrer par niveau atteint">
      {#each ONGLETS as o (o.id)}
        <button aria-pressed={onglet === o.id} onclick={() => (onglet = o.id)}>
          {o.label} <span class="cc num">{compte(o.seuil)}</span>
        </button>
      {/each}
    </div>

    {#if settings.colors.length < 2}
      <p class="note-pied">Ajoute au moins 2 couleurs pour générer les combinaisons.</p>
    {:else if visibles.length === 0}
      <p class="note-pied">Aucune paire n’atteint ce niveau.</p>
    {:else}
      <ul class="paires">
        {#each visibles as p (p.id)}
          <li class="paire" class:retenue={retenue(p)}>
            <div class="apercu" style="background:{p.fond.hex};color:{p.texte.hex}">
              <span class="apercu-titre">Titre lisible</span>
              <span class="apercu-corps">Exemple de texte courant sur ce fond.</span>
            </div>

            <div class="mesure">
              <span class="ratio value">{fmt(p.ratio)}</span>
              <span class="niveau-badge" data-niveau={p.niveau}>{NIVEAUX[p.niveau]}</span>
            </div>

            <label class="retenir">
              <input type="checkbox" checked={retenue(p)} onchange={() => bascule(p)} />
              <span class="retenir-texte">Retenir</span>
              <span class="vh">
                {p.texte.label} sur {p.fond.label}, {fmt(p.ratio)} pour un, {NIVEAUX[p.niveau]}
              </span>
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!--
    Le compteur de déverrouillage. Retenir des associations n'est pas
    décoratif : c'est ce qui ouvre les étapes Rôles, Convertir et
    Exporter. On ne distribue pas des rôles avant d'avoir décidé quelles
    paires on va réellement employer.
  -->
  <section class="bilan">
    <div class="bilan-ligne">
      <span class="bilan-label">Couleurs ayant au moins une association AA</span>
      <span class="value">{couvertes} / {settings.colors.length}</span>
    </div>
    <span class="barre" aria-hidden="true">
      <span
        style="inline-size:{settings.colors.length
          ? Math.round((couvertes / settings.colors.length) * 100)
          : 0}%"
      ></span>
    </span>
    <p class="note-pied">
      {#if settings.colors.length > 0 && couvertes === settings.colors.length}
        Chaque couleur a au moins un duo lisible. C’est la bonne nouvelle.
      {:else}
        Certaines couleurs n’ont pas encore de duo lisible : ajoute une neutre claire ou foncée
        pour améliorer la couverture.
      {/if}
    </p>

    <div class="verrou" data-ok={debloque}>
      <span class="signe" aria-hidden="true">{debloque ? '✓' : '🔒'}</span>
      <span>
        <span class="value">{retenues}</span> / {PAIRINGS_REQUIS} associations retenues —
        {debloque ? 'la suite est ouverte.' : 'la suite s’ouvre à partir de là.'}
      </span>
    </div>
  </section>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.4rem;
  }

  .testeur {
    display: grid;
    gap: 0.7rem;
  }

  .testeur-tete {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .testeur-tete .panel-tete {
    flex: 1;
  }

  .lien {
    border: none;
    background: none;
    padding: 0.2rem 0.4rem;
    min-block-size: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: underline;
  }

  .lien:hover {
    background: none;
    color: var(--text-main);
  }

  /* Onglets : l'actif est un aplat plein, pas un soulignement. */
  .onglets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-block-end: 0.2rem;
  }

  .onglets button {
    padding: 7px 14px;
    border-radius: 10px;
    border-color: transparent;
    background: var(--surface-attente);
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted);
    min-block-size: 0;
  }

  .onglets button:hover {
    background: var(--surface-panel);
    border-color: var(--filet);
  }

  .onglets button[aria-pressed='true'] {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
  }

  .onglets .cc {
    margin-inline-start: 5px;
    font-weight: 700;
    opacity: 0.7;
  }

  .paires {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .paire {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 14px;
    padding: 6px;
    border: 1px solid var(--filet);
    border-radius: 14px;
    transition: border-color 150ms ease, background-color 150ms ease;
  }

  /* Retenue : la case cochée porte déjà l'information ; le fond et la
     bordure ne font que la renforcer, et restent lisibles sans couleur. */
  .paire.retenue {
    border-color: var(--surface-chrome);
    background: var(--surface-conforme);
  }

  /*
   * L'aperçu est le cœur de l'écran : les deux couleurs en conditions
   * réelles, un titre et une ligne de texte courant. C'est ce qui permet
   * de juger autre chose que le chiffre — un ratio conforme peut rester
   * pénible à lire en petit corps.
   */
  .apercu {
    display: grid;
    gap: 2px;
    padding: 14px 18px;
    border-radius: 10px;
    min-inline-size: 0;
  }

  .apercu-titre {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }

  .apercu-corps {
    font-size: 13px;
    line-height: 1.4;
  }

  .mesure {
    display: grid;
    justify-items: end;
    gap: 3px;
    white-space: nowrap;
  }

  .ratio {
    font-size: 20px;
    font-weight: 750;
    line-height: 1;
  }

  .niveau-badge {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--surface-attente);
    color: var(--text-muted);
  }

  .niveau-badge[data-niveau='AAA'],
  .niveau-badge[data-niveau='AA'] {
    background: var(--surface-conforme);
    color: var(--conforme);
  }

  .niveau-badge[data-niveau='echec'] {
    background: color-mix(in oklab, var(--non-conforme) 12%, var(--blanc));
    color: var(--non-conforme);
  }

  .retenir {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-inline-end: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    min-block-size: 44px;
    cursor: pointer;
  }

  .paire.retenue .retenir {
    color: var(--text-main);
  }

  /* — Bilan et verrou — */
  .bilan {
    display: grid;
    gap: 0.45rem;
    padding-block-start: 1.2rem;
    border-block-start: 1px solid var(--filet);
  }

  .bilan-ligne {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    font-size: 13px;
  }

  .bilan-label {
    color: var(--text-muted);
  }

  .barre {
    display: block;
    block-size: 7px;
    border-radius: var(--radius-pill);
    background: var(--surface-attente);
    overflow: hidden;
  }

  .barre span {
    display: block;
    block-size: 100%;
    background: var(--conforme);
    transition: inline-size 500ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .verrou {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    font-size: 13px;
  }

  .verrou[data-ok='true'] {
    background: var(--surface-conforme);
    border-color: var(--bord-conforme);
  }

  .verrou .signe {
    line-height: 1;
  }

  @media (max-width: 46rem) {
    .paire {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .mesure {
      justify-items: start;
      grid-auto-flow: column;
      align-items: center;
      gap: 0.6rem;
    }
  }
</style>
