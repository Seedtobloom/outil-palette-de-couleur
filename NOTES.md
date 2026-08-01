# NOTES — Nuancier

Journal de décisions du projet. Objectif : pouvoir reprendre le travail dans
trois mois sans redécouvrir les arbitrages.

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
