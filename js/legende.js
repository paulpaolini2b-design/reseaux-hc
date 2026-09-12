/* legende.js — légende générée à partir des seuls symboles réellement utilisés.
 * Positionnable (glissement) et redimensionnable (plan.legende.echelle).
 * Reprise à l'identique dans l'export PDF (mêmes primitives).
 */
import { CHARTE, LIBELLES, styleTroncon } from './charte.js';
import { rect, texte, poly, transformer, hachurerPolyligne, ligne } from './primitives.js';
import { echantillonSymbole } from './symboles.js';
import { etenduePlan } from './vue.js';

/* Libellé et clé de regroupement d'un objet ponctuel. */
function cleSymbole(o) {
  const a = o.attributs || {};
  switch (o.type) {
    case 'support': {
      const m = { BETON: a.classe === 'E' ? 'Support béton classe E' : 'Support béton classe D', BOIS: 'Support bois', ME_TUB: 'Support métallique tubulaire', ME_PTR: 'Poutrelle métallique' }[a.materiau] || 'Support';
      return { cle: 'support|' + (a.materiau || '') + '|' + (a.materiau === 'BETON' ? a.classe || '' : '') + '|' + o.etat, libelle: m + ' ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: { materiau: a.materiau, classe: a.classe } };
    }
    case 'coffret': return { cle: 'coffret|' + o.etat, libelle: 'Coffret / borne BT ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: { sigle: a.sigle || '' } };
    case 'poste': return { cle: 'poste|' + o.etat, libelle: 'Poste / coupure HTA ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: { sigle: a.sigle || '' } };
    case 'boite_jonction': return { cle: 'bj|' + o.domaine + '|' + o.etat, libelle: 'Boîte de jonction ' + o.domaine + ' ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: {}, domaine: o.domaine, pose: o.pose };
    case 'malt': return { cle: 'malt', libelle: 'Mise à la terre (MALT)', attributs: {} };
    case 'eras': return { cle: 'eras|' + o.domaine + '|' + (a.avec_malt ? 1 : 0) + '|' + o.etat, libelle: (a.sous_type === 'BRANCHEMENT' ? 'RAS branchement' : a.sous_type === 'EP' ? 'RAS EP' : 'ERAS ' + o.domaine) + (a.avec_malt ? ' avec MALT' : '') + ' ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: { avec_malt: a.avec_malt, sous_type: a.sous_type }, domaine: o.domaine, pose: o.pose };
    case 'point_lumineux': return { cle: 'pl|' + o.etat, libelle: 'Point lumineux ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: {} };
    case 'armoire_ep': return { cle: 'aep|' + o.etat, libelle: 'Armoire de commande EP ' + LIBELLES.etats[o.etat].toLowerCase(), attributs: { sigle: a.sigle } };
    default: return null;
  }
}

function libelleTroncon(o) {
  const r = CHARTE.reseaux[o.domaine];
  return (r ? r.libelle : o.domaine) + ' ' + LIBELLES.poses[o.pose].toLowerCase() + ' ' + LIBELLES.etats[o.etat].toLowerCase();
}

/* Entrées de légende { type:'troncon'|'symbole', libelle, … } dédoublonnées. */
export function entreesLegende(objets) {
  const map = new Map();
  for (const o of objets) {
    if (o.type === 'note') continue;
    if (o.type === 'troncon') {
      const cle = 't|' + o.domaine + '|' + o.pose + '|' + o.etat;
      if (!map.has(cle)) map.set(cle, { type: 'troncon', libelle: libelleTroncon(o), domaine: o.domaine, pose: o.pose, etat: o.etat, ordre: 0 });
    } else {
      const s = cleSymbole(o);
      if (s && !map.has(s.cle)) map.set(s.cle, { type: 'symbole', typeObjet: o.type, etat: o.etat, ordre: 1, ...s });
    }
  }
  return [...map.values()].sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr'));
}

/* Position par défaut : coin bas-droit de l'étendue du plan. */
export function positionLegende(plan, entrees, echelle) {
  const L = CHARTE.legende;
  const l = L.largeur * echelle;
  const h = (L.marge * 2 + L.taille_titre * 1.6 + entrees.length * L.ligne) * echelle;
  if (plan.legende.x !== null && plan.legende.y !== null) return { x: plan.legende.x, y: plan.legende.y, l, h };
  const e = etenduePlan();
  return { x: e.x + e.l - l - 10, y: e.y + e.h - h - 10, l, h };
}

export function boiteLegende(plan, objets) {
  const entrees = entreesLegende(objets);
  if (!entrees.length) return null;
  return positionLegende(plan, entrees, plan.legende.echelle || 1);
}

export function primitivesLegende(plan, objets, reglages = {}) {
  const entrees = entreesLegende(objets);
  if (!entrees.length) return [];
  const L = CHARTE.legende;
  const echelle = plan.legende.echelle || 1;
  const pos = positionLegende(plan, entrees, echelle);
  const prims = [];
  // Construite en local puis mise à l'échelle et positionnée
  prims.push(rect(0, 0, L.largeur, L.marge * 2 + L.taille_titre * 1.6 + entrees.length * L.ligne, { couleur: L.cadre, epaisseur: L.epaisseur_cadre, remplissage: L.fond }));
  prims.push(texte(L.marge, L.marge + L.taille_titre, 'Légende', { taille: L.taille_titre, couleur: '#000', ancre: 'debut' }));
  let y = L.marge + L.taille_titre * 1.6 + L.ligne / 2;
  const xEch = L.marge + L.longueur_echantillon / 2, xTexte = L.marge + L.longueur_echantillon + 3;
  for (const e of entrees) {
    if (e.type === 'troncon') {
      const s = styleTroncon(e.domaine, e.pose, e.etat);
      const pts = [{ x: L.marge, y }, { x: L.marge + L.longueur_echantillon, y }];
      if (s.fluo) prims.push(poly(pts, { couleur: CHARTE.lisere.couleur, epaisseur: s.epaisseur + CHARTE.lisere.surepaisseur, tirete: s.tirete }));
      prims.push(poly(pts, { couleur: s.couleur, epaisseur: s.epaisseur, tirete: s.tirete }));
      if (s.hachure) prims.push(...hachurerPolyligne(pts, CHARTE.hachures_troncon));
      if (s.reprendre) prims.push(poly(pts, { couleur: CHARTE.a_reprendre_troncon.couleur, epaisseur: CHARTE.a_reprendre_troncon.epaisseur, tirete: CHARTE.a_reprendre_troncon.tirete }));
    } else {
      const ech = echantillonSymbole(e.typeObjet, e.etat, e.attributs, e.domaine || 'BTS', e.pose || 'aerien');
      prims.push(...transformer(ech, { x: xEch, y, rotation: 0, echelle: 0.85 }));
    }
    prims.push(texte(xTexte, y + L.taille_texte * 0.36, e.libelle, { taille: L.taille_texte, couleur: '#000', ancre: 'debut' }));
    y += L.ligne;
  }
  // ligne de séparation sous le titre
  prims.push(ligne(L.marge, L.marge + L.taille_titre * 1.35, L.largeur - L.marge, L.marge + L.taille_titre * 1.35, '#000', 0.3));
  return transformer(prims, { x: pos.x, y: pos.y, rotation: 0, echelle });
}
