/* outils.js — outils de tracé et d'édition (machine d'états).
 *
 * pointeur.js traduit les événements bruts en gestes (appui, glisser, appui long,
 * survol) et les transmet ici. Les outils manipulent le modèle et passent par
 * historique.valider() pour chaque action terminée.
 */
import { etat, emettre, sur, objets, objetParId, objetsSelectionnes, selectionner, deselectionner, notifier } from './etat.js';
import { CHARTE } from './charte.js';
import { pxVersPlan } from './vue.js';
import { nouvelObjetPonctuel, nouveauTroncon, nouvelleNote, attribuerRepere, cloner, genererId, calquePourEtat, TYPES_PONCTUELS } from './modele.js';
import { valider, apercu, restaurerDernier } from './historique.js';
import { chercherObjet, accrocher, accrocherAngle, boiteObjet, testerLegende, primsObjet } from './accrochage.js';
import { dessinerTemporaire, viderTemporaire, definirFournisseurPoignees, dessinerPoignees, surligner } from './rendu-svg.js';
import { poly, cercle } from './primitives.js';
import { primitivesTroncon } from './symboles.js';
import { boiteLegende } from './legende.js';
import { ouvrirEditeurNote } from './ui/notes.js';

/* Outils principaux (touches 1 à 9) */
export const OUTILS = [
  { id: 'selection', touche: '1', libelle: 'Sélection', icone: 'M5 3l14 9-6 1-3 6z' },
  { id: 'troncon', touche: '2', libelle: 'Tronçon', icone: 'M3 19l6-8 5 4 7-10', trait: true },
  { id: 'support', touche: '3', libelle: 'Support', type: 'support', icone: 'M6 8h12v8H6z' },
  { id: 'coffret', touche: '4', libelle: 'Coffret / borne', type: 'coffret', icone: 'M4 6h16v12H4z M8 12h8' },
  { id: 'poste', touche: '5', libelle: 'Poste HTA', type: 'poste', icone: 'M3 7h18v10H3z M7 12h10' },
  { id: 'boite_jonction', touche: '6', libelle: 'Boîte de jonction', type: 'boite_jonction', icone: 'M12 8a8 4 0 1 0 0.1 0z' },
  { id: 'eras', touche: '7', libelle: 'ERAS / RAS', type: 'eras', icone: 'M8 8a3 3 0 1 0 .1 0z M16 6v6M12 12h8M13.5 14.5h5M15 17h2' },
  { id: 'malt', touche: '8', libelle: 'MALT', type: 'malt', icone: 'M12 4v8M5 12h14M7 15h10M9.5 18h5' },
  { id: 'note', touche: '9', libelle: 'Note de terrain', icone: 'M5 4h14v12H9l-4 4z M8 8h8M8 12h5' },
  { id: 'gomme', touche: '', libelle: 'Gomme', icone: 'M4 16l8-8 6 6-6 6H8z M12 8l4-4 6 6-4 4' }
];

const s = {                   // état interne des outils
  polyligne: null,            // points en cours (outil tronçon)
  survolPoint: null,
  glisser: null               // { mode, ... } pendant un glissement
};

export function initialiserOutils() {
  definirFournisseurPoignees(poignees);
  sur('projet-ouvert', () => { s.polyligne = null; viderTemporaire(); });
}

/* Tolérance en unités plan selon le type de pointeur (12 px stylet, 48 px doigt). */
export function tolerance(pointerType) {
  return pxVersPlan(pointerType === 'touch' ? 24 : 12);
}

/* ---------- Choix de l'outil ---------- */
export function definirOutil(id, preset = null) {
  if (etat.outil === 'troncon' && id !== 'troncon') annulerAction();
  etat.outil = id;
  etat.preset = preset;
  const def = OUTILS.find((o) => o.id === id);
  if (!preset && def && def.type) etat.preset = { type: def.type, attributs: {} };
  if (id === 'note' || id === 'selection' || id === 'gomme' || id === 'troncon') { if (!preset) etat.preset = null; }
  viderTemporaire();
  emettre('outil', { id, preset: etat.preset });
}

/* ---------- Gestes ---------- */
export function appui(p, ctx) {
  const tol = tolerance(ctx.pointerType);
  switch (etat.outil) {
    case 'selection': return appuiSelection(p, ctx, tol);
    case 'troncon': return appuiTroncon(p, ctx, tol);
    case 'note': return poserNote(p);
    case 'gomme': return gommer(p, tol, true);
    default: return poserPonctuel(p, tol);
  }
}

