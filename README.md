# Réseaux HC — tracé de réseaux BT/HTA sur tablette (lot 1)

Application web progressive (PWA) hors ligne pour tracer, symboliser et annoter des réseaux électriques HTA/BT sur fond de plan (PDF, image, photo), sur tablette Android au stylet et au doigt. Aucun serveur, aucune dépendance en ligne : tout est stocké sur la tablette (IndexedDB).

## Contenu de la livraison

```
reseaux-hc/
├─ index.html, manifest.json, sw.js       coquille, manifeste PWA, service worker (précache intégral)
├─ nomenclature.json                       copie identique du fichier fourni (jamais régénéré)
├─ HYPOTHESES.md                           décisions prises faute d'information (à lire)
├─ css/app.css                             thème, cibles tactiles, portrait / paysage
├─ js/                                     modules ES (voir en-tête de chaque fichier)
│  ├─ charte.js                            TOUTE la charte graphique (couleurs, tiretés, cotes, textes)
│  └─ …
├─ icons/                                  icônes PWA
└─ vendor/                                 pdf.js (legacy), pdf-lib, fontkit, DejaVu Sans
```

## Déploiement (hébergement statique)

L'application est un dossier de fichiers statiques. Le seul prérequis est **HTTPS** (obligatoire pour le service worker et l'installation PWA), sauf en `http://localhost` pour les essais.

1. Copier le dossier `reseaux-hc/` tel quel sur l'hébergement (GitHub Pages, serveur web interne, partage HTTPS…). Aucune compilation, aucun `npm install`.
2. Vérifier que les fichiers `.mjs` sont servis avec le type MIME `text/javascript` et les `.wasm` avec `application/wasm` (GitHub Pages, nginx et Apache récents le font par défaut).
3. Ouvrir `https://…/reseaux-hc/index.html` une première fois **avec** connexion : le service worker met en cache les 62 ressources (≈ 6 Mo). L'application est ensuite utilisable sans réseau.

Mise à jour : après avoir remplacé les fichiers, incrémenter `VERSION` dans `sw.js` (ex. `reseaux-hc-v1.0.1`). À la prochaine ouverture connectée, la tablette télécharge la nouvelle version et affiche « Nouvelle version installée : relancez l'application ».

Essai local : `python3 -m http.server 8000` dans le dossier, puis `http://localhost:8000/`.

## Installation sur la tablette

1. Ouvrir l'adresse dans **Chrome Android** (≥ 105 recommandé).
2. Menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »). L'icône « Réseaux HC » apparaît ; l'application s'ouvre plein écran.
3. Ouvrir une première fois l'application depuis l'icône avec la connexion active, puis passer en mode avion pour vérifier : elle démarre et le dernier projet se rouvre à l'identique.
4. Recommandé : Chrome → Paramètres → Site → autoriser le **stockage** ; l'application demande elle-même le stockage persistant pour que les projets ne soient pas purgés.

Les projets, fonds et nomenclature personnalisée restent dans le navigateur de la tablette. Pour transférer un projet sur le PC : Exporter → **Projet .json** (fond embarqué), puis Projets → **Importer un .json** sur l'autre appareil.

## Notice courte

### Démarrer
- **Projets** (icône dossier) : créer, ouvrir, renommer, dupliquer, supprimer, importer. Le projet porte nom, commune, date.
- **Fond de plan** (icône image) : PDF (choix de la page dans *Calques* si plusieurs), image ou **photo** prise directement. Le fond est net à tout niveau de zoom.
- Le dernier projet se rouvre automatiquement, avec sa vue.

### Terrain (rapidité)
- Barre de gauche : **1** sélection, **2** tronçon, **3** support, **4** coffret, **5** poste, **6** boîte de jonction, **7** ERAS, **8** MALT, **9** note, gomme (X), bibliothèque.
- Bandeau du bas : **réseau** (HTA / BTS / BRT / EP), **pose** (aérien / souterrain / façade), **état** (existant / à poser / à déposer / à reprendre). Il s'applique à tout ce qui est posé ensuite, et à la sélection courante.
- **Un appui = un objet posé**, aucun champ obligatoire. Au stylet, glisser lors de la pose oriente le symbole.
- **Tronçon** : un appui par sommet, accrochage automatique aux extrémités et aux ouvrages (cercle vert) ; terminer par un appui sur le dernier sommet, Entrée ou double appui. Touche **A** : accrochage 0° / 45° / 90°.
- **Note** (9) : appui puis texte au clavier ; couleur, taille, cadre, fond, flèche de rappel.
- **Bibliothèque** : recherche dans la nomenclature (libellé, sigle, section), filtrée sur le marché (BPU) quand l'état est « à poser » ; favoris et récents. Choisir un article règle l'outil de pose ; un armement ou une dépose s'ajoute au matériel associé de la sélection.
- Navigation : le **doigt** déplace, deux doigts zooment, double appui au doigt ajuste. Le **stylet** dessine ; son bouton latéral gomme. Appui long : menu contextuel.

### Bureau (complétude)
- Sélectionner un objet puis **F**, Entrée, double appui ou *Fiche* dans le menu : type filtré (matériau → hauteur → classe → effort, valeurs libres possibles), fonction, renforcement et son sens, armement, sigle, section, fourreau, matériel associé (nomenclature, libre, packages), commentaire, désignation manuelle prioritaire. **Tab** passe au champ suivant, **Ctrl+Entrée** valide.
- Indicateur **« à compléter »** en haut : liste des objets incomplets, un appui centre et ouvre la fiche.
- Étiquettes déplaçables (poignée bleue), masquables (**E** ou fiche). Rotation par poignée ronde ou **R**. Sommets déplaçables, point bleu au milieu d'un segment pour insérer un sommet.
- **Calques** : visibilité / verrou / opacité, filtre par réseau, opacité et page du fond, taille des textes et des symboles, légende.
- **Aperçu papier** (icône page) : masque tout ce qui n'est pas exporté.

### Export
- **PDF** vectoriel : page d'origine conservée, texte sélectionnable, légende. **PNG** 150 / 200 / 300 dpi. **.json** pour transfert. Sur Android le panneau de partage s'ouvre (Drive, mail…).

### Raccourcis
Ctrl+Z / Ctrl+Y annuler / rétablir · Ctrl+S sauver (automatique de toute façon) · Ctrl+D dupliquer · Suppr supprimer · Échap abandonner / désélectionner / fermer · Entrée terminer un tracé / ouvrir la fiche · Ctrl+0 ajuster · + / − zoom · flèches déplacement fin (Maj ×10) · 1-9 outils · X gomme · R rotation 90° · E étiquettes · A accrochage angulaire · F fiche · ? aide.

## Modifier la charte ou la nomenclature
- Couleurs, tiretés, épaisseurs, dimensions des symboles, tailles de textes, hachures : uniquement `js/charte.js`.
- Nomenclature : remplacer `nomenclature.json` sur l'hébergement (et incrémenter `VERSION` dans `sw.js`), ou importer un fichier depuis la Bibliothèque sur la tablette.
