/* primitives.js — primitives géométriques en unités plan.
 *
 * Chaque symbole est décrit UNE SEULE FOIS sous forme de primitives ; rendu-svg.js
 * et export-pdf.js ne sont que deux projections de cette description. C'est ce qui
 * garantit que l'export PDF est identique à l'écran.
 *
 * Types de primitives :
 *   { t:'ligne',  x1,y1,x2,y2, couleur, epaisseur, tirete?, bout? }
 *   { t:'poly',   points:[{x,y}], ferme, couleur|null, epaisseur, remplissage|null, tirete?, joint? }
 *   { t:'cercle', cx,cy,r, couleur|null, epaisseur, remplissage|null }
 *   { t:'texte',  x,y (ligne de base), texte, taille, couleur, ancre:'debut'|'milieu'|'fin', rotation }
 */

let mesureur = null;

/* Mesure de la largeur d'un texte (unités plan). Le mesureur est fourni par main.js
 * (canvas + police DejaVu Sans) ou par export-pdf.js (police embarquée). */
export function definirMesureur(fn) { mesureur = fn; }
export function mesurerTexte(texte, taille) {
  if (mesureur) { try { return mesureur(texte, taille); } catch (e) { /* repli ci-dessous */ } }
  return texte.length * taille * 0.62;
}

/* ---------- Constructeurs ---------- */
export const ligne = (x1, y1, x2, y2, couleur, epaisseur, extra = {}) => ({ t: 'ligne', x1, y1, x2, y2, couleur, epaisseur, ...extra });
export const poly = (points, options = {}) => ({ t: 'poly', points, ferme: false, couleur: '#000', epaisseur: 0.6, remplissage: null, ...options });
export const cercle = (cx, cy, r, options = {}) => ({ t: 'cercle', cx, cy, r, couleur: '#000', epaisseur: 0.6, remplissage: null, ...options });
export const texte = (x, y, contenu, options = {}) => ({ t: 'texte', x, y, texte: String(contenu), taille: 3, couleur: '#000', ancre: 'debut', rotation: 0, ...options });

export function rect(x, y, l, h, options = {}) {
  return poly([{ x, y }, { x: x + l, y }, { x: x + l, y: y + h }, { x, y: y + h }], { ferme: true, ...options });
}

export function ellipsePoly(cx, cy, rx, ry, options = {}, n = 36) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return poly(pts, { ferme: true, ...options });
}

/* ---------- Transformation (rotation + translation + échelle) ---------- */
export function tournerPoint(p, cos, sin) {
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/* Applique échelle, rotation (degrés) puis translation à des primitives locales.
 * Les textes gardent leur orientation horizontale sauf si prim.suivre_rotation. */
export function transformer(prims, { x = 0, y = 0, rotation = 0, echelle = 1 } = {}) {
  const a = (rotation * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const tp = (p) => { const r = tournerPoint({ x: p.x * echelle, y: p.y * echelle }, cos, sin); return { x: r.x + x, y: r.y + y }; };
  const out = [];
  for (const p of prims) {
    switch (p.t) {
      case 'ligne': {
        const a1 = tp({ x: p.x1, y: p.y1 }), a2 = tp({ x: p.x2, y: p.y2 });
        out.push({ ...p, x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, epaisseur: p.epaisseur * echelle, tirete: p.tirete ? p.tirete.map((v) => v * echelle) : p.tirete });
        break;
      }
      case 'poly':
        out.push({ ...p, points: p.points.map(tp), epaisseur: p.epaisseur * echelle, tirete: p.tirete ? p.tirete.map((v) => v * echelle) : p.tirete });
        break;
      case 'cercle': {
        const c = tp({ x: p.cx, y: p.cy });
        out.push({ ...p, cx: c.x, cy: c.y, r: p.r * echelle, epaisseur: p.epaisseur * echelle });
        break;
      }
      case 'texte': {
        const c = tp({ x: p.x, y: p.y });
        out.push({ ...p, x: c.x, y: c.y, taille: p.taille * echelle, rotation: p.suivre_rotation ? (p.rotation || 0) + rotation : (p.rotation || 0) });
        break;
      }
      default:
        out.push(p);
    }
  }
  return out;
}

/* ---------- Hachures ---------- */
/* Hachure un polygone (liste de points) par des lignes parallèles d'angle angleDeg. */
export function hachurerPolygone(points, { pas = 1.6, angle_deg = 45, epaisseur = 0.45, couleur = '#000' } = {}) {
  if (points.length < 3) return [];
  const a = (angle_deg * Math.PI) / 180;
  const cos = Math.cos(-a), sin = Math.sin(-a);
  const cosR = Math.cos(a), sinR = Math.sin(a);
  const loc = points.map((p) => tournerPoint(p, cos, sin));   // repère où les hachures sont horizontales
  let ymin = Infinity, ymax = -Infinity;
  for (const p of loc) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
  const res = [];
  for (let y = ymin + pas * 0.5; y < ymax; y += pas) {
    const xs = [];
    for (let i = 0; i < loc.length; i++) {
      const p1 = loc[i], p2 = loc[(i + 1) % loc.length];
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        xs.push(p1.x + ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y));
      }
    }
    xs.sort((u, v) => u - v);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const q1 = tournerPoint({ x: xs[i], y }, cosR, sinR), q2 = tournerPoint({ x: xs[i + 1], y }, cosR, sinR);
      res.push(ligne(q1.x, q1.y, q2.x, q2.y, couleur, epaisseur, { bout: 'butt' }));
    }
  }
  return res;
}