export function doubleAppui(p, ctx) {
  if (etat.outil === 'troncon' && s.polyligne) { terminerPolyligne(); return true; }
  if (etat.outil === 'selection') {
    const h = chercherObjet(p, tolerance(ctx.pointerType));
    if (h) { selectionner([h.objet.id]); emettre('ouvrir-fiche', h.objet.id); return true; }
  }
  return false;
}

export function appuiLong(p, ctx) {
  const tol = tolerance(ctx.pointerType);
  const h = chercherObjet(p, tol);
  if (h && !etat.selection.has(h.objet.id)) selectionner([h.objet.id]);
  emettre('menu-contextuel', { x: ctx.ecran.x, y: ctx.ecran.y, plan: p, objet: h ? h.objet : null });
  return true;
}

/* Survol du stylet : surbrillance de l'objet qui serait sélectionné, aperçu de tracé. */
export function survol(p, ctx) {
  s.survolPoint = p;
  if (etat.outil === 'troncon' && s.polyligne) { dessinerApercuPolyligne(p, ctx); return; }
  if (etat.outil === 'selection' || etat.outil === 'gomme') {
    const h = chercherObjet(p, tolerance('pen'));
    surligner(h ? h.objet.id : null);
  } else {
    surligner(null);
    const a = accrocher(p, tolerance('pen'));
    if (a) dessinerTemporaire([cercle(a.x, a.y, pxVersPlan(7), { couleur: CHARTE.ecran.accrochage, epaisseur: pxVersPlan(1.5), remplissage: null })]);
    else viderTemporaire();
  }
}

export function finSurvol() { surligner(null); if (!(etat.outil === 'troncon' && s.polyligne)) viderTemporaire(); }

/* Début de glissement. Retourne true si l'outil prend le geste (sinon : navigation). */
export function debutGlisser(p, ctx) {
  const tol = tolerance(ctx.pointerType);
  if (ctx.poignee) return debutPoignee(ctx.poignee, p, ctx);
  switch (etat.outil) {
    case 'selection': {
      const h = chercherObjet(p, tol);
      if (h) {
        if (!etat.selection.has(h.objet.id)) {
          if (ctx.pointerType === 'touch') return false;   // au doigt, on ne déplace qu'un objet déjà sélectionné
          selectionner([h.objet.id], { ajouter: ctx.shift });
        }
        s.glisser = { mode: h.partie === 'etiquette' ? 'etiquette' : 'deplacer', origine: p, id: h.objet.id, avant: cloner(objetsSelectionnes()) };
        return true;
      }
      const lg = testerLegende(p);
      if (lg) { selectionner(['legende']); s.glisser = { mode: 'legende', origine: p, depart: { x: lg.x, y: lg.y } }; return true; }
      if (ctx.pointerType === 'touch') return false;
      deselectionner();
      s.glisser = { mode: 'lasso', origine: p };
      return true;
    }
    case 'troncon': {
      if (ctx.pointerType === 'touch') return false;
      if (!s.polyligne) {
        const a = accrocher(p, tol);
        s.polyligne = [a ? { x: a.x, y: a.y } : p];
      }
      s.glisser = { mode: 'segment' };
      return true;
    }
    case 'gomme':
      s.glisser = { mode: 'gomme', supprimes: 0 };
      gommer(p, tol, false);
      return true;
    case 'note':
      return false;
    default: {
      if (ctx.pointerType === 'touch') return false;
      // Poser puis orienter : l'objet suit la direction du glissement
      const o = poserPonctuel(p, tol, { sansValider: true });
      if (!o) return false;
      s.glisser = { mode: 'orienter', id: o.id, centre: { x: o.x, y: o.y } };
      return true;
    }
  }
}

