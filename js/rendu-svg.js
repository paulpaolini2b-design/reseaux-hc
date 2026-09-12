/* rendu-svg.js — projection des primitives vers le DOM SVG.
 *
 * Un <g> par objet, re-rendu uniquement quand l'objet change (comparaison d'une
 * empreinte JSON). Les poignées de sélection et le curseur sont dessinés dans des
 * groupes en coordonnées écran (non mis à l'échelle), jamais exportés.
 */
import { etat, sur, objets } from './etat.js';
import { CHARTE } from './charte.js';
import { vue, versEcran } from './vue.js';
import { primitivesObjet } from './symboles.js';
import { primitivesLegende } from './legende.js';
import { surChangementVue, appliquerVisibiliteCalqueFond } from './fond.js';

const NS = 'http://www.w3.org/2000/svg';
let svg, gVue, gObjets, gTemp, gPoignees, gCurseur;
const empreintes = new Map();   // id → { empreinte, g }
let rafDemande = false;

export function initialiserRendu() {
  svg = document.getElementById('plan-svg');
  gVue = document.getElementById('g-vue');
  gObjets = document.getElementById('g-objets');
  gTemp = document.getElementById('g-temporaire');
  gPoignees = document.getElementById('g-poignees');
  gCurseur = document.getElementById('g-curseur');

  sur('vue', () => { appliquerVue(); surChangementVue(); dessinerPoignees(); });
  sur('objets', () => demanderRendu());
  sur('objets-apercu', () => demanderRendu());
  sur('selection', () => { demanderRendu(); });
  sur('calques', () => { appliquerCalques(); appliquerVisibiliteCalqueFond(); demanderRendu(); });
  sur('reglages', () => { empreintes.clear(); gObjets.innerHTML = ''; demanderRendu(); });
  sur('projet-ouvert', () => { empreintes.clear(); gObjets.innerHTML = ''; appliquerVue(); appliquerCalques(); demanderRendu(); });
}

export function el(nom, attrs = {}) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  return e;
}

function appliquerVue() {
  gVue.setAttribute('transform', `matrix(${vue.k} 0 0 ${vue.k} ${vue.tx} ${vue.ty})`);
  const ind = document.getElementById('indicateur-zoom');
  if (ind) ind.textContent = Math.round(vue.k * 100) + ' %';
}

export function demanderRendu() {
  if (rafDemande) return;
  rafDemande = true;
  requestAnimationFrame(() => { rafDemande = false; rendreTout(); });
}

/* ---------- Primitives → éléments SVG ---------- */
export function primVersSvg(p) {
  switch (p.t) {
    case 'ligne':
      return el('line', {
        x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, stroke: p.couleur || 'none', 'stroke-width': p.epaisseur,
        'stroke-dasharray': p.tirete ? p.tirete.join(' ') : null, 'stroke-linecap': p.bout || 'round'
      });
    case 'poly': {
      if (!p.points.length) return null;
      let d = 'M' + p.points.map((q) => q.x.toFixed(2) + ' ' + q.y.toFixed(2)).join('L');
      if (p.ferme) d += 'Z';
      return el('path', {
        d, fill: p.remplissage || 'none', stroke: p.couleur || 'none', 'stroke-width': p.couleur ? p.epaisseur : 0,
        'stroke-dasharray': p.tirete ? p.tirete.join(' ') : null, 'stroke-linejoin': p.joint || 'round', 'stroke-linecap': 'round'
      });
    }
    case 'cercle':
      return el('circle', { cx: p.cx, cy: p.cy, r: p.r, fill: p.remplissage || 'none', stroke: p.couleur || 'none', 'stroke-width': p.couleur ? p.epaisseur : 0 });
    case 'texte': {
      const t = el('text', {
        x: p.x, y: p.y, 'font-size': p.taille, fill: p.couleur, 'font-family': CHARTE.texte.police,
        'text-anchor': p.ancre === 'milieu' ? 'middle' : (p.ancre === 'fin' ? 'end' : 'start'),
        transform: p.rotation ? `rotate(${p.rotation} ${p.x} ${p.y})` : null
      });
      t.textContent = p.texte;
      return t;
    }
    default:
      return null;
  }
}

export function ajouterPrims(groupe, prims) {
  for (const p of prims) { const e = primVersSvg(p); if (e) groupe.appendChild(e); }
}

