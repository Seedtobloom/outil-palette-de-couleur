# NOTES — Nuancier

Journal de décisions du projet. Objectif : pouvoir reprendre le travail dans
trois mois sans redécouvrir les arbitrages.

---

## Phase 1 — Rampes, harmonie, palette complète (2026-08-01)

### Périmètre livré

- `src/engine/ramp` : courbes (profils L chromatique/neutre, cloche de
  chroma asymétrique éditable), génération 8–16 pas, torsion de teinte,
  neutres teintés, mode inversé (Leonardo).
- `src/engine/harmony` : roues RYB et RGB, six schémas classiques, score de
  contraintes explicable.
- `src/engine/semantic` + `palette.ts` : palette complète depuis une seule
  couleur, ~34 rôles × 2 thèmes, garantie AA par construction.
- `src/engine/export` : variables CSS (oklch + repli hex), Tailwind v4.
- UI : onglet « Construire une palette » (réglages expliqués, rampes,
  aperçu de rôles clair/sombre, score, exports) + onglet « Vérifier ».

### Décisions prises

- **⚠ Contradiction signalée dans le prompt produit** : « rampe de 12 pas »
  mais l'échelle listée (50·100·200…900·950) compte 11 valeurs. Tranché
  provisoirement en faveur de la liste explicite (11 pas, comme Tailwind) ;
  le nombre de pas est configurable de 8 à 16, donc réversible à tout
  moment. **À valider.**
- **Calibration des courbes par défaut** : profils L et forme de chroma
  mesurés sur la moyenne des 17 échelles chromatiques (et 5 neutres) de
  Tailwind v4 (fixture `src/data/references/tailwind-v4.json`). Découverte
  au passage : Tailwind v4 est définie au-delà du gamut sRGB sur les pas
  médians (palette pensée P3) — la recette de reproduction se joue donc en
  gamut P3.
