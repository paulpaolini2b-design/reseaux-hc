/* designation.js — génération et troncature des désignations de supports.
 *
 * Les formats viennent de nomenclature.json → designations_supports.formats.
 * Règle §6.3 : la désignation se construit à partir des seuls attributs
 * renseignés, elle se tronque au premier attribut manquant, elle ne se
 * complète jamais par des valeurs supposées.
 */
import { etat } from './etat.js';

/* Formats de repli si la nomenclature n'en fournit pas (identiques au cahier des charges). */
const FORMATS_REPLI = {
  BETON:            { format: 'BE {hauteur}m {classe} {effort}' },
  BOIS:             { format: 'BØ {hauteur}m {classe}' },
  BOIS_JUMELE:      { format: 'BØ J 2x{hauteur}m {classe}' },
  BOIS_CONTREFICHE: { format: 'BØ CF 2x{hauteur}m Y {effort}' },
  BOIS_HAUBANE:     { format: 'BØ H {hauteur}m {classe}' },
  ME_TUB:           { format: 'ME tub {hauteur}m {effort}' },
  ME_PTR:           { format: 'ME ptr {hauteur}m {effort}' }
};

function formats() {
  const n = etat.nomenclature;
  return (n && n.designations_supports && n.designations_supports.formats) || FORMATS_REPLI;
}

/* Clé de format selon matériau et renforcement. */
export function cleFormat(a) {
  if (a.materiau === 'BOIS') {
    if (a.renforcement === 'JUMELE') return 'BOIS_JUMELE';
    if (a.renforcement === 'CONTREFICHE') return 'BOIS_CONTREFICHE';
    if (a.renforcement === 'HAUBANE') return 'BOIS_HAUBANE';
    return 'BOIS';
  }
  return a.materiau || '';
}

/* Préfixe métallique proposé par défaut selon l'état (ME tub en neuf, ME ptr en existant / à déposer). */
export function materiauMetalliqueParDefaut(etatObjet) {
  return etatObjet === 'a_poser' ? 'ME_TUB' : 'ME_PTR';
}

/* Génère la désignation d'un support. Retourne '' si le matériau est inconnu. */
export function designationSupport(objet) {
  const a = objet.attributs || {};
  const cle = cleFormat(a);
  const f = formats()[cle] || FORMATS_REPLI[cle];
  if (!f) return '';
  const valeurs = {
    hauteur: (a.hauteur_m !== null && a.hauteur_m !== undefined && a.hauteur_m !== '') ? String(a.hauteur_m) : null,
    classe: a.classe ? String(a.classe) : null,
    effort: (a.effort_daN !== null && a.effort_daN !== undefined && a.effort_daN !== '') ? String(a.effort_daN) : null
  };
  return tronquer(f.format, valeurs, objet.etat);
}

/* Applique le format en s'arrêtant au premier attribut manquant.
 * Ex. "BE {hauteur}m {classe} {effort}" avec classe absente → "BE 11m". */
export function tronquer(format, valeurs, etatObjet) {
  const jetons = format.split(' ');
  const sortie = [];          // { texte, attribut: bool }
  for (const jeton of jetons) {
    const m = /\{(\w+)\}/.exec(jeton);
    if (!m) { sortie.push({ texte: jeton, attribut: false }); continue; }   // texte fixe (BE, J, CF, H, Y, tub, ptr…)
    const v = valeurs[m[1]];
    if (v === null || v === undefined || v === '') break;
    sortie.push({ texte: jeton.replace(m[0], v), attribut: true });
  }
  // Nettoyage des jetons fixes orphelins en fin ("Y" sans effort, etc.) : on retire
  // les jetons fixes qui suivent le dernier attribut renseigné, sauf le préfixe.
  let dernierAttribut = -1;
  for (let i = 0; i < sortie.length; i++) if (sortie[i].attribut) dernierAttribut = i;
  const prefixeLongueur = jetons.findIndex((j) => /\{/.test(j));   // nb de jetons de préfixe
  const coupe = Math.max(dernierAttribut + 1, prefixeLongueur);
  const res = sortie.slice(0, coupe).map((j) => j.texte);
  if (res.length === prefixeLongueur && (etatObjet === 'existant' || etatObjet === 'a_reprendre')) {
    return res.join(' ') + ' existant';   // « BE existant »
  }
  return res.join(' ');
}

/* Désignation automatique pour les autres types. */
export function designationAuto(objet) {
  const a = objet.attributs || {};
  switch (objet.type) {
    case 'support': return designationSupport(objet);
    case 'coffret': return a.sigle || '';
    case 'poste': return a.sigle ? (a.sigle + (a.puissance_kva ? ' ' + a.puissance_kva + ' kVA' : '')) : '';
    case 'armoire_ep': return a.sigle || '';
    case 'eras': return { BT_RESEAU: 'ERAS BT', HTA: 'ERAS HTA', BRANCHEMENT: 'RAS brt', EP: 'RAS EP' }[a.sous_type] || 'ERAS';
    case 'malt': return 'MALT';
    case 'boite_jonction': return 'BJ ' + (objet.domaine || '');
    case 'point_lumineux': return 'PL';
    case 'troncon': {
      let s = a.section || '';
      if (a.fourreau) s += (s ? ' ' : '') + a.fourreau;
      return s;
    }
    default: return '';
  }
}

/* Recalcule designation_auto d'un objet (la manuelle reste prioritaire). */
export function actualiserDesignation(objet) {
  objet.designation_auto = designationAuto(objet);
  return objet.designation_auto;
}
