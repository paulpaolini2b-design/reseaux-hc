/* export-png.js — export PNG : fond rendu à la résolution demandée + primitives
 * projetées sur le canvas (même description géométrique que l'écran et le PDF).
 */
import { etat } from './etat.js';
import { CHARTE } from './charte.js';
import { etenduePlan } from './vue.js';
import { rendreDans } from './fond.js';
import { primitivesExport } from './export-pdf.js';

/* dpi : résolution équivalente (72 = 1 pixel par unité plan). */
export async function exporterPng({ dpi = 200, progression = () => {} } = {}) {
  const e = etenduePlan();
  const k = dpi / 72;
  const MAX = 8192;   // limite de sécurité des canvas sur tablette
  const kEff = Math.min(k, MAX / Math.max(e.l, e.h));
  const l = Math.round(e.l * kEff), h = Math.round(e.h * kEff);
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  const ctx = cv.getContext('2d');
  progression('Rendu du fond…');
  await rendreDans(ctx, kEff, l, h);
  progression('Tracé des objets…');
  ctx.setTransform(kEff, 0, 0, kEff, -e.x * kEff, -e.y * kEff);
  dessinerPrimsCanvas(ctx, primitivesExport());
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  progression('Encodage PNG…');
  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  return blob;
}

export function dessinerPrimsCanvas(ctx, prims) {
  ctx.lineJoin = 'round';
  for (const p of prims) {
    switch (p.t) {
      case 'ligne':
        if (!p.couleur) break;
        ctx.strokeStyle = p.couleur; ctx.lineWidth = p.epaisseur; ctx.lineCap = p.bout === 'butt' ? 'butt' : 'round';
        ctx.setLineDash(p.tirete || []);
        ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
        break;
      case 'poly':
        if (p.points.length < 2) break;
        ctx.beginPath(); ctx.moveTo(p.points[0].x, p.points[0].y);
        for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
        if (p.ferme) ctx.closePath();
        if (p.remplissage) { ctx.fillStyle = p.remplissage; ctx.fill(); }
        if (p.couleur && p.epaisseur > 0) { ctx.strokeStyle = p.couleur; ctx.lineWidth = p.epaisseur; ctx.lineCap = 'round'; ctx.setLineDash(p.tirete || []); ctx.stroke(); }
        break;
      case 'cercle':
        ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        if (p.remplissage) { ctx.fillStyle = p.remplissage; ctx.fill(); }
        if (p.couleur && p.epaisseur > 0) { ctx.strokeStyle = p.couleur; ctx.lineWidth = p.epaisseur; ctx.setLineDash([]); ctx.stroke(); }
        break;
      case 'texte': {
        ctx.save();
        ctx.font = `${p.taille}px ${CHARTE.texte.police}`;
        ctx.fillStyle = p.couleur;
        ctx.textAlign = p.ancre === 'milieu' ? 'center' : (p.ancre === 'fin' ? 'right' : 'left');
        ctx.textBaseline = 'alphabetic';
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillText(p.texte, 0, 0);
        ctx.restore();
        break;
      }
      default: break;
    }
  }
}

export function nomExport(ext) {
  const p = etat.projet;
  return ((p.nom || 'plan') + (p.commune ? '_' + p.commune : '')).replace(/[^\w\-àâäéèêëîïôöùûüç]+/gi, '_') + ext;
}
