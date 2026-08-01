# NOTES — Nuancier

Journal de décisions du projet. Objectif : pouvoir reprendre le travail dans
trois mois sans redécouvrir les arbitrages.

---

## Infrastructure Cloudflare — front + back (2026-08-01)

Demandé par Cindy en avance de phase (la persistance était prévue en
Phase 4) : l'outil est désormais déployable sur sa stack Cloudflare.
**Précision de Cindy : tout se fait à la main via le dashboard, sans
wrangler** → le chemin principal est Cloudflare Pages + Git.

### Décisions

- **Chemin principal : Pages + dossier `functions/`** (déploiement 100 %
  dashboard : connexion du dépôt GitHub, build `npm run build` → `dist`,
  binding KV `NUANCIER_KV` ajouté dans Settings → Bindings). Le fallback
  SPA de Pages est natif (pas de 404.html) et les Functions ne captent
  que `/api/*` (routage par fichiers).
- **La logique d'API vit dans `shared/api.ts`** (validation, sauvegarde,
  lecture) ; `functions/` (Pages) et `worker/` (variante wrangler,
  conservée en option) ne sont que des enrobages de la même
  implémentation — pas de double maintenance de la logique.
- Les Functions répondent 503 avec un message explicite si le binding KV
  n'est pas configuré : le site reste utilisable, seul le partage est
  indisponible.
- Vérifié en local en simulant Pages (`wrangler pages dev dist --kv`,
  outil de vérification uniquement) : santé, POST/GET, 422, front, SPA.
- **Second choix de Cindy : le back en Worker créé depuis le template
  « Hello World » du dashboard.** Ajouts en conséquence :
  `worker/standalone.ts` (API seule + CORS ouvert, pas d'assets) bundlé
  par `npm run build:worker` en `worker-dashboard.js` — LE fichier unique
  à coller dans l'éditeur en ligne, commité pour être copiable depuis
  GitHub. Le front lit `VITE_API_BASE` (variable de build Pages) pour
  appeler le Worker sur son domaine workers.dev ; vide = appels relatifs
  (Pages Functions ou Worker routé sur le même domaine). CORS en `*` :
  données non sensibles, pas de session. Point de vigilance documenté :
  le fichier collé ne se met pas à jour tout seul, il faut recoller après
  chaque évolution de l'API (README, section « Mise à jour du back »).
- **Lisibilité du dépôt demandée par Cindy** : arborescence FRONT/BACK
  annotée en tête de README + un mini README par dossier — GitHub les
  affiche en naviguant dans les dossiers.
- **Renommage littéral demandé par Cindy** : `src/` → `front/`,
  `worker/` + `shared/` → `back/` (la logique d'API et ses deux enrobages
  vivent ensemble). Seule exception : `functions/` garde son nom, imposé
  par la convention Cloudflare Pages (documenté dans son README et dans
  l'arborescence). Chemins mis à jour partout (index.html, tsconfig,
  vite/vitest, wrangler.jsonc, imports des functions).
- **Précision suivante de Cindy : ce sont les fichiers à copier-coller
  qui doivent s'appeler front et back.** → deux fichiers à la racine :
  - **`back.js`** (ex back-a-coller.js) : l'API, à coller dans le Worker
    du back (`npm run build:back`).
  - **`front.js`** : NOUVEAU — l'application complète (HTML + CSS + JS du
    build Vite inlinés par `scripts/build-front-file.mjs`) servie par un
    Worker, à coller dans le Worker du front (`npm run build:front`).
    Les routes `/api/*` y sont relayées au back via un **service
    binding** nommé `BACK` (un clic dans le dashboard) : pas de CORS,
    pas de variable d'URL à configurer, les deux Workers suffisent.
    `npm run build:colle` régénère les deux.
  - Piège technique géré : `</script>` échappé dans le JS inliné
    (sinon le HTML se casse) ; vérifié en navigateur réel, zéro erreur.
  - Ce mode remplace VITE_API_BASE pour ce déploiement (la variable
    reste utile pour le mode Pages + Worker séparé).
  - Testé : deux Workers wrangler dev reliés par service binding,
    parcours complet navigateur (app inlinée + partage + réouverture).

- **Un seul Worker** : le front (SPA Vite buildée dans `dist/`) est servi
  par les assets statiques de la plateforme (`not_found_handling:
  single-page-application`), le back (`worker/index.ts`) ne reçoit que
  `/api/*` grâce à `run_worker_first` — sans quoi le fallback SPA
  avalerait les routes d'API.