export function glisser(p, ctx) {
  const g = s.glisser;
  if (!g) return;
  switch (g.mode) {
    case 'deplacer': {
      const dx = p.x - g.origine.x, dy = p.y - g.origine.y;
      for (const o of objetsSelectionnes()) {
        const av = g.avant.find((a) => a.id === o.id);
        if (!av) continue;
        deplacerObjet(o, av, dx, dy);
      }
      apercu(); break;
    }
    case 'etiquette': {
      const o = objetParId(g.id);
      const av = g.avant.find((a) => a.id === g.id);
      if (o && av) { o.etiquette.dx = (av.etiquette.dx ?? 0) + (p.x - g.origine.x); o.etiquette.dy = (av.etiquette.dy ?? 0) + (p.y - g.origine.y); apercu(); }
      break;
    }
    case 'legende': {
      etat.plan.legende.x = g.depart.x + (p.x - g.origine.x);
      etat.plan.legende.y = g.depart.y + (p.y - g.origine.y);
      apercu(); break;
    }
    case 'echelle-legende': {
      const b = boiteLegende(etat.plan, objets());
      if (b) { const f = Math.max(0.4, Math.min(3, (p.x - b.x) / (CHARTE.legende.largeur))); etat.plan.legende.echelle = f; apercu(); }
      break;
    }
    case 'lasso':
      dessinerTemporaire([poly(rectPoints(g.origine, p), { ferme: true, couleur: CHARTE.ecran.selection, epaisseur: pxVersPlan(1), remplissage: CHARTE.ecran.lasso, tirete: [pxVersPlan(4), pxVersPlan(3)] })]);
      break;
    case 'segment':
      dessinerApercuPolyligne(p, ctx);
      break;
    case 'orienter': {
      const o = objetParId(g.id);
      if (o) { const d = Math.hypot(p.x - g.centre.x, p.y - g.centre.y); if (d > tolerance(ctx.pointerType) / 2) { o.rotation = angleVers(g.centre, p); apercu(); } }
      break;
    }
    case 'rotation': {
      const o = objetParId(g.id);
      if (o) { o.rotation = Math.round(angleVers(g.centre, p) - g.decalage); if (ctx.shift) o.rotation = Math.round(o.rotation / 15) * 15; apercu(); }
      break;
    }
    case 'sommet': {
      const o = objetParId(g.id);
      if (o) {
        const a = accrocher(p, tolerance(ctx.pointerType), { exclureId: o.id });
        let q = a ? { x: a.x, y: a.y } : p;
        if (etat.accrochageAngulaire && !a) { const voisin = o.points[g.index - 1] || o.points[g.index + 1]; if (voisin) q = accrocherAngle(voisin, q); }
        o.points[g.index] = q; apercu();
      }
      break;
    }
    case 'fleche': {
      const o = objetParId(g.id);
      if (o) { o.fleche = { x: p.x, y: p.y }; apercu(); }
      break;
    }
    case 'gomme':
      gommer(p, tolerance(ctx.pointerType), false);
      break;
  }
}

export function finGlisser(p, ctx) {
  const g = s.glisser;
  s.glisser = null;
  if (!g) return;
  switch (g.mode) {
    case 'deplacer': valider('Déplacement'); break;
    case 'etiquette': valider('Étiquette déplacée'); break;
    case 'legende': case 'echelle-legende': emettre('objets'); break;
    case 'lasso': {
      viderTemporaire();
      const r = rectPoints(g.origine, p);
      const rect = { x: Math.min(g.origine.x, p.x), y: Math.min(g.origine.y, p.y), l: Math.abs(p.x - g.origine.x), h: Math.abs(p.y - g.origine.y) };
      const ids = objetsDansRect(rect).map((o) => o.id);
      selectionner(ids, { ajouter: ctx.shift });
      void r;
      break;
    }
    case 'segment': {
      const tol = tolerance(ctx.pointerType);
      const a = accrocher(p, tol);
      let q = a ? { x: a.x, y: a.y } : p;
      const dernier = s.polyligne[s.polyligne.length - 1];
      if (etat.accrochageAngulaire && !a) q = accrocherAngle(dernier, q);
      if (Math.hypot(q.x - dernier.x, q.y - dernier.y) > tol / 2) s.polyligne.push(q);
      dessinerApercuPolyligne(null, ctx);
      break;
    }
    case 'orienter': valider('Objet posé'); break;
    case 'rotation': valider('Rotation'); break;
    case 'sommet': valider('Sommet déplacé'); break;
    case 'fleche': valider('Flèche de note'); break;
    case 'gomme': if (g.supprimes) valider('Suppression'); break;
  }
  dessinerPoignees();
}

