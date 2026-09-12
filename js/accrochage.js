/* accrochage.js — recherche d'objets sous le pointeur (hit-test géométrique sur le
 * modèle) et accrochage aux extrémités / ouvrages / angles.
 *
 * La tolérance est fournie en unités plan par l'appelant (12 px stylet, 48 px
 * doigt convertis selon le zoom).
 */
import { etat, objets } from './etat.js';
import { primitivesObjet } from './symboles.js';
import { boitePrimitives } from './symboles.js';
import { boiteLegende } from './legende.js';
import { TYPES_PONCTUELS } from './modele.js';

export function distancePointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function objetActif(o) {
  const c = etat.projet.calques[o.calque] || etat.projet.calques.existant;
  if (!c.visible || c.verrou) return false;
  if (o.type !== 'note' && etat.projet.filtre_domaines[o.domaine] === false) return false;
  return true;
}

function dansBoite(p, b) {
  return b && p.x >= b.x && p.x <= b.x + b.l && p.y >= b.y && p.y <= b.y + b.h;
}

/* Cache des primitives par empreinte (évite de recalculer pour chaque test). */
const cache = new Map();
export function primsObjet(o) {
  const cle = JSON.stringify(o) + '|' + JSON.stringify(etat.projet.reglages);
  let c = cache.get(o.id);
  if (!c || c.cle !== cle) { c = { cle, r: primitivesObjet(o, etat.projet.reglages) }; cache.set(o.id, c); }
  return c.r;
}

/* Teste un objet. Retourne { distance, partie, index } ou null. */
export function testerObjet(o, p, tol) {
  const r = primsObjet(o);
  if (o.type === 'troncon') {
    // sommets d'abord
    for (let i = 0; i < o.points.length; i++) {
      const d = Math.hypot(p.x - o.points[i].x, p.y - o.points[i].y);
      if (d <= tol) return { distance: d, partie: 'sommet', index: i };
    }
    let best = Infinity, idx = -1;
    for (let i = 0; i + 1 < o.points.length; i++) {
      const d = distancePointSegment(p, o.points[i], o.points[i + 1]);
      if (d < best) { best = d; idx = i; }
    }
    if (best <= tol + 1) return { distance: best, partie: 'corps', index: idx };
    if (etat.etiquettesVisibles && dansBoite(p, r.boiteEtiquette)) return { distance: tol, partie: 'etiquette', index: -1 };
    return null;
  }
  if (o.type === 'note') {
    // Rotation inverse du point autour de l'ancre, puis test dans la boîte locale
    const a = (-(o.rotation || 0) * Math.PI) / 180;
    const dx = p.x - o.x, dy = p.y - o.y;
    const q = { x: o.x + dx * Math.cos(a) - dy * Math.sin(a), y: o.y + dx * Math.sin(a) + dy * Math.cos(a) };
    const b = r.boite;
    if (b && q.x >= b.x - tol / 2 && q.x <= b.x + b.l + tol / 2 && q.y >= b.y - tol / 2 && q.y <= b.y + b.h + tol / 2) {
      return { distance: Math.hypot(p.x - (b.x + b.l / 2), p.y - (b.y + b.h / 2)), partie: 'corps', index: -1 };
    }
    if (o.fleche && Math.hypot(p.x - o.fleche.x, p.y - o.fleche.y) <= tol) return { distance: 0, partie: 'fleche', index: -1 };
    return null;
  }
  // ponctuel
  const d = Math.hypot(p.x - o.x, p.y - o.y);
  if (d <= (r.rayon || 2) + tol) return { distance: d, partie: 'corps', index: -1 };
  if (etat.etiquettesVisibles && dansBoite(p, r.boiteEtiquette)) return { distance: tol + 0.5, partie: 'etiquette', index: -1 };
  return null;
}

/* Recherche le meilleur objet sous le point. options : { ignorer: Set<id>, types: [..], seulementSelection } */
export function chercherObjet(p, tol, options = {}) {
  if (!etat.plan) return null;
  let best = null;
  for (const o of objets()) {
    if (options.ignorer && options.ignorer.has(o.id)) continue;
    if (options.types && !options.types.includes(o.type)) continue;
    if (options.seulementSelection && !etat.selection.has(o.id)) continue;
    if (!objetActif(o)) continue;
    const t = testerObjet(o, p, tol);
    if (!t) continue;
    const prio = TYPES_PONCTUELS.includes(o.type) ? 0 : (o.type === 'note' ? 1 : 2);
    const score = prio * 1000 + (t.partie === 'etiquette' ? 500 : 0) + t.distance;
    if (!best || score < best.score) best = { objet: o, score, ...t };
  }
  return best;
}

/* Objets dont la boîte est contenue dans un rectangle plan (lasso). */
export function objetsDansRectangle(rect) {
  const res = [];
  const x2 = rect.x + rect.l, y2 = rect.y + rect.h;
  for (const o of objets()) {
    if (!objetActif(o)) continue;
    const b = boiteObjet(o);
    if (!b) continue;
    if (b.x >= rect.x && b.y >= rect.y && b.x + b.l <= x2 && b.y + b.h <= y2) res.push(o);
  }
  return res;
}

/* Boîte englobante d'un objet (corps seul). */
export function boiteObjet(o) {
  const r = primsObjet(o);
  return boitePrimitives(r.corps);
}

/* Légende sous le point ? */
export function testerLegende(p) {
  const b = boiteLegende(etat.plan, objets());
  return b && dansBoite(p, b) ? b : null;
}

/* ---------- Accrochage ---------- */
/* Accroche p aux extrémités de tronçons et aux centres d'ouvrages ponctuels. */
export function accrocher(p, tol, { exclureId = null } = {}) {
  let best = null;
  for (const o of objets()) {
    if (o.id === exclureId || !objetActif(o) || o.type === 'note') continue;
    const candidats = o.type === 'troncon' ? [o.points[0], o.points[o.points.length - 1]] : [{ x: o.x, y: o.y }];
    for (const c of candidats) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d <= tol && (!best || d < best.d)) best = { x: c.x, y: c.y, d, objet: o };
    }
  }
  return best;
}

/* Accrochage angulaire (0 / 45 / 90°) par rapport au point précédent. */
export function accrocherAngle(precedent, p) {
  const dx = p.x - precedent.x, dy = p.y - precedent.y;
  const L = Math.hypot(dx, dy);
  if (!L) return p;
  const a = Math.atan2(dy, dx);
  const pas = Math.PI / 4;
  const a2 = Math.round(a / pas) * pas;
  return { x: precedent.x + Math.cos(a2) * L, y: precedent.y + Math.sin(a2) * L };
}

export function viderCacheAccrochage() { cache.clear(); }
