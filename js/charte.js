/* charte.js — TOUTE la charte graphique de l'application.
 *
 * Toutes les dimensions sont exprimées en unités de plan (points PDF, 1/72 de pouce
 * — 1 mm ≈ 2,835 pt). Elles ont donc une taille fixe SUR LE PAPIER : l'écran et
 * l'export PDF utilisent exactement les mêmes valeurs.
 *
 * Ce fichier se modifie sans toucher au reste du code.
 */

export const CHARTE = {

  /* ---------- 8.1 Réseaux : couleur par réseau et par état ----------
   * couleur : { existant, a_poser } ; pour BTS, l'existant dépend de la pose.
   * epaisseur : HTA > BTS > BRT = EP.
   * tirete_souterrain : motif [trait, blanc, ...] appliqué en pose souterraine.
   * facade : trait plein, même couleur que l'aérien (hypothèse H-02).
   */
  reseaux: {
    HTA: {
      libelle: 'HTA',
      couleur: { existant: '#8B2E1F', a_poser: '#E2001A' },
      epaisseur: 1.6,
      tirete_souterrain: [10, 4]            // pointillé long
    },
    BTS: {
      libelle: 'BT réseau',
      couleur: {
        existant: { aerien: '#C8960C', facade: '#C8960C', souterrain: '#3DDC1E' },
        a_poser: '#14307D'
      },
      epaisseur: 1.25,
      tirete_souterrain: [6, 3]             // pointillé moyen
    },
    BRT: {
      libelle: 'Branchement',
      couleur: { existant: '#B35A00', a_poser: '#FF8A00' },
      epaisseur: 0.9,
      tirete_souterrain: [3, 2]             // pointillé court
    },
    EP: {
      libelle: 'Éclairage public',
      couleur: { existant: '#7B2D8E', a_poser: '#FF2D95' },
      epaisseur: 0.9,
      tirete_souterrain: [7, 2.5, 1.2, 2.5] // tiret-point
    }
  },

  /* Couleurs fluo : reçoivent un liseré sombre très fin (dessiné dessous). */
  fluo: ['#3DDC1E', '#FF2D95'],
  lisere: { couleur: '#1A1A1A', surepaisseur: 0.7 },

  /* État « à déposer » sur les tronçons : hachures noires régulières par-dessus
   * le style de l'existant (ni changement de couleur, ni de tireté). */
  hachures_troncon: { pas: 5, longueur: 4.5, epaisseur: 0.55, couleur: '#000000', angle_deg: 60 },

  /* État « à reprendre » (hypothèse H-01) : style existant + liseré discontinu. */
  a_reprendre_troncon: { tirete: [1.2, 2.4], epaisseur: 0.5, couleur: '#000000' },

  /* ---------- États des objets ponctuels ---------- */
  etats: {
    existant:    { contour: '#000000', remplissage: '#FFFFFF' },
    a_poser:     { contour: '#000000', remplissage: '#000000' },
    a_deposer:   { contour: '#000000', remplissage: '#FFFFFF', hachures: { pas: 1.6, epaisseur: 0.45, angle_deg: 45, couleur: '#000000' } },
    a_reprendre: { contour: '#000000', remplissage: '#FFFFFF', demi: true }   // moitié gauche remplie (H-01)
  },
  contour_symbole: 0.6,          // épaisseur du contour des symboles ponctuels

  /* ---------- 8.2 Supports ---------- */
  supports: {
    rectangle: { largeur: 6.4, hauteur: 3.6 },        // béton classe D
    carre:     { cote: 4.6 },                          // béton classe E
    cercle:    { rayon: 2.1 },                         // bois (petit diamètre)
    croix:     { cote: 4.6, epaisseur_croix: 0.55 },   // poutrelle ME ptr : carré + croix inscrite
    anneau:    { rayon: 3.6, rayon_interieur: 2.5 },   // ME tub : cercle de plus grand diamètre, double trait
    generique: { rayon: 2.6 }                          // support posé sans matériau connu
  },

  /* Renforcements (combinables avec chaque type) */
  renforcements: {
    contrefiche: { longueur: 5.5, base: 4 },           // triangle accolé, pointe dans le sens de la contrefiche
    jumele:      { ecart: 1.4 },                       // deux symboles identiques côte à côte
    hauban:      { longueur: 9, tete: 2.4 },           // flèche dans le sens du tirage
    portique:    { ecart: 7, epaisseur: 0.9 }          // deux symboles reliés par une traverse (proposition)
  },

  /* ---------- 8.4 Coffrets et bornes BT ---------- */
  coffret: { largeur: 8.5, hauteur: 6, taille_sigle: 2.3, taille_sigle_min: 1.6 },

  /* ---------- 8.5 Postes et appareillage de coupure HTA ---------- */
  poste: { largeur: 13, hauteur: 8.5, couleur: '#E2001A', taille_sigle: 2.8, epaisseur: 0.8 },

  /* ---------- 8.6 Boîtes de jonction / dérivation ---------- */
  boite_jonction: { rx: 2.6, ry: 1.6 },

  /* ---------- 8.7 MALT (IEC 60417-5019) ---------- */
  malt: { hauteur_trait: 4, largeurs: [4.4, 3, 1.6], ecart_barres: 1.1, epaisseur: 0.65, couleur: '#000000' },

  /* ---------- 8.8 ERAS / RAS : petit cercle + MALT optionnelle ---------- */
  eras: { rayon: 1.9, decalage_malt: 3.2 },

  /* ---------- 8.9 Éclairage public ---------- */
  eclairage: {
    point_lumineux: { rayon: 2.2, rayon_rayons: 3.6, nb_rayons: 8 },
    armoire:        { largeur: 8.5, hauteur: 6, taille_sigle: 2.3 }
  },

  /* ---------- 8.10 Étiquettes et textes ---------- */
  texte: {
    police: 'DejaVu Sans, Arial, Helvetica, sans-serif',
    couleur: '#000000',
    taille_etiquette: 3.2,           // désignation
    taille_etiquette_secondaire: 2.6, // matériel associé abrégé
    taille_repere: 2.4,
    interligne: 1.22,
    fond_etiquette: 'rgba(255,255,255,0.78)',
    marge_etiquette: 0.9,
    decalage_etiquette: { dx: 1.5, dy: -3.6 }  // décalage par défaut, ajouté au rayon du symbole
  },

  /* ---------- 9. Notes de terrain (entièrement paramétrables par note) ---------- */
  notes: {
    taille_defaut: 4.5,
    couleur_defaut: '#B00020',
    palette: ['#B00020', '#000000', '#14307D', '#1B7F3B', '#FF8A00', '#7B2D8E', '#FFFFFF'],
    tailles: [3, 4.5, 6, 8, 11, 15],
    fond: 'rgba(255,255,255,0.72)',
    cadre: { couleur: '#000000', epaisseur: 0.5, marge: 1.4 },
    fleche: { epaisseur: 0.6, tete: 2.6 }
  },

  /* ---------- Légende ---------- */
  legende: {
    largeur: 110, ligne: 7, marge: 4, taille_texte: 3.2, taille_titre: 4,
    fond: '#FFFFFF', cadre: '#000000', epaisseur_cadre: 0.6, longueur_echantillon: 22
  },

  /* ---------- Aides à l'écran (jamais exportées) ---------- */
  ecran: {
    selection: '#0A84FF',
    survol: '#0A84FF',
    accrochage: '#00A85A',
    poignee_px: 22,          // rayon des poignées, en pixels écran (doigt)
    poignee_stylet_px: 12,
    lasso: 'rgba(10,132,255,0.15)'
  },

  /* Ordre de dessin (z) par type */
  ordre_z: ['troncon', 'malt', 'eras', 'boite_jonction', 'point_lumineux', 'coffret', 'armoire_ep', 'poste', 'support', 'note'],

  /* Préfixes de repère (numérotation automatique par type) */
  reperes: {
    support: 'P', coffret: 'C', poste: 'PT', boite_jonction: 'BJ', malt: 'T',
    eras: 'R', point_lumineux: 'L', armoire_ep: 'A', troncon: 'S', note: 'N'
  }
};

