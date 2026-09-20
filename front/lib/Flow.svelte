<script lang="ts">
  /**
   * LE parcours, en six étapes : Départ, Nuancier, Harmonie, Rôles,
   * Contraste, Livraison. Tout l'outil vit ici — rien n'est ailleurs.
   *
   * Il en a compté onze, dont un choix de projet, une étape de sélection
   * de la couleur de base, une étape de génération de rampes, une étape
   * d'impression et une de déclinaison réseaux sociaux. Elles sont
   * tombées pour ramener l'outil au périmètre de la référence.
   */
  import {
    gamutMap,
    oklchToHex,
    parseToOklch,
    construitPalette,
    trieParFamilles,
    libelleTri,
    messageTri,
    nommePalette,
    type SensTri,
    exportNuancierCss,
    composeApercu,
    type Apercu,
    exportAse,
    exportPlancheSvg,
  } from '../engine';
  import { settings } from './state.svelte';
  import { journal } from './journal.svelte';
  import { parcours } from './parcours.svelte';
  import { messages } from './messages.svelte';
  import StepPalette from './StepPalette.svelte';
  import StepHarmony from './StepHarmony.svelte';
  import StepContrast from './StepContrast.svelte';
  import StepRoles from './StepRoles.svelte';
  import StepConvert from './StepConvert.svelte';
  import SidePanel from './SidePanel.svelte';
  import ImportImage from './ImportImage.svelte';

  /**
   * Panneau d'entrée ouvert sous la barre d'outils. « Coller » est
   * ouvert d'emblée : on arrive presque toujours avec une charte à
   * valider, rarement d'une page blanche.
   */
  let panneau: 'coller' | 'image' | null = $state('coller');

  function ouvre(lequel: 'coller' | 'image'): void {
    panneau = panneau === lequel ? null : lequel;
  }

  /**
   * Le sens du prochain tri. Il bascule à chaque clic : le bouton
   * annonce ce qu'il fera, pas ce qu'il vient de faire.
   */
  let sensTri: SensTri = $state('clair-fonce');

  function trie(): void {
    const sens = sensTri;
    journal.agis('Tri du nuancier', () => {
      settings.colors = trieParFamilles(settings.colors, sens);
    });
    sensTri = sens === 'clair-fonce' ? 'fonce-clair' : 'clair-fonce';
    messages.montre(messageTri(sens), 'info');
  }

  /**
   * Construit une palette complète. Chaque clic propose autre chose —
   * un autre schéma, une autre clarté d'accents — en gardant les
   * couleurs verrouillées comme ancres.
   */
  let graine = $state(0);

  function construit(): void {
    const g = graine;
    const avant = settings.colors.length;
    journal.agis('Construction de la palette', () => {
      const faites = construitPalette(settings.colors, g, () => 'Couleur');
      const noms = nommePalette(faites.map((c) => c.hex));
      settings.colors = faites.map((c, i) => {
        const ancre = settings.colors.find((a) => a.verrou && a.hex === c.hex);
        return (
          ancre ?? {
            id: `k${g}-${i}-${Date.now().toString(36)}`,
            hex: c.hex,
            label: noms[i] as string,
          }
        );
      });
      settings.pairings = [];
    });
    graine = g + 1;
    messages.succes(
      avant === 0
        ? `Palette construite — ${settings.colors.length} couleurs.`
        : `Nouvelle palette générée — ${settings.colors.length} couleurs.`,
      { libelle: 'Annuler', faire: () => journal.annule() },
    );
  }

  /** Vider garde les couleurs verrouillées : c'est tout l'intérêt du verrou. */
  function vide(): void {
    const gardees = settings.colors.filter((c) => c.verrou).length;
    journal.agis('Vidage du nuancier', () => {
      settings.colors = settings.colors.filter((c) => c.verrou);
      settings.pairings = [];
    });
    messages.montre(
      gardees > 0
        ? `Palette réinitialisée — ${gardees} couleur${gardees > 1 ? 's' : ''} verrouillée${gardees > 1 ? 's' : ''} conservée${gardees > 1 ? 's' : ''}.`
        : 'Palette vidée.',
      'info',
      { libelle: 'Annuler', faire: () => journal.annule() },
    );
  }

  const current = $derived(parcours.courante);

  /*
   * ⚠ ICI SE TROUVAIT `seedColors`, ET IL FAUT DIRE POURQUOI IL EST PARTI.
   *
   * À l'entrée d'une étape d'analyse, si le nuancier était vide, il le
   * remplissait de cinq couleurs tirées de `generatePalette(baseColor)` :
   * « Principale », « Secondaire », « Accent », « Gris clair », « Gris
   * foncé ». Comme `baseColor` n'est plus renseignée par rien depuis la
   * suppression de l'étape « couleur de base », ces cinq couleurs
   * venaient du bleu par défaut. Le nuancier se remplissait donc tout
   * seul de couleurs que personne n'avait choisies.
   *
   * C'était un pansement sur le verrou d'étape, qui laissait passer un
   * nuancier vide (voir `auMoins3` dans parcours.svelte.ts). Le verrou
   * compte maintenant vraiment les couleurs, et il n'y a plus rien à
   * amorcer : on entre dans l'étape Harmonie avec ses propres couleurs,
   * ou on n'y entre pas.
   */
  function next(): void {
    parcours.suivant();
  }

  // Import d'une palette existante (le point d'entrée le plus fréquent :
  // une charte à valider ou à compléter).
  let pastedColors = $state('');
  const parsedPaste = $derived(
    pastedColors
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => parseToOklch(t))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => oklchToHex(gamutMap(c, 'srgb'))),
  );

  function importPasted(): void {
    if (parsedPaste.length === 0) return;
    settings.colors = parsedPaste.map((hex, i) => ({
      id: `p${i}`,
      hex,
      label: `Couleur ${i + 1}`,
    }));
    settings.baseColor = parsedPaste[0] as string;
    panneau = null;
  }

  /*
   * Ici vivaient une pipette écran et un `baseValid` : du code défini,
   * jamais affiché — la barre d'outils qui les portait est tombée avec
   * l'étape « couleur de base ». Ils continuaient d'écrire dans
   * `settings.baseColor`, ce qui achevait de brouiller la piste quand
   * l'export sortait du bleu.
   */
  const etapeSuivante = $derived(parcours.suivante);
  const conditionSuivante = $derived(parcours.conditionSuivante);
  const peutContinuer = $derived(parcours.peutContinuer);

  /**
   * Un seul export de code : les variables CSS du nuancier. Tailwind,
   * DTCG et SCSS sont tombés avec le reste — la référence ne sort que du
   * CSS, du SVG, du PNG, du PDF, de l'ASE et du JSON.
   */
  const FICHIER_CSS = 'nuancier.css';
  let copied = $state(false);

  async function copyExport(): Promise<void> {
    await navigator.clipboard.writeText(exportText);
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

  /** Déclenche un téléchargement à partir d'un contenu en mémoire. */
  function telecharge(contenu: BlobPart, nom: string, type: string): void {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
  }

  function telechargeTexte(): void {
    telecharge(exportText, FICHIER_CSS, 'text/css;charset=utf-8');
    messages.succes(`${FICHIER_CSS} téléchargé.`);
  }

  function telechargeAse(): void {
    const octets = exportAse(settings.colors, 'Nuancier');
    telecharge(octets, 'nuancier.ase', 'application/octet-stream');
    messages.succes('nuancier.ase téléchargé — à ouvrir dans le panneau Nuancier d’Illustrator.');
  }

  /**
   * Les associations retenues à l'étape Contraste partent dans la
   * planche. C'était le maillon manquant : les retenir ouvrait la suite
   * du parcours, mais ce travail de décision ne ressortait dans aucun
   * livrable — exactement le défaut de l'outil de référence, où
   * `selectedPairings` ne sert qu'à débloquer et n'apparaît dans aucun
   * export.
   */
  const associationsRetenues = $derived(
    settings.pairings
      .map((cle) => {
        const [idTexte, idFond] = cle.split('|');
        const texte = settings.colors.find((c) => c.id === idTexte);
        const fond = settings.colors.find((c) => c.id === idFond);
        return texte && fond
          ? {
              texte: { hex: texte.hex, label: texte.label },
              fond: { hex: fond.hex, label: fond.label },
            }
          : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  );

  /**
   * ⚠ LE DÉFAUT QUE CET EXPORT RÉPARE.
   *
   * `exportText` descendait de `palette`, c'est-à-dire d'un thème
   * fabriqué par `generatePalette(settings.baseColor)`. Or `baseColor`
   * est le reste d'une étape « choisis ta couleur de base » supprimée
   * depuis, que plus rien ne renseigne sauf « Coller » et l'import
   * photo — pas le Smart Builder. Le fichier téléchargé descendait donc
   * du bleu par défaut (#2563eb) : on pouvait travailler une heure sur
   * Terre, Paille et Glycine et repartir avec un CSS bleu.
   *
   * La source est maintenant le nuancier, ses rôles et les associations
   * retenues. Ce qu'on télécharge est ce qu'on a sous les yeux.
   */
  const exportText = $derived(
    exportNuancierCss(
      settings.colors.map((c) => ({ hex: c.hex, label: c.label, tonDirect: c.reference })),
      {
        ids: settings.colors.map((c) => c.id),
        roles: settings.roles,
        associations: associationsRetenues,
      },
    ),
  );

  /**
   * Les deux aperçus, montés avec le travail des étapes 3 et 4.
   *
   * On passe les couleurs AVEC leur rôle et la liste des associations
   * retenues : l'aperçu ne compose que des duos déjà vérifiés, et prend
   * les fonds et le bouton là où les rôles les désignent. Sans ça, il
   * classait les couleurs par clarté et posait, par exemple, un rouge de
   * marque sur un gris moyen — un duo que personne n'avait validé, dans
   * la vignette censée montrer le résultat.
   */
  const apercus = $derived.by(() => {
    const entrees = settings.colors.map((c) => ({
      hex: c.hex,
      label: c.label,
      role: settings.roles[c.id],
    }));
    return (['clair', 'sombre'] as const)
      .map((mode) => ({ mode, vue: composeApercu(entrees, mode, associationsRetenues) }))
      .filter((a): a is { mode: 'clair' | 'sombre'; vue: Apercu } => a.vue !== null);
  });

  const apercuFaible = $derived(apercus.some((a) => a.vue.ratioTexte < 4.5));
  /** Au moins un aperçu a dû composer hors des associations retenues. */
  const apercuNonValide = $derived(apercus.some((a) => !a.vue.valide));

  /** Tronqué vers le bas : 4,497 n'est pas 4,5, et ne passe donc pas AA. */
  function fmtRatio(valeur: number): string {
    return (Math.floor(valeur * 100) / 100).toFixed(2).replace('.', ',');
  }

  const plancheSvg = $derived(
    exportPlancheSvg(settings.colors, { associations: associationsRetenues }),
  );

  function telechargePlancheSvg(): void {
    telecharge(plancheSvg, 'planche-nuancier.svg', 'image/svg+xml;charset=utf-8');
    messages.succes('planche-nuancier.svg téléchargée.');
  }

  /**
   * La même planche en PNG, pour les envois où un SVG n'est pas lisible
   * (messageries, présentations). Rasterisée à 2× via un canvas : le
   * dessin reste défini par la fonction pure du moteur, l'interface ne
   * fait que le mettre en pixels.
   */
  function telechargePlanchePng(): void {
    const echelle = 2;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([plancheSvg], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * echelle;
      canvas.height = image.height * echelle;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
        return;
      }
      ctx.scale(echelle, echelle);
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
          return;
        }
        telecharge(blob, 'planche-nuancier.png', 'image/png');
        messages.succes('planche-nuancier.png téléchargée.');
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      messages.refus('Le navigateur n’a pas pu produire le PNG. Le SVG, lui, fonctionne.');
    };
    image.src = url;
  }

  /*
   * Deux tables de rampes (« Principale / Secondaire / Accent / Gris »,
   * « Succès / Attention / Erreur / Info ») vivaient ici, plus un
   * `void generatePalette` qui empêchait le compilateur de signaler
   * l'import devenu inutile. Tout cela décrivait l'étape « rampes »
   * supprimée depuis, et c'est ce silence forcé qui a permis au bleu de
   * rester branché aussi longtemps sans que rien ne proteste.
   */
</script>

<div class="flow">
  {#key current.id}
    <section class="stage zone-evaluation">
      <header class="stage-head">
        <p class="etape-num">Étape {parcours.index + 1}</p>
        <h2>{@html current.title.replace(/(\w+)\.$/, '<i>$1</i>.')}</h2>
        {#if current.lead}<p class="lead">{current.lead}</p>{/if}
      </header>

      {#if current.id === 'palette'}
        <!--
          La barre d'outils de l'étape : par où la palette entre, et les
          trois actions qui agissent sur l'ensemble. Ces entrées vivaient
          dans une étape « Départ » séparée — c'était une étape de plus
          pour un choix qu'on refait en cours de route. Elles sont
          maintenant au-dessus du nuancier, là où on s'en sert.
        -->
        <div class="barre-outils" role="group" aria-label="Construire la palette">
          <button class:actif={panneau === 'coller'} onclick={() => ouvre('coller')}>
            Coller une palette
          </button>
          <button class:actif={panneau === 'image'} onclick={() => ouvre('image')}>
            Importer une photo
          </button>
          <!--
            Le bouton « magique » de la référence : une baguette, un
            libellé court, un résultat immédiat et différent à chaque
            clic. C'est ce qui donne l'impression que quelque chose de
            malin travaille — alors que c'est de la géométrie sur le
            cercle des teintes, déterministe et testée.
          -->
          <button class="solid magique" onclick={construit}>
            <span class="baguette" aria-hidden="true">✦</span> Smart Builder
          </button>
          {#if settings.colors.length >= 2}
            <button onclick={trie} title={libelleTri(sensTri)}>Trier</button>
          {/if}
          {#if settings.colors.length > 0}
            <button class="vider" onclick={vide}>Vider la palette</button>
          {/if}
        </div>

        {#if panneau === 'coller'}
          <div class="panneau-depart">
            <p class="micro">Colle tes couleurs — une par ligne, ou séparées par des espaces</p>
            <div class="paste">
              <label class="vh" for="paste-hex">Tes couleurs en hexadécimal</label>
              <textarea
                id="paste-hex"
                rows="4"
                bind:value={pastedColors}
                placeholder="#1a1a2e&#10;#f7f5ef&#10;#c0392b"
                spellcheck="false"
              ></textarea>
              {#if parsedPaste.length > 0}
                <span class="paste-preview" aria-hidden="true">
                  {#each parsedPaste as hex (hex)}<span style="background:{hex}"></span>{/each}
                </span>
              {/if}
              <button class="solid" onclick={importPasted} disabled={parsedPaste.length === 0}>
                {parsedPaste.length === 0
                  ? 'Importer'
                  : `Importer ${parsedPaste.length} couleur${parsedPaste.length > 1 ? 's' : ''}`}
              </button>
              {#if pastedColors.trim() !== '' && parsedPaste.length === 0}
                <p class="note-pied">
                  Aucune couleur reconnue là-dedans. Les formats lus sont le hexadécimal
                  (#1a1a2e), rgb(), hsl() et oklch().
                </p>
              {/if}
            </div>
          </div>
        {:else if panneau === 'image'}
          <div class="panneau-depart">
            <p class="micro">Choisis une image — l’analyse reste dans ton navigateur</p>
            <ImportImage onImporte={() => (panneau = null)} />
          </div>
        {/if}

        <StepPalette />
      {:else if current.id === 'harmony'}
        <StepHarmony />
      {:else if current.id === 'roles'}
        <StepRoles />
      {:else if current.id === 'contrast'}
        <StepContrast />
      {:else if current.id === 'convert'}
        <StepConvert />
      {:else if current.id === 'deliver'}
        {#if settings.colors.length > 0}
          <!--
            Tes couleurs en situation, par les deux bouts : la plus
            claire en fond d'un côté, la plus foncée de l'autre. Rien
            n'est fabriqué ici, tout est choisi dans le nuancier — et
            chaque zone dit quelle couleur elle porte, sinon l'aperçu
            n'est qu'une image de plus.

            Sous deux couleurs il n'y a pas d'interface à montrer : la
            liste est vide et le bloc disparaît, sans masquer les
            livrables qui suivent.
          -->
          {#if apercus.length > 0}
          <div class="previews">
            {#each apercus as { mode, vue } (mode)}
              <!--
                Le filet de la carte est une TEINTE de la carte, pas la
                couleur du détail en plein : à pleine force il cernait la
                vignette comme un cadre et écrasait tout le reste. Il doit
                seulement poser la surface — surtout quand la page a pris
                la couleur de la carte et qu'il est le seul séparateur.
              -->
              <div class="preview" style="background:{vue.fond.hex}">
                <div
                  class="preview-card"
                  style="background:{vue.carte.hex};border-color:color-mix(in oklab, {vue.detail
                    .hex} 30%, {vue.carte.hex})"
                >
                  <p class="preview-oeil" style="color:{vue.detail.hex}">
                    {mode === 'clair' ? 'Clair' : 'Sombre'}
                  </p>
                  <p class="preview-titre" style="color:{vue.texte.hex}">Un titre qui porte</p>
                  <p class="preview-body" style="color:{vue.texte.hex}">
                    Un texte courant, et un
                    <span style="color:{vue.detail.hex}">détail plus discret</span>.
                  </p>
                  <p class="preview-actions">
                    <span
                      class="bouton-plein"
                      style="background:{vue.action.hex};color:{vue.surAction.hex}"
                    >
                      Action
                    </span>
                    <!--
                      Un second bouton, en contour : il montre le même
                      nuancier sur un autre registre, et il n'introduit
                      aucune couleur de plus — son trait et son intitulé
                      reprennent la couleur du texte, déjà validée sur
                      cette carte.
                    -->
                    <span
                      class="bouton-trait"
                      style="color:{vue.texte.hex};border-color:color-mix(in oklab, {vue.texte
                        .hex} 45%, {vue.carte.hex})"
                    >
                      Secondaire
                    </span>
                  </p>
                  <p
                    class="preview-pied"
                    style="color:{vue.detail.hex};border-color:color-mix(in oklab, {vue.detail
                      .hex} 22%, {vue.carte.hex})"
                  >
                    {vue.carte.label} · texte {vue.texte.label} · {fmtRatio(vue.ratioTexte)}:1{vue.valide
                      ? ' ✓ retenue'
                      : ''}
                  </p>
                </div>
              </div>
            {/each}
          </div>
          <p class="note-pied alerte-apercu">
            Ces deux vignettes ne montent que des duos que tu as retenus à l’étape Contraste,
            et prennent leurs fonds et leur bouton dans les rôles de l’étape Rôles.
          </p>
          {#if apercuNonValide}
            <p class="note-pied alerte-apercu">
              Sur au moins un des deux modes, tes associations retenues ne couvrent pas ce
              fond : l’aperçu a dû choisir seul, et son pied ne porte pas la mention
              « retenue ». Retiens une association sur ce fond à l’étape Contraste pour que
              la vignette dise quelque chose de vérifié.
            </p>
          {/if}
          {#if apercuFaible}
            <p class="note-pied alerte-apercu">
              Sur au moins un des deux fonds, la couleur la plus lisible de ton nuancier
              n’atteint pas 4,5:1. Il te manque une couleur de texte — c’est ce que l’aperçu
              montre, ce n’est pas un défaut d’affichage.
            </p>
          {/if}
          {/if}
          <div class="panel">
            <p class="panel-tete">
              Pour l’intégration
              <span class="panel-compte">{FICHIER_CSS}</span>
            </p>
            <div class="deliver-row">
              <button class="solid" onclick={copyExport}>
                {copied ? 'Copié ✓' : 'Copier le code'}
              </button>
              <button onclick={telechargeTexte}>Télécharger</button>
            </div>
            <p class="note-pied">
              Une variable par couleur, sous son nom, puis les rôles de l’étape 4 qui pointent
              dessus. Les associations que tu as retenues suivent en commentaire, avec leur
              ratio — de quoi intégrer sans avoir à redemander quoi poser sur quoi.
            </p>
            <details class="why">
              <summary>Voir le code</summary>
              <textarea readonly rows="8" value={exportText} aria-label="Code exporté"></textarea>
            </details>
          </div>

          <!--
            Les deux livrables qui n'ont rien à voir avec du code : le
            nuancier qui s'ouvre dans Illustrator, et la planche qu'on
            envoie au client. Ce sont ceux qu'une graphiste utilise le
            plus souvent, donc ils ont leur propre bloc.
          -->
          <div class="panel">
            <p class="panel-tete">
              Pour la création
              <span class="panel-compte">
                {settings.colors.length} couleurs · {associationsRetenues.length} associations
              </span>
            </p>
            <div class="deliver-row">
              <button class="solid" onclick={telechargeAse} disabled={settings.colors.length === 0}>
                Nuancier .ase
              </button>
              <button onclick={telechargePlanchePng} disabled={settings.colors.length === 0}>
                Planche PNG
              </button>
              <button onclick={telechargePlancheSvg} disabled={settings.colors.length === 0}>
                Planche SVG
              </button>
            </div>
            <p class="note-pied">
              Le .ase s’ouvre dans Illustrator, InDesign et Photoshop, avec tes noms. La planche
              porte les deux contrastes de référence de chaque couleur, sur blanc et sur noir —
              et, en seconde partie, les associations que tu as retenues à l’étape Contraste,
              rendues en conditions réelles avec leur ratio.
            </p>
          </div>

        {/if}
      {/if}

      <footer class="stage-foot">
        {#if parcours.index > 0}
          <button class="ghost" onclick={() => parcours.precedent()}>← Retour</button>
        {:else}<span></span>{/if}

      </footer>
    </section>
  {/key}

  <SidePanel
    etapeId={current.id}
    suivante={etapeSuivante ? { titre: etapeSuivante.title, court: etapeSuivante.short } : null}
    {peutContinuer}
    {conditionSuivante}
    onContinuer={next}
  />
</div>

<style>
  /*
   * Deux colonnes : la scène, et le panneau d'accompagnement. La
   * navigation a quitté cette grille pour la barre de tête — elle
   * mangeait une colonne entière sans rien apporter au travail en cours.
   */
  .flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--colonne-analyse);
    gap: var(--gouttiere);
    align-items: start;
    max-inline-size: var(--largeur-max);
    margin: 0 auto;
  }

  /*
   * — Scène : carte BLANCHE OPAQUE posée sur le fond doux —
   *
   * Le reste du chrome est en verre dépoli. Pas ici : c'est la zone
   * d'évaluation. Une carte translucide laisserait le dégradé passer
   * derrière les échantillons, et la règle des deux zones (brief §9.1)
   * tomberait — l'outil jugerait des couleurs sur un fond qui n'est pas
   * celui qu'il annonce. `zone-evaluation` rétablit aussi les tokens
   * clairs quand l'interface est en thème sombre.
   */
  .stage {
    inline-size: 100%;
    background: var(--surface-canvas);
    border: 1px solid var(--filet);
    border-radius: var(--radius-lg);
    box-shadow: var(--ombre-carte);
    padding: 1.9rem 2rem 1.6rem;
    display: grid;
    gap: 1.5rem;
    align-content: start;
    min-block-size: 22rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .stage {
      animation: rise 240ms cubic-bezier(0.2, 0.7, 0.3, 1);
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }

  .stage-head {
    display: grid;
    gap: 0.15rem;
    padding-block-end: 24px;
    border-block-end: 1px solid var(--filet);
  }

  /* Sur-titre : c'est la seule marque de couleur de la tête de scène,
     en Terre. Il donne le repère de progression sans concurrencer le
     titre, qui reste en Ébène. */
  /* Sur-titre : micro-capitales grasses et très espacées, en Terre.
     Il fait contrepoids au titre en serif fine juste en dessous —
     30 px en graisse 300 contre 11,5 px en 700, c'est cet écart qui
     porte la signature typographique. */
  .etape-num {
    margin: 0 0 8px;
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--surface-chrome);
  }

  .stage-head h2 {
    font-size: 30px;
    font-weight: 300;
    line-height: 1.12;
    letter-spacing: 0;
  }

  .lead {
    margin: 8px 0 0;
    color: var(--text-muted);
    font-size: 14px;
    max-inline-size: var(--mesure);
  }

  /* Le panneau de départ est visuellement rattaché aux cartes de choix :
     on doit voir que c'est la suite du clic, pas un bloc indépendant. */
  /* — Barre d'outils de l'étape « Construire » — */
  .barre-outils {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .barre-outils button {
    font-size: 0.85rem;
    padding: 0.35rem 0.95rem;
    min-block-size: 40px;
  }

  .barre-outils button.magique {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .baguette {
    font-size: 0.95rem;
    line-height: 1;
  }

  /* La baguette tourne légèrement au survol : le seul mouvement
     décoratif de l'interface, et il annonce « quelque chose va être
     inventé ». Supprimé si le mouvement est refusé. */
  @media (prefers-reduced-motion: no-preference) {
    .barre-outils button.magique:hover .baguette {
      transform: rotate(-18deg) scale(1.15);
      transition: transform var(--transition);
      display: inline-block;
    }
  }

  .barre-outils button.actif {
    background: var(--surface-chrome);
    border-color: var(--surface-chrome);
    color: var(--text-on-chrome);
  }

  /* « Vider » se détache du reste, et s'écarte : c'est la seule action
     destructive de la barre. Elle reste annulable au Ctrl+Z. */
  .barre-outils button.vider {
    margin-inline-start: auto;
    color: var(--non-conforme);
  }

  .barre-outils button.vider:hover {
    border-color: var(--non-conforme);
  }

  .panneau-depart {
    display: grid;
    gap: 0.7rem;
    background: var(--surface-panel);
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
  }

  .panneau-depart .micro {
    margin: 0;
  }

  .paste {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }

  .paste textarea {
    inline-size: 100%;
    font-family: var(--font-ui);
    font-size: 0.85rem;
  }

  .paste-preview {
    display: flex;
    gap: 3px;
  }

  .paste-preview span {
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 4px;
  }

  .why {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .why summary {
    cursor: pointer;
    color: var(--text-main);
  }

  .why textarea {
    inline-size: 100%;
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
  }

  /*
   * — Les deux vignettes —
   *
   * Elles doivent se lire comme une interface, pas comme un empilement
   * de paragraphes colorés. Tout l'effet tient à l'air : une page
   * généreuse autour de la carte, une carte généreuse autour de son
   * texte, et une hiérarchie franche entre l'œil, le titre et le corps.
   *
   * Aucune ombre, ici comme ailleurs (voir --ombre-carte dans app.css) :
   * une ombre poserait un gris qui n'est pas du nuancier par-dessus des
   * couleurs qu'on est justement en train de juger. Ce sont le filet et
   * l'écart de clarté entre la page et la carte qui détachent la
   * surface.
   */
  .previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: stretch;
  }

  .preview {
    border-radius: 20px;
    padding: 1.7rem 1.5rem;
    display: grid;
    align-items: start;
  }

  .preview-card {
    border: 1px solid;
    border-radius: 16px;
    padding: 1.4rem 1.35rem 1.2rem;
  }

  /* L'œil : le mode, en petites capitales espacées. Il campe la vignette
     sans consommer la place d'un titre. */
  .preview-oeil {
    margin: 0 0 0.75rem;
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Le titre, dans la serif de l'outil : c'est lui qui donne à la
     vignette l'air d'une vraie page, et il montre la palette sur un
     corps où la couleur se voit vraiment. */
  .preview-titre {
    margin: 0 0 0.45rem;
    font-family: var(--font-titre);
    font-weight: 300;
    font-size: 1.3rem;
    line-height: 1.2;
  }

  .preview-body {
    margin: 0 0 1.15rem;
    font-size: 0.87rem;
    line-height: 1.55;
    max-inline-size: 34ch;
  }

  .preview-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.78rem;
  }

  .preview-actions span {
    padding: 0.42rem 1rem;
    border-radius: var(--radius-pill);
    font-weight: 500;
    line-height: 1.2;
  }

  .bouton-trait {
    background: none;
    border: 1px solid;
  }

  /* La légende de l'aperçu : quelle couleur porte quoi, et le contraste
     obtenu. Sans elle, on regarde une vignette jolie sans savoir ce
     qu'elle dit — et c'est précisément ce qu'on reprochait à l'ancien
     aperçu. Elle prend la couleur du détail, donc une couleur du
     nuancier : elle fait partie de la démonstration.

     Le filet qui la sépare la sort de la simulation : ce qui est
     au-dessus est l'interface, ce qui est en dessous en parle. */
  .preview-pied {
    margin: 1.2rem 0 0;
    padding-block-start: 0.7rem;
    border-block-start: 1px solid;
    font-size: 0.69rem;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
  }

  .alerte-apercu {
    margin-top: 0.6rem;
  }

  .deliver-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .stage-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.3rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(28, 18, 5, 0.09);
  }

  /* Le remplissage vient de la feuille globale (Terre) ; ici, seulement
     la générosité du gabarit. */
  button.solid {
    padding: 0.45rem 1.3rem;
  }

  button.solid:disabled {
    opacity: 0.35;
    cursor: default;
  }

  button.ghost {
    border-color: transparent;
    color: var(--text-muted);
    padding-inline: 0.6rem;
  }

  button.ghost:hover {
    color: var(--text-main);
    border-color: var(--ink-muted);
  }

  /* Le panneau passe sous la scène : il accompagne la décision, il ne
     la porte pas — il peut donc descendre. */
  @media (max-width: 68rem) {
    .flow {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 46rem) {
    .stage {
      padding: 1.1rem 1.1rem 1rem;
    }

    .previews {
      grid-template-columns: 1fr;
    }

    /* Sur téléphone, la générosité devient de la place perdue : la
       vignette se resserre pour que la carte garde sa largeur de
       lecture. */
    .preview {
      padding: 1.2rem 1rem;
    }

    .preview-card {
      padding: 1.1rem 1rem 1rem;
    }

    .preview-titre {
      font-size: 1.15rem;
    }
  }
</style>
