/* modele.js — schéma des données, valeurs par défaut, repères, indicateur « complet ».
 *
 * Structure : projet → plans[] → objets[]  (un seul plan exposé en V1, §10.1)
 */
import { CHARTE } from './charte.js';

export const VERSION_SCHEMA = 1;

export const TYPES_PONCTUELS = ['support', 'coffret', 'poste', 'boite_jonction', 'malt', 'eras', 'point_lumineux', 'armoire_ep'];

export function genererId(prefixe = 'o') {
  return prefixe + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ---------- Projet ---------- */
export function nouveauProjet({ nom = 'Nouvelle affaire', commune = '', date = aujourdhui() } = {}) {
  const maintenant = new Date().toISOString();
  return {
    id: genererId('prj'),
    version_schema: VERSION_SCHEMA,
    nom, commune, date,
    cree_le: maintenant,
    modifie_le: maintenant,
    plan_courant: 0,
    plans: [nouveauPlan('Plan 1')],
    calques: calquesParDefaut(),
    filtre_domaines: { HTA: true, BTS: true, BRT: true, EP: true },
    compteurs: {},
    reglages: { echelle_symbole: 1, taille_texte: 1 }
  };
}

export function nouveauPlan(nom = 'Plan 1') {
  return {
    id: genererId('pl'),
    nom,
    fond: null,     // { fond_id, type: 'pdf'|'image', page, nb_pages, largeur, hauteur, opacite, nom_fichier, rotation }
    fonds: [],      // réservé : superposition de plusieurs fonds (version ultérieure)
    objets: [],
    vue: null,      // { x, y, k } — position et niveau de zoom
    legende: { visible: true, x: null, y: null, echelle: 1 },
    echelle: null   // réservé lot 3 : { unites_par_metre }
  };
}

export function calquesParDefaut() {
  const c = {};
  for (const nom of ['fond', 'existant', 'a_poser', 'a_deposer', 'cotation', 'annotations']) {
    c[nom] = { visible: true, verrou: false, opacite: 1 };
  }
  return c;
}

export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Objets ---------- */

/* Calque déduit de l'état (le calque reste stocké et modifiable). */
export function calquePourEtat(etat, type) {
  if (type === 'note') return 'annotations';
  if (etat === 'a_poser') return 'a_poser';
  if (etat === 'a_deposer') return 'a_deposer';
  return 'existant';
}

function base(type, courant) {
  return {
    id: genererId(),
    type,
    calque: calquePourEtat(courant.etat, type),
    etat: courant.etat,
    domaine: courant.domaine,
    pose: courant.pose,
    rotation: 0,
    echelle_symbole: 1,
    repere: '',
    designation_auto: '',
    designation_manuelle: '',
    materiel_associe: [],   // { source: 'NOMENCLATURE'|'LIBRE', ref_article?, libelle, quantite, unite? }
    complet: false,
    commentaire: '',
    ref_article: null,
    etiquette: { visible: true, dx: CHARTE.texte.decalage_etiquette.dx, dy: CHARTE.texte.decalage_etiquette.dy },
    attributs: {}
  };
}

export function nouvelObjetPonctuel(type, x, y, courant, attributs = {}) {
  const o = base(type, courant);
  o.x = x; o.y = y;
  o.attributs = attributsParDefaut(type);
  Object.assign(o.attributs, attributs);
  return o;
}

export function attributsParDefaut(type) {
  switch (type) {
    case 'support':
      return { materiau: '', classe: '', hauteur_m: null, effort_daN: null, fonction: '', renforcement: 'AUCUN', angle_renforcement: 0, armement: '', usage: '' };
    case 'coffret':
      return { sigle: '', nb_plages: null, section_reseau: '' };
    case 'poste':
      return { sigle: '', puissance_kva: null };
    case 'boite_jonction':
      return { sections: '' };
    case 'malt':
      return { convention: '' };
    case 'eras':
      return { avec_malt: true, sous_type: 'BT_RESEAU' };   // BT_RESEAU | HTA | BRANCHEMENT | EP
    case 'point_lumineux':
      return { sur: 'SUPPORT' };                           // SUPPORT | MAT
    case 'armoire_ep':
      return { sigle: 'S17', phase: '' };
    default:
      return {};
  }
}

export function nouveauTroncon(points, courant, attributs = {}) {
  const o = base('troncon', courant);
  o.points = points.map((p) => ({ x: p.x, y: p.y }));
  o.attributs = {
    section: '', nature: '', norme: '', fourreau: '',
    longueur_m: null, longueur_manuelle: null,
    nature_terrain: '', profondeur_m: null, grillage_avertisseur: null,
    tranchee_commune: false,
    sous_segments: []    // lot 3 : [{ de, a, nature_terrain }]
  };
  Object.assign(o.attributs, attributs);
  return o;
}

export function nouvelleNote(x, y, texte = '') {
  const o = base('note', { etat: 'existant', domaine: 'BTS', pose: 'aerien' });
  o.calque = 'annotations';
  o.x = x; o.y = y;
  o.texte = texte;
  o.couleur = CHARTE.notes.couleur_defaut;
  o.taille = CHARTE.notes.taille_defaut;
  o.cadre = false;
  o.fond = true;
  o.fleche = null;   // { x, y } point désigné
  o.etiquette.visible = false;
  return o;
}

/* ---------- Repères ---------- */
export function attribuerRepere(projet, objet) {
  if (objet.repere) return objet.repere;
  const prefixe = CHARTE.reperes[objet.type] || 'O';
  projet.compteurs[prefixe] = (projet.compteurs[prefixe] || 0) + 1;
  objet.repere = prefixe + projet.compteurs[prefixe];
  return objet.repere;
}

/* Recalcule les compteurs à l'ouverture d'un projet (sécurité après import). */
export function recalculerCompteurs(projet) {
  const compteurs = {};
  for (const plan of projet.plans) {
    for (const o of plan.objets) {
      const m = /^([A-Z]+)(\d+)$/.exec(o.repere || '');
      if (m) compteurs[m[1]] = Math.max(compteurs[m[1]] || 0, parseInt(m[2], 10));
    }
  }
  projet.compteurs = compteurs;
}

/* ---------- Indicateur « complet » ---------- */
export function estComplet(o) {
  const a = o.attributs || {};
  switch (o.type) {
    case 'support': {
      if (!a.materiau || !a.hauteur_m) return false;
      if (a.materiau === 'BETON') return !!a.classe && !!a.effort_daN;
      if (a.materiau === 'BOIS') return !!a.classe;
      return !!a.effort_daN;   // ME_TUB, ME_PTR
    }
    case 'coffret':
    case 'poste':
    case 'armoire_ep':
      return !!a.sigle;
    case 'troncon':
      return !!a.section;
    case 'note':
      return !!(o.texte && o.texte.trim());
    default:
      return true;   // MALT, ERAS, boîtes de jonction, point lumineux : rien d'obligatoire
  }
}

export function mettreAJourComplet(o) {
  o.complet = estComplet(o);
  return o.complet;
}

/* Désignation affichée (manuelle prioritaire). */
export function designationAffichee(o) {
  return (o.designation_manuelle && o.designation_manuelle.trim()) ? o.designation_manuelle : (o.designation_auto || '');
}

/* Abrégé du matériel associé pour l'étiquette : « 1 EAS 70-10, 1 MALT » */
export function materielAbrege(o, max = 3) {
  const lignes = (o.materiel_associe || []).slice(0, max).map((m) => {
    const q = (m.quantite !== null && m.quantite !== undefined && m.quantite !== '') ? m.quantite + ' ' : '';
    return q + abregerLibelle(m.libelle);
  });
  const reste = (o.materiel_associe || []).length - max;
  if (reste > 0) lignes.push('+' + reste);
  return lignes.join(', ');
}

function abregerLibelle(l) {
  if (!l) return '';
  // On garde les 28 premiers caractères pour ne pas encombrer le plan.
  return l.length > 28 ? l.slice(0, 27) + '…' : l;
}

/* Migration de schéma : applique les valeurs manquantes aux anciens projets. */
export function migrerProjet(p) {
  if (!p.version_schema) p.version_schema = 1;
  if (!p.calques) p.calques = calquesParDefaut();
  if (!p.filtre_domaines) p.filtre_domaines = { HTA: true, BTS: true, BRT: true, EP: true };
  if (!p.compteurs) p.compteurs = {};
  if (!p.reglages) p.reglages = { echelle_symbole: 1, taille_texte: 1 };
  if (!Array.isArray(p.plans) || p.plans.length === 0) p.plans = [nouveauPlan()];
  if (typeof p.plan_courant !== 'number') p.plan_courant = 0;
  for (const plan of p.plans) {
    if (!plan.objets) plan.objets = [];
    if (!plan.legende) plan.legende = { visible: true, x: null, y: null, echelle: 1 };
    if (!plan.fonds) plan.fonds = [];
    for (const o of plan.objets) {
      if (!o.etiquette) o.etiquette = { visible: o.type !== 'note', dx: CHARTE.texte.decalage_etiquette.dx, dy: CHARTE.texte.decalage_etiquette.dy };
      if (!o.materiel_associe) o.materiel_associe = [];
      if (!o.attributs) o.attributs = attributsParDefaut(o.type);
      if (o.echelle_symbole === undefined) o.echelle_symbole = 1;
      if (o.rotation === undefined) o.rotation = 0;
      mettreAJourComplet(o);
    }
  }
  return p;
}

/* Copie profonde sûre. */
export function cloner(v) {
  return (typeof structuredClone === 'function') ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