/* Retourne le style de trait d'un tronçon à partir du triplet domaine + pose + état.
 * { couleur, epaisseur, tirete (tableau ou null), fluo, hachure (bool), reprendre (bool) } */
export function styleTroncon(domaine, pose, etat) {
  const r = CHARTE.reseaux[domaine] || CHARTE.reseaux.BTS;
  const etatBase = (etat === 'a_poser') ? 'a_poser' : 'existant';   // à déposer / à reprendre = style existant
  let couleur = r.couleur[etatBase];
  if (typeof couleur === 'object') couleur = couleur[pose] || couleur.aerien;
  const tirete = (pose === 'souterrain') ? r.tirete_souterrain : null;
  return {
    couleur,
    epaisseur: r.epaisseur,
    tirete,
    fluo: CHARTE.fluo.includes(couleur.toUpperCase()) || CHARTE.fluo.includes(couleur),
    hachure: etat === 'a_deposer',
    reprendre: etat === 'a_reprendre'
  };
}

/* Couleur « de réseau » d'un objet ponctuel (boîtes de jonction, ERAS). */
export function couleurReseau(domaine, pose, etat) {
  return styleTroncon(domaine, pose || 'aerien', etat).couleur;
}

/* Libellés d'affichage */
export const LIBELLES = {
  etats: { existant: 'Existant', a_poser: 'À poser', a_deposer: 'À déposer', a_reprendre: 'À reprendre' },
  poses: { aerien: 'Aérien', souterrain: 'Souterrain', facade: 'Façade' },
  domaines: { HTA: 'HTA', BTS: 'BTS', BRT: 'BRT', EP: 'EP' },
  types: {
    support: 'Support', coffret: 'Coffret / borne', poste: 'Poste / coupure HTA', boite_jonction: 'Boîte de jonction',
    malt: 'MALT', eras: 'ERAS / RAS', point_lumineux: 'Point lumineux', armoire_ep: 'Armoire EP',
    troncon: 'Tronçon', note: 'Note'
  },
  calques: { fond: 'Fond de plan', existant: 'Existant', a_poser: 'À poser', a_deposer: 'À déposer', cotation: 'Cotation', annotations: 'Annotations' }
};
