/* ui/notes.js — éditeur de note de terrain : texte, couleur, taille, cadre, fond,
 * flèche de rappel. Le clavier physique est utilisable immédiatement (focus).
 */
import { etat, objetParId, notifier, selectionner } from '../etat.js';
import { CHARTE } from '../charte.js';
import { valider } from '../historique.js';
import { cloner, genererId, attribuerRepere } from '../modele.js';
import { echapper } from './dialogues.js';

export function ouvrirEditeurNote(id, { nouvelle = false } = {}) {
  const n = objetParId(id);
  if (!n) return;
  const d = document.getElementById('dlg-note');
  const K = CHARTE.notes;
  d.innerHTML = `
    <form method="dialog" class="dialogue note">
      <h2>${nouvelle ? 'Nouvelle note' : 'Note ' + echapper(n.repere)}</h2>
      <textarea name="texte" rows="4" placeholder="Texte de la note (Entrée = nouvelle ligne)">${echapper(n.texte)}</textarea>
      <div class="couleurs">${K.palette.map((c) => `<button type="button" class="pastille ${n.couleur === c ? 'actif' : ''}" data-couleur="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
      <div class="ligne2">
        <label>Taille<select name="taille">${K.tailles.map((t) => `<option value="${t}" ${Number(n.taille) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Rotation (°)<input type="number" name="rotation" value="${Math.round(n.rotation || 0)}" step="15"></label>
      </div>
      <div class="ligne2">
        <label class="case"><input type="checkbox" name="cadre" ${n.cadre ? 'checked' : ''}> Cadre</label>
        <label class="case"><input type="checkbox" name="fond" ${n.fond ? 'checked' : ''}> Fond blanc</label>
      </div>
      <label class="case"><input type="checkbox" name="fleche" ${n.fleche ? 'checked' : ''}> Flèche de rappel (déplacez ensuite sa pointe avec la poignée)</label>
      <div class="boutons">
        <button type="button" class="btn btn-danger" data-r="supprimer">Supprimer</button>
        <button type="button" class="btn" data-r="dupliquer" ${nouvelle ? 'hidden' : ''}>Dupliquer</button>
        <button type="submit" class="btn btn-primaire">Valider</button>
      </div>
    </form>`;
  const form = d.querySelector('form');
  let couleur = n.couleur;
  d.querySelectorAll('.pastille').forEach((b) => b.addEventListener('click', () => { couleur = b.dataset.couleur; d.querySelectorAll('.pastille').forEach((x) => x.classList.toggle('actif', x === b)); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const texte = form.elements.texte.value.trimEnd();
    if (!texte.trim()) { supprimer(n); d.close(); if (nouvelle) notifier('Note vide : non conservée'); return; }
    n.texte = texte;
    n.couleur = couleur;
    n.taille = Number(form.elements.taille.value);
    n.rotation = Number(form.elements.rotation.value) || 0;
    n.cadre = form.elements.cadre.checked;
    n.fond = form.elements.fond.checked;
    if (form.elements.fleche.checked && !n.fleche) n.fleche = { x: n.x - 12, y: n.y - 12 };
    if (!form.elements.fleche.checked) n.fleche = null;
    valider('Note');
    d.close();
  });
  d.querySelector('[data-r="supprimer"]').addEventListener('click', () => { supprimer(n); d.close(); });
  d.querySelector('[data-r="dupliquer"]').addEventListener('click', () => {
    const c = cloner(n); c.id = genererId(); c.repere = ''; attribuerRepere(etat.projet, c); c.x += 12; c.y += 12;
    if (c.fleche) c.fleche = null;
    etat.plan.objets.push(c); valider('Note dupliquée'); selectionner([c.id]); d.close();
  });
  d.addEventListener('close', () => { if (nouvelle && !form.elements.texte.value.trim() && objetParId(n.id)) supprimer(n); }, { once: true });
  // Ctrl+Entrée valide, Échap ferme (comportement natif du <dialog>)
  form.elements.texte.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
  d.showModal();
  setTimeout(() => { form.elements.texte.focus(); form.elements.texte.setSelectionRange(form.elements.texte.value.length, form.elements.texte.value.length); }, 30);
}

function supprimer(n) {
  etat.plan.objets = etat.plan.objets.filter((o) => o.id !== n.id);
  etat.selection.delete(n.id);
  valider('Note supprimée');
}