/* ---------- Rendu des objets ---------- */
function ordreZ(o) {
  const i = CHARTE.ordre_z.indexOf(o.type);
  return i < 0 ? 99 : i;
}

function rendreTout() {
  if (!etat.plan) return;
  const liste = objets();
  const reglages = etat.projet.reglages;
  const vus = new Set();
  const tries = liste.map((o, i) => ({ o, i })).sort((a, b) => ordreZ(a.o) - ordreZ(b.o) || a.i - b.i);

  for (const { o } of tries) {
    vus.add(o.id);
    const selectionne = etat.selection.has(o.id);
    const empreinte = JSON.stringify(o) + '|' + (selectionne ? 1 : 0) + '|' + (etat.etiquettesVisibles ? 1 : 0) + '|' + etat.modePapier;
    let entree = empreintes.get(o.id);
    if (!entree) {
      const g = el('g', { 'data-id': o.id, class: 'objet' });
      gObjets.appendChild(g);
      entree = { empreinte: null, g };
      empreintes.set(o.id, entree);
    }
    if (entree.empreinte !== empreinte) {
      entree.empreinte = empreinte;
      rendreObjet(entree.g, o, reglages, selectionne);
    }
    // ordre z : on réordonne en déplaçant en fin (opération sans coût si déjà en place)
    if (entree.g !== gObjets.lastElementChild) gObjets.appendChild(entree.g);
    appliquerVisibiliteObjet(entree.g, o);
  }
  for (const [id, entree] of empreintes) if (!vus.has(id)) { entree.g.remove(); empreintes.delete(id); }
  rendreLegende();
  dessinerPoignees();
}

function rendreObjet(g, o, reglages, selectionne) {
  g.innerHTML = '';
  g.setAttribute('class', 'objet' + (selectionne ? ' selectionne' : '') + (o.complet === false && o.type !== 'note' ? ' incomplet' : ''));
  const r = primitivesObjet(o, reglages);
  const gCorps = el('g', { 'data-role': 'corps' });
  ajouterPrims(gCorps, r.corps);
  g.appendChild(gCorps);
  if (etat.etiquettesVisibles && r.etiquette.length) {
    const gEt = el('g', { 'data-role': 'etiquette' });
    ajouterPrims(gEt, r.etiquette);
    g.appendChild(gEt);
  }
  // Indicateur discret « objet incomplet » (jamais exporté) : petit point orange
  if (!etat.modePapier && o.complet === false && o.type !== 'note') {
    const p = o.type === 'troncon' ? o.points[0] : { x: o.x, y: o.y };
    const rayon = (r.rayon || 3) + 1.2;
    g.appendChild(el('circle', { cx: p.x + rayon * 0.7, cy: p.y - rayon * 0.7, r: 1.1, fill: '#FF8A00', stroke: '#fff', 'stroke-width': 0.3, class: 'marque-incomplet' }));
  }
}

function appliquerVisibiliteObjet(g, o) {
  const calque = etat.projet.calques[o.calque] || etat.projet.calques.existant;
  const domaineVisible = o.type === 'note' || etat.projet.filtre_domaines[o.domaine] !== false;
  const visible = calque.visible && domaineVisible;
  g.style.display = visible ? '' : 'none';
  g.style.opacity = calque.opacite !== 1 ? String(calque.opacite) : '';
}

function appliquerCalques() {
  // Re-appliqué par rendreTout ; ici on force le rafraîchissement immédiat.
  for (const [id, entree] of empreintes) {
    const o = objets().find((x) => x.id === id);
    if (o) appliquerVisibiliteObjet(entree.g, o);
  }
}

/* ---------- Légende ---------- */
let gLegende = null;
function rendreLegende() {
  if (gLegende) { gLegende.remove(); gLegende = null; }
  const plan = etat.plan;
  if (!plan || !plan.legende || !plan.legende.visible) return;
  const prims = primitivesLegende(plan, objets(), etat.projet.reglages);
  if (!prims.length) return;
  gLegende = el('g', { id: 'legende', class: 'legende' });
  ajouterPrims(gLegende, prims);
  gObjets.appendChild(gLegende);
}

/* ---------- Groupe temporaire (aperçus d'outils) ---------- */
export function viderTemporaire() { gTemp.innerHTML = ''; }
export function dessinerTemporaire(prims) { viderTemporaire(); ajouterPrims(gTemp, prims); }
export function groupeTemporaire() { return gTemp; }