- **Le back ne fait que la persistance.** Le moteur reste 100 % client
  (interdit du brief : pas de backend pour le moteur). Endpoints :
  `GET /api/health`, `POST /api/palettes`, `GET /api/palettes/:id`.
- **On stocke la recette, pas la palette** : couleur de base + réglages
  (< 1 Ko), le front régénère à l'identique. Avantages : KV minuscule,
  liens pérennes même si le moteur s'améliore (versionné `version: 1`),
  et rien d'autre que des données validées en base — `validatePalette`
  rejette tout champ inconnu et borne toutes les valeurs (testé).
- **Identifiants** : 16 caractères base36 tirés de `crypto.getRandomValues`
  (~82 bits) — liens non devinables, pas d'énumération.
- **Pas de framework serveur** (Hono, etc.) : 3 routes, un `fetch` nu
  suffit ; zéro dépendance d'exécution ajoutée.
- **tsconfig séparé pour le worker** (types workers-types sans DOM),
  vérifié par `npm run check` ; validation testée par Vitest.
- Vérifié de bout en bout en local : `wrangler dev` (KV miniflare) +
  parcours navigateur complet (créer un lien → l'ouvrir → palette
  restaurée).

### Reste à faire au déploiement réel

- `wrangler kv namespace create NUANCIER_KV` puis coller l'id dans
  `wrangler.jsonc` (placeholder explicite en attendant).
- R2 (profils ICC, PDF) : prévu Phase 3/4, binding à ajouter le moment venu.
- Pas de limitation de débit sur `POST /api/palettes` pour l'instant —
  à ajouter si l'outil devient public (Turnstile ou rate limiting Workers).

---

## Phase 2 (partielle) — Parcours guidé et refonte visuelle (2026-08-01)

Demandé par Cindy : « un panel par étape, agréable à utiliser », avec des
captures d'un outil de référence en inspiration (« tu peux adapter »).

### Ce qui est repris de ses références, et comment c'est adapté

- Rail d'étapes à gauche (numéros, coches, étape courante marquée) ✔
- Panneau central par étape, une question à la fois ✔
- Colonne droite « Prochaine étape » + contexte vivant ✔
- Mini-bande de la palette dans l'en-tête ✔
- Adaptation à notre DA : interface quasi achromatique (l'outil de
  référence est violet/coloré — chez nous la seule couleur à l'écran est
  celle de l'utilisatrice), pas de « santé % » gamifiée mais le score de
  contraintes explicable, pas de conversions CMJN/Pantone « approximatives »
  (règles de justesse 7 et 9 du prompt : pas de CMJN par formule, pas de
  bibliothèque Pantone).

### Livré

- Parcours guidé en 6 étapes (prompt §3.1) : usage → départ (couleur /
  ambiance par correspondances documentées / surprise ; image « bientôt »)
  → couleur de base → construction (réglages expliqués + rampes en direct)
  → vérification (garanties mesurées + score déplié) → livraison (aperçus
  clair/sombre, exports, partage).
- **Bande d'épreuve** (première version de l'élément signature §3.4) :
  sticky en pied d'écran, la palette simultanément en trois états — écran,
  niveaux de gris, deutéranopie — mise à jour en direct. L'état « papier »
  arrive avec le module print (annoncé honnêtement dans la bande).
