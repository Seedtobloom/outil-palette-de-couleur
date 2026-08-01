# Brief technique — Outil de création de palettes de couleurs
### Web + Print + Accessibilité + Éco-conception
*Seed to Bloom — document de conception, v1*

---

## Sommaire

1. [État de l'art : ce qui existe et où ça casse](#1)
2. [Socle colorimétrique : les fondations à ne pas rater](#2)
3. [Contraste et accessibilité (la vraie hiérarchie A / AA / AAA)](#3)
4. [Harmonie et complémentarité : dépasser la roue d'Itten](#4)
5. [Le module print : là où 95 % des outils s'arrêtent](#5)
6. [Éco-couleurs : deux logiques distinctes à ne pas mélanger](#6)
7. [Spécification fonctionnelle par modules](#7)
8. [Architecture technique et choix de librairies](#8)
9. [Roadmap par étapes, avec critères de recette](#9)
10. [Pièges, risques juridiques et protocole de validation](#10)
11. [Annexes : formules, tables de seuils, valeurs de référence](#11)

---

<a name="1"></a>
## 1. État de l'art : ce qui existe et où ça casse

### 1.1 Cartographie honnête du marché

| Outil | Ce qu'il fait vraiment bien | Où il s'arrête |
|---|---|---|
| **Coolors** | Génération rapide, UX imbattable, export ASE/PDF | Zéro science perceptuelle (HSL), contraste en add-on, print inexistant |
| **Adobe Color** | Roue d'harmonie classique, extraction d'image, intégration CC, simulation daltonisme | Harmonies RYB figées, pas de rampes de design system, pas de TAC |
| **Paletton** | Roue interactive pédagogique, prévisualisation | Techno datée, RGB/HSV, aucune accessibilité sérieuse |
| **Khroma / Huemint / AIColors** | Génération IA, propositions inattendues, mise en contexte | Boîte noire, pas reproductible, pas auditable pour un client |
| **Leonardo (Adobe)** | Génération *par ratio de contraste cible* — approche inversée excellente | Interface aride, web only, pas d'harmonie, pas de print |
| **Atmos.style** | OKLCH, courbes d'easing, rampes propres, checks accessibilité | Payant, UI-only, aucune notion print ni éco |
| **Radix Colors / Open Color / Tailwind** | Échelles à rôles sémantiques (1–12), pensées pour l'usage réel | Palettes figées, pas un générateur |
| **Accessible Palette (Evil Martians)** | CIELab + lightness constante, très rigoureux | Mono-fonction |
| **Material Theme Builder (HCT)** | Modèle HCT (CAM16 + ton) qui garantit le contraste par construction | Verrouillé dans le langage Material |
| **Who Can Use / Polypane / Stark** | Vérification de paires, simulation de déficiences visuelles | Vérificateurs, pas générateurs |
| **ColorBox (Lyft)** | Courbes paramétriques sur chaque canal | Abandonné, web only |
| **Pantone Connect / Color Bridge** | Autorité sur les tons directs, équivalences quadri | Fermé, payant, licence propriétaire stricte |
| **Colorpeek / colorffy / ColorSpace** | Micro-outils utilitaires | Fragmentés |

### 1.2 Les cinq trous du marché — c'est ton positionnement

1. **Aucun outil ne fait le pont print ↔ web.** Les outils UI ignorent le CMJN ; les outils print ignorent WCAG. Une identité visuelle vit dans les deux mondes, et c'est exactement ton métier.
2. **Aucun outil ne calcule le coût environnemental d'une palette.** Ni taux d'encrage, ni énergie écran. C'est *le* différenciant Seed to Bloom, et personne ne l'occupe.
3. **Presque aucun ne simule le substrat.** Une palette validée sur écran meurt sur un papier recyclé non couché : le gamut s'effondre, le blanc du papier est jaune-gris, l'engraissement écrase les nuances. C'est la douleur n°1 du print éco.
4. **L'accessibilité est traitée en aval, jamais en amont.** On génère puis on vérifie, au lieu de générer *sous contrainte*. Leonardo est la seule exception sérieuse.
5. **Rien n'est livrable au client.** Aucun outil ne sort une documentation de charte couleur argumentée, avec justifications éco et accessibilité, prête à envoyer.

> **Positionnement cible :** un outil qui ne génère pas « des jolies couleurs », mais qui **produit un système chromatique validé sur trois axes simultanés — perceptuel, accessible, matériel (encre + énergie) — et documenté pour un client.**

---

<a name="2"></a>
## 2. Socle colorimétrique : les fondations à ne pas rater

Toute erreur ici se propage dans tous les modules. C'est la partie à écrire une fois, bien, et ne plus jamais toucher.

### 2.1 Choix de l'espace de travail interne

**Décision : OKLCH comme espace pivot. Non négociable.**

| Espace | Usage dans l'outil |
|---|---|
| **sRGB / hex** | Entrée/sortie uniquement. Jamais de calcul dedans. |
| **HSL** | À bannir de la logique interne. Sa « lightness » est un mensonge perceptuel (le bleu à L=50 % est bien plus sombre que le jaune à L=50 %). |
| **CIELab / LCH** | Correct, mais dérive sur les bleus (le fameux virage violet des dégradés bleu→blanc). |
| **OKLab / OKLCH** | **Espace pivot.** Uniformité perceptuelle supérieure, stable sur les bleus et violets, natif CSS Color 4, gère P3/Rec2020. |
| **CAM16-UCS / HCT** | Plus rigoureux encore (tient compte de l'adaptation à l'environnement) mais lourd. À garder comme option de vérification, pas comme moteur. |
| **CMJN + profil ICC** | Espace de *sortie* print. Nécessite un vrai moteur ICC (voir §5 et §8). |

### 2.2 Les phénomènes perceptuels que ton outil doit connaître

Ce sont les raisons pour lesquelles une palette « mathématiquement propre » peut paraître fausse. Les intégrer te met immédiatement au-dessus de 90 % des outils.

- **Plafond de chroma variable selon la teinte.** Dans sRGB, le jaune atteint son chroma max vers L≈0.85, le bleu vers L≈0.45. Conséquence directe : **une rampe à chroma constant est impossible.** Il faut une courbe de chroma par teinte, calculée par recherche dichotomique du gamut.
- **Effet Helmholtz–Kohlrausch.** Une couleur très saturée paraît plus claire que sa luminance réelle. Deux couleurs de même L OKLCH mais de chroma très différent ne « pèsent » pas pareil dans une composition.
- **Décalage Bezold–Brücke.** La teinte perçue dérive quand la luminance change. C'est pourquoi les bonnes rampes appliquent une **torsion de teinte** (hue torsion) : quelques degrés de dérive contrôlée vers le chaud dans les clairs, vers le froid dans les sombres — ou l'inverse selon le parti pris.
- **Effet Abney.** La teinte perçue dérive aussi avec la saturation. Même remède.
- **Contraste simultané.** Une couleur change d'apparence selon son voisinage. → justifie un module de prévisualisation en contexte, pas seulement des pastilles isolées.
- **Métamérisme.** Deux couleurs identiques sous D65 (écran) peuvent différer sous D50 (norme d'observation print) ou sous éclairage LED de bureau. À mentionner dans la doc client : *une validation couleur ne se fait jamais sur écran non calibré.*

### 2.3 Gamut mapping — l'algorithme à implémenter

Quand une couleur OKLCH sort du gamut cible (sRGB, P3, ou CMJN sur un papier donné) :

```
1. Conserver L et H.
2. Recherche dichotomique sur C entre 0 et C_initial.
3. À chaque itération : convertir vers l'espace cible, tester l'appartenance au gamut.
4. Critère d'arrêt : ΔE(OK) < 0.02 entre la version clippée et la version réduite (MINDE local, algo CSS Color 4).
5. Retourner C_max.
```

C'est l'algorithme normalisé par le CSS Color Module Level 4. L'implémenter proprement une fois te sert pour sRGB, P3 **et** l'aperçu CMJN.

### 2.4 Métrique de différence : ΔE

| Formule | Quand l'utiliser |
|---|---|
| ΔE76 | Jamais (trop grossier) |
| ΔE94 / CMC | Legacy textile/industrie |
| **ΔE2000 (ΔE00)** | **Référence pour la tolérance print et l'écart écran/papier** |
| **ΔEOK** | Rapide, suffisant pour le gamut mapping et la « distinguabilité » d'une palette |

Repères d'interprétation (ΔE00) :
- **< 1** : différence non perceptible
- **1–2** : perceptible par un œil exercé côte à côte
- **2–3,5** : perceptible par tous côte à côte
- **> 5** : deux couleurs différentes

Usages concrets dans l'outil :
- **Distinguabilité d'une palette catégorielle** → refuser deux couleurs à ΔE00 < 10, y compris après simulation de daltonisme.
- **Alerte dérive print** → afficher le ΔE00 entre la couleur écran et sa conversion CMJN sur le profil du papier choisi. Au-delà de ~5, prévenir le client *avant* la production.

---

<a name="3"></a>
## 3. Contraste et accessibilité

### 3.1 Correction importante : il n'existe pas de niveau A pour le contraste

C'est une confusion extrêmement répandue et il faut que ton outil soit juste là-dessus.

| Critère WCAG 2.2 | Niveau | Exigence |
|---|---|---|
| 1.4.1 — Utilisation de la couleur | **A** | Ne pas véhiculer une information **par la couleur seule**. Aucun ratio exigé. |
| 1.4.3 — Contraste (minimum) | **AA** | Texte 4.5:1 · Grand texte 3:1 |
| 1.4.6 — Contraste (amélioré) | **AAA** | Texte 7:1 · Grand texte 4.5:1 |
| 1.4.11 — Contraste des éléments non textuels | **AA** | Composants d'interface et éléments graphiques porteurs de sens : 3:1 |

**Le niveau A n'impose aucun ratio de contraste.** Il impose la non-dépendance à la couleur. Ton outil doit donc afficher trois statuts (« Non conforme / AA / AAA ») **et** un check séparé pour 1.4.1.

Définition de « grand texte » : **≥ 18 pt (24 px)** en graisse normale, ou **≥ 14 pt (18,66 px)** en gras.

Exemptions à coder : logotypes, texte purement décoratif, éléments désactivés (mais à afficher en avertissement UX, pas comme un feu vert).

### 3.2 La formule WCAG 2 et ses défauts (à connaître, pas à contourner)

```
Pour chaque canal c ∈ {R, G, B} normalisé sur [0,1] :
    c' = c / 12.92                    si c ≤ 0.03928
    c' = ((c + 0.055) / 1.055)^2.4    sinon
L = 0.2126·R' + 0.7152·G' + 0.0722·B'
Ratio = (L_clair + 0.05) / (L_sombre + 0.05)
```

Défauts documentés :
- **Symétrique** : inverser texte et fond donne le même score, alors que la perception humaine ne l'est pas.
- **Aveugle à la typographie** : un label 12 px light et un titre 32 px bold obtiennent le même score.
- **Surévalue les couleurs sombres** : la constante 0.05 (flare) écrase les écarts dans les basses lumières. Une paire à 4.5:1 en mode sombre peut être quasi illisible.
- **Suppose sRGB** : rien n'est prévu pour P3.

Malgré ça : **c'est la norme légale.** RGAA en France, EAA au niveau européen, ADA/Section 508 aux US s'appuient tous sur WCAG 2.x. Ton outil doit traiter WCAG 2 comme **la porte de conformité**.

### 3.3 APCA — à intégrer, mais correctement positionné

APCA (Advanced Perceptual Contrast Algorithm) corrige les défauts ci-dessus : score Lc sur une échelle ~0–106, sensible à la polarité, à la taille et à la graisse.

Seuils de référence :

| Lc | Signification |
|---|---|
| 15 | Minimum absolu pour un élément non textuel |
| 30 | Minimum absolu pour du texte (désactivé, filigrane) |
| 45 | Grand texte / gros titres (équivalent approximatif du 3:1) |
| 60 | Texte courant (équivalent approximatif du 4.5:1) |
| 75 | Niveau préféré pour du corps de texte |
| 90 | Texte fin ou petit corps |

**Statut normatif — c'est le point à ne pas rater :** <cite index="1-1">APCA n'a jamais dépassé le stade exploratoire et a été retiré du working draft de WCAG 3 en juillet 2023, faute de soutien du groupe de travail.</cite> <cite index="3-1">En 2026, le draft indique toujours que l'algorithme de contraste de WCAG 3 reste à déterminer.</cite> <cite index="5-1">WCAG 3 est encore à des années de sa publication finale, 2030 étant une cible optimiste.</cite>

**Conséquence pour ton architecture :**

```
WCAG 2.2  →  verrou de conformité. Bloquant. C'est ce qui protège juridiquement ton client.
APCA      →  signal qualité. Informatif. Détecte les paires « conformes mais moches ».
```

Une paire qui passe WCAG 2 mais échoue APCA = alerte « techniquement conforme, perceptuellement faible ». Une paire qui passe APCA mais échoue WCAG 2 = **refus**. C'est la posture recommandée par les praticiens accessibilité et c'est celle qui te met à l'abri.

Argument commercial utile : <cite index="3-1">le rapport WebAIM Million 2026 relève des échecs de contraste WCAG 2 sur 83,9 % du million de pages d'accueil les plus visitées, en hausse par rapport aux 79,1 % de l'année précédente, avec une moyenne de 34 occurrences de contraste insuffisant par page.</cite>

### 3.4 Déficiences de vision des couleurs (CVD)

Prévalence : environ 8 % des hommes et 0,5 % des femmes d'origine nord-européenne.

Simulations à implémenter (matrices de **Machado, Oliveira & Fernandes 2009**, plus fidèles que Brettel/Viénot pour les formes légères) :

| Type | Description | Sévérité à simuler |
|---|---|---|
| Deutéranomalie / deutéranopie | Cônes M — la plus fréquente | 0 à 100 % |
| Protanomalie / protanopie | Cônes L — assombrit fortement les rouges | 0 à 100 % |
| Tritanomalie / tritanopie | Cônes S — rare | 0 à 100 % |
| Achromatopsie | Vision monochrome | binaire |

**Piège classique :** simuler à 100 % uniquement. Les formes partielles (anomalies) sont bien plus fréquentes que les dichromaties complètes. Prévoir un curseur de sévérité.

**Test décisif à automatiser :** après simulation, recalculer le ΔE00 entre toutes les paires de la palette. Si deux couleurs sémantiquement opposées (succès / erreur) tombent sous ΔE00 = 10 en deutéranopie, **c'est un échec bloquant**, indépendamment du contraste.

### 3.5 Ce que la matrice de contraste doit couvrir

Ne pas se limiter à « texte sur fond ». Générer une matrice N×N typée :

| Type de paire | Seuil AA | Seuil AAA |
|---|---|---|
| Texte courant / fond | 4.5:1 | 7:1 |
| Grand texte / fond | 3:1 | 4.5:1 |
| Icône, bordure de champ, composant / fond | 3:1 | — |
| Anneau de focus / fond adjacent | 3:1 | — |
| État désactivé | exempté (mais signaler) | — |
| Fond / fond (séparation de surfaces) | pas de norme — viser 1.2:1 min. pour la lisibilité des cartes | — |
| Séries de data-viz entre elles | pas de norme — viser ΔE00 ≥ 10 + distinguabilité CVD | — |

Et systématiquement en **double : mode clair et mode sombre**. Une inversion naïve de rampe casse toujours quelque chose.

---

<a name="4"></a>
## 4. Harmonie et complémentarité : dépasser la roue d'Itten

### 4.1 Les schémas classiques, et pourquoi ils sont insuffisants seuls

| Schéma | Construction | Usage réel |
|---|---|---|
| Monochrome | 1 teinte, variations L/C | Sobre, sûr, risque de fadeur |
| Analogue | ±15 à 45° | Cohérent, naturel, faible hiérarchie |
| Complémentaire | +180° | Contraste max, risque de vibration si chroma élevé des deux côtés |
| Complémentaire divisé | +150° / +210° | Le meilleur rapport tension/confort |
| Triadique | +120° / +240° | Vivant, difficile à équilibrer |
| Tétradique / carré | +90° incréments | Riche, exige une hiérarchie forte |
| Complémentaire double | 2 paires | Rarement maîtrisable sans dominante nette |

**Le piège majeur :** ces schémas viennent de la roue **RYB** (rouge-jaune-bleu, modèle pigmentaire d'Itten). Le complémentaire « artistique » du rouge est le vert ; le complémentaire **RGB** du rouge (#FF0000) est le cyan (#00FFFF). Ce ne sont pas les mêmes couleurs, et la plupart des outils confondent les deux silencieusement.

**Décision de conception :** implémenter **les deux roues**, explicitement étiquetées, avec une table de conversion RYB↔teinte OKLCH. L'utilisateur choisit son référentiel. C'est un différenciant fort auprès des graphistes formés à Itten, et personne ne le fait proprement.

### 4.2 Harmonie perceptuelle : les vraies règles opérationnelles

Les schémas donnent des *teintes*. L'harmonie vient de ce qu'on fait de la **lightness** et du **chroma**. Règles à coder comme contraintes :

1. **Isoluminance = danger.** Deux couleurs de même L OKLCH côte à côte vibrent et sont illisibles en niveaux de gris. Imposer un écart de L minimum entre couleurs adjacentes dans la composition.
2. **Chroma décroissant avec le rôle.** Marque (chroma haut) > accent (moyen) > surfaces (très bas) > neutres (proche de 0). Une palette où tout est saturé n'a pas de hiérarchie.
3. **Neutres teintés.** Les gris purs (C=0) sont morts. Injecter 0,005 à 0,02 de chroma sur la teinte de marque → cohérence immédiate. Paramètre : « influence de la marque sur les neutres, 0–100 % ».
4. **Torsion de teinte sur les rampes.** Dérive de 3 à 15° entre l'extrémité claire et l'extrémité sombre. Chaud vers le clair = ambiance solaire/vintage ; froid vers le sombre = profondeur.
5. **Règle 60-30-10.** Dominante / secondaire / accent. À utiliser comme *contrôle de surface*, pas comme règle de sélection : c'est une répartition d'aire, pas de palette.
6. **Test niveaux de gris systématique.** Si la palette ne fonctionne pas en N&B, elle ne fonctionne pas. Vaut pour le web comme pour la photocopie du flyer.

### 4.3 Sur le « score d'harmonie » — un avertissement

Il existe des modèles quantitatifs (Moon & Spencer, Ou & Luo, Matsuda). **Ne cherche pas à noter la beauté.** C'est culturellement situé, mal validé, et ça donnera à l'outil un air de gadget.

**À la place : un score de contraintes**, entièrement explicable, où chaque point retiré est justifié par une règle nommée.

```
Score = Σ pénalités sur :
  · violations de contraste (bloquant)
  · collisions CVD (bloquant)
  · isoluminance entre couleurs voisines
  · chroma hors gamut sur le support cible
  · déséquilibre de répartition L (trous dans la rampe)
  · dépassement du taux d'encrage cible
  · distinguabilité catégorielle insuffisante
```

Chaque pénalité affiche sa règle et son remède. C'est auditable, défendable devant un client, et ça reflète ta posture pédagogique.

### 4.4 Taxonomie des rôles — la vraie sortie de l'outil

Une palette utile n'est pas une liste de 5 couleurs. C'est un système de **rôles** :

```
MARQUE
  primary, secondary, accent  → chacun avec rampe 50→950
SURFACES
  background, surface, surface-raised, surface-sunken, overlay
CONTENU (« on- »)
  on-background, on-surface, on-primary, on-accent
  text-primary, text-secondary, text-muted, text-disabled
STRUCTURE
  border-subtle, border-default, border-strong, divider
INTERACTION
  focus-ring, hover, active, selected, visited
SÉMANTIQUE  (chacun ×3 : surface / bordure / contenu)
  success, warning, error, info
DATA-VIZ
  categorical[8], sequential[9], diverging[11]
```

Chaque rôle est un *token*, pas une couleur figée : il pointe vers un pas de rampe, et bascule automatiquement en mode sombre.

### 4.5 Data-viz : règles spécifiques

- **Catégorielle** : maximum 8 séries distinguables. Au-delà, changer de forme d'encodage. Référence à intégrer comme preset : **Okabe-Ito** (sûre pour toutes les CVD) — `#000000`, `#E69F00`, `#56B4E9`, `#009E73`, `#F0E442`, `#0072B2`, `#D55E00`, `#CC79A7`.
- **Séquentielle** : lightness strictement monotone, chroma croissant ou constant. Générable directement en OKLCH.
- **Divergente** : deux rampes séquentielles, point neutre au milieu, **lightness symétrique** de part et d'autre.
- Presets à proposer : ColorBrewer, viridis, cividis (conçue pour la deutéranopie).

---

<a name="5"></a>
## 5. Le module print : là où 95 % des outils s'arrêtent

C'est ta zone d'avantage la plus défendable. Aucun générateur de palette grand public ne fait ça.

### 5.1 Conversion RVB → CMJN : ce qu'il faut faire correctement

Une conversion « formule » (`K = 1 - max(R,G,B)` etc.) est **fausse et inutilisable en production**. Il faut un vrai moteur ICC avec :

- **Profil source** : sRGB IEC61966-2.1, ou Display P3.
- **Profil destination** : selon le procédé et le papier (voir table §5.3).
- **Intention de rendu** :

| Intention | Quand | Comportement |
|---|---|---|
| Perceptuelle | Images, photos | Comprime tout le gamut, préserve les relations, décale même les couleurs in-gamut |
| **Colorimétrique relative + compensation du point noir** | **Couleurs de marque, aplats** | Conserve les couleurs in-gamut, ramène les hors-gamut au plus proche. **Défaut de l'outil.** |
| Saturation | Graphiques, infographies | Privilégie la vivacité sur la fidélité |
| Colorimétrique absolue | Épreuvage, simulation de blanc papier | Simule le blanc du support — **utile pour ton mode « papier recyclé »** |

### 5.2 Taux d'encrage total (TAC / TIL) — l'indicateur critique

Le TAC = somme C + M + J + N sur un point donné. Un aplat 100/100/100/100 = 400 %, ce qui est ininprimable.

| Procédé / support | TAC max typique | Profil ICC de référence |
|---|---|---|
| Offset feuille, couché | 300–330 % | PSO Coated v3 (FOGRA51) / ISO Coated v2 |
| Offset feuille, non couché | 280–300 % | PSO Uncoated v3 (FOGRA52) |
| Offset rotative (heatset) | 300 % | PSO LWC / Web Coated |
| Journal / papier recyclé fin | 220–240 % | ISOnewspaper26v4 |
| Numérique toner | 240–280 % | selon machine |
| Riso | 1 passe = 100 % max, 2–3 passes conseillées | pas de profil ICC standard |

**Règle absolue à intégrer dans l'outil :** *toujours faire confirmer le TAC et le profil par l'imprimeur*. Afficher le champ « profil fourni par l'imprimeur » et accepter un import `.icc`.

**Noirs à coder :**
- Noir texte / petits corps : **100 % N seul** (évite les défauts de repérage)
- Noir riche (aplats) : `60C 40M 40J 100N` ≈ 240 %, ou `40/30/30/100` ≈ 200 % en version éco
- Noir de repérage 100/100/100/100 : **jamais**, sauf traits de coupe

### 5.3 Simulation du substrat — la fonctionnalité signature

C'est ce qui te distingue vraiment, et c'est directement branché sur ton positionnement éco.

Un papier recyclé non couché n'est pas blanc : son point blanc peut être à L*≈88, b*≈+4 (jaunâtre) contre L*≈95, b*≈−2 pour un couché blanchi. Le gamut disponible s'effondre, l'engraissement (dot gain) écrase les demi-teintes.

**À implémenter :**
1. Bibliothèque de substrats : couché mat blanchi FSC, non couché blanchi, non couché naturel, recyclé 100 %, kraft, papier ensemencé, carton gris.
2. Chaque substrat = un point blanc L*a*b* + un profil ICC (ou une approximation calibrée).
3. Rendu de la palette **sur le blanc du substrat**, pas sur #FFFFFF. Le choc visuel est pédagogique et convainc les clients instantanément.
4. Alerte « cette couleur perd X en chroma sur ce papier », avec ΔE00 affiché.
5. Proposition automatique d'un **ton direct** quand la couleur de marque est irrécupérable en quadri sur ce support.

C'est exactement l'arbitrage identité visuelle / contraintes éco que ta méthode identifie comme point faible — l'outil le résout visuellement.

### 5.4 Tons directs, riso, et le sujet juridique Pantone

**Attention réelle :** Pantone, RAL, NCS sont des **marques déposées avec des bibliothèques de couleurs protégées**. Publier ou redistribuer les valeurs Lab/hex des nuanciers Pantone dans un outil, même gratuit, t'expose. Adobe a d'ailleurs retiré le support natif Pantone de ses applications pour des raisons de licence.

**Approche sûre :**
- L'utilisateur **saisit** une référence Pantone qu'il possède (texte libre + valeur Lab qu'il lit sur son nuancier). L'outil ne fournit pas la base.
- Traiter les tons directs de façon **abstraite** : « ton direct #1, Lab = … », avec simulation d'aplat, de trame et de surimpression.
- Pour la riso : les nuanciers d'encres Riso sont largement publiés par les ateliers et beaucoup plus libres. Constituer une bibliothèque riso maison (Fluo Pink, Bright Red, Aqua, Federal Blue, Green, Yellow, Sunflower, Burgundy…) avec **simulation de surimpression en mode Multiply** et gestion 1/2/3 passes.

La riso mérite un mode dédié : c'est un procédé structurellement éco (encre soja, pas de chauffe, tirage court), très aligné avec ton discours, et aucun outil ne le supporte.

### 5.5 Ce que le module print doit sortir

- Valeurs CMJN par couleur, sur le profil choisi
- TAC par couleur + TAC moyen de la palette
- ΔE00 écran ↔ papier, avec code couleur d'alerte
- Aperçu sur blanc de substrat
- Recommandation ton direct / quadri
- Fiche de production PDF pour l'imprimeur

---

<a name="6"></a>
## 6. Éco-couleurs : deux logiques distinctes à ne pas mélanger

C'est le cœur du différenciant. Attention : **print et web n'ont rien à voir**, et confondre les deux serait exactement le raccourci que tu reproches au greenwashing.

### 6.1 Axe print — le taux d'encrage

Le levier est direct et quantifiable.

**Objectifs par zone (méthode éco-encrage) :**

| Zone | TAC max recommandé |
|---|---|
| Face avant / zone principale | 200 % |
| Faces secondaires | 150 % |
| Zones techniques / verso | 50 % |
| Parties non visibles après pliage | 0 % |

**Calcul d'impact à intégrer :**

```
Surface support × (TAC / 100)        = surface d'encre
× charge d'encre au m² selon procédé = poids d'encre
× tirage                             = poids total
× 3,13                               = kg CO₂ évités

1 kg d'encre économisée = 3,13 kg CO₂ = 28 km en voiture
Charge offset : 1–1,5 g/m² (couché brillant) → 1,6–2,4 g/m² (non couché)
```

**Leviers que l'outil doit proposer automatiquement quand le TAC dépasse la cible :**
- Aplat quadri dense → ton direct (plafond 100 %)
- Noir 100 % → noir à 85 % (≈ 50 % d'encre en moins, imperceptible)
- Aplat plein → trame à 50 % ou dégradé ouvert
- Bandeau de couleur → filet
- Réserve blanche exploitée comme couleur à part entière

**Ne pas oublier la fin de vie :** les encres très couvrantes, les encres UV et les aplats sombres dégradent la **désencrabilité** du papier (méthode INGEDE 11). Une palette claire n'est pas seulement moins encrée, elle est plus recyclable. Argument à ajouter dans la doc client.

### 6.2 Axe web — l'énergie écran

Beaucoup plus nuancé, et c'est là qu'il faut être rigoureusement honnête.

**Ce qui est établi :**
- <cite index="20-1">Les dalles OLED pilotent chaque pixel individuellement : la puissance dépend de la luminance moyenne affichée, et un contenu très sombre consomme moins.</cite> <cite index="17-1">Sur les écrans LCD, le rétroéclairage reste allumé quel que soit le contenu : l'économie est nulle.</cite>
- <cite index="18-1">Une étude Purdue mesure une économie de 3 à 9 % en luminosité automatique, et jusqu'à 47 % à 100 % de luminosité.</cite>
- Le bleu est le sous-pixel le moins efficace énergétiquement sur OLED, le vert le plus efficace. Une même luminance perçue coûte donc plus cher en bleu saturé.

**Ce qu'il ne faut PAS faire :**
- Annoncer un chiffre unique d'économie. Le résultat dépend de la dalle, de la luminosité système, du contenu, du fabricant.
- Pousser le mode sombre comme un absolu : il dégrade la lisibilité pour certains profils (astigmatisme, halation).

**Ce que l'outil doit faire :** un **indice relatif de coût énergétique**, jamais une valeur absolue.

```
Coût_relatif = Σ (aire_estimée_du_rôle × poids_énergétique_couleur)
poids_énergétique ≈ f(R, G, B) pondéré par l'efficacité des sous-pixels OLED
Affiché en base 100 (palette de référence = 100), jamais en Wh ou en gCO₂.
Toujours accompagné de : « valable sur dalle OLED uniquement ».
```

Combiné avec ta méthode : moins de couleurs distinctes = moins de poids sur les SVG et PNG indexés ; aplats plutôt que dégradés = meilleure compression ; palette limitée = CSS plus court.

### 6.3 L'éco-score : le concevoir sans greenwasher

**Règles de conception non négociables :**

1. **Aucun score composite unique.** Deux indicateurs séparés — encrage (print) et énergie relative (web) — jamais additionnés.
2. **Toute pondération est affichée et modifiable.**
3. **Toute hypothèse est nommée** : procédé, papier, tirage, type de dalle.
4. **L'incertitude est affichée**, pas gommée.
5. **Aucun vocabulaire non prouvable** : pas de « palette verte », pas de « couleur durable », pas de feuille verte. On dit « –38 points de TAC vs la version initiale », c'est tout.

Cette rigueur est vendable : c'est précisément ce que les recommandations ARPP et le guide DGCCRF sur les allégations environnementales exigent. Ton outil devient un outil de conformité, pas de communication.

---

<a name="7"></a>
## 7. Spécification fonctionnelle par modules

### 7.1 Vue d'ensemble du pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  M0  BRIEF / CONTEXTE                                           │
│      usage → support(s) → durée de vie → cibles                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  M1  INGESTION                                                  │
│      hex · OKLCH · CMJN · extraction image · réf. ton direct     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  M2  MOTEUR COLORIMÉTRIQUE  (cœur — OKLCH pivot)                │
│      conversions · gamut mapping · ΔE · plafonds de chroma       │
└──────┬─────────────┬─────────────┬─────────────┬────────────────┘
       ▼             ▼             ▼             ▼
   ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │M3      │  │M4        │  │M5        │  │M6        │
   │RAMPES  │  │HARMONIE  │  │CONTRASTE │  │PRINT     │
   │50→950  │  │roues     │  │WCAG+APCA │  │CMJN/TAC  │
   │        │  │RYB/RGB   │  │+CVD      │  │substrat  │
   └────┬───┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
        └───────────┴─────────────┴─────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  M7  MOTEUR ÉCO   encrage (print) │ énergie relative (web)       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  M8  ATTRIBUTION SÉMANTIQUE  rôles → tokens · clair/sombre       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  M9  EXPORTS   CSS · Tailwind · Figma · ASE · DTCG · PDF client  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Détail des modules

**M0 — Brief / contexte** *(applique ta règle d'or : partir de l'usage, jamais du support)*
- Supports cibles : web / print / les deux
- Si print : procédé, papier, tirage, format, durée de vie prévue
- Si web : mode clair / sombre / les deux, niveau d'accessibilité visé (AA ou AAA)
- Contraintes de marque : couleurs imposées, tons directs existants
- **Sortie :** un objet `context` qui pilote les contraintes de tous les modules en aval

**M1 — Ingestion**
- Saisie hex / OKLCH / RVB / CMJN + profil
- Extraction depuis image : k-means en **OKLab** (pas en RGB — c'est ce qui donne les extractions moches partout ailleurs), avec pondération par aire
- Import d'un `.ase` / `.aco` existant
- Import d'un profil `.icc`

**M2 — Moteur colorimétrique**
- Toutes conversions via OKLCH
- `maxChroma(L, H, gamut)` par dichotomie
- `gamutMap(color, gamut)` selon l'algo CSS Color 4
- `deltaE00(a, b)` et `deltaEOK(a, b)`
- Détection out-of-gamut sRGB / P3 / CMJN

**M3 — Générateur de rampes**
- 8 / 10 / 12 / 14 / 16 pas configurables
- Courbe de lightness paramétrable (linéaire, ease-in, ease-out, courbe de Bézier éditable)
- Courbe de chroma : « bump » central paramétrable (chroma max au milieu, atténué aux extrêmes)
- Torsion de teinte : dérive en degrés entre les deux extrémités
- **Mode inversé (approche Leonardo) : « génère-moi le pas qui atteint exactement 4.5:1 sur ce fond »** — c'est le mode le plus puissant et le plus rare
- Génération des neutres teintés (curseur d'influence de la marque 0–100 %)

**M4 — Moteur d'harmonie**
- Roue RYB **et** roue RGB, commutables
- Schémas classiques + décalage manuel
- Contraintes perceptuelles (écart de L min, chroma décroissant par rôle)
- Score de contraintes explicable (§4.3)

**M5 — Moteur de contraste**
- Matrice N×N typée par usage (§3.5)
- WCAG 2.2 (bloquant) + APCA (informatif)
- Simulation CVD × 4 types × curseur de sévérité
- Test niveaux de gris
- Test de distinguabilité catégorielle (ΔE00 avant et après simulation CVD)
- Vérification 1.4.1 : liste des couleurs porteuses de sens seules → checklist manuelle

**M6 — Moteur print** *(voir §5)*

**M7 — Moteur éco** *(voir §6)*

**M8 — Attribution sémantique**
- Mapping automatique rôle → pas de rampe, avec correction manuelle
- Génération du thème sombre par transformation de rampe (pas par inversion naïve)
- Vérification que tous les tokens passent leurs seuils dans les deux thèmes

**M9 — Exports**

| Format | Cible |
|---|---|
| Variables CSS (`oklch()` + fallback hex) | Intégration WordPress / GeneratePress |
| Tailwind v4 (`@theme`, OKLCH natif) | Projets front |
| `theme.json` WordPress | Sites clients |
| Variables Figma (JSON plugin) | Maquettage |
| `.ase` / `.aco` | Illustrator / InDesign / Photoshop |
| Design Tokens W3C (DTCG) | Interop |
| **PDF de charte chromatique** | **Livrable client — le vrai produit** |
| Fiche production imprimeur | Prépresse |

Le PDF client est le plus stratégique : nuancier, rôles, valeurs web + print, rapport d'accessibilité, indicateurs éco avec hypothèses. C'est ce que tu joins à une propale, et c'est ce qu'aucun concurrent ne produit.

---

<a name="8"></a>
## 8. Architecture technique et choix de librairies

### 8.1 Principe : tout le calcul côté client

Toute la colorimétrie est du calcul pur, léger, sans données sensibles. **Aucun backend nécessaire pour le moteur.** Ça donne une app instantanée, offline-capable, et quasi gratuite à héberger.

```
┌──────────────────────────────────────────────────┐
│  SPA statique  (Vite + Svelte ou React)          │
│  ├── moteur colorimétrique (TypeScript pur)      │
│  ├── Web Worker : matrices N×N, gamut mapping    │
│  └── WASM : moteur ICC (lcms2) pour le CMJN      │
└───────────────┬──────────────────────────────────┘
                │  (uniquement pour la persistance)
                ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare Workers                              │
│  ├── KV   : palettes sauvegardées, liens partagés│
│  ├── R2   : profils ICC, exports PDF             │
│  └── Worker : génération PDF, API projets        │
└──────────────────────────────────────────────────┘
```

C'est exactement ta stack existante (Workers + KV + R2), donc pas de coût d'apprentissage.

### 8.2 Librairies recommandées

| Besoin | Choix | Pourquoi |
|---|---|---|
| Conversions couleur | **culori** | Tree-shakeable, OKLCH/OKLab natif, ΔE2000 inclus, gamut mapping, très rapide |
| Alternative / vérification | **colorjs.io** | Plus complet et plus lent — utile pour valider culori en tests |
| APCA | **apca-w3** | Implémentation de référence, versionner explicitement (0.1.9) |
| Simulation CVD | matrices **Machado 2009** implémentées à la main | Les libs npm sont souvent des Viénot mal implémentées |
| Moteur ICC / CMJN | **lcms2 compilé en WASM** | Seule voie pour un vrai CMJN. Alternative : approximation + avertissement honnête |
| UI | **Svelte** | Léger, réactif, cohérent avec un discours éco-conception |
| Graphiques (rampes, courbes) | **D3** ciblé ou SVG maison | Éviter les usines à gaz |
| PDF | **WeasyPrint** côté Worker, ou `pdf-lib` client | Tu maîtrises déjà WeasyPrint |

**À bannir :** chroma.js (pas d'OKLCH natif propre), toute lib qui calcule en HSL.

### 8.3 Le point dur : le CMJN

C'est le seul vrai obstacle technique du projet. Trois options, par ordre de qualité :

1. **lcms2 en WASM** — conversion ICC exacte, intentions de rendu, TAC réel. ~300 ko de WASM. C'est la bonne réponse, et ça devient le verrou technique de ton outil.
2. **Tables de correspondance pré-calculées** — générer offline (via Python + littlecms) une LUT par profil, la charger en JSON. Léger, rapide, précis, mais figé sur les profils que tu embarques.
3. **Approximation analytique + avertissement** — acceptable pour une V0 seulement, avec un message clair « valeurs indicatives, non contractuelles ».

**Recommandation : option 2 pour la V2** (excellent rapport effort/qualité), option 1 si l'outil trouve son public.

### 8.4 Modèle de données

```json
{
  "version": "1.0",
  "meta": { "name": "", "client": "", "created": "", "author": "Seed to Bloom" },
  "context": {
    "targets": ["web", "print"],
    "print": { "process": "offset-sheetfed", "substrate": "uncoated-recycled-100",
               "iccProfile": "PSOuncoated_v3_FOGRA52", "tacLimit": 280,
               "runLength": 2000, "formatM2": 0.0625 },
    "web": { "themes": ["light", "dark"], "wcagTarget": "AA", "gamut": "srgb" }
  },
  "colors": [{
    "id": "primary",
    "source": { "space": "oklch", "l": 0.55, "c": 0.14, "h": 232 },
    "ramp": [{ "step": 50, "oklch": [0.97, 0.012, 232], "hex": "#f2f6fa" }],
    "print": { "cmyk": [78, 42, 12, 2], "tac": 134, "deltaE00": 3.1,
               "spotRecommended": false }
  }],
  "roles": { "background": "neutral.50", "text-primary": "neutral.900",
             "brand": "primary.500", "focus-ring": "primary.600" },
  "audit": {
    "wcag": { "pairsTested": 168, "failures": [], "level": "AA" },
    "apca": { "lowestLc": 62.4, "warnings": [] },
    "cvd": { "collisions": [] },
    "eco": { "avgTac": 118, "tacDelta": -42, "inkSavedKg": 0.34,
             "co2AvoidedKg": 1.06, "screenEnergyIndex": 87,
             "assumptions": ["offset feuille", "1,8 g/m²", "tirage 2000"] }
  }
}
```

Ce schéma est le contrat entre tous les modules. Le figer tôt évite les refontes.

---

<a name="9"></a>
## 9. Roadmap par étapes

Chaque étape est **livrable et utile seule**. Pas de big bang.

### V0 — Le noyau qui ne ment pas *(≈ 3 jours)*
**But :** un moteur juste. Rien d'autre.
- Conversions hex ↔ OKLCH ↔ Lab ↔ P3 (culori)
- `maxChroma()` + gamut mapping CSS Color 4
- ΔE00 et ΔEOK
- Contraste WCAG 2.2 + statuts AA / AAA + APCA Lc
- Matrice de contraste N×N typée
- 4 simulations CVD avec curseur de sévérité
- UI minimale : saisir des couleurs, voir la matrice

**Recette V0 :** les ratios calculés correspondent exactement à WebAIM Contrast Checker sur 20 paires témoins ; les Lc correspondent à l'outil APCA de référence sur 20 paires ; les conversions OKLCH correspondent à oklch.com.

### V1 — Rampes et harmonie *(≈ 4 jours)*
- Générateur de rampes 8–16 pas, courbes L et C éditables, torsion de teinte
- **Mode inversé : « génère le pas qui atteint exactement le ratio X »**
- Neutres teintés
- Roues RYB + RGB, schémas classiques
- Score de contraintes explicable
- Attribution sémantique des rôles + génération du thème sombre
- Export CSS variables + Tailwind v4

**Recette V1 :** régénérer une rampe Radix ou Tailwind connue et obtenir un écart ΔE00 < 3 sur chaque pas.

### V2 — Print *(≈ 5 jours)*
- LUT CMJN pré-calculées pour 4–5 profils
- Calcul TAC par couleur et moyen
- ΔE00 écran ↔ papier + alertes
- Bibliothèque de substrats + rendu sur blanc papier
- Recommandation ton direct / quadri
- Mode riso avec surimpression multiply
- Export `.ase` + fiche production

**Recette V2 :** commander une épreuve contractuelle chez ton imprimeur habituel sur une palette test, et comparer au ΔE00 annoncé. C'est le seul vrai test.

### V3 — Éco *(≈ 3 jours)*
- Calcul d'encrage + conversion CO₂ avec hypothèses affichées
- Leviers de réduction proposés automatiquement
- Indice relatif d'énergie écran
- Comparateur avant / après avec écart chiffré

**Recette V3 :** sur un support réel déjà produit, retrouver un taux d'encrage cohérent avec l'aperçu des séparations d'InDesign (±5 points).

### V4 — Livrable client *(≈ 4 jours)*
- PDF de charte chromatique complet (nuancier, rôles, valeurs web + print, rapport a11y, indicateurs éco)
- Sauvegarde des palettes (Workers + KV)
- Lien de partage client en lecture seule
- Prévisualisation en contexte : maquette de page, maquette d'imprimé

### V5 — Ce qui fait revenir *(optionnel)*
- Extraction depuis moodboard / photo (k-means OKLab)
- Import d'une palette existante → audit complet en un clic (**c'est un excellent produit d'appel commercial** : « envoyez-moi vos couleurs, je vous renvoie l'audit »)
- Branchement sur le Bloom Portal : palette attachée à un projet client
- Assistant conversationnel : traduire un brief en contraintes de palette

---

<a name="10"></a>
## 10. Pièges, risques et protocole de validation

### 10.1 Pièges de conception

| Piège | Conséquence | Parade |
|---|---|---|
| Calculer en HSL « pour aller vite » | Toutes les rampes dérivent | OKLCH partout, dès la V0 |
| Rampe à chroma constant | Impossible, sortie de gamut sur les extrêmes | Courbe de chroma calculée par dichotomie |
| Inverser la rampe pour le mode sombre | Contrastes cassés, couleurs boueuses | Transformation dédiée + re-vérification complète |
| Ne tester que les paires texte/fond | Bordures et anneaux de focus non conformes | Matrice typée par usage |
| Simuler le daltonisme à 100 % seulement | On rate les formes légères, plus fréquentes | Curseur de sévérité |
| Score de beauté | Gadget, non défendable | Score de contraintes explicable |
| Conversion CMJN par formule | Valeurs fausses, client déçu à l'impression | ICC ou LUT, sinon avertissement explicite |
| Score éco unique et absolu | Greenwashing | Deux indicateurs séparés, hypothèses affichées |
| Aperçu sur fond blanc pur pour le print | Illusion, choc à la livraison | Rendu sur blanc de substrat |

### 10.2 Risque juridique

- **Pantone / RAL / NCS** : ne jamais embarquer les bibliothèques. Saisie utilisateur uniquement.
- **Accessibilité** : ne jamais présenter APCA comme une conformité. Formuler « conforme WCAG 2.2 niveau AA » et rien d'autre. Ajouter une mention « l'outil vérifie les critères liés à la couleur ; il ne constitue pas un audit d'accessibilité complet ».
- **Allégations environnementales** : les chiffres doivent toujours être accompagnés de leur périmètre et de leurs hypothèses (cf. recommandations ARPP et guide DGCCRF).

### 10.3 Protocole de validation

| Module | Référence de vérité |
|---|---|
| Conversions | oklch.com, colorjs.io |
| WCAG 2 | WebAIM Contrast Checker (20 paires témoins) |
| APCA | outil APCA de référence, version épinglée |
| CVD | Coblis, et un preset Okabe-Ito qui doit passer tous les tests |
| Rampes | reproduire Radix Colors et Tailwind, ΔE00 < 3 par pas |
| CMJN / TAC | Aperçu des séparations InDesign + épreuve contractuelle imprimeur |
| Encrage | Recalcul manuel sur un support déjà produit |

Écrire ces tests **avant** le code de chaque module. C'est ce qui distingue un outil professionnel d'un joli prototype.

---

<a name="11"></a>
## 11. Annexes

### A. Seuils WCAG 2.2 — récapitulatif

| Contenu | AA | AAA |
|---|---|---|
| Texte < 18 pt (24 px) normal, ou < 14 pt (18,66 px) gras | 4.5:1 | 7:1 |
| Texte ≥ 18 pt normal ou ≥ 14 pt gras | 3:1 | 4.5:1 |
| Composants d'interface et éléments graphiques signifiants | 3:1 | — |
| Éléments désactivés, logotypes, décoratif | exempté | exempté |

**Rappel : le niveau A ne contient aucun critère de ratio de contraste** (SC 1.4.1 « Utilisation de la couleur » est de niveau A mais porte sur la non-dépendance à la couleur).

### B. Seuils APCA (Lc)

| Lc | Usage |
|---|---|
| 15 | Minimum non textuel |
| 30 | Minimum absolu pour du texte |
| 45 | Grand texte |
| 60 | Texte courant |
| 75 | Corps de texte, niveau préféré |
| 90 | Texte fin ou petit corps |

Le signe de Lc indique la polarité (positif = texte sombre sur fond clair).

### C. Palette Okabe-Ito (sûre pour toutes les CVD)

`#000000` · `#E69F00` · `#56B4E9` · `#009E73` · `#F0E442` · `#0072B2` · `#D55E00` · `#CC79A7`

### D. TAC de référence

| Support | TAC max |
|---|---|
| Offset couché feuille | 300–330 % |
| Offset non couché feuille | 280–300 % |
| Rotative heatset | 300 % |
| Journal / recyclé fin | 220–240 % |
| Numérique toner | 240–280 % |

Objectifs éco-encrage : 200 % face avant · 150 % faces secondaires · 50 % zones techniques · 0 % zones non visibles.

### E. Formule d'impact encre

```
Surface × (TAC/100) × charge_g_m2 × tirage = poids d'encre (g)
poids (kg) × 3,13 = kg CO₂ évités
Charge offset : 1–1,5 g/m² (couché brillant) · 1,6–2,4 g/m² (non couché)
```

### F. Ressources techniques

- **culori** — https://culorijs.org
- **colorjs.io** — https://colorjs.io
- **apca-w3** — npm, versionner explicitement
- **CSS Color Module Level 4** — algorithme de gamut mapping normatif
- **Machado, Oliveira & Fernandes (2009)** — matrices CVD
- **Okabe & Ito** — palette CVD-safe
- **ColorBrewer, viridis, cividis** — rampes data-viz
- **ECI.org** — profils ICC européens libres
- **INGEDE Method 11** — désencrabilité
- **ARPP / DGCCRF** — allégations environnementales

---

*Document de conception — Seed to Bloom · à faire évoluer au fil des versions de l'outil.*
