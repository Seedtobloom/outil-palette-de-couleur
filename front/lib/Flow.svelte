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
    exportCss,
    exportAse,
    exportPlancheSvg,
    generatePalette,
    type GeneratedPalette,
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

  let { palette }: { palette: GeneratedPalette | null } = $props();

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

  /**
   * Verse la palette générée dans le nuancier si la graphiste n'y a pas
   * encore touché.
   *
   * Branché sur le parcours plutôt que sur un seul bouton : quel que soit
   * le chemin d'entrée — « Continuer », clic dans le fil, saut depuis le
   * score de santé — l'étape s'ouvre avec de la matière à analyser.
   */
  parcours.onEntree = () => {
    if (settings.colors.length === 0 && palette) seedColors(palette);
  };

  function next(): void {
    parcours.suivant();
  }

  function seedColors(p: GeneratedPalette): void {
    const t = p.themes.light.tokens;
    settings.colors = [
      { id: 'g1', hex: t.primary.hex, label: 'Principale' },
      { id: 'g2', hex: t.secondary.hex, label: 'Secondaire' },
      { id: 'g3', hex: t.accent.hex, label: 'Accent' },
      { id: 'g4', hex: p.ramps.neutral.steps[1]!.hex, label: 'Gris clair' },
      { id: 'g5', hex: p.ramps.neutral.steps[9]!.hex, label: 'Gris foncé' },
    ];
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

  // Pipette écran : API EyeDropper, avec repli explicite quand elle
  // n'est pas exposée (Firefox, Safari).
  const pipetteDisponible =
    typeof window !== 'undefined' && 'EyeDropper' in window;

  async function pipette(): Promise<void> {
    try {
      const Outil = (window as unknown as {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
      }).EyeDropper;
      const { sRGBHex } = await new Outil().open();
      settings.baseColor = sRGBHex;
    } catch {
      // Annulation par la personne : rien à signaler.
    }
  }

  const baseValid = $derived(parseToOklch(settings.baseColor) !== null);

  const etapeSuivante = $derived(parcours.suivante);
  const conditionSuivante = $derived(parcours.conditionSuivante);
  const peutContinuer = $derived(parcours.peutContinuer);

  /**
   * Un seul export de code : les variables CSS du système généré.
   * Tailwind, DTCG et SCSS sont tombés avec le reste — la référence ne
   * sort que du CSS, du SVG, du PNG, du PDF, de l'ASE et du JSON.
   */
  const FICHIER_CSS = 'nuancier.css';
  let copied = $state(false);

  const exportText = $derived(palette ? exportCss(palette) : '');

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

  const BRAND_RAMPS = [
    ['primary', 'Principale'],
    ['secondary', 'Secondaire'],
    ['accent', 'Accent'],
    ['neutral', 'Gris'],
  ] as const;

  const SEM_RAMPS = [
    ['success', 'Succès'],
    ['warning', 'Attention'],
    ['error', 'Erreur'],
    ['info', 'Info'],
  ] as const;

  void generatePalette; // (le calcul vit dans App, qui passe `palette`)
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
        {#if palette}
          <div class="previews">
            {#each ['light', 'dark'] as const as mode (mode)}
              {@const t = palette.themes[mode].tokens}
              <div class="preview" style="background:{t.background.hex}">
                <div
                  class="preview-card"
                  style="background:{t.surface.hex};border-color:{t['border-default'].hex}"
                >
                  <p class="preview-title" style="color:{t['text-primary'].hex}">
                    {mode === 'light' ? 'Clair' : 'Sombre'}
                  </p>
                  <p class="preview-body" style="color:{t['text-secondary'].hex}">
                    Un texte, un <span style="color:{t['text-muted'].hex}">détail</span>.
                  </p>
                  <p class="preview-actions">
                    <span style="background:{t.primary.hex};color:{t['on-primary'].hex}">Action</span>
                    <span
                      style="background:{t['success-surface'].hex};color:{t['success-content']
                        .hex};border:1px solid {t['success-border'].hex}">✓</span
                    >
                    <span
                      style="background:{t['error-surface'].hex};color:{t['error-content']
                        .hex};border:1px solid {t['error-border'].hex}">✗</span
                    >
                  </p>
                </div>
              </div>
            {/each}
          </div>
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
              Variables CSS : rampes, rôles, thèmes clair et sombre, prêtes à coller.
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

  .previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }

  .preview {
    border-radius: var(--radius);
    padding: 1rem;
  }

  .preview-card {
    border: 1px solid;
    border-radius: var(--radius);
    padding: 0.85rem 0.95rem;
  }

  .preview-title {
    margin: 0 0 0.25rem;
    font-weight: 600;
  }

  .preview-body {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
  }

  .preview-actions {
    display: flex;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.78rem;
  }

  .preview-actions span {
    padding: 0.2rem 0.7rem;
    border-radius: 100px;
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
  }
</style>
