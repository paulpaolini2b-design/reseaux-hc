/* fond.js — fond de plan : PDF (pdf.js), image ou photo de l'appareil.
 *
 * Le fond est dessiné dans un <canvas> qui couvre la zone de plan. Pendant un
 * geste (zoom, déplacement) le canvas est simplement transformé en CSS, puis le
 * fond est re-rendu à la résolution réelle de l'écran 180 ms après le dernier
 * mouvement : le zoom est net (pas d'agrandissement bitmap).
 */
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';
import { etat, emettre, notifier } from './etat.js';
import { vue, tailleEcran, ajuster } from './vue.js';
import { bd } from './bd.js';
import { genererId } from './modele.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const URL_POLICES = new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href;
const URL_WASM = new URL('../vendor/pdfjs/wasm/', import.meta.url).href;

let canvas, ctx;
let docPdf = null;        // PDFDocumentProxy
let pagePdf = null;       // PDFPageProxy
let imageBitmap = null;   // ImageBitmap
let tacheRendu = null;    // RenderTask pdf.js en cours
let minuterie = null;
let dernierRendu = null;  // { k, tx, ty, dpr } du dernier rendu abouti
let jeton = 0;

export function initialiserFond() {
  canvas = document.getElementById('fond-canvas');
  ctx = canvas.getContext('2d', { alpha: false });
  window.addEventListener('resize', () => { tailleEcran(); programmerRendu(0); });
}

/* Détecte le type de fichier. */
function typeFichier(fichier) {
  if (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)) return 'pdf';
  if (fichier.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fichier.name)) return 'image';
  return null;
}

/* Charge un fichier comme fond du plan courant. Retourne les infos du fond. */
export async function chargerFichier(fichier, { photo = false } = {}) {
  const type = typeFichier(fichier);
  if (!type) throw new Error('Format non pris en charge : utilisez un PDF ou une image.');
  const fond_id = genererId('fd');
  await bd.put('fonds', { id: fond_id, blob: fichier, type, nom_fichier: fichier.name || (photo ? 'photo.jpg' : 'fond') });
  const infos = { fond_id, type, page: 1, nb_pages: 1, largeur: 0, hauteur: 0, opacite: 1, nom_fichier: fichier.name || (photo ? 'photo.jpg' : 'fond'), rotation: 0, transform_pdf: null };
  etat.fondBlob = fichier;
  await preparer(fichier, infos);
  etat.plan.fond = infos;
  emettre('fond', infos);
  ajuster();
  programmerRendu(0);
  return infos;
}

/* Recharge le fond du plan courant depuis la base (ouverture d'un projet). */
export async function ouvrirFondProjet() {
  liberer();
  const f = etat.plan && etat.plan.fond;
  if (!f) { etat.fondBlob = null; effacer(); emettre('fond', null); return; }
  const enreg = await bd.get('fonds', f.fond_id);
  if (!enreg) { notifier('Fond de plan introuvable dans la base : à recharger.'); etat.fondBlob = null; effacer(); emettre('fond', null); return; }
  etat.fondBlob = enreg.blob;
  await preparer(enreg.blob, f);
  emettre('fond', f);
  programmerRendu(0);
}

/* Prépare le document (PDF ou image) et renseigne dimensions / transform. */
async function preparer(blob, infos) {
  if (infos.type === 'pdf') {
    const donnees = new Uint8Array(await blob.arrayBuffer());
    docPdf = await pdfjs.getDocument({ data: donnees, standardFontDataUrl: URL_POLICES, wasmUrl: URL_WASM, isEvalSupported: false }).promise;
    infos.nb_pages = docPdf.numPages;
    infos.page = Math.min(Math.max(1, infos.page || 1), docPdf.numPages);
    await chargerPage(infos);
  } else {
    let bitmap;
    try { bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) { bitmap = await createImageBitmap(blob); }
    imageBitmap = bitmap;
    // Image normalisée : le grand côté vaut 1190 unités plan (long côté A3 en points),
    // pour que les symboles gardent une taille « papier » quelle que soit la résolution.
    const s = 1190 / Math.max(bitmap.width, bitmap.height);
    infos.echelle_image = s;
    infos.largeur = bitmap.width * s;
    infos.hauteur = bitmap.height * s;
    infos.nb_pages = 1;
  }
}

async function chargerPage(infos) {
  pagePdf = await docPdf.getPage(infos.page);
  const vp = pagePdf.getViewport({ scale: 1 });
  infos.largeur = vp.width;
  infos.hauteur = vp.height;
  infos.rotation = pagePdf.rotate || 0;
  infos.transform_pdf = Array.from(vp.transform);   // espace utilisateur PDF → coordonnées plan
}

/* Change de page (PDF multi-pages). */
export async function changerPage(n) {
  const f = etat.plan && etat.plan.fond;
  if (!f || f.type !== 'pdf' || !docPdf) return;
  f.page = Math.min(Math.max(1, n), docPdf.numPages);
  await chargerPage(f);
  emettre('fond', f);
  ajuster();
  programmerRendu(0);
}