/* Annule l'action en cours (Échap). */
export function annulerAction() {
  if (s.glisser) {
    if (s.glisser.mode === 'deplacer' || s.glisser.mode === 'rotation' || s.glisser.mode === 'sommet') {
      // restauration par annulation de l'aperçu : on recharge le dernier état validé
      restaurerDernier();
    }
    s.glisser = null;
  }
  if (s.polyligne) { s.polyligne = null; viderTemporaire(); notifier('Tracé abandonné'); return true; }
  if (etat.selection.size) { deselectionner(); return true; }
  return false;
}

/* ---------- Sélection ---------- */
function appuiSelection(p, ctx, tol) {
  const h = chercherObjet(p, tol);
  if (h) {
    if (ctx.shift && etat.selection.has(h.objet.id)) { etat.selection.delete(h.objet.id); emettre('selection', [...etat.selection]); }
    else selectionner([h.objet.id], { ajouter: ctx.shift });
    emettre('objet-touche', h.objet.id);
    return true;
  }
  if (testerLegende(p)) { selectionner(['legende']); return true; }
  deselectionner();
  emettre('fermer-panneaux');
  return true;
}

function objetsDansRect(rect) {
  const res = [];
  for (const o of objets()) {
    const b = boiteObjet(o);
    if (!b) continue;
    if (b.x >= rect.x && b.y >= rect.y && b.x + b.l <= rect.x + rect.l && b.y + b.h <= rect.y + rect.h) res.push(o);
  }
  return res;
}

function rectPoints(a, b) { return [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }]; }

function deplacerObjet(o, av, dx, dy) {
  if (o.type === 'troncon') o.points = av.points.map((q) => ({ x: q.x + dx, y: q.y + dy }));
  else { o.x = av.x + dx; o.y = av.y + dy; if (o.type === 'note' && av.fleche) o.fleche = { x: av.fleche.x + dx, y: av.fleche.y + dy }; }
}

