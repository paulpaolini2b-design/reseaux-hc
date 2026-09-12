/* ui/barre-outils.js — barre d'outils latérale, annuler/rétablir permanents,
 * sélecteur réseau + pose + état avec aperçu du style, boutons de la barre haute.
 */
import { etat, emettre, sur, notifier, objets, selectionner } from '../etat.js';
import { CHARTE, LIBELLES, styleTroncon } from '../charte.js';
import * as outils from '../outils.js';
import { annuler, retablir, infos } from '../historique.js';
import { ajuster } from '../vue.js';
import { ouvrirPalette, basculerPalette } from './palette.js';
import { ouvrirDialogue, message } from './dialogues.js';

const NS = 'http://www.w3.org/2000/svg';

export function initialiserBarreOutils() {
  const cont = document.getElementById('outils-principaux');
  cont.innerHTML = '';
  for (const o of outils.OUTILS) {
    const b = document.createElement('button');
    b.className = 'btn-outil';
    b.dataset.outil = o.id;
    b.title = o.libelle + (o.touche ? ' (' + o.touche + ')' : ' (X)');
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${o.icone}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>${o.touche ? `<span class="touche">${o.touche}</span>` : ''}`;
    b.addEventListener('click', () => {
      if (o.id === 'support' || o.id === 'coffret' || o.id === 'poste') {
        // Un second appui sur l'outil ouvre la palette filtrée sur sa catégorie
        if (etat.outil === o.id) { ouvrirPalette({ categorie: { support: 'SUPPORT', coffret: 'COFFRET_BT', poste: 'POSTE' }[o.id] }); return; }
      }
      outils.definirOutil(o.id);
    });
    cont.appendChild(b);
  }
  const bPalette = document.createElement('button');
  bPalette.className = 'btn-outil btn-palette';
  bPalette.title = 'Bibliothèque de symboles (nomenclature)';
  bPalette.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  bPalette.addEventListener('click', () => basculerPalette());
  cont.appendChild(bPalette);

  document.getElementById('btn-annuler').addEventListener('click', () => annuler());
  document.getElementById('btn-retablir').addEventListener('click', () => retablir());
  sur('historique', majHistorique);
  sur('outil', majOutil);
  sur('projet-ouvert', () => { majHistorique(infos()); majOutil(); });
  majOutil();
  initialiserSelecteur();

  document.getElementById('btn-etiquettes').addEventListener('click', basculerEtiquettes);
  sur('basculer-etiquettes', basculerEtiquettes);
  document.getElementById('btn-papier').addEventListener('click', basculerPapier);
  document.getElementById('btn-aide').addEventListener('click', ouvrirAide);
  sur('ouvrir-aide', ouvrirAide);
  sur('tout-selectionner', () => selectionner(objets().map((o) => o.id)));
}

function majHistorique(i) {
  document.getElementById('btn-annuler').disabled = !i.peutAnnuler;
  document.getElementById('btn-retablir').disabled = !i.peutRetablir;
}

function majOutil() {
  document.querySelectorAll('#outils-principaux .btn-outil').forEach((b) => {
    b.classList.toggle('actif', b.dataset.outil === etat.outil);
  });
  const zone = document.getElementById('zone-plan');
  zone.dataset.outil = etat.outil;
}

/* ---------- Sélecteur réseau / pose / état ---------- */
function initialiserSelecteur() {
  const dom = document.getElementById('sel-domaine');
  const pose = document.getElementById('sel-pose');
  const et = document.getElementById('sel-etat');
  for (const [k, l] of Object.entries(LIBELLES.domaines)) dom.appendChild(chip(k, l, 'domaine'));
  for (const [k, l] of Object.entries(LIBELLES.poses)) pose.appendChild(chip(k, l, 'pose'));
  for (const [k, l] of Object.entries(LIBELLES.etats)) et.appendChild(chip(k, l, 'etat'));
  majSelecteur();
  sur('courant', majSelecteur);
}

function chip(valeur, libelle, groupe) {
  const b = document.createElement('button');
  b.className = 'chip chip-' + groupe;
  b.dataset.valeur = valeur;
  b.textContent = libelle;
  b.addEventListener('click', () => {
    etat.courant[groupe] = valeur;
    emettre('courant', etat.courant);
    // Appliquer immédiatement à la sélection si elle existe (pas pour les notes)
    const sel = objets().filter((o) => etat.selection.has(o.id) && o.type !== 'note');
    if (sel.length) outils.modifierSelection({ [groupe]: valeur });
  });
  return b;
}

function majSelecteur() {
  for (const groupe of ['domaine', 'pose', 'etat']) {
    document.querySelectorAll('.chip-' + groupe).forEach((b) => {
      b.classList.toggle('actif', b.dataset.valeur === etat.courant[groupe]);
      if (groupe === 'domaine') b.style.setProperty('--couleur', styleTroncon(b.dataset.valeur, etat.courant.pose, etat.courant.etat).couleur);
    });
  }
  const s = styleTroncon(etat.courant.domaine, etat.courant.pose, etat.courant.etat);
  const svg = document.getElementById('apercu-style');
  svg.innerHTML = '';
  const mk = (attrs) => { const e = document.createElementNS(NS, 'line'); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const ech = 2.2;   // agrandissement pour l'aperçu
  if (s.fluo) svg.appendChild(mk({ x1: 6, y1: 12, x2: 114, y2: 12, stroke: CHARTE.lisere.couleur, 'stroke-width': (s.epaisseur + CHARTE.lisere.surepaisseur) * ech, 'stroke-dasharray': s.tirete ? s.tirete.map((v) => v * ech).join(' ') : '' }));
  svg.appendChild(mk({ x1: 6, y1: 12, x2: 114, y2: 12, stroke: s.couleur, 'stroke-width': s.epaisseur * ech, 'stroke-dasharray': s.tirete ? s.tirete.map((v) => v * ech).join(' ') : '', 'stroke-linecap': 'round' }));
  if (s.hachure) for (let x = 10; x < 114; x += CHARTE.hachures_troncon.pas * ech) svg.appendChild(mk({ x1: x - 3, y1: 17, x2: x + 3, y2: 7, stroke: '#000', 'stroke-width': 1.2 }));
  if (s.reprendre) svg.appendChild(mk({ x1: 6, y1: 12, x2: 114, y2: 12, stroke: '#000', 'stroke-width': 1, 'stroke-dasharray': '2.5 5' }));
}

function basculerEtiquettes() {
  etat.etiquettesVisibles = !etat.etiquettesVisibles;
  document.getElementById('btn-etiquettes').setAttribute('aria-pressed', String(etat.etiquettesVisibles));
  emettre('reglages');
}

function basculerPapier() {
  etat.modePapier = !etat.modePapier;
  document.getElementById('app').classList.toggle('mode-papier', etat.modePapier);
  document.getElementById('btn-papier').setAttribute('aria-pressed', String(etat.modePapier));
  emettre('fermer-panneaux');
  emettre('reglages');
  if (etat.modePapier) { ajuster(); notifier('Aperçu rendu papier — appuyez à nouveau pour revenir à l’édition'); }
}

function ouvrirAide() {
  ouvrirDialogue('dlg-aide', `
    <form method="dialog" class="dialogue aide">
      <h2>Aide</h2>
      <h3>Stylet et doigt</h3>
      <ul>
        <li>Le stylet dessine, sélectionne et déplace ; le doigt fait glisser le plan, deux doigts zooment.</li>
        <li>Un appui bref pose l'objet de l'outil courant ; glisser en posant oriente le symbole.</li>
        <li>Appui long : menu contextuel. Double appui au doigt : ajuster le plan à l'écran.</li>
        <li>Bouton latéral du stylet enfoncé : gomme (les objets touchés sont supprimés).</li>
        <li>Tronçon : un appui par sommet ; appui sur le dernier sommet, Entrée ou double appui pour terminer ; Échap abandonne.</li>
        <li>Objet sélectionné : poignée ronde = rotation, carrés = sommets, point bleu = insérer un sommet ou déplacer l'étiquette.</li>
      </ul>
      <h3>Clavier</h3>
      <table>
        <tr><td>1 … 9</td><td>outils (sélection, tronçon, support, coffret, poste, boîte de jonction, ERAS, MALT, note)</td></tr>
        <tr><td>X</td><td>gomme</td></tr>
        <tr><td>Ctrl+Z / Ctrl+Y</td><td>annuler / rétablir</td></tr>
        <tr><td>Ctrl+S</td><td>sauvegarder (la sauvegarde est de toute façon automatique)</td></tr>
        <tr><td>Ctrl+D</td><td>dupliquer la sélection</td></tr>
        <tr><td>Suppr</td><td>supprimer la sélection</td></tr>
        <tr><td>Échap</td><td>abandonner le tracé en cours, désélectionner, fermer un panneau</td></tr>
        <tr><td>Entrée</td><td>terminer le tracé, ou ouvrir la fiche de l'objet sélectionné</td></tr>
        <tr><td>F</td><td>fiche de l'objet sélectionné</td></tr>
        <tr><td>Ctrl+0, + / -</td><td>ajuster, zoomer</td></tr>
        <tr><td>Flèches (Maj = ×10)</td><td>déplacement fin de la sélection</td></tr>
        <tr><td>R / Maj+R</td><td>rotation de 90° / -90°</td></tr>
        <tr><td>E</td><td>masquer / afficher toutes les étiquettes</td></tr>
        <tr><td>A</td><td>accrochage angulaire 0° / 45° / 90°</td></tr>
        <tr><td>Tab, Ctrl+Entrée</td><td>dans une fiche : champ suivant, valider</td></tr>
        <tr><td>?</td><td>cette aide</td></tr>
      </table>
      <div class="boutons"><button type="submit" class="btn btn-primaire">Fermer</button></div>
    </form>`);
}

export { message };