export function hachurerCercle(cx, cy, r, options) {
  const pts = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return hachurerPolygone(pts, options);
}

/* Hachures « à déposer » le long d'une polyligne : petits traits noirs réguliers,
 * inclinés, centrés sur le trait. */
export function hachurerPolyligne(points, { pas = 5, longueur = 4.5, epaisseur = 0.55, couleur = '#000', angle_deg = 60 } = {}) {
  const res = [];
  let reste = pas / 2;
  const a = (angle_deg * Math.PI) / 180;
  for (let i = 0; i + 1 < points.length; i++) {
    const p1 = points[i], p2 = points[i + 1];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const L = Math.hypot(dx, dy);
    if (L === 0) continue;
    const ux = dx / L, uy = dy / L;
    // direction du trait de hachure : tangente tournée de angle_deg
    const hx = ux * Math.cos(a) - uy * Math.sin(a), hy = ux * Math.sin(a) + uy * Math.cos(a);
    let d = reste;
    while (d <= L) {
      const cx = p1.x + ux * d, cy = p1.y + uy * d;
      res.push(ligne(cx - hx * longueur / 2, cy - hy * longueur / 2, cx + hx * longueur / 2, cy + hy * longueur / 2, couleur, epaisseur, { bout: 'butt' }));
      d += pas;
    }
    reste = d - L;
  }
  return res;
}

/* ---------- Boîte englobante ---------- */
export function boite(prims) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const inc = (x, y) => { if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y; };
  for (const p of prims) {
    switch (p.t) {
      case 'ligne': inc(p.x1, p.y1); inc(p.x2, p.y2); break;
      case 'poly': for (const q of p.points) inc(q.x, q.y); break;
      case 'cercle': inc(p.cx - p.r, p.cy - p.r); inc(p.cx + p.r, p.cy + p.r); break;
      case 'texte': {
        const l = mesurerTexte(p.texte, p.taille);
        const x0 = p.ancre === 'milieu' ? p.x - l / 2 : (p.ancre === 'fin' ? p.x - l : p.x);
        inc(x0, p.y - p.taille); inc(x0 + l, p.y + p.taille * 0.3);
        break;
      }
    }
  }
  if (x1 === Infinity) return null;
  return { x: x1, y: y1, l: x2 - x1, h: y2 - y1 };
}

/* Un bloc de texte multi-lignes : retourne { prims, boite } avec fond / cadre optionnels.
 * (x, y) = coin haut-gauche du bloc si ancre 'debut', centre horizontal si 'milieu'. */
export function blocTexte(x, y, contenu, { taille = 3, couleur = '#000', ancre = 'debut', interligne = 1.22, fond = null, cadre = null, marge = 0.9, rotation = 0, epaisseur_cadre = 0.5 } = {}) {
  const lignes = String(contenu).split('\n');
  const largeurs = lignes.map((l) => mesurerTexte(l, taille));
  const largeur = Math.max(0, ...largeurs);
  const hauteur = taille * interligne * lignes.length;
  // Boîte locale (avant rotation), origine = (x,y)
  const x0 = ancre === 'milieu' ? -largeur / 2 : (ancre === 'fin' ? -largeur : 0);
  const prims = [];
  if (fond || cadre) {
    prims.push(rect(x0 - marge, -marge, largeur + 2 * marge, hauteur + 2 * marge, {
      couleur: cadre || null, remplissage: fond || null, epaisseur: epaisseur_cadre
    }));
  }
  lignes.forEach((l, i) => {
    prims.push(texte(0, taille * interligne * i + taille * 0.95, l, { taille, couleur, ancre, rotation: 0, suivre_rotation: true }));
  });
  const res = transformer(prims, { x, y, rotation, echelle: 1 });
  return { prims: res, boite: { x: x + x0 - marge, y: y - marge, l: largeur + 2 * marge, h: hauteur + 2 * marge }, largeur, hauteur };
}
