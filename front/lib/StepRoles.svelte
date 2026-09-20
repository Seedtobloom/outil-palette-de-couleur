<script lang="ts">
  /**
   * Étape « Attribuer les rôles » : organiser la palette par poids
   * visuel, en quatre zones.
   *
   * La taille des pastilles n'est pas décorative — c'est le propos de
   * l'écran. Une dominante occupe la place qu'elle prendra dans la
   * maquette ; un neutre est petit parce qu'il travaille en fond. On
   * voit d'un coup d'œil si la palette est équilibrée ou si elle a cinq
   * couleurs qui se battent pour le premier plan.
   *
   * Le rôle est déduit tant que personne ne l'a décidé, puis il se fige
   * dès qu'on le pose. Deux façons de le changer : le glisser-déposer
   * pour la souris, un menu déroulant sous chaque pastille pour le
   * clavier. Le glisser-déposer seul exclurait la moitié des usages.
   */
  import { parseToOklch } from '../engine';
  import { settings, LIBELLES_ROLE, type PaletteEntry, type RoleCouleur } from './state.svelte';
  import { journal } from './journal.svelte';

  /** En dessous, la couleur ne porte plus de teinte : c'est un neutre. */
  const SEUIL_NEUTRE = 0.045;
  /** Frontière entre neutre clair et neutre foncé, en clarté OKLCH. */
  const CLARTE_PIVOT = 0.62;

  /**
   * Le rôle déduit d'une couleur, quand rien n'a été décidé.
   * Il ne rend JAMAIS « dominante » : c'est un choix de marque, pas une
   * propriété mesurable. L'outil peut dire qu'une couleur est un neutre
   * clair ; il ne peut pas dire qu'elle est ta couleur principale.
   */
  function roleDeduit(hex: string): RoleCouleur {
    const c = parseToOklch(hex);
    if (!c) return 'accent';
    if (c.c < SEUIL_NEUTRE) return c.l >= CLARTE_PIVOT ? 'neutre-claire' : 'neutre-foncee';
    return 'accent';
  }

  function roleDe(entree: PaletteEntry): RoleCouleur {
    return settings.roles[entree.id] ?? roleDeduit(entree.hex);
  }

  /**
   * Une palette sans dominante n'est pas une palette : on en désigne
   * une, la plus intense, tant que personne n'a tranché. Calculé à
   * l'affichage plutôt qu'écrit dans l'état — écrire en rendant, c'est
   * la boucle réactive assurée.
   */
  const dominanteImplicite = $derived.by(() => {
    if (settings.colors.some((c) => settings.roles[c.id] === 'hero')) return null;
    const chromatiques = settings.colors
      .map((c) => ({ c, o: parseToOklch(c.hex) }))
      .filter((x) => x.o !== null && x.o.c >= SEUIL_NEUTRE);
    if (chromatiques.length === 0) return null;
    return chromatiques.reduce((a, b) => (b.o!.c > a.o!.c ? b : a)).c.id;
  });

  function roleEffectif(entree: PaletteEntry): RoleCouleur {
    if (entree.id === dominanteImplicite) return 'hero';
    return roleDe(entree);
  }

  const ZONES: { id: RoleCouleur; titre: string; pluriel: string; aide: string }[] = [
    {
      id: 'hero',
      titre: 'Dominante — la couleur principale',
      pluriel: 'Dominantes — les couleurs principales',
      aide: 'Celle qu’on retient de la marque. Une seule, idéalement ; trois au maximum.',
    },
    {
      id: 'accent',
      titre: 'Accents — mises en avant et boutons',
      pluriel: 'Accents — mises en avant et boutons',
      aide: 'Boutons, liens, mises en avant. Elle doit pouvoir porter du texte lisible.',
    },
    {
      id: 'neutre-claire',
      titre: 'Neutres claires',
      pluriel: 'Neutres claires',
      aide: 'Fonds de page et de cartes. Teintées, jamais des gris purs.',
    },
    {
      id: 'neutre-foncee',
      titre: 'Neutres foncées',
      pluriel: 'Neutres foncées',
      aide: 'Textes, filets, fonds sombres — la charpente.',
    },
  ];

  function dansLaZone(role: RoleCouleur): PaletteEntry[] {
    return settings.colors.filter((c) => roleEffectif(c) === role);
  }

  function attribue(entree: PaletteEntry, role: RoleCouleur): void {
    if (roleEffectif(entree) === role && settings.roles[entree.id] === role) return;
    journal.agis(`${LIBELLES_ROLE[role]} : ${entree.label}`, () => {
      settings.roles = { ...settings.roles, [entree.id]: role };
    });
  }

  // — Glisser-déposer entre zones —
  let saisi: string | null = $state(null);
  let survolee: RoleCouleur | null = $state(null);

  /** Les alertes de répartition, dans l'ordre où elles comptent. */
  const alertes = $derived.by(() => {
    const n = (role: RoleCouleur) => dansLaZone(role).length;
    const out: string[] = [];
    if (settings.colors.length === 0) return out;
    if (n('hero') === 0) out.push('Choisis une couleur dominante pour ancrer ta marque.');
    if (n('hero') > 3) out.push('Trop de dominantes — garde-en une à trois au maximum.');
    if (n('accent') === 0) out.push('Ajoute au moins une couleur d’accentuation.');
    if (n('neutre-claire') === 0) out.push('Il te manque une neutre claire pour les fonds.');
    if (n('neutre-foncee') === 0) out.push('Il te manque une neutre foncée pour les textes.');
    return out;
  });
