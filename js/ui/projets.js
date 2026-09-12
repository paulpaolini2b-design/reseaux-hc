/* ui/projets.js — liste des projets (créer, ouvrir, renommer, dupliquer, supprimer,
 * importer), chargement du fond (PDF / image / photo), boîte d'export (PDF, PNG, JSON).
 */
import { etat, notifier, sur, emettre } from '../etat.js';
import * as P from '../projet.js';
import { chargerFichier } from '../fond.js';
import { exporterPdf } from '../export-pdf.js';
import { exporterPng, nomExport } from '../export-png.js';
import { bd } from '../bd.js';
import { aujourdhui } from '../modele.js';
import { ouvrirDialogue, fermerDialogue, confirmer, demander, echapper } from './dialogues.js';

export function initialiserProjetsUI() {
  document.getElementById('btn-projets').addEventListener('click', ouvrirListeProjets);
  document.getElementById('btn-fond').addEventListener('click', ouvrirFondDialogue);
  document.getElementById('btn-export').addEventListener('click', ouvrirExport);
  sur('projet-ouvert', () => { document.getElementById('message-vide').hidden = !!etat.plan.fond; });
  sur('fond', () => { document.getElementById('message-vide').hidden = !!(etat.plan && etat.plan.fond); });
  sur('projet-ferme', () => { document.getElementById('message-vide').hidden = false; });
}

/* ---------- Projets ---------- */
export async function ouvrirListeProjets() {
  const liste = await P.listerProjets();
  const espace = await bd.espace();
  const d = ouvrirDialogue('dlg-projets', `
    <form method="dialog" class="dialogue projets">
      <header class="entete-dialogue"><h2>Projets</h2><button type="button" class="btn-icone fermer" title="Fermer">✕</button></header>
      <div class="actions-projets">
        <button type="button" class="btn btn-primaire" data-action="nouveau">Nouveau projet</button>
        <button type="button" class="btn" data-action="importer">Importer un .json</button>
      </div>
      <div class="liste-projets">
        ${liste.length ? liste.map((p) => `
          <div class="projet ${etat.projet && etat.projet.id === p.id ? 'courant' : ''}" data-id="${p.id}">
            <div class="infos" data-action="ouvrir">
              <div class="nom">${echapper(p.nom)}${p.commune ? ' <span class="commune">— ' + echapper(p.commune) + '</span>' : ''}</div>
              <div class="meta">${echapper(p.date || '')} · ${p.nb_objets} objet${p.nb_objets > 1 ? 's' : ''}${p.fond ? ' · ' + echapper(p.fond) : ' · sans fond'} · modifié ${formaterDate(p.modifie_le)}</div>
            </div>
            <div class="actions">
              <button type="button" class="btn-icone" data-action="renommer" title="Renommer">✎</button>
              <button type="button" class="btn-icone" data-action="dupliquer" title="Dupliquer">⧉</button>
              <button type="button" class="btn-icone" data-action="supprimer" title="Supprimer">🗑</button>
            </div>
          </div>`).join('') : '<p class="vide">Aucun projet. Créez-en un pour commencer.</p>'}
      </div>
      ${espace ? `<div class="aide">Stockage utilisé : ${(espace.utilise / 1048576).toFixed(1)} Mo${espace.quota ? ' / ' + (espace.quota / 1048576).toFixed(0) + ' Mo disponibles' : ''}</div>` : ''}
    </form>`);
  d.querySelector('.fermer').addEventListener('click', () => d.close());
  d.querySelector('[data-action="nouveau"]').addEventListener('click', async () => {
    const r = await demander('Nouveau projet', [
      { nom: 'nom', libelle: 'Nom de l’affaire', valeur: '', placeholder: 'Ex. Renforcement BT Lieu-dit…' },
      { nom: 'commune', libelle: 'Commune', valeur: '' },
      { nom: 'date', libelle: 'Date', valeur: aujourdhui(), type: 'date' }
    ], { ok: 'Créer' });
    if (!r || !r.nom.trim()) return;
    d.close();
    await P.creerProjet({ nom: r.nom.trim(), commune: r.commune.trim(), date: r.date });
    notifier('Projet créé — ajoutez un fond de plan');
    ouvrirFondDialogue();
  });
  d.querySelector('[data-action="importer"]').addEventListener('click', () => {
    const inp = document.getElementById('fichier-projet');
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = '';
      if (!f) return;
      try { const id = await P.importerProjetJson(f); d.close(); await P.ouvrirProjet(id); notifier('Projet importé'); }
      catch (e) { notifier('Import impossible : ' + e.message, 4000); }
    };
    inp.click();
  });
  d.querySelectorAll('.projet').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('[data-action="ouvrir"]').addEventListener('click', async () => { d.close(); try { await P.ouvrirProjet(id); } catch (e) { notifier(e.message); } });
    el.querySelector('[data-action="renommer"]').addEventListener('click', async () => {
      const p = liste.find((x) => x.id === id);
      const r = await demander('Renommer', [{ nom: 'nom', libelle: 'Nom', valeur: p.nom }, { nom: 'commune', libelle: 'Commune', valeur: p.commune || '' }, { nom: 'date', libelle: 'Date', valeur: p.date || '', type: 'date' }]);
      if (!r) return;
      await P.renommerProjet(id, { nom: r.nom.trim() || p.nom, commune: r.commune.trim(), date: r.date });
      ouvrirListeProjets();
    });
    el.querySelector('[data-action="dupliquer"]').addEventListener('click', async () => { await P.dupliquerProjet(id); notifier('Projet dupliqué'); ouvrirListeProjets(); });
    el.querySelector('[data-action="supprimer"]').addEventListener('click', async () => {
      const p = liste.find((x) => x.id === id);
      if (await confirmer(`Supprimer définitivement « ${p.nom} » ?`, { ok: 'Supprimer', danger: true })) { await P.supprimerProjet(id); ouvrirListeProjets(); }
    });
  });
}

function formaterDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Fond de plan ---------- */
export function ouvrirFondDialogue() {
  if (!etat.projet) { notifier('Ouvrez ou créez d’abord un projet'); ouvrirListeProjets(); return; }
  const f = etat.plan.fond;
  const d = ouvrirDialogue('dlg-fond', `
    <form method="dialog" class="dialogue">
      <h2>Fond de plan</h2>
      ${f ? `<p class="aide">Fond actuel : ${echapper(f.nom_fichier)}${f.type === 'pdf' && f.nb_pages > 1 ? ' (page ' + f.page + ' / ' + f.nb_pages + ')' : ''}. Le remplacer conserve les objets déjà tracés.</p>` : '<p class="aide">Choisissez un PDF, une image ou prenez une photo. Le plan est utilisable ensuite sans connexion.</p>'}
      <div class="boutons colonne">
        <button type="button" class="btn btn-primaire" data-action="fichier">Choisir un PDF ou une image</button>
        <button type="button" class="btn" data-action="photo">Prendre une photo</button>
        <button type="button" class="btn" data-action="fermer">Annuler</button>
      </div>
    </form>`);
  d.querySelector('[data-action="fermer"]').addEventListener('click', () => d.close());
  const charger = (inputId, photo) => {
    const inp = document.getElementById(inputId);
    inp.onchange = async () => {
      const fichier = inp.files[0]; inp.value = '';
      if (!fichier) return;
      d.close();
      notifier('Chargement du fond…');
      try { const infos = await chargerFichier(fichier, { photo }); notifier(infos.type === 'pdf' ? `PDF chargé (${infos.nb_pages} page${infos.nb_pages > 1 ? 's' : ''})` : 'Image chargée'); }
      catch (e) { console.error(e); notifier('Chargement impossible : ' + (e.message || e), 5000); }
    };
    inp.click();
  };
  d.querySelector('[data-action="fichier"]').addEventListener('click', () => charger('fichier-fond', false));
  d.querySelector('[data-action="photo"]').addEventListener('click', () => charger('fichier-photo', true));
}

/* ---------- Export ---------- */
export function ouvrirExport() {
  if (!etat.projet) { notifier('Aucun projet ouvert'); return; }
  const d = ouvrirDialogue('dlg-export', `
    <form method="dialog" class="dialogue">
      <h2>Exporter</h2>
      <div class="boutons colonne">
        <button type="button" class="btn btn-primaire" data-action="pdf">PDF vectoriel (format du fond, légende, texte sélectionnable)</button>
        <label class="ligne2 compact">
          <button type="button" class="btn" data-action="png">Image PNG</button>
          <select name="dpi"><option value="150">150 dpi</option><option value="200" selected>200 dpi</option><option value="300">300 dpi</option></select>
        </label>
        <button type="button" class="btn" data-action="json">Projet .json (avec fond embarqué, pour transfert)</button>
        <button type="button" class="btn" data-action="fermer">Fermer</button>
      </div>
      <p class="aide" id="export-etat"></p>
      <p class="aide">Sur Android, l’export s’ouvre dans le panneau de partage (Drive, mail, Nearby…) ; sinon le fichier est téléchargé.</p>
    </form>`);
  const etatEl = d.querySelector('#export-etat');
  const progression = (m) => { etatEl.textContent = m; };
  d.querySelector('[data-action="fermer"]').addEventListener('click', () => d.close());
  d.querySelector('[data-action="pdf"]').addEventListener('click', async () => {
    try {
      const blob = await exporterPdf({ progression });
      progression('PDF prêt (' + (blob.size / 1048576).toFixed(2) + ' Mo)');
      await P.telechargerBlob(blob, P.nomFichierProjet('.pdf'), { partager: true });
    } catch (e) { console.error(e); progression('Échec de l’export PDF : ' + (e.message || e)); }
  });
  d.querySelector('[data-action="png"]').addEventListener('click', async () => {
    try {
      const blob = await exporterPng({ dpi: Number(d.querySelector('[name="dpi"]').value), progression });
      progression('PNG prêt (' + (blob.size / 1048576).toFixed(2) + ' Mo)');
      await P.telechargerBlob(blob, nomExport('.png'), { partager: true });
    } catch (e) { console.error(e); progression('Échec de l’export PNG : ' + (e.message || e)); }
  });
  d.querySelector('[data-action="json"]').addEventListener('click', async () => {
    try {
      progression('Préparation du fichier…');
      const blob = await P.exporterProjetJson();
      const mo = blob.size / 1048576;
      progression('Fichier prêt (' + mo.toFixed(1) + ' Mo)' + (mo > 25 ? ' — volumineux : le fond est embarqué en base64' : ''));
      await P.telechargerBlob(blob, P.nomFichierProjet('.json'), { partager: true });
    } catch (e) { console.error(e); progression('Échec : ' + (e.message || e)); }
  });
}

export { fermerDialogue, emettre };
