/* ui/fiche-objet.js — fiche de l'objet sélectionné (phase bureau).
 *
 * Aucun champ n'est obligatoire. Les listes sont filtrées depuis la nomenclature
 * (matériau → hauteur → classe → effort) et chaque liste accepte une valeur libre.
 * Toute modification est appliquée immédiatement (annulable), la désignation
 * automatique se recalcule, l'indicateur « complet » aussi.
 */
import { etat, emettre, sur, objetParId, notifier, selectionner } from '../etat.js';
import { LIBELLES } from '../charte.js';
import { calquePourEtat, designationAffichee } from '../modele.js';
import { valider } from '../historique.js';
import { designationAuto, materiauMetalliqueParDefaut } from '../designation.js';
import * as N from '../nomenclature.js';
import { echapper, demander } from './dialogues.js';
import { ouvrirEditeurNote } from './notes.js';

let fiche, idCourant = null;

const FONCTIONS = ['', 'ALIGNEMENT', 'ANGLE', 'ARRET', 'DERIVATION', 'ANCRAGE', 'DOUBLE_ANCRAGE', 'REMONTEE_AERO_SOUTERRAINE', 'TRAVERSEE'];
const RENFORCEMENTS = [['AUCUN', 'Aucun'], ['CONTREFICHE', 'Contrefiché'], ['JUMELE', 'Jumelé'], ['HAUBANE', 'Haubané'], ['PORTIQUE', 'Portique']];
const NATURES_TERRAIN = ['', 'CHAUSSEE', 'TROTTOIR', 'ACCOTEMENT', 'TERRE', 'ROCHE', 'ENROBE', 'BETON', 'PAVES', 'ESPACE_VERT'];

export function initialiserFiche() {
  fiche = document.getElementById('fiche');
  sur('ouvrir-fiche', (id) => ouvrirFiche(id));
  sur('objet-touche', (id) => { if (!fiche.hidden) ouvrirFiche(id); });
  sur('selection', (ids) => { if (!fiche.hidden) { if (ids.length === 1 && ids[0] !== 'legende') ouvrirFiche(ids[0]); else fermerFiche(); } });
  sur('objets', () => {
    if (fiche.hidden || !idCourant) return;
    // Pas de re-rendu pendant une saisie au clavier dans la fiche (le champ perdrait le focus)
    const a = document.activeElement;
    const saisie = a && a.closest && a.closest('#fiche') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName);
    if (!saisie) ouvrirFiche(idCourant, { conserver: true });
  });
  sur('fermer-panneaux', () => fermerFiche());
  sur('valider-fiche', () => { if (!fiche.hidden) { fermerFiche(); notifier('Fiche validée'); } });
  sur('projet-ferme', () => fermerFiche());
}

export function fermerFiche() { fiche.hidden = true; idCourant = null; }

