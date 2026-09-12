/* projet.js — projet courant : création, ouverture, sauvegarde automatique,
 * export / import .json (fond de plan embarqué en base64).
 */
import { etat, emettre, sur, deselectionner, notifier } from './etat.js';
import { bd } from './bd.js';
import { nouveauProjet, migrerProjet, recalculerCompteurs, cloner, genererId } from './modele.js';
import { reinitialiserHistorique } from './historique.js';
import { ouvrirFondProjet } from './fond.js';
import { restaurer } from './vue.js';
import { viderCacheAccrochage } from './accrochage.js';

let minuterie = null;
let sauvegardeEnCours = false;
let modifieDepuisSauvegarde = false;

export function initialiserProjet() {
  sur('objets', () => programmerSauvegarde());
  sur('vue', () => programmerSauvegarde(1500));
  sur('calques', () => programmerSauvegarde());
  sur('fond', () => programmerSauvegarde(0));
  sur('reglages', () => programmerSauvegarde());
  // Sauvegarde à la mise en arrière-plan (fermeture de l'application sur tablette)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sauverMaintenant(); });
  window.addEventListener('pagehide', () => sauverMaintenant());
}

function indicateur(texte, classe) {
  const el = document.getElementById('etat-sauvegarde');
  if (!el) return;
  el.textContent = texte;
  el.className = classe || '';
}

export function programmerSauvegarde(delai = 400) {
  if (!etat.projet) return;
  modifieDepuisSauvegarde = true;
  indicateur('●', 'modifie');
  clearTimeout(minuterie);
  minuterie = setTimeout(sauverMaintenant, delai);
}

export async function sauverMaintenant() {
  clearTimeout(minuterie);
  if (!etat.projet || sauvegardeEnCours) return;
  sauvegardeEnCours = true;
  try {
    etat.projet.modifie_le = new Date().toISOString();
    await bd.put('projets', cloner(etat.projet));
    modifieDepuisSauvegarde = false;
    indicateur('✓', 'sauve');
  } catch (e) {
    console.error(e);
    indicateur('!', 'erreur');
    notifier('Sauvegarde impossible : ' + (e.message || e));
  } finally {
    sauvegardeEnCours = false;
    if (modifieDepuisSauvegarde) programmerSauvegarde();
  }
}

export async function listerProjets() {
  const tous = await bd.tout('projets');
  return tous.map((p) => ({ id: p.id, nom: p.nom, commune: p.commune, date: p.date, modifie_le: p.modifie_le, nb_objets: (p.plans || []).reduce((n, pl) => n + (pl.objets || []).length, 0), fond: p.plans && p.plans[0] && p.plans[0].fond ? p.plans[0].fond.nom_fichier : '' }))
    .sort((a, b) => (b.modifie_le || '').localeCompare(a.modifie_le || ''));
}

export async function creerProjet(infos) {
  const p = nouveauProjet(infos);
  await bd.put('projets', cloner(p));
  await ouvrirProjet(p.id);
  return p;
}

export async function ouvrirProjet(id) {
  await sauverMaintenant();
  const p = await bd.get('projets', id);
  if (!p) throw new Error('Projet introuvable.');
  migrerProjet(p);
  recalculerCompteurs(p);
  etat.projet = p;
  etat.plan = p.plans[p.plan_courant] || p.plans[0];
  etat.selection.clear();
  viderCacheAccrochage();
  await bd.put('prefs', { cle: 'dernier_projet', valeur: id });
  await ouvrirFondProjet();
  restaurer(etat.plan);
  reinitialiserHistorique();
  emettre('projet-ouvert', p);
  emettre('selection', []);
  document.getElementById('nom-projet').textContent = p.nom + (p.commune ? ' — ' + p.commune : '');
  indicateur('✓', 'sauve');
  return p;
}

export async function fermerProjet() {
  await sauverMaintenant();
  etat.projet = null; etat.plan = null; etat.fondBlob = null;
  deselectionner();
  emettre('projet-ferme');
  document.getElementById('nom-projet').textContent = 'Aucun projet';
  indicateur('', '');
}

