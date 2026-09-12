/* symboles.js — catalogue des symboles : chaque objet → primitives (unités plan).
 *
 * Symboles locaux centrés sur (0,0), axe « haut » = -y ; la rotation de l'objet
 * (degrés, sens horaire à l'écran) s'applique ensuite. Les textes restent
 * horizontaux (§8.3), sauf le texte des notes.
 */
import { CHARTE, styleTroncon, couleurReseau } from './charte.js';
import { ligne, poly, cercle, texte, rect, ellipsePoly, transformer, hachurerPolygone, hachurerPolyligne, blocTexte, mesurerTexte, boite } from './primitives.js';
import { designationAffichee, materielAbrege } from './modele.js';

const C = CHARTE.contour_symbole;

/* ---------- Remplissage selon l'état (convention commune aux ponctuels) ---------- */
function polygoneCercle(cx, cy, r, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}

/* Coupe un polygone par le demi-plan x <= 0 (Sutherland-Hodgman). */
function moitieGauche(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const aIn = a.x <= 0, bIn = b.x <= 0;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = a.x / (a.x - b.x);
      out.push({ x: 0, y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

/* Forme polygonale fermée avec le remplissage de l'état.
 * couleurPlein : couleur du remplissage « à poser » (noir par défaut). */
function formeEtat(pts, etatObjet, { contour = '#000000', couleurPlein = '#000000', epaisseur = C } = {}) {
  const e = CHARTE.etats[etatObjet] || CHARTE.etats.existant;
  const prims = [];
  if (etatObjet === 'a_poser') {
    prims.push(poly(pts, { ferme: true, couleur: contour, epaisseur, remplissage: couleurPlein }));
  } else if (etatObjet === 'a_deposer') {
    prims.push(poly(pts, { ferme: true, couleur: null, epaisseur: 0, remplissage: e.remplissage }));
    prims.push(...hachurerPolygone(pts, e.hachures));
    prims.push(poly(pts, { ferme: true, couleur: contour, epaisseur, remplissage: null }));
  } else if (etatObjet === 'a_reprendre') {
    prims.push(poly(pts, { ferme: true, couleur: null, epaisseur: 0, remplissage: e.remplissage }));
    const demi = moitieGauche(pts);
    if (demi.length >= 3) prims.push(poly(demi, { ferme: true, couleur: null, epaisseur: 0, remplissage: couleurPlein }));
    prims.push(poly(pts, { ferme: true, couleur: contour, epaisseur, remplissage: null }));
  } else {
    prims.push(poly(pts, { ferme: true, couleur: contour, epaisseur, remplissage: e.remplissage }));
  }
  return prims;
}

function cercleEtat(r, etatObjet, options = {}) {
  if (etatObjet === 'existant') {
    return [cercle(0, 0, r, { couleur: options.contour || '#000000', epaisseur: options.epaisseur || C, remplissage: '#FFFFFF' })];
  }
  if (etatObjet === 'a_poser') {
    return [cercle(0, 0, r, { couleur: options.contour || '#000000', epaisseur: options.epaisseur || C, remplissage: options.couleurPlein || '#000000' })];
  }
  const prims = formeEtat(polygoneCercle(0, 0, r), etatObjet, { ...options, contour: null, epaisseur: 0 });
  // contour circulaire propre par-dessus
  prims.push(cercle(0, 0, r, { couleur: options.contour || '#000000', epaisseur: options.epaisseur || C, remplissage: null }));
  return prims.filter((p) => !(p.t === 'poly' && p.couleur === null && p.remplissage === null));
}

/* Texte contrasté sur un fond selon l'état (sigles à l'intérieur des coffrets/postes). */
function couleurTexteSurEtat(etatObjet, couleurPlein = '#000000') {
  if (etatObjet === 'a_poser') return couleurPlein === '#000000' || couleurPlein === '#E2001A' ? '#FFFFFF' : '#000000';
  return '#000000';
}

/* Sigle centré dans une largeur donnée, taille réduite si nécessaire ; fond blanc si hachuré. */
function sigleDans(sigle, largeur, tailleMax, tailleMin, etatObjet, couleurPlein) {
  if (!sigle) return [];
  let taille = tailleMax;
  while (taille > tailleMin && mesurerTexte(sigle, taille) > largeur - 1) taille -= 0.2;
  const l = mesurerTexte(sigle, taille);
  const prims = [];
  if (etatObjet === 'a_deposer' || etatObjet === 'a_reprendre') {
    prims.push(rect(-l / 2 - 0.4, -taille * 0.6, l + 0.8, taille * 1.2, { couleur: null, epaisseur: 0, remplissage: '#FFFFFF' }));
  }
  prims.push(texte(0, taille * 0.36, sigle, { taille, couleur: couleurTexteSurEtat(etatObjet, couleurPlein), ancre: 'milieu' }));
  return prims;
}

/* ---------- Supports ---------- */
function symboleSupportSimple(a, etatObjet) {
  const S = CHARTE.supports;
  switch (a.materiau) {
    case 'BETON': {
      if (a.classe === 'E') { const c = S.carre.cote; return { prims: formeEtat([{ x: -c / 2, y: -c / 2 }, { x: c / 2, y: -c / 2 }, { x: c / 2, y: c / 2 }, { x: -c / 2, y: c / 2 }], etatObjet), rayon: c / 2 }; }
      const l = S.rectangle.largeur, h = S.rectangle.hauteur;
      return { prims: formeEtat([{ x: -l / 2, y: -h / 2 }, { x: l / 2, y: -h / 2 }, { x: l / 2, y: h / 2 }, { x: -l / 2, y: h / 2 }], etatObjet), rayon: l / 2 };
    }
    case 'BOIS':
      return { prims: cercleEtat(S.cercle.rayon, etatObjet), rayon: S.cercle.rayon };
    case 'ME_PTR': {
      const c = S.croix.cote, ep = S.croix.epaisseur_croix;
      const prims = formeEtat([{ x: -c / 2, y: -c / 2 }, { x: c / 2, y: -c / 2 }, { x: c / 2, y: c / 2 }, { x: -c / 2, y: c / 2 }], etatObjet);
      const couleurCroix = etatObjet === 'a_poser' ? '#FFFFFF' : '#000000';
      prims.push(ligne(-c / 2, -c / 2, c / 2, c / 2, couleurCroix, ep), ligne(-c / 2, c / 2, c / 2, -c / 2, couleurCroix, ep));
      return { prims, rayon: c / 2 };
    }
    case 'ME_TUB': {
      const R = S.anneau.rayon, r = S.anneau.rayon_interieur;
      const prims = [];
      if (etatObjet === 'existant') {
        prims.push(cercle(0, 0, R, { couleur: '#000', epaisseur: C, remplissage: '#FFFFFF' }), cercle(0, 0, r, { couleur: '#000', epaisseur: C, remplissage: '#FFFFFF' }));
      } else {
        prims.push(...cercleEtat(R, etatObjet));
        prims.push(cercle(0, 0, r, { couleur: '#000', epaisseur: C, remplissage: '#FFFFFF' }));
      }
      return { prims, rayon: R };
    }
    default: {
      // Support posé sans matériau connu : cercle générique
      const r = S.generique.rayon;
      const prims = cercleEtat(r, etatObjet);
      prims.push(cercle(0, 0, 0.45, { couleur: null, epaisseur: 0, remplissage: etatObjet === 'a_poser' ? '#FFFFFF' : '#000000' }));
      return { prims, rayon: r };
    }
  }
}

function symboleSupport(o) {
  const a = o.attributs || {};
  const simple = symboleSupportSimple(a, o.etat);
  let prims = [];
  const R = CHARTE.renforcements;
  const ang = ((a.angle_renforcement || 0) * Math.PI) / 180;   // 0° = vers le haut du symbole
  const dir = { x: Math.sin(ang), y: -Math.cos(ang) };
  const perp = { x: dir.y, y: -dir.x };
  let rayon = simple.rayon;

  switch (a.renforcement) {
    case 'JUMELE': {
      const d = simple.rayon + R.jumele.ecart / 2;
      prims.push(...transformer(simple.prims, { x: -d, y: 0 }), ...transformer(simple.prims, { x: d, y: 0 }));
      rayon = d + simple.rayon;
      break;
    }
    case 'PORTIQUE': {
      const d = R.portique.ecart / 2;
      prims.push(ligne(-d, 0, d, 0, '#000', R.portique.epaisseur));
      prims.push(...transformer(simple.prims, { x: -d, y: 0 }), ...transformer(simple.prims, { x: d, y: 0 }));
      rayon = d + simple.rayon;
      break;
    }
    case 'CONTREFICHE': {
      prims.push(...simple.prims);
      // triangle accolé, base sur le bord du symbole, pointe dans le sens de la contrefiche
      const b = simple.rayon, L = R.contrefiche.longueur, w = R.contrefiche.base / 2;
      const base1 = { x: dir.x * b + perp.x * w, y: dir.y * b + perp.y * w };
      const base2 = { x: dir.x * b - perp.x * w, y: dir.y * b - perp.y * w };
      const pointe = { x: dir.x * (b + L), y: dir.y * (b + L) };
      prims.push(...formeEtat([base1, pointe, base2], o.etat));
      rayon = b + L;
      break;
    }
    case 'HAUBANE': {
      prims.push(...simple.prims);
      const b = simple.rayon, L = R.hauban.longueur, t = R.hauban.tete;
      const p0 = { x: dir.x * b, y: dir.y * b }, p1 = { x: dir.x * (b + L), y: dir.y * (b + L) };
      prims.push(ligne(p0.x, p0.y, p1.x, p1.y, '#000', C + 0.1));
      prims.push(poly([
        { x: p1.x, y: p1.y },
        { x: p1.x - dir.x * t + perp.x * t * 0.45, y: p1.y - dir.y * t + perp.y * t * 0.45 },
        { x: p1.x - dir.x * t - perp.x * t * 0.45, y: p1.y - dir.y * t - perp.y * t * 0.45 }
      ], { ferme: true, couleur: '#000', epaisseur: C, remplissage: '#000' }));
      rayon = b + L;
      break;
    }
    default:
      prims.push(...simple.prims);
  }
  return { prims, rayon };
}

/* ---------- Autres ponctuels ---------- */
function symboleCoffret(o) {
  const K = CHARTE.coffret;
  const l = K.largeur, h = K.hauteur;
  const prims = formeEtat([{ x: -l / 2, y: -h / 2 }, { x: l / 2, y: -h / 2 }, { x: l / 2, y: h / 2 }, { x: -l / 2, y: h / 2 }], o.etat);
  prims.push(...sigleDans(o.attributs.sigle, l, K.taille_sigle, K.taille_sigle_min, o.etat));
  return { prims, rayon: l / 2 };
}

function symbolePoste(o) {
  const K = CHARTE.poste;
  const l = K.largeur, h = K.hauteur;
  const prims = formeEtat([{ x: -l / 2, y: -h / 2 }, { x: l / 2, y: -h / 2 }, { x: l / 2, y: h / 2 }, { x: -l / 2, y: h / 2 }], o.etat,
    { contour: K.couleur, couleurPlein: K.couleur, epaisseur: K.epaisseur });
  prims.push(...sigleDans(o.attributs.sigle, l, K.taille_sigle, 1.6, o.etat, K.couleur));
  return { prims, rayon: l / 2 };
}

function symboleBoiteJonction(o) {
  const K = CHARTE.boite_jonction;
  const couleur = couleurReseau(o.domaine, o.pose, o.etat);
  const pts = ellipsePoly(0, 0, K.rx, K.ry).points;
  const e = CHARTE.etats[o.etat] || CHARTE.etats.existant;
  const prims = [poly(pts, { ferme: true, couleur: null, epaisseur: 0, remplissage: couleur })];
  if (o.etat === 'a_deposer') prims.push(...hachurerPolygone(pts, e.hachures));
  prims.push(poly(pts, { ferme: true, couleur: '#000', epaisseur: C, remplissage: null }));
  return { prims, rayon: K.rx };
}

export function symboleMalt(dx = 0, dy = 0) {
  const K = CHARTE.malt;
  const prims = [ligne(dx, dy - K.hauteur_trait, dx, dy, K.couleur, K.epaisseur)];
  K.largeurs.forEach((l, i) => { const y = dy + i * K.ecart_barres; prims.push(ligne(dx - l / 2, y, dx + l / 2, y, K.couleur, K.epaisseur)); });
  return prims;
}

function symboleEras(o) {
  const K = CHARTE.eras;
  const couleur = couleurReseau(o.domaine, o.pose, o.etat);
  const prims = cercleEtat(K.rayon, o.etat, { contour: couleur, couleurPlein: couleur });
  let rayon = K.rayon;
  if (o.attributs.avec_malt) { prims.push(...symboleMalt(K.decalage_malt, 0)); rayon = K.decalage_malt + CHARTE.malt.largeurs[0] / 2; }
  return { prims, rayon };
}

function symbolePointLumineux(o) {
  const K = CHARTE.eclairage.point_lumineux;
  const prims = [];
  for (let i = 0; i < K.nb_rayons; i++) {
    const a = (i / K.nb_rayons) * Math.PI * 2;
    prims.push(ligne(Math.cos(a) * K.rayon, Math.sin(a) * K.rayon, Math.cos(a) * K.rayon_rayons, Math.sin(a) * K.rayon_rayons, '#000', C));
  }
  prims.push(...cercleEtat(K.rayon, o.etat));
  return { prims, rayon: K.rayon_rayons };
}

function symboleArmoireEp(o) {
  const K = CHARTE.eclairage.armoire;
  const l = K.largeur, h = K.hauteur;
  const prims = formeEtat([{ x: -l / 2, y: -h / 2 }, { x: l / 2, y: -h / 2 }, { x: l / 2, y: h / 2 }, { x: -l / 2, y: h / 2 }], o.etat);
  prims.push(...sigleDans(o.attributs.sigle || 'S17', l, K.taille_sigle, 1.6, o.etat));
  return { prims, rayon: l / 2 };
}

/* ---------- Tronçons ---------- */
export function primitivesTroncon(o) {
  const s = styleTroncon(o.domaine, o.pose, o.etat);
  const pts = o.points;
  const prims = [];
  if (s.fluo) prims.push(poly(pts, { couleur: CHARTE.lisere.couleur, epaisseur: s.epaisseur + CHARTE.lisere.surepaisseur, tirete: s.tirete, joint: 'round' }));
  prims.push(poly(pts, { couleur: s.couleur, epaisseur: s.epaisseur, tirete: s.tirete, joint: 'round' }));
  if (s.hachure) prims.push(...hachurerPolyligne(pts, CHARTE.hachures_troncon));
  if (s.reprendre) prims.push(poly(pts, { couleur: CHARTE.a_reprendre_troncon.couleur, epaisseur: CHARTE.a_reprendre_troncon.epaisseur, tirete: CHARTE.a_reprendre_troncon.tirete }));
  return prims;
}

/* Point milieu (en longueur) d'une polyligne et direction locale. */
export function milieuPolyligne(pts) {
  let L = 0;
  for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  let d = L / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (d <= seg || i === pts.length - 2) {
      const t = seg ? d / seg : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
        ux: seg ? (pts[i + 1].x - pts[i].x) / seg : 1, uy: seg ? (pts[i + 1].y - pts[i].y) / seg : 0 };
    }
    d -= seg;
  }
  return { x: pts[0].x, y: pts[0].y, ux: 1, uy: 0 };
}

/* ---------- Notes ---------- */
function primitivesNote(o) {
  const K = CHARTE.notes;
  const bloc = blocTexte(o.x, o.y, o.texte || '…', {
    taille: o.taille || K.taille_defaut, couleur: o.couleur || K.couleur_defaut, ancre: 'debut',
    fond: o.fond ? K.fond : null, cadre: o.cadre ? K.cadre.couleur : null, marge: K.cadre.marge,
    rotation: o.rotation || 0, epaisseur_cadre: K.cadre.epaisseur
  });
  const prims = [...bloc.prims];
  if (o.fleche) {
    // Flèche de rappel : du bord gauche-milieu du bloc (avant rotation) vers le point désigné
    const a = ((o.rotation || 0) * Math.PI) / 180;
    const cx = o.x + Math.cos(a) * (-K.cadre.marge) - Math.sin(a) * (bloc.hauteur / 2);
    const cy = o.y + Math.sin(a) * (-K.cadre.marge) + Math.cos(a) * (bloc.hauteur / 2);
    const dx = o.fleche.x - cx, dy = o.fleche.y - cy, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, t = K.fleche.tete;
    prims.push(ligne(cx, cy, o.fleche.x, o.fleche.y, o.couleur || K.couleur_defaut, K.fleche.epaisseur));
    prims.push(poly([
      { x: o.fleche.x, y: o.fleche.y },
      { x: o.fleche.x - ux * t - uy * t * 0.4, y: o.fleche.y - uy * t + ux * t * 0.4 },
      { x: o.fleche.x - ux * t + uy * t * 0.4, y: o.fleche.y - uy * t - ux * t * 0.4 }
    ], { ferme: true, couleur: null, epaisseur: 0, remplissage: o.couleur || K.couleur_defaut }));
  }
  return { prims, boite: bloc.boite };
}

/* ---------- Étiquettes ---------- */
function lignesEtiquette(o) {
  const lignes = [];
  const d = designationAffichee(o);
  if (o.type === 'troncon') { if (d) lignes.push(d); return lignes; }
  lignes.push(d || o.repere || '');
  if (o.type === 'support' && o.attributs.armement) lignes.push(o.attributs.armement);
  const m = materielAbrege(o);
  if (m) lignes.push(m);
  return lignes.filter(Boolean);
}

export function primitivesEtiquette(o, reglages, rayon = 0) {
  if (!o.etiquette || o.etiquette.visible === false) return { prims: [], boite: null };
  const T = CHARTE.texte;
  const f = (reglages.taille_texte || 1);
  let ancreX, ancreY, lignes;
  if (o.type === 'troncon') {
    lignes = lignesEtiquette(o);
    if (!lignes.length) return { prims: [], boite: null };
    const m = milieuPolyligne(o.points);
    ancreX = m.x + (o.etiquette.dx ?? 0) - m.uy * 3;
    ancreY = m.y + (o.etiquette.dy ?? 0) + m.ux * 3 - T.taille_etiquette * f;
  } else {
    lignes = lignesEtiquette(o);
    if (!lignes.length) return { prims: [], boite: null };
    // L'étiquette part du bord droit du symbole (rayon) : elle ne le recouvre jamais par défaut
    ancreX = o.x + rayon + T.marge_etiquette + (o.etiquette.dx ?? T.decalage_etiquette.dx);
    ancreY = o.y + (o.etiquette.dy ?? T.decalage_etiquette.dy);
  }
  const prims = [];
  let y = ancreY;
  let boiteTot = null;
  lignes.forEach((l, i) => {
    const taille = (i === 0 ? T.taille_etiquette : T.taille_etiquette_secondaire) * f;
    const bloc = blocTexte(ancreX, y, l, { taille, couleur: T.couleur, fond: T.fond_etiquette, marge: T.marge_etiquette, interligne: T.interligne });
    prims.push(...bloc.prims);
    y += taille * T.interligne + 0.6;
    boiteTot = boiteTot ? union(boiteTot, bloc.boite) : bloc.boite;
  });
  return { prims, boite: boiteTot };
}

function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, l: Math.max(a.x + a.l, b.x + b.l) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/* ---------- Point d'entrée ---------- */
/* Retourne { corps: prims, etiquette: prims, boiteEtiquette, rayon (ponctuels), boite (notes) } */
export function primitivesObjet(o, reglages = { echelle_symbole: 1, taille_texte: 1 }) {
  if (o.type === 'troncon') {
    const et = primitivesEtiquette(o, reglages);
    return { corps: primitivesTroncon(o), etiquette: et.prims, boiteEtiquette: et.boite, rayon: 0 };
  }
  if (o.type === 'note') {
    const n = primitivesNote(o);
    return { corps: n.prims, etiquette: [], boiteEtiquette: null, boite: n.boite, rayon: 0 };
  }
  let local;
  switch (o.type) {
    case 'support': local = symboleSupport(o); break;
    case 'coffret': local = symboleCoffret(o); break;
    case 'poste': local = symbolePoste(o); break;
    case 'boite_jonction': local = symboleBoiteJonction(o); break;
    case 'malt': local = { prims: symboleMalt(0, CHARTE.malt.hauteur_trait / 2), rayon: CHARTE.malt.hauteur_trait }; break;
    case 'eras': local = symboleEras(o); break;
    case 'point_lumineux': local = symbolePointLumineux(o); break;
    case 'armoire_ep': local = symboleArmoireEp(o); break;
    default: local = { prims: cercleEtat(2.5, o.etat), rayon: 2.5 };
  }
  const echelle = (reglages.echelle_symbole || 1) * (o.echelle_symbole || 1);
  const corps = transformer(local.prims, { x: o.x, y: o.y, rotation: o.rotation || 0, echelle });
  const et = primitivesEtiquette(o, reglages, local.rayon * echelle);
  return { corps, etiquette: et.prims, boiteEtiquette: et.boite, rayon: local.rayon * echelle };
}

/* Primitive d'un échantillon de symbole pour la légende et la palette (local, centré). */
export function echantillonSymbole(type, etatObjet, attributs = {}, domaine = 'BTS', pose = 'aerien') {
  const faux = { type, etat: etatObjet, domaine, pose, x: 0, y: 0, rotation: 0, echelle_symbole: 1, attributs: { renforcement: 'AUCUN', ...attributs }, etiquette: { visible: false }, materiel_associe: [] };
  const r = primitivesObjet(faux, { echelle_symbole: 1, taille_texte: 1 });
  return r.corps;
}

export { boite as boitePrimitives };