export function ouvrirFiche(id, { conserver = false } = {}) {
  const o = objetParId(id);
  if (!o) { fermerFiche(); return; }
  if (o.type === 'note') { ouvrirEditeurNote(id); fermerFiche(); return; }
  const defil = conserver ? fiche.scrollTop : 0;
  idCourant = id;
  fiche.hidden = false;
  document.getElementById('palette').hidden = true;
  document.getElementById('panneau-calques').hidden = true;
  document.getElementById('panneau-a-completer').hidden = true;
  fiche.innerHTML = `
    <header class="entete-panneau">
      <h2>${echapper(LIBELLES.types[o.type] || o.type)} <span class="repere">${echapper(o.repere)}</span></h2>
      <span class="complet ${o.complet ? 'oui' : 'non'}" title="${o.complet ? 'Fiche complète' : 'Fiche à compléter'}">${o.complet ? '✓' : '!'}</span>
      <button class="btn-icone fermer" title="Fermer (Échap)">✕</button>
    </header>
    <div class="contenu">
      <section class="bloc">
        <div class="chips" data-champ="etat">${Object.entries(LIBELLES.etats).map(([k, l]) => `<button class="chip ${o.etat === k ? 'actif' : ''}" data-valeur="${k}">${l}</button>`).join('')}</div>
        <div class="ligne2">
          <label>Réseau<select name="domaine">${Object.entries(LIBELLES.domaines).map(([k, l]) => `<option value="${k}" ${o.domaine === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Pose<select name="pose">${Object.entries(LIBELLES.poses).map(([k, l]) => `<option value="${k}" ${o.pose === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
      </section>
      <section class="bloc" id="fiche-specifique"></section>
      <section class="bloc">
        <h3>Désignation</h3>
        <div class="designation-auto">Automatique : <strong>${echapper(designationAuto(o) || '—')}</strong></div>
        <label>Désignation manuelle (prioritaire)<input name="designation_manuelle" value="${echapper(o.designation_manuelle)}" placeholder="Laisser vide pour l'automatique"></label>
        <label class="case"><input type="checkbox" name="etiquette_visible" ${o.etiquette.visible ? 'checked' : ''}> Afficher l'étiquette sur le plan</label>
      </section>
      <section class="bloc" id="fiche-materiel">
        <h3>Matériel associé</h3>
        <div class="liste-materiel"></div>
        <div class="ajout-materiel">
          <input type="search" name="rech_materiel" placeholder="Ajouter depuis la nomenclature…" autocomplete="off">
          <div class="resultats" hidden></div>
        </div>
        <div class="ligne2">
          <input name="materiel_libre" placeholder="Matériel libre (ex. ferrure FT)">
          <button class="btn" data-action="ajouter-libre">Ajouter</button>
        </div>
        <div class="packages">${N.nomsPackages().map((p) => `<button class="chip petit" data-package="${p}">+ ${echapper(p.replace(/_/g, ' '))}</button>`).join('')}</div>
      </section>
      <section class="bloc">
        <h3>Commentaire</h3>
        <textarea name="commentaire" rows="3" placeholder="Ex. le dernier support sur la 3ᵉ branche est difficilement accessible…">${echapper(o.commentaire)}</textarea>
      </section>
      <section class="bloc avance">
        <details>
          <summary>Avancé</summary>
          <div class="ligne2">
            <label>Rotation (°)<input type="number" name="rotation" value="${Math.round(o.rotation || 0)}" step="5"></label>
            <label>Taille du symbole<input type="number" name="echelle_symbole" value="${o.echelle_symbole || 1}" step="0.1" min="0.3" max="5"></label>
          </div>
          <label>Calque<select name="calque">${Object.entries(LIBELLES.calques).filter(([k]) => k !== 'fond').map(([k, l]) => `<option value="${k}" ${o.calque === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Repère<input name="repere" value="${echapper(o.repere)}"></label>
        </details>
      </section>
    </div>
    <footer class="pied-panneau">
      <button class="btn" data-action="dupliquer">Dupliquer</button>
      <button class="btn btn-danger" data-action="supprimer">Supprimer</button>
      <button class="btn btn-primaire" data-action="valider" title="Ctrl+Entrée">Valider</button>
    </footer>`;

  rendreSpecifique(o);
  rendreMateriel(o);
  brancher(o);
  fiche.scrollTop = defil;
}

/* ---------- Champs propres à chaque type ---------- */
function opt(valeurs, courant, { libelles = null, vide = '—' } = {}) {
  const liste = valeurs.map((v) => `<option value="${echapper(v)}" ${String(v) === String(courant ?? '') ? 'selected' : ''}>${echapper(libelles ? libelles[v] ?? v : (v === '' ? vide : v))}</option>`);
  const present = valeurs.some((v) => String(v) === String(courant ?? ''));
  if (!present && courant !== null && courant !== undefined && courant !== '') liste.unshift(`<option value="${echapper(courant)}" selected>${echapper(courant)} (libre)</option>`);
  liste.push(`<option value="__libre__">Autre…</option>`);
  return liste.join('');
}

function rendreSpecifique(o) {
  const z = fiche.querySelector('#fiche-specifique');
  const a = o.attributs;
  switch (o.type) {
    case 'support': {
      const materiaux = N.materiauxSupports();
      const libMat = { '': '—', BETON: 'Béton (BE)', BOIS: 'Bois (BØ)', ME_TUB: 'Métallique tubulaire (ME tub)', ME_PTR: 'Poutrelle métallique (ME ptr)' };
      const hauteurs = a.materiau ? N.hauteursSupports(a.materiau) : [];
      const classes = a.materiau ? N.classesSupports(a.materiau, a.hauteur_m) : [];
      const efforts = a.materiau ? N.effortsSupports(a.materiau, a.hauteur_m, a.classe) : [];
      const armements = etat.nomenclature.articles.filter((x) => x.categorie === (o.domaine === 'HTA' ? 'ARMEMENT_HTA' : 'ARMEMENT_BT')).map((x) => x.libelle);
      z.innerHTML = `
        <h3>Support</h3>
        <label>Matériau<select name="a.materiau">${opt(['', ...materiaux], a.materiau, { libelles: libMat })}</select></label>
        ${!a.materiau ? `<div class="aide">Métallique : ${materiauMetalliqueParDefaut(o.etat) === 'ME_TUB' ? 'ME tub proposé pour un support neuf' : 'ME ptr proposé pour un support existant'}.</div>` : ''}
        <div class="ligne2">
          <label>Hauteur (m)<select name="a.hauteur_m" ${!a.materiau ? 'disabled' : ''}>${opt(['', ...hauteurs], a.hauteur_m)}</select></label>
          <label>Classe<select name="a.classe" ${!a.materiau || (a.materiau !== 'BETON' && a.materiau !== 'BOIS' && !classes.length) ? 'disabled' : ''}>${opt(['', ...classes], a.classe)}</select></label>
        </div>
        <div class="ligne2">
          <label>Effort (daN)<select name="a.effort_daN" ${!a.materiau || a.materiau === 'BOIS' ? 'disabled' : ''}>${opt(['', ...efforts], a.effort_daN)}</select></label>
          <label>Fonction<select name="a.fonction">${FONCTIONS.map((f) => `<option value="${f}" ${a.fonction === f ? 'selected' : ''}>${f ? f.replace(/_/g, ' ').toLowerCase() : '—'}</option>`).join('')}</select></label>
        </div>
        <div class="ligne2">
          <label>Renforcement<select name="a.renforcement">${RENFORCEMENTS.map(([k, l]) => `<option value="${k}" ${a.renforcement === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Sens du renforcement (°)<input type="number" name="a.angle_renforcement" value="${a.angle_renforcement || 0}" step="15" ${a.renforcement === 'AUCUN' || a.renforcement === 'JUMELE' ? 'disabled' : ''}></label>
        </div>
        <label>Armement<input name="a.armement" list="liste-armements" value="${echapper(a.armement)}" placeholder="Ex. NP 70, ferrure FT…"></label>
        <datalist id="liste-armements">${armements.map((l) => `<option value="${echapper(l)}">`).join('')}</datalist>
`;
      break;
    }
    case 'coffret': {
      const sig = N.sigles(['COFFRET_BT', 'ECLAIRAGE_PUBLIC']).map((s) => s.sigle);
      const plages = N.plagesRembt(a.sigle);
      const grilles = N.grillesCibe(a.section_reseau);
      z.innerHTML = `
        <h3>Coffret / borne</h3>
        <label>Sigle<select name="a.sigle">${opt(['', ...sig], a.sigle)}</select></label>
        <div class="ligne2">
          <label>Nombre de plages<input type="number" name="a.nb_plages" value="${a.nb_plages ?? ''}" min="0"></label>
          <label>Section du réseau entrant<input name="a.section_reseau" value="${echapper(a.section_reseau)}" placeholder="Ex. 3x150+70"></label>
        </div>
        ${plages ? `<div class="aide">${echapper(a.sigle)} : ${plages} plages selon la nomenclature.</div>` : ''}
        ${grilles.length ? `<div class="aide">Grilles CIBE conseillées : ${grilles.map(echapper).join(', ')}.</div>` : ''}`;
      break;
    }
    case 'poste': {
      const sig = N.sigles(['POSTE', 'COUPURE_HTA']).map((s) => s.sigle);
      z.innerHTML = `
        <h3>Poste / coupure HTA</h3>
        <label>Sigle<select name="a.sigle">${opt(['', ...sig], a.sigle)}</select></label>
        <label>Puissance (kVA)<input type="number" name="a.puissance_kva" value="${a.puissance_kva ?? ''}" min="0"></label>`;
      break;
    }
    case 'boite_jonction':
      z.innerHTML = `<h3>Boîte de jonction</h3><label>Sections raccordées<input name="a.sections" value="${echapper(a.sections)}" placeholder="Ex. 150 / 150"></label>`;
      break;
    case 'malt': {
      const aide = N.aideMalt();
      z.innerHTML = `<h3>MALT</h3><label>Convention / repère<input name="a.convention" value="${echapper(a.convention)}"></label>
        ${aide ? `<div class="aide">${echapper(aide.convention)}<br>Systématique : ${aide.systematique.map(echapper).join(', ')}.<br>Jamais : ${aide.jamais.map(echapper).join(', ')}.</div>` : ''}`;
      break;
    }
    case 'eras':
      z.innerHTML = `<h3>ERAS / RAS</h3>
        <label>Type<select name="a.sous_type">${[['BT_RESEAU', 'ERAS BT réseau'], ['HTA', 'ERAS HTA'], ['BRANCHEMENT', 'RAS branchement'], ['EP', 'RAS éclairage public']].map(([k, l]) => `<option value="${k}" ${a.sous_type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="case"><input type="checkbox" name="a.avec_malt" ${a.avec_malt ? 'checked' : ''}> Avec MALT (jamais sur branchement ni EP)</label>`;
      break;
    case 'point_lumineux':
      z.innerHTML = `<h3>Point lumineux</h3><label>Implanté sur<select name="a.sur"><option value="SUPPORT" ${a.sur === 'SUPPORT' ? 'selected' : ''}>Support réseau</option><option value="MAT" ${a.sur === 'MAT' ? 'selected' : ''}>Mât EP</option></select></label>`;
      break;
    case 'armoire_ep':
      z.innerHTML = `<h3>Armoire EP</h3><label>Sigle<input name="a.sigle" value="${echapper(a.sigle)}"></label>`;
      break;
    case 'troncon': {
      const sections = N.sectionsCables(o.domaine, o.pose).map((s) => s.section);
      const fourreaux = N.fourreaux().map((f) => f.notation);
      const longueur = a.longueur_manuelle ?? '';
      z.innerHTML = `
        <h3>Tronçon</h3>
        <label>Section / câble<select name="a.section">${opt(['', ...sections], a.section)}</select></label>
        ${o.domaine === 'BTS' && a.section ? aideNeutreSection(a.section) : ''}
        <div class="ligne2">
          <label>Nature<input name="a.nature" value="${echapper(a.nature)}" placeholder="Ex. torsadé, HN 33-S-33"></label>
          <label>Norme<input name="a.norme" value="${echapper(a.norme)}"></label>
        </div>
        <label>Fourreau<select name="a.fourreau">${opt(['', ...fourreaux], a.fourreau)}</select></label>
        <div class="ligne2">
          <label>Longueur (m, saisie)<input type="number" name="a.longueur_manuelle" value="${longueur}" min="0" step="0.5" placeholder="Le métré vient au lot 3"></label>
          <label>Nature du terrain<select name="a.nature_terrain">${NATURES_TERRAIN.map((n) => `<option value="${n}" ${a.nature_terrain === n ? 'selected' : ''}>${n ? n.replace(/_/g, ' ').toLowerCase() : '—'}</option>`).join('')}</select></label>
        </div>
        ${o.pose === 'souterrain' ? `
        <div class="ligne2">
          <label>Profondeur (m)<input type="number" name="a.profondeur_m" value="${a.profondeur_m ?? ''}" step="0.1" min="0"></label>
          <label class="case"><input type="checkbox" name="a.grillage_avertisseur" ${a.grillage_avertisseur ? 'checked' : ''}> Grillage avertisseur</label>
        </div>
        <label class="case"><input type="checkbox" name="a.tranchee_commune" ${a.tranchee_commune ? 'checked' : ''}> Tranchée commune</label>` : ''}
        <div class="aide">${o.points.length} sommets.</div>`;
      break;
    }
    default:
      z.innerHTML = '';
  }
}

function aideNeutreSection(section) {
  const s = N.neutrePorteurConseille(section);
  return s ? `<div class="aide">Faisceau ${echapper(section)} : armement neutre porteur ${s} conseillé.</div>` : '';
}

/* ---------- Matériel associé ---------- */
function rendreMateriel(o) {
  const z = fiche.querySelector('.liste-materiel');
  if (!o.materiel_associe.length) { z.innerHTML = '<p class="vide">Aucun matériel associé.</p>'; return; }
  z.innerHTML = o.materiel_associe.map((m, i) => `
    <div class="ligne-materiel" data-i="${i}">
      <input type="number" class="qte" value="${m.quantite ?? 1}" min="0" step="1" title="Quantité">
      <span class="lib" title="${echapper(m.libelle)}">${echapper(m.libelle)}${m.unite ? ' <small>' + echapper(m.unite) + '</small>' : ''}${m.source === 'LIBRE' ? ' <small>(libre)</small>' : ''}</span>
      <button class="btn-icone" data-action="retirer" title="Retirer">✕</button>
    </div>`).join('');
  z.querySelectorAll('.qte').forEach((inp) => inp.addEventListener('change', () => {
    const i = parseInt(inp.closest('.ligne-materiel').dataset.i, 10);
    o.materiel_associe[i].quantite = inp.value === '' ? null : Number(inp.value);
    valider('Quantité');
  }));
  z.querySelectorAll('[data-action="retirer"]').forEach((b) => b.addEventListener('click', () => {
    const i = parseInt(b.closest('.ligne-materiel').dataset.i, 10);
    o.materiel_associe.splice(i, 1);
    valider('Matériel retiré');
  }));
}

/* ---------- Liaison des champs ---------- */
function brancher(o) {
  fiche.querySelector('.fermer').addEventListener('click', fermerFiche);
  fiche.querySelectorAll('[data-champ="etat"] .chip').forEach((b) => b.addEventListener('click', () => {
    o.etat = b.dataset.valeur;
    o.calque = calquePourEtat(o.etat, o.type);
    valider('État');
  }));
  fiche.querySelectorAll('select, input, textarea').forEach((el) => {
    if (!el.name || el.name === 'rech_materiel' || el.name === 'materiel_libre' || el.classList.contains('qte')) return;
    el.addEventListener('change', () => appliquerChamp(o, el));
  });
  // Recherche de matériel
  const rech = fiche.querySelector('[name="rech_materiel"]');
  const res = fiche.querySelector('.resultats');
  rech.addEventListener('input', () => {
    const t = rech.value.trim();
    if (t.length < 2) { res.hidden = true; return; }
    const articles = N.rechercher(t, { statut: N.statutPourEtat(o.etat) }, 12);
    res.innerHTML = articles.length ? articles.map((a) => `<button type="button" data-id="${a.id}"><span>${echapper(a.libelle)}</span><small>${echapper(N.libelleCategorie(a.categorie))}${a.unite ? ' · ' + echapper(a.unite) : ''}</small></button>`).join('') : '<div class="vide">Aucun article</div>';
    res.hidden = false;
    res.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const a = N.articleParId(b.dataset.id);
      o.materiel_associe.push({ source: 'NOMENCLATURE', ref_article: a.id, libelle: a.libelle, quantite: 1, unite: a.unite || '' });
      rech.value = ''; res.hidden = true;
      valider('Matériel associé');
      emettre('objet-pose', { ref_article: a.id });
    }));
  });
  fiche.querySelector('[data-action="ajouter-libre"]').addEventListener('click', () => {
    const inp = fiche.querySelector('[name="materiel_libre"]');
    const l = inp.value.trim();
    if (!l) return;
    o.materiel_associe.push({ source: 'LIBRE', ref_article: null, libelle: N.corrigerOrthographe(l), quantite: 1, unite: '' });
    inp.value = '';
    valider('Matériel libre');
  });
  fiche.querySelector('[name="materiel_libre"]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fiche.querySelector('[data-action="ajouter-libre"]').click(); } });
  fiche.querySelectorAll('[data-package]').forEach((b) => b.addEventListener('click', () => {
    const lignes = N.lignesPackage(b.dataset.package);
    if (!lignes.length) { notifier('Package vide'); return; }
    o.materiel_associe.push(...lignes);
    valider('Package ' + b.dataset.package);
  }));
  fiche.querySelector('[data-action="dupliquer"]').addEventListener('click', () => { selectionner([o.id]); import('../outils.js').then((m) => m.dupliquerSelection()); });
  fiche.querySelector('[data-action="supprimer"]').addEventListener('click', () => { selectionner([o.id]); import('../outils.js').then((m) => { m.supprimerSelection(); fermerFiche(); }); });
  fiche.querySelector('[data-action="valider"]').addEventListener('click', () => { fermerFiche(); notifier('Fiche validée'); });
}

async function appliquerChamp(o, el) {
  let valeur = el.type === 'checkbox' ? el.checked : el.value;
  if (valeur === '__libre__') {
    const r = await demander('Valeur libre', [{ nom: 'v', libelle: el.closest('label') ? el.closest('label').firstChild.textContent : 'Valeur', valeur: '' }]);
    if (!r || !r.v.trim()) { ouvrirFiche(o.id, { conserver: true }); return; }
    valeur = N.corrigerOrthographe(r.v.trim());
  }
  if (el.type === 'number') valeur = valeur === '' ? null : Number(valeur);
  if (typeof valeur === 'string' && el.name !== 'commentaire') valeur = N.corrigerOrthographe(valeur);

  if (el.name.startsWith('a.')) {
    const champ = el.name.slice(2);
    if (['hauteur_m', 'effort_daN', 'nb_plages', 'puissance_kva'].includes(champ) && valeur !== null && valeur !== '' && !isNaN(Number(valeur))) valeur = Number(valeur);
    o.attributs[champ] = valeur;
    // Cascade : un changement en amont réinitialise l'aval s'il n'est plus proposé
    if (o.type === 'support') {
      if (champ === 'materiau') {
        const h = N.hauteursSupports(valeur);
        if (h.length && !h.includes(Number(o.attributs.hauteur_m))) o.attributs.hauteur_m = null;
        if (valeur !== 'BETON' && valeur !== 'BOIS') o.attributs.classe = '';
        if (valeur === 'BOIS') o.attributs.effort_daN = null;
        if (valeur && !o.ref_article) { const art = N.articleSupport(o.attributs); o.ref_article = art ? art.id : null; }
      }
      if (champ === 'hauteur_m' || champ === 'classe') {
        const c = N.classesSupports(o.attributs.materiau, o.attributs.hauteur_m);
        if (c.length && o.attributs.classe && !c.includes(o.attributs.classe) && champ === 'hauteur_m') o.attributs.classe = '';
        const e = N.effortsSupports(o.attributs.materiau, o.attributs.hauteur_m, o.attributs.classe);
        if (e.length && o.attributs.effort_daN && !e.includes(Number(o.attributs.effort_daN))) o.attributs.effort_daN = null;
      }
      if (['materiau', 'hauteur_m', 'classe', 'effort_daN'].includes(champ)) { const art = N.articleSupport(o.attributs); o.ref_article = art ? art.id : o.ref_article; }
      if (champ === 'renforcement' && (valeur === 'AUCUN' || valeur === 'JUMELE')) o.attributs.angle_renforcement = 0;
    }
    if (o.type === 'eras' && champ === 'sous_type' && (valeur === 'BRANCHEMENT' || valeur === 'EP')) o.attributs.avec_malt = false;
    if (o.type === 'coffret' && champ === 'sigle') { const p = N.plagesRembt(valeur); if (p && !o.attributs.nb_plages) o.attributs.nb_plages = p; }
  } else if (el.name === 'etiquette_visible') {
    o.etiquette.visible = !!valeur;
  } else if (el.name === 'rotation' || el.name === 'echelle_symbole') {
    o[el.name] = valeur === null ? (el.name === 'rotation' ? 0 : 1) : Number(valeur);
  } else if (el.name === 'domaine' || el.name === 'pose' || el.name === 'calque' || el.name === 'repere' || el.name === 'designation_manuelle' || el.name === 'commentaire') {
    o[el.name] = valeur;
  }
  valider('Fiche ' + (o.repere || ''));
}

export { designationAffichee };
