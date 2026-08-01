<script lang="ts">
  /**
   * Étape « Contraste » — refondue autour d'une règle : à tout moment,
   * une seule chose à faire, et elle est écrite en toutes lettres.
   *
   * L'ancienne version affichait tout en même temps (la paire, la liste,
   * la matrice, l'épreuve, les tons directs, le niveau A) et laissait
   * corriger couleur par couleur. On s'y perdait, et le travail était
   * manuel de bout en bout.
   *
   * Maintenant :
   * - l'outil annonce ce qu'il peut régler seul, et le règle sur un clic ;
   * - pour ce qui reste, il PROPOSE des couleurs classées par coût, au
   *   lieu d'imposer une correction unique ;
   * - quand une association n'est pas rattrapable, il le dit et indique
   *   ce que la paire sait faire, plutôt que d'inventer un compromis ;
   * - tous les contrôles de vérification sont repliés dans un seul bloc.
   */
  import {
    corrigeTout,
    evaluePaires,
    lectureApca,
    impactSurPalette,
    proposeCorrections,
    SEUILS,
    LEVEL_A_CHECK,
    findSpotCollisions,
    simulateCvd,
    toGrayscale,
    type Candidat,
    type Impact,
    type PairUse,
  } from '../engine';
  import { settings } from './state.svelte';

  let { showTechnical }: { showTechnical: boolean } = $props();

  const USAGES: { id: PairUse; label: string }[] = [
    { id: 'texte', label: 'Texte courant' },
    { id: 'titre', label: 'Grand texte' },
    { id: 'composant', label: 'Icône, bordure, focus' },
  ];

  const NOM_USAGE: Record<PairUse, string> = {
    texte: 'du texte courant',
    titre: 'un grand titre',
    composant: 'une icône ou une bordure',
  };

  let usage: PairUse = $state('texte');
  let controlesOuverts = $state(false);
  let curseur = $state(0);
  /** Piste survolée ou sélectionnée, pour l'aperçu « après ». */
  let pisteVisee = $state(0);
  /**
   * Pile d'annulation. Un seul niveau ne suffisait pas : on enchaîne les
   * corrections, et il faut pouvoir défaire les trois dernières quand on
   * s'aperçoit qu'on est parti dans le mauvais sens.
   */
  let historique: (typeof settings.colors)[] = $state([]);
  let resume = $state('');
  /** Ce que la dernière action a changé, pour l'afficher noir sur blanc. */
  let dernierBilan: { avant: number; apres: number } | null = $state(null);

  const seuil = $derived(SEUILS[usage]);
  const paires = $derived(evaluePaires(settings.colors, usage));

  /**
   * Les échecs, dédoublonnés : « A sur B » et « B sur A » ont le même
   * ratio et se corrigent ensemble. En afficher deux revenait à doubler
   * la liste sans rien ajouter à la décision.
   */
  const echecs = $derived.by(() => {
    const vus = new Set<string>();
    return paires.filter((p) => {
      if (p.niveau !== null) return false;
      const cle = [p.avantId, p.fondId].sort().join('|');
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  });

  const courante = $derived(echecs[Math.min(curseur, Math.max(0, echecs.length - 1))]);

  const proposition = $derived(
    courante ? proposeCorrections(courante.avantHex, courante.fondHex, usage) : null,
  );

  /**
   * Chaque piste est mesurée sur TOUTE la palette, pas seulement sur la
   * paire en cours — c'est ce qui manquait : on corrigeait une paire, une
   * autre tombait, le compteur ne descendait pas et on avait le sentiment
   * de cliquer dans le vide.
   *
   * Le classement suit le gain net : une piste qui règle trois paires
   * passe devant une piste indolore qui n'en règle qu'une.
   */
  const pistes = $derived.by(() => {
    if (!proposition || !courante) return [];
    return proposition.candidats
      .map((c) => ({
        c,
        impact: impactSurPalette(
          settings.colors,
          c.cible === 'avant' ? courante.avantId : courante.fondId,
          c.hex,
          usage,
        ),
      }))
      .sort((a, b) => {
        // Une piste qui vide une bande de clarté passe toujours en
        // dernier, quel que soit son gain en contraste : elle règle des
        // paires en cassant le système.
        const videA = a.impact.bandeVidee !== null;
        const videB = b.impact.bandeVidee !== null;
        if (videA !== videB) return videA ? 1 : -1;
        const gainA = a.impact.resolues - a.impact.cassees;
        const gainB = b.impact.resolues - b.impact.cassees;
        if (gainA !== gainB) return gainB - gainA;
        if (a.c.douce !== b.c.douce) return a.c.douce ? -1 : 1;
        return a.c.deltaL - b.c.deltaL;
      })
      .slice(0, 3);
  });

  const pisteActive = $derived(pistes[Math.min(pisteVisee, Math.max(0, pistes.length - 1))] ?? null);

  /** Le libellé d'impact, en français, jamais un chiffre nu. */
  function libelleImpact(i: Impact): string {
    if (i.cassees === 0) {
      return i.resolues > 1 ? `règle ${i.resolues} associations` : 'règle celle-ci';
    }
    const reglees = i.resolues > 1 ? `en règle ${i.resolues}` : 'en règle une';
    const cassees = i.cassees > 1 ? `en casse ${i.cassees}` : 'en casse une';
    return `${reglees}, ${cassees}`;
  }

  /**
   * Gain net de la meilleure piste disponible. S'il est nul ou négatif,
   * c'est un renseignement en soi : aucune retouche de CETTE paire ne
   * fait avancer l'ensemble, donc le problème est ailleurs — dans la
   * structure de la palette, pas dans cette association.
   */
  const meilleurGain = $derived(
    pistes.length > 0
      ? Math.max(...pistes.map((p) => p.impact.resolues - p.impact.cassees))
      : 0,
  );

  const impasse = $derived(pistes.length > 0 && meilleurGain <= 0);

  /** Une piste qui dégrade l'accord des couleurs doit le dire. */
  function alerteHarmonie(i: Impact): string {
    const perte = i.harmonieAvant - i.harmonieApres;
    return perte >= 8 ? `harmonie ${i.harmonieAvant} → ${i.harmonieApres}` : '';
  }

  const NOM_BANDE: Record<string, string> = {
    light: 'claire',
    mid: 'moyenne',
    dark: 'foncée',
  };

  /** L'alerte de structure : celle qu'aucun compte de paires ne donne. */
  function alerteBande(i: Impact): string {
    return i.bandeVidee ? `plus aucune couleur ${NOM_BANDE[i.bandeVidee]}` : '';
  }

  /** Ce que l'ajustement automatique réglerait, sans rien appliquer. */
  const simulation = $derived(corrigeTout(settings.colors, usage));

  function nomDe(id: string): string {
    return settings.colors.find((c) => c.id === id)?.label ?? id;
  }

  function fmt(r: number): string {
    return (Math.floor(r * 100) / 100).toFixed(2).replace('.', ',');
  }

  function memorise(): number {
    historique = [...historique, settings.colors.map((c) => ({ ...c }))].slice(-10);
    return echecs.length;
  }

  function ajusteTout(): void {
    const bilan = corrigeTout(settings.colors, usage);
    if (bilan.changements.length === 0) return;
    const avant = memorise();
    // Le moteur rend des couleurs au label facultatif ; le nuancier, lui,
    // en exige un — on repart des entrées d'origine pour le conserver.
    settings.colors = settings.colors.map((c) => ({
      ...c,
      hex: bilan.couleurs.find((n) => n.id === c.id)?.hex ?? c.hex,
    }));
    const n = bilan.changements.length;
    resume = `${n} couleur${n > 1 ? 's' : ''} ajustée${n > 1 ? 's' : ''}.`;
    dernierBilan = { avant, apres: echecs.length };
    curseur = 0;
    pisteVisee = 0;
  }

  function annule(): void {
    const precedent = historique.at(-1);
    if (!precedent) return;
    historique = historique.slice(0, -1);
    settings.colors = precedent;
    resume = 'Retour en arrière.';
    dernierBilan = null;
  }

  /**
   * Applique une piste et RESTE dans le fil : le curseur n'est pas remis
   * à zéro. La paire réglée disparaît de la liste, donc le même index
   * pointe déjà sur la suivante — c'est ce qui fait la différence entre
   * avancer et avoir l'impression de recliquer sur la même chose.
   */
  function appliquePiste(candidat: Candidat): void {
    if (!courante) return;
    const id = candidat.cible === 'avant' ? courante.avantId : courante.fondId;
    const avant = memorise();
    settings.colors = settings.colors.map((c) => (c.id === id ? { ...c, hex: candidat.hex } : c));
    resume = `« ${nomDe(id)} » ajustée.`;
    dernierBilan = { avant, apres: echecs.length };
    pisteVisee = 0;
    if (curseur > echecs.length - 1) curseur = 0;
  }

  /** La phrase de progression, celle qui dit si on avance ou non. */
  const phraseProgression = $derived.by(() => {
    if (!dernierBilan) return '';
    const { avant, apres } = dernierBilan;
    if (apres === 0) return `${avant} → 0 : tout passe.`;
    if (apres < avant) return `${avant} → ${apres} associations en échec.`;
    if (apres === avant) return `Toujours ${apres} associations en échec : cette correction en a réglé une et cassé une autre.`;
    return `${avant} → ${apres} : cette correction a créé plus de problèmes qu’elle n’en a réglé.`;
  });

  const spotCollisions = $derived(findSpotCollisions(settings.colors));

  const epreuve = $derived([
    { label: 'Écran', hexes: settings.colors.map((c) => c.hex) },
    { label: 'Niveaux de gris', hexes: settings.colors.map((c) => toGrayscale(c.hex)) },
    { label: 'Deutéranopie', hexes: settings.colors.map((c) => simulateCvd(c.hex, 'deutan', 100)) },
  ]);
</script>

<div class="wrap">
  <!-- 1. Ce qu'on vérifie -->
  <div class="entete">
    <div class="usages" role="group" aria-label="Usage évalué">
      {#each USAGES as u (u.id)}
        <button
          aria-pressed={usage === u.id}
          onclick={() => {
            usage = u.id;
            curseur = 0;
            pisteVisee = 0;
          }}>{u.label}</button
        >
      {/each}
    </div>
    <p class="regle">{seuil.regle} — il faut {fmt(seuil.aa)}:1</p>
  </div>

  <!-- 2. L'action du moment, écrite en toutes lettres -->
  {#if echecs.length === 0}
    <p class="tout-passe">
      <span class="signe" aria-hidden="true">✓</span>
      Les {paires.length} associations passent le seuil. Rien à corriger sur cet usage.
    </p>
  {:else}
    <div class="barre-action">
      <div class="barre-texte">
        <p class="barre-titre">
          {echecs.length} association{echecs.length > 1 ? 's' : ''} ne passe{echecs.length > 1
            ? 'nt'
            : ''} pas.
        </p>
        <p class="barre-detail">
          {#if simulation.changements.length > 0}
            L’outil peut en régler {simulation.changements.length} tout seul, en ne déplaçant que
            la clarté — teintes et intensités conservées.
          {:else}
            Aucune ne se règle automatiquement sans toucher à tes teintes : elles se décident une
            par une, ci-dessous.
          {/if}
        </p>
      </div>
      {#if simulation.changements.length > 0}
        <button class="principal" onclick={ajusteTout}>
          Ajuster automatiquement
        </button>
      {/if}
    </div>

    {#if resume}
      <p class="resume" data-recul={dernierBilan !== null && dernierBilan.apres >= dernierBilan.avant} role="status">
        <span class="resume-fait">{resume}</span>
        {#if phraseProgression}
          <span class="resume-progres">{phraseProgression}</span>
        {/if}
        {#if historique.length > 0}
          <button class="lien" onclick={annule}>Annuler</button>
        {/if}
      </p>
    {/if}
  {/if}

  <!-- 3. La décision en cours : le spécimen, puis les pistes -->
  {#if courante && proposition}
    <div class="decision">
      <p class="micro">
        À décider — {curseur + 1} sur {echecs.length}
      </p>
      <h3 class="titre-decision">
        « {nomDe(courante.avantId)} » sur « {nomDe(courante.fondId)} », <i>illisible</i>.
      </h3>
      <p class="diagnostic">{proposition.diagnostic}</p>

      <div class="specimens">
        <div class="specimen">
          <div class="page" style="background:{courante.fondHex};color:{courante.avantHex}">
            <p class="page-titre">Un titre de section</p>
            <p class="page-texte">
              Le texte courant d’un paragraphe, à la taille où on le lit vraiment. C’est ici que
              se juge la lisibilité, pas dans un chiffre.
            </p>
          </div>
          <p class="mesure">
            <span class="ratio value">{fmt(courante.ratio)}:1</span>
            <span class="verdict" data-ok="false"><span aria-hidden="true">✕</span> aujourd’hui</span>
          </p>
        </div>

        {#if pisteActive}
          {@const fond = pisteActive.c.cible === 'fond' ? pisteActive.c.hex : courante.fondHex}
          {@const texte = pisteActive.c.cible === 'avant' ? pisteActive.c.hex : courante.avantHex}
          <div class="specimen">
            <div class="page" style="background:{fond};color:{texte}">
              <p class="page-titre">Un titre de section</p>
              <p class="page-texte">
                Le texte courant d’un paragraphe, à la taille où on le lit vraiment. C’est ici que
                se juge la lisibilité, pas dans un chiffre.
              </p>
            </div>
            <p class="mesure">
              <span class="ratio value">{fmt(pisteActive.c.ratio)}:1</span>
              <span class="verdict" data-ok="true"><span aria-hidden="true">✓</span> avec la piste choisie</span>
            </p>
          </div>
        {/if}
      </div>

      <!-- Les pistes : on choisit, on ne subit pas -->
      {#if impasse}
        <!--
          Le renseignement le plus utile de toute l'étape : continuer à
          retoucher ici ferait tourner en rond. On le dit AVANT le clic,
          et on renvoie là où le problème se règle vraiment.
        -->
        <p class="impasse">
          Aucune retouche de cette paire ne fait baisser le total : chaque correction possible
          en casse autant qu’elle en règle. Le problème n’est pas cette association, c’est
          l’écart de clarté dans la palette — il se règle à l’étape Nuancier, en ajoutant une
          couleur franchement plus claire ou plus foncée.
        </p>
      {/if}

      {#if pistes.length > 0}
        <p class="micro">{impasse ? 'Malgré tout, si tu veux forcer' : 'Ce que je te propose'}</p>
        <!--
          role="radio" et non aria-pressed : ce sont des options
          exclusives, pas des interrupteurs. La distinction n'est pas
          cosmétique — le style global d'un bouton « enfoncé » repeint le
          fond en Terre avec du texte Paille, ce qui rendait le libellé de
          la piste sélectionnée illisible sur la carte claire.
        -->
        <ul class="pistes" role="radiogroup" aria-label="Pistes de correction">
          {#each pistes as { c: piste, impact }, i (piste.cible + piste.hex)}
            <li>
              <button
                class="piste"
                class:visee={i === pisteVisee}
                role="radio"
                aria-checked={i === pisteVisee}
                onmouseenter={() => (pisteVisee = i)}
                onfocus={() => (pisteVisee = i)}
                onclick={() => (pisteVisee === i ? appliquePiste(piste) : (pisteVisee = i))}
              >
                <span class="piste-duo" aria-hidden="true">
                  <span
                    style="background:{piste.cible === 'avant' ? courante.avantHex : courante.fondHex}"
                  ></span>
                  <span class="fleche">→</span>
                  <span style="background:{piste.hex}"></span>
                </span>
                <span class="piste-corps">
                  <span class="piste-tete">
                    <strong>{piste.cible === 'avant' ? 'Changer le texte' : 'Changer le fond'}</strong>
                    <!-- L'effet sur l'ENSEMBLE, avant de cliquer. -->
                    <span class="piste-badge" data-net={impact.cassees === 0}>
                      {libelleImpact(impact)}
                    </span>
                    {#if !piste.douce}
                      <span class="piste-badge">
                        {piste.memeFamille ? 'gros écart' : 'change la couleur'}
                      </span>
                    {/if}
                    {#if alerteBande(impact)}
                      <span class="piste-badge" data-net={false}>{alerteBande(impact)}</span>
                    {/if}
                    {#if alerteHarmonie(impact)}
                      <span class="piste-badge" data-net={false}>{alerteHarmonie(impact)}</span>
                    {/if}
                  </span>
                  <span class="piste-phrase">{piste.phrase}</span>
                  <span class="piste-chiffres value">
                    {piste.hex} · {fmt(piste.ratio)}:1 · {piste.deltaL} points de clarté
                  </span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
        <p class="aide">
          Survole une piste pour la voir dans le spécimen, clique pour l’appliquer.
        </p>
      {:else}
        <p class="note-pied">
          Aucune variante de ces deux couleurs n’atteint le seuil : elles ne peuvent pas se porter
          l’une l’autre. Sépare-les dans la maquette.
        </p>
      {/if}

      <div class="actions">
        {#if pisteActive}
          <!-- En impasse, l'action n'est plus l'action principale : la
               mettre en avant serait pousser vers un clic inutile. -->
          <button class:principal={!impasse} onclick={() => appliquePiste(pisteActive.c)}>
            {impasse ? 'Appliquer quand même' : 'Appliquer et passer à la suivante'}
          </button>
        {/if}
        {#if proposition.usageTenable && proposition.usageTenable !== usage}
          <button onclick={() => { usage = proposition.usageTenable as PairUse; curseur = 0; }}>
            La garder pour {NOM_USAGE[proposition.usageTenable]}
          </button>
        {/if}
        {#if echecs.length > 1}
          <button
            class="ghost"
            onclick={() => {
              curseur = (curseur + 1) % echecs.length;
              pisteVisee = 0;
            }}>Passer</button
          >
        {/if}
      </div>

      {#if showTechnical}
        <p class="tech value">
          APCA Lc {courante.lc.toFixed(0)} — {lectureApca(courante.lc, usage)}. Complément
          informatif : la référence normative reste WCAG 2.2.
        </p>
      {/if}
    </div>

    {#if echecs.length > 1}
      <ul class="reste">
        {#each echecs as e, i (e.avantId + e.fondId)}
          {#if i !== curseur}
            <li>
              <button onclick={() => { curseur = i; pisteVisee = 0; }}>
                <span class="puce" style="background:{e.fondHex};color:{e.avantHex}">Aa</span>
                <span>{nomDe(e.avantId)} sur {nomDe(e.fondId)}</span>
                <span class="value">{fmt(e.ratio)}:1</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  {/if}

  <!-- 4. Tout le reste, replié : ce sont des contrôles, pas des décisions -->
  <details class="controles" bind:open={controlesOuverts}>
    <summary>Contrôles de vérification</summary>

    <div class="controles-corps">
      <div class="bloc">
        <p class="micro">Toutes les associations</p>
        <div class="matrice-scroll">
          <table>
            <caption class="vh">Matrice de toutes les associations</caption>
            <thead>
              <tr>
                <th scope="col"><span class="vh">Sur</span></th>
                {#each settings.colors as c (c.id)}
                  <th scope="col"><span class="tete" style="background:{c.hex}"></span>{c.label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each settings.colors as ligne (ligne.id)}
                <tr>
                  <th scope="row"><span class="tete" style="background:{ligne.hex}"></span>{ligne.label}</th>
                  {#each settings.colors as colonne (colonne.id)}
                    {#if ligne.id === colonne.id}
                      <td class="diag" aria-hidden="true"></td>
                    {:else}
                      {@const p = paires.find((x) => x.avantId === ligne.id && x.fondId === colonne.id)}
                      <td>
                        {#if p}
                          <span class="signe" aria-hidden="true">{p.niveau ? '✓' : '✕'}</span>
                          <span class="value">{fmt(p.ratio)}</span>
                          <span class="niveau">{p.niveau ?? '—'}</span>
                        {/if}
                      </td>
                    {/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bloc">
        <p class="micro">L’épreuve</p>
        {#each epreuve as rang (rang.label)}
          <div class="rang">
            <span class="rang-label">{rang.label}</span>
            <span class="rang-bande" aria-hidden="true">
              {#each rang.hexes as hex, i (i)}<span style="background:{hex}"></span>{/each}
            </span>
          </div>
        {/each}
      </div>

      {#if spotCollisions.length > 0}
        <div class="bloc">
          <p class="micro">En ton direct</p>
          {#each spotCollisions as c (c.a + c.b)}
            <p class="note-pied">{c.message}</p>
          {/each}
        </div>
      {/if}

      <div class="bloc">
        <p class="micro">Le niveau A — à vérifier toi-même</p>
        <p class="a-question">{LEVEL_A_CHECK.question}</p>
        <label class="a-check">
          <input type="checkbox" bind:checked={settings.levelAConfirmed} />
          Non — chaque information a un second indice (texte, icône, motif).
        </label>
        <p class="note-pied">{LEVEL_A_CHECK.why}</p>
      </div>
    </div>
  </details>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1.2rem;
  }

  .entete {
    display: grid;
    gap: 0.35rem;
  }

  .usages {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .usages button {
    font-size: 0.85rem;
    padding: 0.3rem 0.9rem;
  }

  .regle {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .tout-passe {
    margin: 0;
    font-size: 0.95rem;
  }

  .tout-passe .signe {
    color: var(--conforme);
    font-weight: 600;
  }

  /* — La barre d'action : ce qu'il y a à faire, et le bouton pour le faire — */
  .barre-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.2rem;
    flex-wrap: wrap;
    background: var(--surface-panel);
    border-radius: var(--radius);
    padding: 0.9rem 1.1rem;
  }

  .barre-texte {
    display: grid;
    gap: 0.15rem;
    min-inline-size: 0;
  }

  .barre-titre {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
  }

  .barre-detail {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    max-inline-size: 34rem;
  }

  /* Le bilan d'une action : ce qui a été fait, puis l'effet chiffré sur
     l'ensemble. C'est la ligne qui manquait pour savoir si on avance. */
  .resume {
    margin: 0;
    font-size: 0.85rem;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
    background: var(--surface-panel);
    border-inline-start: 3px solid var(--conforme);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.8rem;
  }

  /* Le mot « recul » est porté par le texte ; le filet ne fait que
     renforcer, il ne porte jamais seul l'information. */
  .resume[data-recul='true'] {
    border-inline-start-color: var(--non-conforme);
  }

  .resume-fait {
    font-weight: 500;
  }

  .resume-progres {
    color: var(--text-muted);
  }

  button.lien {
    border: none;
    background: none;
    padding: 0;
    min-block-size: 0;
    text-decoration: underline;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* — La décision — */
  .decision {
    display: grid;
    gap: 0.7rem;
  }

  .decision .micro {
    margin: 0;
  }

  .titre-decision {
    margin: 0;
    font-size: 1.3rem;
  }

  .diagnostic {
    margin: 0;
    font-size: 0.88rem;
    max-inline-size: 44rem;
  }

  .specimens {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
  }

  .page {
    padding: 1.1rem 1.2rem;
    border-radius: var(--radius);
  }

  .page-titre {
    margin: 0 0 0.4rem;
    font-family: var(--font-titre);
    font-size: 1.15rem;
  }

  .page-texte {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .mesure {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0.4rem 0 0;
  }

  .ratio {
    font-size: 1.35rem;
  }

  .verdict {
    font-size: 0.82rem;
    font-weight: 500;
  }

  .verdict[data-ok='true'] {
    color: var(--conforme);
  }

  .verdict[data-ok='false'] {
    color: var(--non-conforme);
  }

  /* — Les pistes proposées — */
  .pistes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }

  .piste {
    inline-size: 100%;
    display: flex;
    align-items: flex-start;
    gap: 0.8rem;
    text-align: left;
    padding: 0.7rem 0.9rem;
    border-radius: var(--radius);
    border: 1px solid rgba(28, 18, 5, 0.12);
    background: var(--surface-canvas);
  }

  /* Couleur de texte réaffirmée : sans elle, la piste sélectionnée
     hériterait du style de bouton actif et deviendrait illisible. */
  .piste.visee {
    border-color: var(--text-main);
    background: var(--surface-panel);
    color: var(--text-main);
  }

  .piste-duo {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    margin-block-start: 0.15rem;
  }

  .piste-duo > span:not(.fleche) {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(28, 18, 5, 0.14);
  }

  .fleche {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .piste-corps {
    display: grid;
    gap: 0.15rem;
    min-inline-size: 0;
  }

  .piste-tete {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
  }

  /* Le badge dit le coût ; il ne se lit pas à la couleur seule, le mot
     porte l'information. */
  .piste-badge {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
    background: rgba(28, 18, 5, 0.07);
    color: var(--text-muted);
  }

  /* Gain net : mis en avant. Effet de bord : laissé neutre, le libellé
     (« en casse une ») porte l'alerte — pas la couleur seule. */
  .piste-badge[data-net='true'] {
    background: var(--etape-active);
    color: var(--ebene);
  }

  .piste-phrase {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .piste-chiffres {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .impasse {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
    max-inline-size: 44rem;
    background: var(--surface-panel);
    border-inline-start: 3px solid var(--non-conforme);
    border-radius: var(--radius-sm);
    padding: 0.7rem 0.9rem;
  }

  .aide {
    margin: 0;
    font-size: 0.75rem;
    font-style: italic;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  button.ghost {
    border-color: transparent;
    color: var(--text-muted);
  }

  .tech {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* — La liste courte des autres échecs — */
  .reste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }

  .reste button {
    inline-size: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    border: none;
    background: none;
    padding: 0.3rem 0.4rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    min-block-size: 38px;
  }

  .reste button:hover {
    background: var(--surface-panel);
  }

  .reste .value {
    margin-inline-start: auto;
    color: var(--text-muted);
  }

  .puce {
    inline-size: 1.6rem;
    block-size: 1.6rem;
    display: grid;
    place-items: center;
    border-radius: 4px;
    font-size: 0.72rem;
    flex-shrink: 0;
  }

  /* — Les contrôles, repliés — */
  .controles {
    border-block-start: 1px solid rgba(28, 18, 5, 0.09);
    padding-block-start: 0.9rem;
  }

  .controles summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-main);
  }

  .controles-corps {
    display: grid;
    gap: 1.4rem;
    margin-block-start: 1rem;
  }

  .bloc {
    display: grid;
    gap: 0.4rem;
  }

  .bloc .micro {
    margin: 0;
  }

  .matrice-scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-size: 0.78rem;
  }

  th,
  td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid rgba(28, 18, 5, 0.09);
    text-align: left;
    white-space: nowrap;
  }

  thead th {
    font-weight: 400;
    color: var(--text-muted);
  }

  .tete {
    display: inline-block;
    inline-size: 0.8rem;
    block-size: 0.8rem;
    border-radius: 2px;
    margin-inline-end: 0.35rem;
    vertical-align: -1px;
  }

  td .signe {
    margin-inline-end: 0.3rem;
  }

  .niveau {
    color: var(--text-muted);
    margin-inline-start: 0.3rem;
  }

  .diag {
    background: var(--surface-panel);
  }

  .rang {
    display: grid;
    grid-template-columns: 8rem 1fr;
    align-items: center;
    gap: 0.7rem;
  }

  .rang-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
  }

  .rang-bande {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: 1.5rem;
    gap: 2px;
  }

  .a-question {
    margin: 0;
    font-size: 0.9rem;
  }

  .a-check {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.88rem;
    min-block-size: 44px;
    padding-block: 0.25rem;
    cursor: pointer;
  }

  .a-check input {
    margin-block-start: 0.2rem;
  }

  @media (max-width: 52rem) {
    .specimens {
      grid-template-columns: 1fr;
    }
  }
</style>
