/* export-pdf.js — export PDF vectoriel (pdf-lib).
 *
 * - Fond PDF : la page d'origine est copiée telle quelle (format, contenu), les
 *   objets sont dessinés par-dessus en vectoriel dans l'espace utilisateur PDF.
 * - Fond image / photo : page aux dimensions du plan, image embarquée.
 * - Les mêmes primitives que l'écran (symboles.js / legende.js) sont projetées ;
 *   le texte reste sélectionnable ; police DejaVu Sans embarquée (sous-ensemble).
 */
import { etat, objets } from './etat.js';
import { CHARTE } from './charte.js';
import { primitivesObjet } from './symboles.js';
import { primitivesLegende } from './legende.js';
import { definirMesureur, mesurerTexte } from './primitives.js';

const URL_POLICE = new URL('../vendor/fonts/DejaVuSans.ttf', import.meta.url).href;

/* Couleur CSS → { r, g, b } (0..1), alpha fusionné sur blanc. */
function couleurRgb(c) {
  if (!c) return null;
  let r = 0, g = 0, b = 0, a = 1;
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (hex) { const v = parseInt(hex[1], 16); r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; }
  else if (rgba) { const p = rgba[1].split(',').map((x) => parseFloat(x)); [r, g, b] = p; if (p.length > 3) a = p[3]; }
  else if (c === 'none') return null;
  const mel = (v) => (v * a + 255 * (1 - a)) / 255;
  return { r: mel(r), g: mel(g), b: mel(b) };
}

/* Toutes les primitives à exporter (objets visibles, étiquettes, légende). */
export function primitivesExport() {
  const plan = etat.plan, projet = etat.projet;
  const prims = [];
  const tries = objets().map((o, i) => ({ o, i })).sort((a, b) => (CHARTE.ordre_z.indexOf(a.o.type) - CHARTE.ordre_z.indexOf(b.o.type)) || a.i - b.i);
  for (const { o } of tries) {
    const calque = projet.calques[o.calque] || projet.calques.existant;
    if (!calque.visible) continue;
    if (o.type !== 'note' && projet.filtre_domaines[o.domaine] === false) continue;
    const r = primitivesObjet(o, projet.reglages);
    prims.push(...r.corps);
    if (etat.etiquettesVisibles) prims.push(...r.etiquette);
  }
  if (plan.legende && plan.legende.visible) prims.push(...primitivesLegende(plan, objets(), projet.reglages));
  return prims;
}

/* Inverse d'une matrice affine [a,b,c,d,e,f]. */
function inverser(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}
function appliquerM(m, p) { return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }; }