/* ---------- Poignées de sélection (coordonnées écran) ---------- */
/* Les outils fournissent la liste des poignées : [{ id, x, y (plan), forme:'rond'|'carre'|'losange', role }] */
let fournisseurPoignees = null;
export function definirFournisseurPoignees(fn) { fournisseurPoignees = fn; }

export function dessinerPoignees() {
  gPoignees.innerHTML = '';
  if (!fournisseurPoignees || etat.modePapier) return;
  const liste = fournisseurPoignees() || [];
  const R = etat.dernierPointeur === 'pen' ? CHARTE.ecran.poignee_stylet_px : CHARTE.ecran.poignee_px;
  for (const p of liste) {
    const e = versEcran(p);
    if (p.forme === 'contour') {
      // contour de sélection (rectangle plan → écran)
      const a = versEcran({ x: p.x, y: p.y }), b = versEcran({ x: p.x + p.l, y: p.y + p.h });
      gPoignees.appendChild(el('rect', { x: a.x - 4, y: a.y - 4, width: b.x - a.x + 8, height: b.y - a.y + 8, fill: 'none', stroke: CHARTE.ecran.selection, 'stroke-width': 1.2, 'stroke-dasharray': '4 3', class: 'contour-selection' }));
      continue;
    }
    if (p.forme === 'lien') {
      const b = versEcran({ x: p.x2, y: p.y2 });
      gPoignees.appendChild(el('line', { x1: e.x, y1: e.y, x2: b.x, y2: b.y, stroke: CHARTE.ecran.selection, 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      continue;
    }
    const g = el('g', { class: 'poignee poignee-' + p.role, 'data-poignee': p.id, transform: `translate(${e.x} ${e.y})` });
    // zone de saisie invisible (48 px doigt / 24 px stylet)
    g.appendChild(el('circle', { r: R, fill: 'rgba(0,0,0,0.001)' }));
    if (p.forme === 'rond') g.appendChild(el('circle', { r: 7, fill: '#fff', stroke: CHARTE.ecran.selection, 'stroke-width': 2 }));
    else if (p.forme === 'losange') g.appendChild(el('path', { d: 'M0 -8L8 0L0 8L-8 0Z', fill: '#fff', stroke: CHARTE.ecran.selection, 'stroke-width': 2 }));
    else if (p.forme === 'petit') g.appendChild(el('circle', { r: 4.5, fill: CHARTE.ecran.selection, stroke: '#fff', 'stroke-width': 1.5 }));
    else g.appendChild(el('rect', { x: -6, y: -6, width: 12, height: 12, fill: '#fff', stroke: CHARTE.ecran.selection, 'stroke-width': 2 }));
    if (p.role === 'rotation') {
      g.appendChild(el('path', { d: 'M-3.5 -1.5a4 4 0 1 1 1 4.2', fill: 'none', stroke: CHARTE.ecran.selection, 'stroke-width': 1.5 }));
    }
    gPoignees.appendChild(g);
  }
}

/* ---------- Curseur de précision (stylet en survol) ---------- */
export function afficherCurseur(x, y, visible) {
  gCurseur.innerHTML = '';
  if (!visible) return;
  gCurseur.appendChild(el('line', { x1: x - 14, y1: y, x2: x - 4, y2: y, stroke: CHARTE.ecran.survol, 'stroke-width': 1.5 }));
  gCurseur.appendChild(el('line', { x1: x + 4, y1: y, x2: x + 14, y2: y, stroke: CHARTE.ecran.survol, 'stroke-width': 1.5 }));
  gCurseur.appendChild(el('line', { x1: x, y1: y - 14, x2: x, y2: y - 4, stroke: CHARTE.ecran.survol, 'stroke-width': 1.5 }));
  gCurseur.appendChild(el('line', { x1: x, y1: y + 4, x2: x, y2: y + 14, stroke: CHARTE.ecran.survol, 'stroke-width': 1.5 }));
  gCurseur.appendChild(el('circle', { cx: x, cy: y, r: 1.5, fill: CHARTE.ecran.survol }));
}

let idSurvol = null;
export function surligner(id) {
  if (idSurvol === id) return;
  if (idSurvol) { const e = empreintes.get(idSurvol); if (e) e.g.classList.remove('survol'); }
  idSurvol = id;
  if (id) { const e = empreintes.get(id); if (e) e.g.classList.add('survol'); }
}

/* Sérialisation du groupe des objets (export PNG). */
export function svgObjetsSerialise() {
  return gObjets;
}
