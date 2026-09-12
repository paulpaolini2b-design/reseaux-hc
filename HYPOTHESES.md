# HYPOTHÈSES — Réseaux HC, lot 1

Décisions prises faute d'information dans le cahier des charges (v9) ou dans `nomenclature.json`. Chaque point est modifiable sans toucher au reste du code : la référence du fichier concerné est indiquée.

## Représentation graphique

| Réf. | Hypothèse | Fichier |
|---|---|---|
| H-01 | **État `a_reprendre`** (présent au modèle §12, absent de §8) : style de l'existant + symbole rempli à moitié gauche ; tronçon = trait de l'existant + liseré noir discontinu fin. Validé (1.a). | `charte.js` → `etats.a_reprendre`, `a_reprendre_troncon` ; `symboles.js` → `formeEtat` |
| H-02 | **Pose `facade`** : trait plein à la couleur de l'aérien, aucun tireté. Validé (2.a). | `charte.js` → `styleTroncon` |
| H-03 | **Postes à poser** : rectangle rouge à contour rouge, rempli **rouge** (et non noir) pour rester lisible et distinct des coffrets ; sigle en blanc. Postes existants : vide, sigle noir ; à déposer : hachuré, sigle sur cartouche blanc. | `charte.js` → `poste` ; `symboles.js` → `symbolePoste` |
| H-04 | **Dimensions des symboles** en unités plan (points PDF) : support béton D 6,4 × 3,6 pt (≈ 2,3 × 1,3 mm papier), coffret 8,5 × 6 pt, poste 13 × 8,5 pt, étiquette 3,2 pt. Un facteur global « taille des symboles » et « taille des textes » est réglable par plan (panneau Calques), plus une échelle par objet (fiche, Avancé). | `charte.js` |
| H-05 | **Hachures « à déposer »** : ponctuels hachurés à 45° pas 1,6 pt ; tronçons : petits traits noirs inclinés de 60° tous les 5 pt, par-dessus le style de l'existant. | `charte.js` → `etats.a_deposer.hachures`, `hachures_troncon` |
| H-06 | **Liseré des couleurs fluo** (#3DDC1E, #FF2D95) : trait sombre 0,7 pt plus large dessiné dessous. | `charte.js` → `lisere` |
| H-07 | **Support sans matériau connu** (posé au terrain sans précision) : cercle générique de rayon 2,6 pt avec point central ; il prend son symbole définitif dès que le matériau est renseigné. | `symboles.js` → `symboleSupportSimple` (default) |
| H-08 | **Contrefiche / hauban** : orientés par un angle propre (« sens du renforcement », 0° = vers le haut du symbole) en plus de la rotation de l'objet. Le **portique** (non décrit) est proposé : deux symboles reliés par une traverse. | `charte.js` → `renforcements` |
| H-09 | **Point lumineux** : petit cercle à 8 rayons ; **armoire EP** : rectangle à sigle (S17 par défaut). | `charte.js` → `eclairage` |
| H-10 | **Étiquette** : désignation (ou repère si vide), armement, matériel associé abrégé (3 lignes max, `+n`), fond blanc translucide, placée à droite du symbole à partir de son rayon ; déplaçable par poignée. Tronçons : étiquette au milieu de la polyligne. | `charte.js` → `texte` ; `symboles.js` → `primitivesEtiquette` |
| H-11 | **Légende** (exigée par §10.5 et le critère 7, placée en lot 2 par le tableau) : livrée en version simple lot 1 — un échantillon par style de tronçon et par type de symbole × état réellement utilisés, positionnable (glisser), redimensionnable (poignée), reprise à l'identique dans le PDF. Le récapitulatif par désignation reste en lot 2. Validé (3.ok). | `legende.js` |

## Modèle et nomenclature

| Réf. | Hypothèse | Fichier |
|---|---|---|
| H-12 | **`ME_PTR` n'existe pas dans `nomenclature.json`** (aucun article `materiau: ME_PTR`). La fiche le propose quand même comme matériau ; hauteur et effort se saisissent librement (« Autre… »). `ME tub` est proposé par défaut pour un support neuf, `ME ptr` pour un support existant, sans jamais être imposé. | `nomenclature.js` → `materiauxSupports` ; `designation.js` |
| H-13 | **Indicateur « complet »** (§6.4, critères non précisés) : support = matériau + hauteur + (béton : classe et effort ; bois : classe ; métallique : effort) ; coffret / poste / armoire = sigle ; tronçon = section ; note = texte non vide ; MALT, ERAS, boîtes de jonction, points lumineux = toujours complets. | `modele.js` → `estComplet` |
| H-14 | **Désignation sans aucun attribut** : « BE existant » pour un support existant ou à reprendre ; « BE » seul pour un support à poser ou à déposer. | `designation.js` → `tronquer` |
| H-15 | **Calque déduit de l'état** (existant → Existant, à poser → À poser, à déposer → À déposer, à reprendre → Existant, notes → Annotations). Le calque reste stocké et modifiable (fiche, Avancé). Le calque **Cotation** existe mais reste vide jusqu'au lot 3. | `modele.js` → `calquePourEtat` |
| H-16 | **Un seul fond par plan** (§10.1 : « un seul plan par projet en V1 » contredit la superposition de fonds). Le modèle réserve `plans[].fonds[]`. Un PDF multi-pages : choix de la page dans le panneau Calques. | `modele.js`, `fond.js` |
| H-17 | **Images et photos** : unités plan = pixels normalisés pour que le grand côté vaille 1190 unités (long côté A3 en points), afin que les symboles gardent une taille « papier » quelle que soit la résolution de la photo. L'export PDF crée une page de ces dimensions. | `fond.js` → `preparer` |
| H-18 | **Édition de la nomenclature** (§5.8 vs lot 2) : lot 1 = import / export JSON de la nomenclature complète (panneau Bibliothèque) + matériel libre dans la fiche ; l'éditeur d'articles vient au lot 2. Une nomenclature importée est conservée en base et remplace celle du dépôt jusqu'à « Restaurer ». | `nomenclature.js` |
| H-19 | **Correspondance article → objet** : SUPPORT → support ; COFFRET_BT → coffret ; POSTE, COUPURE_HTA → poste ; BOITE_JONCTION → boîte de jonction (sauf accessoires HTA de poste) ; MALT → MALT ; ERAS → ERAS (MALT cochée sauf branchement et EP, ou selon `malt_obligatoire`) ; ECLAIRAGE_PUBLIC → armoire / S20 / point lumineux / câble selon le libellé ; CABLE, FOURREAU → tronçon. Les autres catégories (armements, déposes, divers) s'ajoutent au **matériel associé** des objets sélectionnés. | `nomenclature.js` → `presetDepuisArticle` |
| H-20 | **Packages** : les lignes sont rapprochées des articles par le début du libellé (40 premiers caractères normalisés) ; sans correspondance elles sont ajoutées en matériel LIBRE. `PACKAGE:MALT` est développé récursivement (3 niveaux max). | `nomenclature.js` → `lignesPackage` |
| H-21 | **Sous-segments par nature de terrain et tranchée commune** : champs prévus au modèle (`sous_segments`, `tranchee_commune`) ; la saisie reste au niveau du tronçon entier jusqu'au lot 3. La longueur est saisie à la main (`longueur_manuelle`) en attendant le métré. | `modele.js` → `nouveauTroncon` |
| H-22 | **Repères automatiques** : P (supports), C (coffrets), PT (postes), BJ, T (MALT), R (ERAS), L (points lumineux), A (armoires), S (tronçons), N (notes) ; modifiables dans la fiche. | `charte.js` → `reperes` |

## Interaction

| Réf. | Hypothèse | Fichier |
|---|---|---|
| H-23 | **Au doigt** : un appui bref pose / sélectionne ; glisser déplace le plan, sauf sur une poignée ou sur un objet déjà sélectionné (déplacement). Le lasso et le tracé par glissement sont réservés au stylet et à la souris. | `pointeur.js`, `outils.js` |
| H-24 | **Poser puis orienter** : au stylet, glisser lors de la pose d'un ponctuel oriente le symbole vers le pointeur. | `outils.js` → mode `orienter` |
| H-25 | **Fin de polyligne** : appui sur le dernier sommet, Entrée, double appui ou menu contextuel. Échap abandonne. | `outils.js` |
| H-26 | **Rejet de paume** : tout contact « touch » est ignoré tant qu'un stylet est en appui ou a survolé dans les 500 ms ; zone morte 6 px stylet / 11 px doigt / 5 px souris. Le survol du stylet dépend du matériel (Pointer Events `pen` avec `buttons = 0`) : sans survol, le curseur de précision n'apparaît qu'au contact. | `pointeur.js` |
| H-27 | **Gomme** : bouton latéral du stylet (`button === 5` ou `buttons & 32`) ou outil Gomme (touche X). Un trait de gomme = une seule étape d'annulation. | `pointeur.js`, `outils.js` |
| H-28 | **Aperçu « rendu papier »** : l'affichage étant déjà à l'échelle du papier, ce mode masque poignées, curseur, marques d'objets incomplets et panneaux, puis ajuste la page à l'écran. Aucun rendu séparé. | `barre-outils.js` → `basculerPapier` |
| H-29 | **Historique** : instantanés complets de la liste d'objets à chaque action (illimité, en mémoire). La position de la légende et les réglages d'affichage ne sont pas annulables. | `historique.js` |
| H-30 | **Sauvegarde automatique** : 400 ms après chaque action, plus au passage en arrière-plan de l'application. | `projet.js` |

## Export et environnement

| Réf. | Hypothèse | Fichier |
|---|---|---|
| H-31 | **Export PDF** : page d'origine copiée (contenu et format conservés), objets dessinés par opérateurs vectoriels bas niveau dans l'espace utilisateur PDF (inverse de la matrice de vue pdf.js, pages tournées gérées), police **DejaVu Sans** embarquée en sous-ensemble (couvre Ø, ∅, ≥, ²). Les couleurs translucides (fonds d'étiquettes) sont fusionnées sur blanc. | `export-pdf.js` |
| H-32 | **Export PNG** : 150 / 200 / 300 dpi, plafonné à 8192 px de côté. | `export-png.js` |
| H-33 | **Export .json** : projet + fond embarqué en base64 (un PDF de 30 Mo donne ≈ 40 Mo) ; signalé au-delà de 25 Mo. À l'import, un projet portant un identifiant déjà présent est recréé sous « (importé) ». | `projet.js` |
| H-34 | **pdf.js** : build « legacy » (compatibilité navigateurs plus anciens) avec polices standard et décodeurs WASM (JPX/JBIG2) embarqués. Les CMaps CJK ne sont pas embarquées (plans français). | `vendor/pdfjs`, `sw.js` |
| H-35 | **Chrome Android ≥ 105** recommandé (`:has()` en CSS, Pointer Events, `<dialog>`, IndexedDB, Web Share). Le stockage persistant est demandé au navigateur (`storage.persist()`) pour éviter la purge des projets. | `main.js`, `bd.js` |
| H-36 | **Feuille virtuelle sans fond** : A3 paysage (1190 × 842 pt) pour pouvoir tracer avant de charger un fond. | `vue.js` → `etenduePlan` |