export async function exporterPdf({ progression = () => {} } = {}) {
  const L = window.PDFLib;
  if (!L) throw new Error('pdf-lib non chargé.');
  const plan = etat.plan;
  const fond = plan.fond;
  progression('Préparation de la page…');

  let doc, page, M;   // M : plan → espace utilisateur PDF
  let echelleGraphique = 1;
  if (fond && fond.type === 'pdf' && etat.fondBlob) {
    const src = await L.PDFDocument.load(await etat.fondBlob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
    doc = await L.PDFDocument.create();
    const [copie] = await doc.copyPages(src, [Math.max(0, (fond.page || 1) - 1)]);
    page = doc.addPage(copie);
    M = inverser(fond.transform_pdf);   // transform_pdf : utilisateur → plan (viewport pdf.js échelle 1)
  } else {
    doc = await L.PDFDocument.create();
    const l = fond ? fond.largeur : 1190, h = fond ? fond.hauteur : 842;
    page = doc.addPage([l, h]);
    M = [1, 0, 0, -1, 0, h];
    if (fond && fond.type === 'image' && etat.fondBlob) {
      progression('Intégration de l’image…');
      const octets = new Uint8Array(await etat.fondBlob.arrayBuffer());
      let img;
      if (etat.fondBlob.type === 'image/png') img = await doc.embedPng(octets);
      else if (etat.fondBlob.type === 'image/jpeg' || etat.fondBlob.type === 'image/jpg') img = await doc.embedJpg(octets);
      else {
        // Autres formats : re-encodage en PNG via canvas
        const bmp = await createImageBitmap(etat.fondBlob, { imageOrientation: 'from-image' });
        const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
        cv.getContext('2d').drawImage(bmp, 0, 0);
        const b64 = cv.toDataURL('image/png').split(',')[1];
        img = await doc.embedPng(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      }
      page.drawImage(img, { x: 0, y: 0, width: l, height: h, opacity: fond.opacite ?? 1 });
    }
  }
  void echelleGraphique;

  progression('Police et textes…');
  doc.registerFontkit(window.fontkit);
  const police = await doc.embedFont(await (await fetch(URL_POLICE)).arrayBuffer(), { subset: true });
  const mesureurPrecedent = null;
  definirMesureur((t, taille) => police.widthOfTextAtSize(nettoyer(t), taille));
  let prims;
  try { prims = primitivesExport(); } finally { definirMesureur(mesureurCanvas); }
  void mesureurPrecedent;

  progression('Tracé vectoriel…');
  const ops = [];
  const P = (p) => appliquerM(M, p);
  const setCouleurTrait = (c) => { const k = couleurRgb(c); if (k) ops.push(L.setStrokingColor(L.rgb(k.r, k.g, k.b))); };
  const setCouleurFond = (c) => { const k = couleurRgb(c); if (k) ops.push(L.setFillingColor(L.rgb(k.r, k.g, k.b))); };
  ops.push(L.pushGraphicsState(), L.setLineJoin(L.LineJoinStyle.Round), L.setLineCap(L.LineCapStyle.Round));

  for (const p of prims) {
    switch (p.t) {
      case 'ligne': {
        const a = P({ x: p.x1, y: p.y1 }), b = P({ x: p.x2, y: p.y2 });
        setCouleurTrait(p.couleur);
        ops.push(L.setLineWidth(p.epaisseur), L.setDashPattern(p.tirete || [], 0), L.setLineCap(p.bout === 'butt' ? L.LineCapStyle.Butt : L.LineCapStyle.Round));
        ops.push(L.moveTo(a.x, a.y), L.lineTo(b.x, b.y), L.stroke());
        break;
      }
      case 'poly': {
        if (p.points.length < 2) break;
        const pts = p.points.map(P);
        ops.push(L.moveTo(pts[0].x, pts[0].y));
        for (let i = 1; i < pts.length; i++) ops.push(L.lineTo(pts[i].x, pts[i].y));
        if (p.ferme) ops.push(L.closePath());
        const trait = p.couleur && p.epaisseur > 0 && couleurRgb(p.couleur);
        const fond = p.remplissage && couleurRgb(p.remplissage);
        if (trait) { setCouleurTrait(p.couleur); ops.push(L.setLineWidth(p.epaisseur), L.setDashPattern(p.tirete || [], 0), L.setLineCap(L.LineCapStyle.Round)); }
        if (fond) setCouleurFond(p.remplissage);
        if (trait && fond) ops.push(L.fillAndStroke());
        else if (fond) ops.push(L.fill());
        else if (trait) ops.push(L.stroke());
        else ops.push(L.endPath());
        break;
      }
      case 'cercle': {
        const c = P({ x: p.cx, y: p.cy });
        const r = p.r * Math.hypot(M[0], M[1]);   // rayon à l'échelle (M est une similitude)
        const k = 0.5523 * r;
        ops.push(L.moveTo(c.x + r, c.y),
          L.appendBezierCurve(c.x + r, c.y + k, c.x + k, c.y + r, c.x, c.y + r),
          L.appendBezierCurve(c.x - k, c.y + r, c.x - r, c.y + k, c.x - r, c.y),
          L.appendBezierCurve(c.x - r, c.y - k, c.x - k, c.y - r, c.x, c.y - r),
          L.appendBezierCurve(c.x + k, c.y - r, c.x + r, c.y - k, c.x + r, c.y), L.closePath());
        const trait = p.couleur && p.epaisseur > 0 && couleurRgb(p.couleur);
        const fond = p.remplissage && couleurRgb(p.remplissage);
        if (trait) { setCouleurTrait(p.couleur); ops.push(L.setLineWidth(p.epaisseur), L.setDashPattern([], 0)); }
        if (fond) setCouleurFond(p.remplissage);
        if (trait && fond) ops.push(L.fillAndStroke()); else if (fond) ops.push(L.fill()); else if (trait) ops.push(L.stroke()); else ops.push(L.endPath());
        break;
      }
      default: break;
    }
  }
  ops.push(L.popGraphicsState());
  page.pushOperators(...ops);

  // Textes (sélectionnables) : direction calculée à travers M pour rester lisibles sur les pages tournées
  for (const p of prims) {
    if (p.t !== 'texte' || !p.texte) continue;
    const t = nettoyer(p.texte);
    const larg = police.widthOfTextAtSize(t, p.taille);
    const a = ((p.rotation || 0) * Math.PI) / 180;
    // ancre → point de départ (gauche de la ligne de base) dans le plan
    let dx = 0;
    if (p.ancre === 'milieu') dx = -larg / 2; else if (p.ancre === 'fin') dx = -larg;
    const depart = { x: p.x + Math.cos(a) * dx, y: p.y + Math.sin(a) * dx };
    const u = P(depart);
    const dir = { x: M[0] * Math.cos(a) + M[2] * Math.sin(a), y: M[1] * Math.cos(a) + M[3] * Math.sin(a) };
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const k = couleurRgb(p.couleur) || { r: 0, g: 0, b: 0 };
    page.drawText(t, { x: u.x, y: u.y, size: p.taille, font: police, color: L.rgb(k.r, k.g, k.b), rotate: L.degrees(angle) });
  }

  doc.setTitle((etat.projet.nom || 'Plan') + (etat.projet.commune ? ' — ' + etat.projet.commune : ''));
  doc.setProducer('Réseaux HC');
  doc.setCreator('Réseaux HC — SIEEP-HC');
  progression('Enregistrement…');
  const octets = await doc.save({ useObjectStreams: true });
  return new Blob([octets], { type: 'application/pdf' });
}

/* Caractères hors police : remplacés pour éviter une erreur d'encodage. */
function nettoyer(t) {
  return String(t).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').replace(/\t/g, ' ');
}

/* Mesureur écran (canvas + DejaVu Sans), défini par main.js ; conservé ici pour restauration. */
let mesureurCanvas = null;
export function definirMesureurCanvas(fn) { mesureurCanvas = fn; definirMesureur(fn); }
export { mesurerTexte };
