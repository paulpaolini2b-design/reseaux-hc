/* ui/a-completer.js — indicateur et parcours des objets dont la fiche est incomplète. */
import { etat, emettre, sur, objets, selectionner } from '../etat.js';
import { LIBELLES } from '../charte.js';
import { designationAffichee } from '../modele.js';
import { vue, appliquer } from '../vue.js';
import { echapper } from './dialogues.js';

let panneau, badge;

export function initialiserACompleter() {
  panneau = document.getElementById('panneau-a-completer');
  badge = document.getElementById('badge-a-completer');
  document.getElementById('btn-a-completer').addEventListener('click', () => { if (panneau.hidden) ouvrir(); else fermer(); });
  sur('objets', () => { majBadge(); if (!panneau.hidden) ouvrir(); });
  sur('projet-ouvert', majBadge);
  sur('projet-ferme', () => { fermer(); majBadge(); });
  sur('fermer-panneaux', fermer);
}

function incomplets() {
  return objets().filter((o) => o.type !== 'note' && o.complet === false);
}

function majBadge() {
  const n = etat.plan ? incomplets().length : 0;
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

function fermer() { panneau.hidden = true; }

function ouvrir() {
  if (!etat.plan) return;
  const liste = incomplets();
  document.getElementById('fiche').hidden = true;
  document.getElementById('panneau-calques').hidden = true;
  panneau.hidden = false;
  panneau.innerHTML = `
    <header class="entete-panneau"><h2>À compléter <span class="repere">${liste.length}</span></h2><button class="btn-icone fermer" title="Fermer">✕</button></header>
    <div class="contenu">
      ${liste.length ? `<p class="aide">Appuyez sur un objet pour le centrer et ouvrir sa fiche.</p>
      <div class="liste-objets">${liste.map((o) => `
        <button class="objet-ligne" data-id="${o.id}">
          <span class="type">${echapper(LIBELLES.types[o.type] || o.type)}</span>
          <span class="repere">${echapper(o.repere)}</span>
          <span class="designation">${echapper(designationAffichee(o) || '—')}</span>
          <span class="manque">${echapper(manque(o))}</span>
        </button>`).join('')}</div>` : '<p class="vide">Toutes les fiches sont complètes.</p>'}
    </div>`;
  panneau.querySelector('.fermer').addEventListener('click', fermer);
  panneau.querySelectorAll('.objet-ligne').forEach((b) => b.addEventListener('click', () => {
    const o = objets().find((x) => x.id === b.dataset.id);
    if (!o) return;
    centrerSur(o);
    selectionner([o.id]);
    emettre('ouvrir-fiche', o.id);
  }));
}

function manque(o) {
  const a = o.attributs || {};
  switch (o.type) {
    case 'support': {
      const m = [];
      if (!a.materiau) m.push('matériau');
      if (!a.hauteur_m) m.push('hauteur');
      if (a.materiau === 'BETON' && !a.classe) m.push('classe');
      if (a.materiau === 'BOIS' && !a.classe) m.push('classe');
      if ((a.materiau === 'BETON' || a.materiau === 'ME_TUB' || a.materiau === 'ME_PTR') && !a.effort_daN) m.push('effort');
      return m.join(', ');
    }
    case 'coffret': case 'poste': case 'armoire_ep': return 'sigle';
    case 'troncon': return 'section';
    default: return '';
  }
}

function centrerSur(o) {
  const p = o.type === 'troncon' ? o.points[Math.floor(o.points.length / 2)] : { x: o.x, y: o.y };
  const k = Math.max(vue.k, 2);
  appliquer({ k, tx: vue.largeurEcran / 2 - p.x * k, ty: vue.hauteurEcran / 2 - p.y * k });
}
