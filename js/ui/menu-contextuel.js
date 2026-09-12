/* ui/menu-contextuel.js — menu à l'appui long (ou clic droit). */
import { etat, emettre, sur, objetParId, selectionner, notifier } from '../etat.js';
import { LIBELLES } from '../charte.js';
import * as outils from '../outils.js';
import { valider } from '../historique.js';
import { nouvelleNote, attribuerRepere, calquePourEtat } from '../modele.js';
import { ouvrirEditeurNote } from './notes.js';
import { echapper } from './dialogues.js';

let menu;

export function initialiserMenuContextuel() {
  menu = document.getElementById('menu-contextuel');
  sur('menu-contextuel', ouvrir);
  sur('fermer-panneaux', fermer);
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target)) fermer(); }, true);
}

function fermer() { menu.hidden = true; menu.innerHTML = ''; }

function ouvrir({ x, y, plan, objet }) {
  const items = [];
  if (etat.outil === 'troncon' && outils.polyligneEnCours()) {
    items.push({ l: 'Terminer le tracé', f: () => outils.terminerPolyligne() });
    items.push({ l: 'Abandonner le tracé', f: () => outils.annulerAction() });
  }
  if (objet) {
    const o = objet;
    if (o.type === 'note') items.push({ l: 'Modifier la note', f: () => ouvrirEditeurNote(o.id) });
    else items.push({ l: 'Fiche de l’objet', f: () => { selectionner([o.id]); emettre('ouvrir-fiche', o.id); } });
    items.push({ l: 'Dupliquer', f: () => { selectionner([o.id], { ajouter: etat.selection.size > 1 }); outils.dupliquerSelection(); } });
    if (o.type !== 'troncon') {
      items.push({ l: 'Tourner de +90°', f: () => outils.tournerSelection(90) });
      items.push({ l: 'Tourner de −90°', f: () => outils.tournerSelection(-90) });
    }
    if (o.type !== 'note') {
      items.push({ l: o.etiquette.visible ? 'Masquer l’étiquette' : 'Afficher l’étiquette', f: () => outils.basculerEtiquettesSelection() });
      items.push({ sous: 'État', options: Object.entries(LIBELLES.etats).map(([k, l]) => ({ l, actif: o.etat === k, f: () => outils.modifierSelection({ etat: k }) })) });
    }
    if (o.type === 'troncon') {
      items.push({ l: 'Inverser le sens', f: () => { o.points.reverse(); valider('Sens inversé'); } });
    }
    items.push({ l: 'Supprimer', danger: true, f: () => { selectionner([o.id], { ajouter: etat.selection.size > 1 }); outils.supprimerSelection(); } });
  } else {
    items.push({ l: 'Ajouter une note ici', f: () => { const n = nouvelleNote(plan.x, plan.y, ''); attribuerRepere(etat.projet, n); etat.plan.objets.push(n); valider('Note'); selectionner([n.id]); ouvrirEditeurNote(n.id, { nouvelle: true }); } });
    if (etat.selection.size) items.push({ l: 'Désélectionner', f: () => { etat.selection.clear(); emettre('selection', []); } });
    items.push({ l: 'Tout sélectionner', f: () => emettre('tout-selectionner') });
    items.push({ l: etat.plan.legende.visible ? 'Masquer la légende' : 'Afficher la légende', f: () => { etat.plan.legende.visible = !etat.plan.legende.visible; emettre('objets'); } });
  }
  menu.innerHTML = items.map((it) => it.sous
    ? `<div class="sous-menu"><div class="titre">${echapper(it.sous)}</div>${it.options.map((op, j) => `<button class="${op.actif ? 'actif' : ''}" data-sous="${items.indexOf(it)}:${j}">${echapper(op.l)}</button>`).join('')}</div>`
    : `<button class="${it.danger ? 'danger' : ''}" data-i="${items.indexOf(it)}">${echapper(it.l)}</button>`).join('');
  menu.hidden = false;
  // Position dans la zone visible
  const zone = document.getElementById('zone-plan').getBoundingClientRect();
  const l = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.min(zone.left + x, window.innerWidth - l - 8) + 'px';
  menu.style.top = Math.min(zone.top + y, window.innerHeight - h - 8) + 'px';
  menu.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { fermer(); items[Number(b.dataset.i)].f(); }));
  menu.querySelectorAll('[data-sous]').forEach((b) => b.addEventListener('click', () => { const [i, j] = b.dataset.sous.split(':').map(Number); fermer(); items[i].options[j].f(); }));
  void calquePourEtat; void notifier; void objetParId;
}