function angleVers(centre, p) {
  return (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI + 90;
}

/* Déplacement au clavier (flèches) : pas en pixels écran. */
export function deplacerSelection(dxPx, dyPx) {
  const sel = objetsSelectionnes();
  if (!sel.length) return;
  const dx = pxVersPlan(dxPx), dy = pxVersPlan(dyPx);
  for (const o of sel) deplacerObjet(o, cloner(o), dx, dy);
  valider('Déplacement');
}

export function supprimerSelection() {
  if (etat.selection.has('legende')) { etat.plan.legende.visible = false; etat.selection.delete('legende'); emettre('objets'); }
  const ids = new Set(etat.selection);
  if (!ids.size) return;
  etat.plan.objets = objets().filter((o) => !ids.has(o.id));
  deselectionner();
  valider('Suppression');
}

export function dupliquerSelection() {
  const sel = objetsSelectionnes();
  if (!sel.length) return;
  const d = pxVersPlan(24);
  const clones = sel.map((o) => {
    const c = cloner(o); c.id = genererId(); c.repere = ''; attribuerRepere(etat.projet, c);
    deplacerObjet(c, o, d, d);
    return c;
  });
  etat.plan.objets.push(...clones);
  selectionner(clones.map((c) => c.id));
  valider('Duplication');
}

export function tournerSelection(deg) {
  const sel = objetsSelectionnes().filter((o) => o.type !== 'troncon');
  if (!sel.length) return;
  for (const o of sel) o.rotation = ((o.rotation || 0) + deg + 360) % 360;
  valider('Rotation');
}

/* Modification groupée d'attributs communs (état, domaine, pose, calque…). */
export function modifierSelection(champs) {
  const sel = objetsSelectionnes();
  if (!sel.length) return;
  for (const o of sel) {
    Object.assign(o, champs);
    if (champs.etat && o.type !== 'note') o.calque = calquePourEtat(champs.etat, o.type);
  }
  valider('Modification groupée');
}

export function basculerEtiquettesSelection() {
  const sel = objetsSelectionnes();
  if (!sel.length) return;
  const cible = !sel.every((o) => o.etiquette.visible);
  for (const o of sel) o.etiquette.visible = cible;
  valider('Étiquettes');
}

/* ---------- Pose d'objets ponctuels ---------- */
function poserPonctuel(p, tol, { sansValider = false } = {}) {
  const preset = etat.preset || { type: 'support', attributs: {} };
  if (preset.type === 'troncon') { notifier('Cet article se trace comme un tronçon : utilisez l’outil Tronçon.'); return null; }
  const a = accrocher(p, tol);
  const q = a ? { x: a.x, y: a.y } : p;
  const courant = { ...etat.courant };
  if (preset.domaine) courant.domaine = preset.domaine;
  if (preset.pose) courant.pose = preset.pose;
  const o = nouvelObjetPonctuel(preset.type, q.x, q.y, courant, preset.attributs || {});
  if (preset.ref_article) o.ref_article = preset.ref_article;
  attribuerRepere(etat.projet, o);
  etat.plan.objets.push(o);
  emettre('objet-pose', o);
  if (!sansValider) valider('Objet posé');
  return o;
}

function poserNote(p) {
  const n = nouvelleNote(p.x, p.y, '');
  attribuerRepere(etat.projet, n);
  etat.plan.objets.push(n);
  valider('Note');
  selectionner([n.id]);
  ouvrirEditeurNote(n.id, { nouvelle: true });
  return true;
}

/* ---------- Tronçons ---------- */
function appuiTroncon(p, ctx, tol) {
  const a = accrocher(p, tol);
  let q = a ? { x: a.x, y: a.y } : p;
  if (!s.polyligne) { s.polyligne = [q]; dessinerApercuPolyligne(null, ctx); return true; }
  const dernier = s.polyligne[s.polyligne.length - 1];
  if (Math.hypot(q.x - dernier.x, q.y - dernier.y) <= tol) { terminerPolyligne(); return true; }   // appui sur le dernier point = fin
  if (etat.accrochageAngulaire && !a) q = accrocherAngle(dernier, q);
  s.polyligne.push(q);
  dessinerApercuPolyligne(null, ctx);
  return true;
}

function dessinerApercuPolyligne(p, ctx) {
  if (!s.polyligne) { viderTemporaire(); return; }
  const pts = [...s.polyligne];
  let accroche = null;
  if (p) {
    const a = accrocher(p, tolerance(ctx ? ctx.pointerType : 'pen'));
    let q = a ? { x: a.x, y: a.y } : p;
    if (etat.accrochageAngulaire && !a) q = accrocherAngle(pts[pts.length - 1], q);
    pts.push(q);
    if (a) accroche = a;
  }
  const faux = { domaine: etat.courant.domaine, pose: etat.courant.pose, etat: etat.courant.etat, points: pts };
  const prims = pts.length > 1 ? primitivesTroncon(faux) : [];
  const r = pxVersPlan(5);
  for (const q of s.polyligne) prims.push(cercle(q.x, q.y, r, { couleur: CHARTE.ecran.selection, epaisseur: pxVersPlan(1.5), remplissage: '#fff' }));
  const dernier = s.polyligne[s.polyligne.length - 1];
  prims.push(cercle(dernier.x, dernier.y, r * 1.8, { couleur: CHARTE.ecran.selection, epaisseur: pxVersPlan(1), remplissage: null, tirete: [pxVersPlan(3), pxVersPlan(2)] }));
  if (accroche) prims.push(cercle(accroche.x, accroche.y, pxVersPlan(7), { couleur: CHARTE.ecran.accrochage, epaisseur: pxVersPlan(1.5), remplissage: null }));
  dessinerTemporaire(prims);
}

export function terminerPolyligne() {
  if (!s.polyligne) return false;
  const pts = s.polyligne;
  s.polyligne = null;
  viderTemporaire();
  if (pts.length < 2) { notifier('Tracé trop court : au moins deux points.'); return false; }
  const preset = etat.preset && etat.preset.type === 'troncon' ? etat.preset : null;
  const courant = { ...etat.courant };
  if (preset && preset.domaine) courant.domaine = preset.domaine;
  if (preset && preset.pose) courant.pose = preset.pose;
  const t = nouveauTroncon(pts, courant, preset ? preset.attributs : {});
  if (preset && preset.ref_article) t.ref_article = preset.ref_article;
  attribuerRepere(etat.projet, t);
  etat.plan.objets.push(t);
  emettre('objet-pose', t);
  valider('Tronçon tracé');
  return true;
}

export function polyligneEnCours() { return s.polyligne; }

/* ---------- Gomme ---------- */
function gommer(p, tol, validerTout) {
  const h = chercherObjet(p, tol);
  if (!h) return false;
  etat.plan.objets = objets().filter((o) => o.id !== h.objet.id);
  etat.selection.delete(h.objet.id);
  if (s.glisser && s.glisser.mode === 'gomme') s.glisser.supprimes++;
  if (validerTout) valider('Suppression'); else apercu();
  return true;
}

/* Gomme par le bouton latéral du stylet, quel que soit l'outil courant. */
export function appuiGomme(p, ctx) { gommer(p, tolerance(ctx.pointerType), true); }
export function debutGlisserGomme(p, ctx) { s.glisser = { mode: 'gomme', supprimes: 0 }; gommer(p, tolerance(ctx.pointerType), false); return true; }
export function finGlisserGomme(p, ctx) { finGlisser(p, ctx); }

/* ---------- Poignées ---------- */
function debutPoignee(id, p, ctx) {
  const [role, objId, idx] = id.split(':');
  if (role === 'echelle-legende') { s.glisser = { mode: 'echelle-legende' }; return true; }
  const o = objetParId(objId);
  if (!o) return false;
  switch (role) {
    case 'rotation': {
      const centre = { x: o.x, y: o.y };
      s.glisser = { mode: 'rotation', id: o.id, centre, decalage: angleVers(centre, p) - (o.rotation || 0) };
      return true;
    }
    case 'sommet': s.glisser = { mode: 'sommet', id: o.id, index: parseInt(idx, 10) }; return true;
    case 'milieu': {
      const i = parseInt(idx, 10);
      o.points.splice(i + 1, 0, { x: p.x, y: p.y });
      s.glisser = { mode: 'sommet', id: o.id, index: i + 1 };
      return true;
    }
    case 'etiquette': s.glisser = { mode: 'etiquette', origine: p, id: o.id, avant: [cloner(o)] }; return true;
    case 'fleche': s.glisser = { mode: 'fleche', id: o.id }; return true;
    default: return false;
  }
}

function poignees() {
  const res = [];
  if (!etat.plan) return res;
  if (etat.selection.has('legende')) {
    const b = boiteLegende(etat.plan, objets());
    if (b) { res.push({ forme: 'contour', ...b }); res.push({ id: 'echelle-legende', role: 'echelle', forme: 'carre', x: b.x + b.l, y: b.y + b.h }); }
  }
  const sel = objetsSelectionnes();
  const unique = sel.length === 1;
  for (const o of sel) {
    const b = boiteObjet(o);
    if (b) res.push({ forme: 'contour', ...b });
    if (!unique) continue;
    const r = primsObjet(o);
    if (o.type === 'troncon') {
      o.points.forEach((q, i) => res.push({ id: 'sommet:' + o.id + ':' + i, role: 'sommet', forme: 'carre', x: q.x, y: q.y }));
      for (let i = 0; i + 1 < o.points.length; i++) {
        res.push({ id: 'milieu:' + o.id + ':' + i, role: 'milieu', forme: 'petit', x: (o.points[i].x + o.points[i + 1].x) / 2, y: (o.points[i].y + o.points[i + 1].y) / 2 });
      }
    } else if (o.type === 'note') {
      const a = ((o.rotation || 0) * Math.PI) / 180;
      const d = pxVersPlan(38);
      res.push({ id: 'rotation:' + o.id, role: 'rotation', forme: 'rond', x: o.x + Math.sin(a) * d, y: o.y - Math.cos(a) * d });
      res.push({ forme: 'lien', x: o.x, y: o.y, x2: o.x + Math.sin(a) * d, y2: o.y - Math.cos(a) * d });
      if (o.fleche) res.push({ id: 'fleche:' + o.id, role: 'fleche', forme: 'losange', x: o.fleche.x, y: o.fleche.y });
    } else {
      const a = ((o.rotation || 0) * Math.PI) / 180;
      const d = (r.rayon || 3) + pxVersPlan(34);
      const hx = o.x + Math.sin(a) * d, hy = o.y - Math.cos(a) * d;
      res.push({ forme: 'lien', x: o.x, y: o.y, x2: hx, y2: hy });
      res.push({ id: 'rotation:' + o.id, role: 'rotation', forme: 'rond', x: hx, y: hy });
    }
    if (etat.etiquettesVisibles && r.boiteEtiquette && o.type !== 'note') {
      res.push({ id: 'etiquette:' + o.id, role: 'etiquette', forme: 'petit', x: r.boiteEtiquette.x, y: r.boiteEtiquette.y });
    }
  }
  return res;
}

export { TYPES_PONCTUELS };