export function reglerOpacite(v) {
  if (!etat.plan || !etat.plan.fond) return;
  etat.plan.fond.opacite = v;
  canvas.style.opacity = String(v * ((etat.projet && etat.projet.calques.fond.opacite) || 1));
  emettre('fond', etat.plan.fond);
}

export function appliquerVisibiliteCalqueFond() {
  if (!etat.projet) return;
  const c = etat.projet.calques.fond;
  canvas.style.display = c.visible ? '' : 'none';
  const op = etat.plan && etat.plan.fond ? etat.plan.fond.opacite : 1;
  canvas.style.opacity = String(op * c.opacite);
}

function liberer() {
  if (tacheRendu) { try { tacheRendu.cancel(); } catch (e) { /* ignore */ } tacheRendu = null; }
  if (docPdf) { docPdf.destroy(); docPdf = null; }
  pagePdf = null;
  if (imageBitmap) { imageBitmap.close && imageBitmap.close(); imageBitmap = null; }
  dernierRendu = null;
}

function effacer() {
  if (!canvas) return;
  canvas.style.transform = '';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* Appelé à chaque changement de vue : transforme le canvas en CSS puis programme un rendu. */
export function surChangementVue() {
  if (dernierRendu) {
    const f = vue.k / dernierRendu.k;
    const tx = vue.tx - dernierRendu.tx * f;
    const ty = vue.ty - dernierRendu.ty * f;
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${f})`;
  }
  programmerRendu(180);
}

export function programmerRendu(delai) {
  clearTimeout(minuterie);
  minuterie = setTimeout(rendre, delai);
}

/* Rendu du fond à la résolution de l'écran pour la vue courante. */
async function rendre() {
  if (!canvas) return;
  tailleEcran();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const l = Math.round(vue.largeurEcran * dpr), h = Math.round(vue.hauteurEcran * dpr);
  const cible = { k: vue.k, tx: vue.tx, ty: vue.ty, dpr };
  const monJeton = ++jeton;

  if (!docPdf && !imageBitmap) { canvas.width = l; canvas.height = h; effacer(); return; }

  // Rendu hors écran puis copie : évite le scintillement pendant le rendu PDF.
  const hors = document.createElement('canvas');
  hors.width = l; hors.height = h;
  const hctx = hors.getContext('2d', { alpha: false });
  hctx.fillStyle = '#FFFFFF';
  hctx.fillRect(0, 0, l, h);

  if (pagePdf) {
    if (tacheRendu) { try { tacheRendu.cancel(); } catch (e) { /* ignore */ } }
    const viewport = pagePdf.getViewport({ scale: vue.k * dpr, offsetX: vue.tx * dpr, offsetY: vue.ty * dpr });
    try {
      tacheRendu = pagePdf.render({ canvasContext: hctx, viewport, background: 'rgba(255,255,255,1)' });
      await tacheRendu.promise;
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      console.error('Rendu PDF :', e);
      return;
    }
    tacheRendu = null;
  } else if (imageBitmap) {
    const si = etat.plan.fond.echelle_image || 1;
    hctx.setTransform(vue.k * dpr * si, 0, 0, vue.k * dpr * si, vue.tx * dpr, vue.ty * dpr);
    hctx.imageSmoothingEnabled = true;
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(imageBitmap, 0, 0);
    hctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (monJeton !== jeton) return;   // une vue plus récente est arrivée entre-temps

  canvas.width = l; canvas.height = h;
  canvas.style.width = vue.largeurEcran + 'px';
  canvas.style.height = vue.hauteurEcran + 'px';
  ctx.drawImage(hors, 0, 0);
  dernierRendu = cible;
  // La vue peut avoir bougé pendant le rendu : on recale en CSS.
  const f = vue.k / cible.k;
  canvas.style.transform = (f === 1 && vue.tx === cible.tx && vue.ty === cible.ty) ? '' :
    `translate(${vue.tx - cible.tx * f}px, ${vue.ty - cible.ty * f}px) scale(${f})`;
}

/* Rendu du fond dans un canvas fourni (export PNG). k : unités plan → pixels. */
export async function rendreDans(ctxCible, k, largeur, hauteur) {
  ctxCible.fillStyle = '#FFFFFF';
  ctxCible.fillRect(0, 0, largeur, hauteur);
  const op = etat.plan && etat.plan.fond ? etat.plan.fond.opacite : 1;
  ctxCible.globalAlpha = op;
  if (pagePdf) {
    const viewport = pagePdf.getViewport({ scale: k });
    await pagePdf.render({ canvasContext: ctxCible, viewport }).promise;
  } else if (imageBitmap) {
    const si = etat.plan.fond.echelle_image || 1;
    ctxCible.setTransform(k * si, 0, 0, k * si, 0, 0);
    ctxCible.drawImage(imageBitmap, 0, 0);
    ctxCible.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctxCible.globalAlpha = 1;
}

export function fondPresent() { return !!(pagePdf || imageBitmap); }
export function nombrePages() { return docPdf ? docPdf.numPages : 1; }