- État partagé guidé ↔ atelier (`front/lib/state.svelte.ts`) : on change
  de mode sans jamais perdre son travail (règle §3.2). Partage extrait en
  composant commun ; chargement `?p=` remonté dans App (ouvre l'atelier).
- Garde-fous d'honnêteté : les usages print/data-viz de l'étape 1
  annoncent que leurs vérifications spécifiques arrivent plus tard ; la
  garantie « Responsable » est affichée comme « à venir », aucun chiffre.

### Reste pour finir la Phase 2

- Aperçus en contexte complets (page web entière ; imprimés sur blanc
  papier en Phase 3), épreuves protan/tritan dans la bande, glossaire
  vivant dans l'interface, remèdes en un clic dans le parcours guidé,
  test réel « 3 minutes sans documentation » sur quelqu'un.

---

## Phase 2 — Étape Contraste refondue (§9.0) (2026-08-01)

« Le spécimen avant le chiffre » appliqué.

### Moteur (`contrast/fix.ts`, 11 tests)

- `corrigeParClarte()` : n'ajuste QUE le L d'OKLCH, choisit le
  déplacement le plus court des deux sens, annonce l'écart en points de
  clarté (« 8 points de clarté en moins suffisent — la teinte et
  l'intensité ne bougent pas »). Testé : teinte préservée à moins de 2°,
  intensité jamais augmentée, seuil réellement atteint.
- `evaluePaires()` : classe les paires pour permettre « une décision par
  écran ». Priorité aux échecs **réparables et proches du seuil** — une
  paire à 4,3:1 se corrige d'un rien, une paire à 1,2:1 n'a rien à faire
  ensemble. Testé.
- Les trois usages portent leur règle nommée, dont le **3:1 non textuel
  (SC 1.4.11)** traité en critère de premier plan.

### Écran

- LA paire à corriger, en **spécimen avant/après** : vrai titre, vrai
  paragraphe, vraies tailles (le grand texte s'affiche vraiment en grand),
  posés sur le blanc sans bordure ni ombre. Le ratio en grand dessous,
  le verdict porté par le signe ✓/✕ avant la couleur.
- La justification est une **note en italique sous les deux blocs**, pas
  une bulle d'aide.
- Le reste des échecs en **liste courte** cliquable.
- La matrice exhaustive passe en **second niveau**, derrière
  « voir les N associations ».
- L'épreuve en trois rangs (écran / gris / deutéranopie) vit ici, comme
  décidé — plus en permanence.
- Titres d'étape au registre du DS : casse phrase, un mot en italique,
  point final (« Chaque paire, *vérifiée*. »).

### Reste sur cette étape

- Panneau latéral droit « prochaine étape + condition d'accès » (présent
  dans le brief §7 et dans les références fournies) : pas encore fait.
- Correction multi-couleurs (quand aucune clarté ne suffit d'un seul
  côté) : l'écran le dit honnêtement mais ne propose pas de corriger le
  fond à la place.

---

## Phase 1 — Socle design Seed to bloom (2026-08-01)

Audit rendu (phase 0), puis socle design appliqué. Décisions de Cindy
intégrées : bande témoin commutable, réseaux sociaux en mise en situation.

### Fait

- `front/styles/colors_and_type.css` : tokens du DS, importé en tête de
  `app.css`. **Aucune valeur de couleur ou de fonte ailleurs** — les 11
  composants ont été migrés sur les tokens (vérifié par grep).
- Polices Typekit (`kww0ycw`) dans `index.html` ; familles déclarées avec
  replis. **Le kit refuse la lecture hors des domaines autorisés (403)** :
  les noms exacts des familles Adobe Fonts n'ont pas pu être vérifiés,
  les replis (Georgia / system-ui) protègent l'affichage. À confirmer en
  ligne.
- Monospace supprimée : `font-variant-numeric: tabular-nums` partout.
- Chrome Terre + Paille, étape active Glycine, canvas d'évaluation blanc
  sans carte encadrée (règle des deux zones).
- Rail vertical à gauche, numéros en Alegreya italique, verrouillage réel
  avec **condition d'accès affichée** (« il faut au moins 3 couleurs »)
  et non un simple grisé.
- **Bande témoin dans le header, commutable** (écran / niveaux de gris /
  deutéranopie) : un seul objet, trois lectures, cases accolées à 2px,
  cliquables. La bande d'épreuve permanente en pied est supprimée.
- Tutoiement dans toute l'interface et tous les textes du moteur.
- Test automatisé des contrastes du chrome (`engine/chrome.test.ts`).

### ⚠ Deux limites du DS relevées par ce test — à remonter

1. **`--ink-muted` (rgba(28,18,5,.52)) = 3,71:1 sur blanc.** Passe le
   grand texte et le non-textuel (3:1), **pas le texte courant (4,5:1)**.
   Le token n'a pas été modifié (il vient du DS) ; l'usage est restreint
   dans l'interface aux libellés secondaires, notes et valeurs doublées
   d'un signe. Un token `--ink-muted-aa` plus foncé résoudrait le sujet.
2. **`--conforme` et `--non-conforme` sont proches en niveaux de gris**
   (ΔE00 ≈ 2,9) et très proches en deutéranopie. Acceptable ici, et
   seulement ici, parce que la règle d'usage impose que le verdict se
   lise sans la couleur. Les deux tests verrouillent cette dépendance.

### Reste sur ce socle

- `colors_and_type.css` ne contient que les valeurs écrites dans le
  brief (§9.2/§9.3) : **le bundle complet des 88 variables n'a pas été
  fourni**. Le fichier porte l'en-tête demandé et un avertissement.
- Undo/redo et bascule clair/sombre du header : non faits.

---

## Étape Harmonie + score de santé (2026-08-01)

Suite du nouveau brief, dans l'ordre que j'ai proposé (les deux manques
les plus criants du parcours).

### Harmonie (`harmony/analysis.ts`, étape 2 du brief)

- **Détection du schéma dominant** avec niveau de confiance : on mesure
  les écarts de teinte au dominant (la couleur la plus chromatique) et on
  compare aux cinq modèles canoniques ; en dessous de 0,45 de confiance
  et au-delà de 45° d'étalement, le verdict est « libre » plutôt qu'un
  schéma inventé.
- **Fausses notes sur les trois axes** :
  - intensité : chroma > 2× la médiane du reste ;
  - clarté : plus de 1,9 écart-type du groupe ;
  - teinte : plus de 75° de sa plus proche voisine chromatique.
- **La correction ne touche QUE l'axe fautif** — c'est tout l'intérêt
  d'OKLCH, et c'est testé explicitement (teinte et clarté préservées à
  moins de 6° et 0,03 quand on corrige l'intensité).
- **Cohérence stricte du verdict** (exigence ⚠ du brief) : un seul
  verdict dérivé du calcul, testé impossible d'afficher « cohérent »
  quand des fausses notes existent, et score décroissant avec leur
  nombre.
- Régularité des écarts affichée sur les trois axes.

### Score de santé (`score.ts`, §8 du brief)

- Pondération exacte du brief : accessibilité 30 %, harmonie 20 %,
  complétude 20 %, équilibre 15 %, éco-encrage 15 %.
- **Calculé, jamais estimé** : un test vérifie que le total est
  exactement la somme pondérée des composantes — impossible qu'il
  contredise le détail.
- Chaque composante explique ce qu'elle mesure et **pointe vers l'étape**
  qui fait perdre des points ; le panneau du header y navigue au clic.
- Choix documenté : l'accessibilité ne compte que les « paires utiles »
  (couleurs de bandes de clarté différentes) — deux fonds clairs ne sont
  pas censés se porter l'un l'autre, les compter fausserait le score.
- 223 tests (14 nouveaux).

---

## Nouveau brief — arbitrages validés (2026-08-01)

Cindy a fourni un second brief, rédigé sans connaître le code existant.
Questions posées avant de coder (comme le demande son §11), réponses :

- **Stack** : le brief impose React + Tailwind + Zustand ; Cindy tranche
  que « le brief a tort, pas la base de code ». On garde **Svelte 5 +
  CSS natif**. Ses arguments (retenus) : le moteur est déjà en TS pur
  conforme à la règle d'architecture ; les runes donnent une réactivité
  à granularité fine adaptée à la matrice n² ; Tailwind ne peut pas
  générer de classes depuis des couleurs dynamiques, il faudrait de
  toute façon des custom properties — donc deux systèmes au lieu d'un.
- **Hébergement** : question écartée par Cindy (« ne prends pas en compte
  cette partie ») → on conserve le déploiement Cloudflare + partage KV.
- **Tons directs** : Cindy confirme qu'il n'existe pas de source à la fois
  libre, fiable et maintenue, et que sa propre section était bancale.
  → **aucune correspondance automatique en V1**. `print/spot.ts` fait
  deux choses exactes : (1) comparer la couleur écran à l'encre que la
  graphiste LIT sur son nuancier physique (référence + Lab saisis),
  avec ΔE00 et les quatre paliers d'interprétation du brief ; (2)
  détecter les couleurs de la palette **non distinguables en ton
  direct** — un simple ΔE entre deux couleurs, aucune donnée
  commerciale requise. C'est le contrôle le plus utile et il reste
  faisable sans nuancier.
- **Aléatoire** : retiré complètement (anti-objectif du brief). Remplacé
  par « J'ai une palette » — collage de hex pour valider/compléter une
  charte existante, qui est le vrai point d'entrée de la cible.

### Ajouté dans la foulée

- **Matrice croisée complète** restaurée dans l'étape Contraste (cœur de
  l'étape 3 du brief) : toutes les paires, avec le meilleur usage
  possible par paire (Tout / Texte / Titre / Non) et les associations à
  éviter entourées.
- Collisions ton direct affichées dans la même étape.
- 209 tests.

### Reste à traiter du nouveau brief

k-means OKLab depuis image · pipette EyeDropper · détection de schéma
dominant et de fausses notes · contrôle 60-30-10 · riso/sérigraphie ·
simulation papier avec engraissement · calcul CO₂ + garde-fou
greenwashing · DTCG/SCSS/ASE/PDF · localStorage + import/export JSON ·
undo/redo · noms français d'un mot · score de santé pondéré
(30/20/20/15/15).

---

## Parcours unique et outil de graphiste (2026-08-01)

Retours de Cindy : « il y en a de partout, je veux que ce soit par step le
tout » + une liste de manques (contraste par couleur avec textes, les
trois A, nuancier éditable, conseils clair/foncé/moyen, couleurs réseaux
sociaux, rôle de chaque couleur, print autant que web).

### Décisions

- **Un seul parcours, 10 étapes** : projet → départ → couleur →
  génération → nuancier → rôles → contraste → impression → réseaux →
  livraison. Les onglets « Atelier » et « Vérifier » sont SUPPRIMÉS
  (c'était la dispersion dénoncée) ; leurs fonctions sont réparties dans
  les étapes. L'étape Impression n'apparaît que si le projet est print ou
  identité complète.
- **Les trois niveaux, honnêtement** : AA et AAA sont calculés par paire
  et par usage (texte courant / grand texte / composant). Le **niveau A**
  est affiché comme ce qu'il est réellement (SC 1.4.1) : une question à
  cocher — « une information est-elle portée par la couleur seule ? » —
  avec son explication. Aucun ratio ne lui est associé nulle part
  (règle de justesse n°1 du prompt).
- **Nuancier éditable** (`analyze/coverage.ts`) : ajout/retrait/renommage,
  bandes de clarté clair (L ≥ 0,80) / moyen / foncé (L ≤ 0,45), conseils
  de manque avec couleur suggérée applicable en un clic, détection des
  doublons (ΔE00 < 5), alerte palette trop maigre (< 3) ou touffue (> 9).
- **Rôles déduits, pas déclarés** (`analyze/usage.ts`) : chaque couleur
  reçoit ses rôles depuis ses contrastes réels — le piège de la couleur
  moyenne (ni blanc ni noir lisible dessus) est nommé explicitement.
- **Print** (`print/cmyk.ts`) : estimation CMJN avec GCR partiel et
  respect du plafond d'encrage du procédé (comportement qualitatif d'un
  profil réel, bien meilleur que K = 1 − max(R,G,B)), TAC par couleur et
  moyen, conseils d'éco-encrage, aperçu sur le blanc du papier choisi
  (jamais #FFFFFF, règle n°8). **Double avertissement affiché** : valeurs
  indicatives non contractuelles, blancs de papier approchés — la vraie
  conversion ICC reste la Phase 3 (règle n°7 : approximation autorisée en
  V0 avec message clair).
- **Réseaux sociaux** (`harmony/social.ts`) : 5 couleurs d'extension
  dérivées de la marque, plus saturées (un post est vu petit, dans un flux
  criard), avec leur contraste sur fond de flux clair ET sombre, un usage
  décrit par couleur, et deux vignettes de post en situation.
- 200 tests (17 nouveaux sur ces modules).

---

## Refonte visuelle — épuré et visuel (2026-08-01)

Retour de Cindy : « encore plus joli, pas trop chiant à utiliser, épuré,
visuel surtout ». Refonte de l'interface guidée :

- **Structure allégée** : suppression du rail latéral et de la colonne
  droite (trop de texte simultané). À la place, une progression
  horizontale en points + une seule scène centrée (max 44 rem), posée sur
  un fond légèrement enfoncé avec ombre douce.
- **Moins de mots, plus de couleur** : les cartes de choix passent de
  paragraphes à titre + 3 mots ; les ambiances deviennent de grands
  aplats cliquables ; l'étape couleur affiche un pavé de 11 rem et la
  rampe en grand ; l'étape réglages montre les 8 rampes avant les
  curseurs ; l'étape contrôle passe en 4 pastilles de verdict + une
  barre de score. Les explications restent accessibles, repliées.
- **Avance au clic** : choisir un usage ou une ambiance passe
  directement à l'étape suivante (moins de « Continuer »).
- **Détail CSS** : boutons en pilule, curseurs redessinés (piste 3 px,
  pouce noir), rayons 10 px, bande d'épreuve en verre dépoli.
- Le fond de l'interface reste achromatique : la seule couleur affichée
  est celle de l'utilisatrice (règle de DA du brief).
- Vérifié en navigateur : parcours complet, zéro erreur JS, AAA conservé.

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