</script>

<div class="wrap">
  {#if settings.colors.length === 0}
    <p class="note-pied">Ajoute des couleurs pour leur donner un rôle.</p>
  {:else}
    <div class="zones">
      {#each ZONES as zone (zone.id)}
        {@const dedans = dansLaZone(zone.id)}
        <!-- `group` : la zone est un conteneur de dépôt, pas une simple
             boîte décorative — les lecteurs d'écran doivent l'annoncer,
             et le menu déroulant sous chaque pastille offre le même
             déplacement au clavier. -->
        <section
          class="zone"
          role="group"
          aria-label={zone.titre}
          class:neutre={zone.id.startsWith('neutre')}
          class:survolee={survolee === zone.id}
          ondragover={(e) => {
            e.preventDefault();
            survolee = zone.id;
          }}
          ondragleave={() => {
            if (survolee === zone.id) survolee = null;
          }}
          ondrop={(e) => {
            e.preventDefault();
            const entree = settings.colors.find((c) => c.id === saisi);
            if (entree) attribue(entree, zone.id);
            saisi = null;
            survolee = null;
          }}
        >
          <p class="zone-titre">
            {dedans.length > 1 ? zone.pluriel : zone.titre}
            <span class="zone-compte num">{dedans.length}</span>
          </p>

          {#if dedans.length === 0}
            <p class="zone-vide">Dépose une couleur ici</p>
          {:else}
            <ul class="pastilles">
              {#each dedans as color (color.id)}
                <li>
                  <div
                    class="pastille-role"
                    role="group"
                    aria-label={`${color.label}, ${LIBELLES_ROLE[zone.id]}`}
                    class:saisi={saisi === color.id}
                    draggable="true"
                    ondragstart={(e) => {
                      saisi = color.id;
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                    }}
                    ondragend={() => {
                      saisi = null;
                      survolee = null;
                    }}
                  >
                    <span class="rond" data-role={zone.id} style="background:{color.hex}"></span>
                    <span class="nom">{color.label}</span>
                    <span class="hex value">{color.hex.toUpperCase()}</span>
                    <label class="choix-role">
                      <span class="vh">Rôle de {color.label}</span>
                      <select
                        value={roleEffectif(color)}
                        onchange={(e) => attribue(color, e.currentTarget.value as RoleCouleur)}
                      >
                        {#each ZONES as z (z.id)}
                          <option value={z.id}>{LIBELLES_ROLE[z.id]}</option>
                        {/each}
                      </select>
                    </label>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    </div>

    <section class="verifier">
      <p class="section-titre">
        <span class="glyphe" aria-hidden="true">◎</span>
        {alertes.length > 0 ? 'À vérifier' : 'Répartition'}
      </p>
      {#if alertes.length > 0}
        <ul class="alertes">
          {#each alertes as a (a)}
            <li class="pastille-etat" data-ok="false">
              <span class="signe" aria-hidden="true">·</span>
              <span>{a}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="pastille-etat" data-ok="true">
          <span class="signe" aria-hidden="true">✓</span>
          <span>Répartition des rôles équilibrée.</span>
        </p>
      {/if}
      <p class="note-pied">
        Tant que tu n’as rien décidé, le rôle est déduit des contrastes et de l’intensité réelles.
        Dès que tu le poses, il ne bouge plus.
      </p>
    </section>
  {/if}
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.2rem;
  }

  .zones {
    display: grid;
    gap: 0.8rem;
  }

  /* Les deux zones de neutres partagent une ligne : ce sont les deux
     faces d'une même charpente, et elles se comparent. */
  .zones :global(.zone.neutre) {
    grid-column: span 1;
  }

  @media (min-width: 52rem) {
    .zones {
      grid-template-columns: 1fr 1fr;
    }

    .zone:not(.neutre) {
      grid-column: 1 / -1;
    }
  }

  .zone {
    border: 1px dashed var(--filet-fort);
    border-radius: var(--radius);
    padding: 0.85rem 1rem 1rem;
    display: grid;
    gap: 0.6rem;
    align-content: start;
    transition: border-color var(--transition), background-color var(--transition);
  }

  /* Cible de dépôt : la bordure se remplit. Un changement de forme, pas
     seulement de teinte — ça reste lisible en contraste élevé forcé. */
  .zone.survolee {
    border-style: solid;
    border-color: var(--surface-chrome);
    background: var(--surface-conforme);
  }

  .zone-titre {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .zone-compte {
    margin-inline-start: auto;
    font-size: 0.75rem;
    padding: 0.05rem 0.45rem;
    border-radius: var(--radius-pill);
    background: var(--surface-attente);
    border: 1px solid var(--bord-attente);
    color: var(--text-main);
  }

  .zone-vide {
    margin: 0;
    font-style: italic;
    font-size: 0.82rem;
    color: var(--text-muted);
    padding-block: 0.8rem;
  }

  .pastilles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 1.1rem;
    align-items: flex-start;
  }

  .pastille-role {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
    cursor: grab;
  }

  .pastille-role.saisi {
    opacity: 0.4;
  }

  /*
   * Le poids visuel, en taille réelle. Une dominante fait deux fois et
   * demie un neutre : c'est la proportion qu'on cherche dans une
   * maquette, et la voir ici évite de la découvrir trop tard.
   */
  .rond {
    display: block;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.12);
    transition: transform var(--transition);
  }

  .rond[data-role='hero'] {
    inline-size: 8.5rem;
    block-size: 8.5rem;
  }

  .rond[data-role='accent'] {
    inline-size: 5.4rem;
    block-size: 5.4rem;
  }

  .rond[data-role^='neutre'] {
    inline-size: 3.6rem;
    block-size: 3.6rem;
  }

  .pastille-role:hover .rond {
    transform: scale(1.04);
  }

  .nom {
    font-size: 0.82rem;
    font-weight: 500;
    max-inline-size: 9rem;
    text-align: center;
  }

  .hex {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .choix-role select {
    font-size: 0.75rem;
    min-block-size: 34px;
    padding: 0.1rem 0.4rem;
  }

  .verifier {
    display: grid;
    gap: 0.5rem;
    padding-block-start: 1.1rem;
    border-block-start: 1px solid var(--filet);
  }

  .verifier .section-titre {
    margin: 0;
  }

  .alertes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
</style>