- **Recette « régénérer une rampe connue »** : la courbe par défaut est un
  profil MOYEN ; aucune courbe unique ne reproduit toutes les échelles
  (leurs formes de chroma diffèrent réellement — le bleu garde son chroma
  tard vers le sombre, l'émeraude culmine tôt). La reproduction à ΔE00 < 3
  par pas se fait via les courbes éditables (petit balayage de réglages
  atelier, testé sur blue et violet). La courbe par défaut reste à ΔE00 < 6.
- **Garantie AA par construction** : chaque rôle contraint est choisi en
  scannant sa rampe jusqu'à satisfaire tous ses seuils (y compris le piège
  de l'aplat de luminance moyenne, illisible en blanc comme en noir : le
  choix d'aplat exige à la fois 3:1 composant ET un contenu lisible 4,5:1).
  Le thème sombre est une réattribution complète revérifiée.
- **Distinguabilité daltonisme des sémantiques** : deux leviers mesurés —
  le vert de succès tire vers le turquoise (h 168, enseignement Okabe-Ito :
  l'axe bleu-jaune survit aux CVD rouge-vert), et les quatre contenus
  sémantiques occupent des étages de clarté distincts (clair :
  succès 950 / erreur 800 / avertissement 700 / info 600). Vérifié :
  succès/erreur ≥ ΔE00 10 en deutéranopie ET protanopie, deux thèmes,
  sur 5 marques très différentes.
- **Bordures** : seule `border-strong` (bordure de champ, porteuse de sens)
  est soumise au 3:1 (SC 1.4.11) ; `border-subtle`/`border-default`
  (filets décoratifs) sont exemptées mais auditées en « signalé », comme
  le veut la norme.
- **Score de contraintes** : succès/erreur confondus = bloquant ;
  autres proximités CVD = avertissement avec conseil (second indice).
  L'isoluminance est mesurée sur les couleurs de base des rampes (identité
  de marque), pas sur les aplats de thème choisis par contraste.

### Alternatives écartées

- Reproduire Radix Colors plutôt que Tailwind : échelles orientées usage
  (12 pas mais sémantique 1–12 différente), correspondance de pas ambiguë.
- Chroma proportionnel au plafond de gamut (k·maxChroma) : instable près
  du coin bleu de P3 (le plafond explose quand la teinte dérive) — mesuré,
  écarté au profit de la cloche absolue bornée par le gamut.
- Éditeur de courbes de Bézier graphique : reporté au mode atelier
  (Phase 2) ; les paramètres (pic, retombées, torsion) couvrent déjà
  l'éditabilité réelle et sont testés.

### Points incertains / à trancher

- La contradiction « 12 pas / 11 valeurs » ci-dessus.
- Le choix des étages sémantiques (erreur en 800 assombrit le rouge des
  textes d'erreur clair ; visuellement correct mais à valider à l'œil).
- `visited` pointe sur l'accent — convention à confirmer.
- Le balayage de réglages de la recette de reproduction est grossier
  (grille) ; un ajustement automatique fin (« caler mes courbes sur cette
  échelle existante ») serait une fonctionnalité d'atelier utile.

### Recette Phase 1 — état

| Critère | État |
|---|---|
| Rampe Tailwind connue régénérée à ΔE00 < 3 par pas | ✅ blue et violet, via courbes éditables (`generate.test.ts`) |
| Palette par défaut AA sur toute la matrice, 2 thèmes, sans intervention | ✅ 5 marques très différentes, 76 paires (`palette.test.ts`) |
| Succès/erreur distinguables en CVD | ✅ deutéranopie + protanopie, 2 thèmes, 5 marques |
| Mode inversé | ✅ pas + couleur exacte au seuil |
| Exports CSS + Tailwind v4 | ✅ testés |

---

## Phase 0 — Le moteur qui ne ment pas (2026-08-01)

### Périmètre livré

- `src/engine/color` : conversions (OKLCH pivot), `inGamut`, `maxChroma`,
  `gamutMap` (algo CSS Color 4), ΔE2000, ΔEOK.
- `src/engine/contrast` : WCAG 2.2 (luminance, ratio, seuils typés par usage),
  APCA (wrapper apca-w3 épinglé 0.1.9), CVD (Machado 2009, sévérité 0–100),
  matrice N×N typée, `findLightnessForRatio` (socle du futur mode inversé).
- `src/engine/explain` : type `Diagnostic`, diagnostics contraste et CVD
  rédigés par le moteur, remèdes exécutables, socle du glossaire (15 termes).
- UI minimale : coller des couleurs, matrice expliquée, remèdes en un clic,
  section daltonisme avec curseur de sévérité, bascule « valeurs techniques ».
- 135 tests (`npm test`), 0 erreur `svelte-check`, build Vite propre.

### Décisions prises

- **Matrices CVD** : données Machado, Oliveira & Fernandes (2009) reprises du
  paquet `colour-science` (BSD-3-Clause), qui republie les tables des auteurs
  (sévérités 0.0→1.0 par pas de 0.1). Vérifiées contre la publication
  (protanopie 1.0, première ligne : 0.152286 / 1.052583 / −0.204868).
  Application en **RGB linéaire**, comme le veut le modèle ; sévérité
  intermédiaire par interpolation linéaire entre les deux matrices voisines.
  Achromatopsie : gris de même luminance (Y linéaire), pas une matrice.
- **Références de recette** :
  - WCAG : 20 paires témoins calculées par une implémentation indépendante
    (Python) de la formule normative, recoupées avec les valeurs affichées par
    WebAIM sur les paires célèbres (#767676 → 4.54, #777777 → 4.48,
    #0000FF → 8.59, #808080 → 3.95…). WebAIM implémente la même formule.
  - APCA : 4 paires canoniques documentées dans le dépôt apca-w3
    (63.0565 / −68.5415 / 58.1463 / −56.2411) + 16 paires figées depuis la
    version épinglée 0.1.9 (non-régression : toute montée de version qui
    changerait les Lc fera échouer les tests).
  - OKLCH : trio primaire vérifié à la main contre oklch.com ; le reste de la
    table est produit par culori — oklch.com utilise culori en interne, donc
    l'accord est structurel. Tolérance de recette : ΔE00 < 0.5.
  - ΔE2000 : 10 paires du jeu de données publié de Sharma, Wu & Dalal (2005),
    accord < 0.001. Calcul sur Lab D65 (choix culori) ; CIEDE2000 s'applique
    aux valeurs Lab fournies, l'illuminant n'affecte pas la formule.
- **Gamut mapping** : implémentation maison de l'algo CSS Color 4 (dichotomie
  sur C, L et H conservés, arrêt ΔEOK < 0.02 contre la version écrêtée),
  testée contre `toGamut` de culori (même algo) à ΔEOK < 0.02 près.
- **Verrou WCAG / signal APCA** : le statut d'une paire ne dépend QUE de
  WCAG 2.2. APCA produit au pire un `warn` (« conforme mais perceptuellement
  faible »), jamais un `fail`, et le texte technique rappelle explicitement
  qu'APCA n'est pas une conformité. Un test vérifie qu'aucun texte du moteur
  n'associe « niveau A » à un ratio.
- **Remèdes** : ajustement de la clarté seule (teinte et intensité
  conservées, résultat gamut-mappé) par dichotomie ; si aucune couleur seule
  ne peut atteindre la cible (fond moyen + AAA), remède combiné
  premier-plan + fond. Les tests vérifient que chaque remède proposé atteint
  réellement le seuil une fois appliqué.
- **Pas de Web Worker en Phase 0** : le moteur est du TypeScript pur, sans
  import UI, et tous ses résultats sont des objets sérialisables — il pourra
  passer dans un Worker sans modification quand les palettes deviendront
  grandes (rampes de la Phase 1). Le brancher maintenant serait de la
  sur-construction.
- **DA** : interface quasi achromatique (neutres chroma ≤ 0.01), une seule
  couleur d'accent (focus/actif), chiffres tabulaires, pas de webfonts
  (piles système : serif pour les titres, grotesque pour l'UI, mono pour les
  valeurs). Texte principal ≈ 15:1, secondaire ≥ 7:1 (AAA).

### Alternatives écartées

- `colorjs.io` comme moteur : gardé en réserve comme outil de vérification
  croisée si un doute apparaît ; culori suffit et est plus rapide.
- Matrices CVD de Brettel/Viénot : moins fidèles pour les formes partielles
  (anomalies), qui sont précisément le cas fréquent — Machado retenu,
  conformément au brief.
- Remèdes sous forme de fonctions (closures) : écarté au profit d'objets de
  données purs, pour rester sérialisable à travers un futur Worker.

### Points incertains / à trancher plus tard

- **Interpolation tritan** : la littérature note que les matrices Machado
  sont moins validées pour la tritanopie (le modèle est construit sur le
  décalage des cônes L/M). Les tests Okabe-Ito passent en tritan à 50 et
  100 %, mais pour un usage print critique on pourra ajouter Brettel 1997
  en vérification croisée. Non bloquant en Phase 0.
- **Identifiants de couleurs dans les textes du moteur** : aujourd'hui
  « couleur 1 », « couleur 2 »… fournis par l'UI. Quand les rôles arriveront
  (Phase 1), les diagnostics parleront en rôles (« texte principal »), ce qui
  rendra les phrases nettement plus parlantes.
- **Seuil `surface` 1.2:1** : cible indicative sans norme (le brief la donne
  comme telle) ; marquée `advisory` dans le moteur et présentée comme
  indicative dans l'UI.
- **P3** : `maxChroma`/`gamutMap` savent déjà travailler en P3, mais l'UI ne
  propose que sRGB en Phase 0. Le choix de gamut cible arrivera avec le
  contexte projet (M0) en Phase 2.

### Recette Phase 0 — état

| Critère | État |
|---|---|
| 20 paires → ratios WebAIM | ✅ testé (`wcag.test.ts`) |
| 20 paires → Lc APCA de référence | ✅ testé (`apca.test.ts`, 4 canoniques + 16 figées) |
| 20 conversions → oklch.com, ΔE00 < 0.5 | ✅ testé (`space.test.ts`) |
| Okabe-Ito sans collision CVD | ✅ testé (`cvd.test.ts`, 3 types × 2 sévérités) |
| Diagnostic → explication non vide + remède applicable | ✅ testé (`diagnostics.test.ts`) |
