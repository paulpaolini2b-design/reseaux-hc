/* ui/calques.js — visibilité, verrouillage et opacité des calques, filtre par
 * réseau (HTA / BTS / BRT / EP), réglages globaux (taille des textes, des symboles),
 * légende, accrochage angulaire, opacité et page du fond.
 */
import { etat, emettre, sur } from '../etat.js';
import { LIBELLES } from '../charte.js';
import { reglerOpacite, changerPage, nombrePages } from '../fond.js';
import { echapper } from './dialogues.js';

let panneau;

export function initialiserCalques() {
  panneau = document.getElementById('panneau-calques');
  document.getElementById('btn-calques').addEventListener('click', () => { if (panneau.hidden) ouvrir(); else fermer(); });
  sur('fermer-panneaux', fermer);
  sur('projet-ferme', fermer);
  sur('reglage-accrochage', () => { if (!panneau.hidden) ouvrir(); });
}

function fermer() { panneau.hidden = true; }

function ouvrir() {
  if (!etat.projet) return;
  const p = etat.projet, plan = etat.plan;
  document.getElementById('fiche').hidden = true;
  document.getElementById('panneau-a-completer').hidden = true;
  panneau.hidden = false;
  panneau.innerHTML = `
    <header class="entete-panneau"><h2>Calques et affichage</h2><button class="btn-icone fermer" title="Fermer">✕</button></header>
    <div class="contenu">
      <section class="bloc">
        <h3>Calques</h3>
        ${Object.entries(LIBELLES.calques).map(([k, l]) => `
          <div class="ligne-calque" data-calque="${k}">
            <label class="case"><input type="checkbox" data-champ="visible" ${p.calques[k].visible ? 'checked' : ''}> ${echapper(l)}</label>
            <button class="btn-icone verrou ${p.calques[k].verrou ? 'actif' : ''}" data-champ="verrou" title="${p.calques[k].verrou ? 'Déverrouiller' : 'Verrouiller'}">${p.calques[k].verrou ? '🔒' : '🔓'}</button>
            <input type="range" data-champ="opacite" min="0.1" max="1" step="0.1" value="${p.calques[k].opacite}" title="Opacité">
          </div>`).join('')}
      </section>
      <section class="bloc">
        <h3>Réseaux affichés</h3>
        <div class="chips">${Object.entries(LIBELLES.domaines).map(([k, l]) => `<button class="chip ${p.filtre_domaines[k] !== false ? 'actif' : ''}" data-domaine="${k}">${l}</button>`).join('')}</div>
      </section>
      ${plan.fond ? `
      <section class="bloc">
        <h3>Fond de plan</h3>
        <div class="aide">${echapper(plan.fond.nom_fichier)} — ${Math.round(plan.fond.largeur)} × ${Math.round(plan.fond.hauteur)} ${plan.fond.type === 'pdf' ? 'pt' : 'unités'}${plan.fond.rotation ? ' (page tournée de ' + plan.fond.rotation + '°)' : ''}</div>
        <label>Opacité du fond<input type="range" id="fond-opacite" min="0.1" max="1" step="0.05" value="${plan.fond.opacite ?? 1}"></label>
        ${plan.fond.type === 'pdf' && nombrePages() > 1 ? `<label>Page<select id="fond-page">${Array.from({ length: nombrePages() }, (_, i) => `<option value="${i + 1}" ${plan.fond.page === i + 1 ? 'selected' : ''}>Page ${i + 1}</option>`).join('')}</select></label>` : ''}
      </section>` : ''}
      <section class="bloc">
        <h3>Réglages du plan</h3>
        <label>Taille des textes (× ${p.reglages.taille_texte})<input type="range" id="reg-texte" min="0.5" max="3" step="0.1" value="${p.reglages.taille_texte}"></label>
        <label>Taille des symboles (× ${p.reglages.echelle_symbole})<input type="range" id="reg-symbole" min="0.5" max="3" step="0.1" value="${p.reglages.echelle_symbole}"></label>
        <label class="case"><input type="checkbox" id="reg-legende" ${plan.legende.visible ? 'checked' : ''}> Afficher la légende</label>
        <label class="case"><input type="checkbox" id="reg-angulaire" ${etat.accrochageAngulaire ? 'checked' : ''}> Accrochage angulaire 0° / 45° / 90° (A)</label>
      </section>
    </div>`;
  panneau.querySelector('.fermer').addEventListener('click', fermer);
  panneau.querySelectorAll('.ligne-calque').forEach((l) => {
    const k = l.dataset.calque;
    l.querySelector('[data-champ="visible"]').addEventListener('change', (e) => { p.calques[k].visible = e.target.checked; emettre('calques'); });
    l.querySelector('[data-champ="verrou"]').addEventListener('click', (e) => { p.calques[k].verrou = !p.calques[k].verrou; e.target.textContent = p.calques[k].verrou ? '🔒' : '🔓'; e.target.classList.toggle('actif', p.calques[k].verrou); emettre('calques'); });
    l.querySelector('[data-champ="opacite"]').addEventListener('input', (e) => { p.calques[k].opacite = Number(e.target.value); emettre('calques'); });
  });
  panneau.querySelectorAll('[data-domaine]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.domaine; p.filtre_domaines[k] = p.filtre_domaines[k] === false; b.classList.toggle('actif', p.filtre_domaines[k]); emettre('calques'); }));
  const fo = panneau.querySelector('#fond-opacite'); if (fo) fo.addEventListener('input', (e) => reglerOpacite(Number(e.target.value)));
  const fp = panneau.querySelector('#fond-page'); if (fp) fp.addEventListener('change', (e) => changerPage(Number(e.target.value)));
  panneau.querySelector('#reg-texte').addEventListener('change', (e) => { p.reglages.taille_texte = Number(e.target.value); emettre('reglages'); ouvrir(); });
  panneau.querySelector('#reg-symbole').addEventListener('change', (e) => { p.reglages.echelle_symbole = Number(e.target.value); emettre('reglages'); ouvrir(); });
  panneau.querySelector('#reg-legende').addEventListener('change', (e) => { plan.legende.visible = e.target.checked; emettre('objets'); });
  panneau.querySelector('#reg-angulaire').addEventListener('change', (e) => { etat.accrochageAngulaire = e.target.checked; });
}