export async function renommerProjet(id, { nom, commune, date }) {
  const p = (etat.projet && etat.projet.id === id) ? etat.projet : await bd.get('projets', id);
  if (!p) return;
  if (nom !== undefined) p.nom = nom;
  if (commune !== undefined) p.commune = commune;
  if (date !== undefined) p.date = date;
  p.modifie_le = new Date().toISOString();
  await bd.put('projets', cloner(p));
  if (etat.projet && etat.projet.id === id) document.getElementById('nom-projet').textContent = p.nom + (p.commune ? ' — ' + p.commune : '');
}

export async function dupliquerProjet(id) {
  const src = (etat.projet && etat.projet.id === id) ? cloner(etat.projet) : await bd.get('projets', id);
  if (!src) return null;
  const copie = cloner(src);
  copie.id = genererId('prj');
  copie.nom = src.nom + ' (copie)';
  copie.cree_le = copie.modifie_le = new Date().toISOString();
  // Les fonds sont partagés en base (même blob) : on duplique l'enregistrement pour rester indépendant.
  for (const plan of copie.plans) {
    if (plan.fond && plan.fond.fond_id) {
      const f = await bd.get('fonds', plan.fond.fond_id);
      if (f) { const nf = { ...f, id: genererId('fd') }; await bd.put('fonds', nf); plan.fond.fond_id = nf.id; }
    }
  }
  await bd.put('projets', copie);
  return copie;
}

export async function supprimerProjet(id) {
  const p = (etat.projet && etat.projet.id === id) ? etat.projet : await bd.get('projets', id);
  if (p) for (const plan of p.plans) if (plan.fond && plan.fond.fond_id) await bd.del('fonds', plan.fond.fond_id);
  await bd.del('projets', id);
  if (etat.projet && etat.projet.id === id) { etat.projet = null; etat.plan = null; etat.fondBlob = null; deselectionner(); emettre('projet-ferme'); document.getElementById('nom-projet').textContent = 'Aucun projet'; }
}

export async function dernierProjetId() {
  const d = await bd.get('prefs', 'dernier_projet');
  return d ? d.valeur : null;
}

/* ---------- Export / import .json ---------- */
function blobVersBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64VersBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exporterProjetJson() {
  await sauverMaintenant();
  const p = cloner(etat.projet);
  const fonds = [];
  for (const plan of p.plans) {
    if (plan.fond && plan.fond.fond_id) {
      const f = await bd.get('fonds', plan.fond.fond_id);
      if (f) fonds.push({ id: f.id, type: f.type, nom_fichier: f.nom_fichier, mime: f.blob.type, base64: await blobVersBase64(f.blob) });
    }
  }
  const contenu = { application: 'reseaux-hc', version_schema: p.version_schema, exporte_le: new Date().toISOString(), projet: p, fonds };
  return new Blob([JSON.stringify(contenu)], { type: 'application/json' });
}

export async function importerProjetJson(fichier) {
  const texte = await fichier.text();
  const d = JSON.parse(texte);
  if (!d || !d.projet || !Array.isArray(d.projet.plans)) throw new Error('Fichier de projet invalide.');
  const p = migrerProjet(d.projet);
  // Nouvel identifiant pour ne pas écraser un projet existant portant le même id
  const existant = await bd.get('projets', p.id);
  if (existant) { p.id = genererId('prj'); p.nom = p.nom + ' (importé)'; }
  const corr = {};
  for (const f of d.fonds || []) {
    const nid = genererId('fd');
    corr[f.id] = nid;
    await bd.put('fonds', { id: nid, type: f.type, nom_fichier: f.nom_fichier, blob: base64VersBlob(f.base64, f.mime || (f.type === 'pdf' ? 'application/pdf' : 'image/jpeg')) });
  }
  for (const plan of p.plans) if (plan.fond && corr[plan.fond.fond_id]) plan.fond.fond_id = corr[plan.fond.fond_id];
  p.modifie_le = new Date().toISOString();
  await bd.put('projets', p);
  return p.id;
}

/* Télécharge un blob (ou le partage sur Android si possible). */
export async function telechargerBlob(blob, nomFichier, { partager = false } = {}) {
  if (partager && navigator.canShare) {
    try {
      const f = new File([blob], nomFichier, { type: blob.type });
      if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nomFichier }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

export function nomFichierProjet(ext) {
  const p = etat.projet;
  const base = ((p.nom || 'projet') + (p.commune ? '_' + p.commune : '')).replace(/[^\w\-àâäéèêëîïôöùûüç]+/gi, '_');
  return base + '_' + (p.date || '').replace(/-/g, '') + ext;
}
