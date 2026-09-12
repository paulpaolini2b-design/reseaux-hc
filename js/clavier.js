/* clavier.js — raccourcis clavier (clavier physique de la tablette).
 *
 * Ctrl+Z / Ctrl+Y (ou Ctrl+Maj+Z) annuler / rétablir ; Ctrl+S sauver ; Ctrl+D dupliquer ;
 * Suppr / Retour arrière supprimer ; Échap annuler l'action / désélectionner ; Entrée terminer un tracé ;
 * Ctrl+0 ajuster ; + / - zoom ; flèches déplacer la sélection (Maj = ×10) ; 1-9 outils ;
 * E étiquettes ; A accrochage angulaire ; F fiche de l'objet sélectionné ; ? aide.
 * Dans une fiche : Tab passe au champ suivant, Ctrl+Entrée valide, Échap ferme.
 */
import { etat, emettre, notifier } from './etat.js';
import { annuler, retablir } from './historique.js';
import { sauverMaintenant } from './projet.js';
import { ajuster } from './vue.js';
import { zoomerCentre } from './pointeur.js';
import * as outils from './outils.js';

function dansSaisie(e) {
  const t = e.target;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

export function initialiserClavier() {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const dialogueOuvert = document.querySelector('dialog[open]');

    // Raccourcis valides même dans une saisie
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); sauverMaintenant().then(() => notifier('Projet sauvegardé')); return; }
    if (e.key === 'Escape') {
      if (dialogueOuvert) return;   // le <dialog> gère lui-même Échap
      if (dansSaisie(e)) { e.target.blur(); emettre('fermer-panneaux'); return; }
      e.preventDefault();
      if (!outils.annulerAction()) emettre('fermer-panneaux');
      return;
    }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); emettre('valider-fiche'); return; }
    if (dansSaisie(e) || dialogueOuvert) return;

    if (!etat.projet) { if (e.key === '?') emettre('ouvrir-aide'); return; }

    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); return; }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); retablir(); return; }
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); outils.dupliquerSelection(); return; }
    if (ctrl && e.key === '0') { e.preventDefault(); ajuster(); return; }
    if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); emettre('tout-selectionner'); return; }
    if (ctrl) return;

    switch (e.key) {
      case 'Delete': case 'Backspace': e.preventDefault(); outils.supprimerSelection(); return;
      case 'Enter': e.preventDefault(); if (!outils.terminerPolyligne() && etat.selection.size === 1) emettre('ouvrir-fiche', [...etat.selection][0]); return;
      case '+': case '=': e.preventDefault(); zoomerCentre(1.25); return;
      case '-': case '_': e.preventDefault(); zoomerCentre(1 / 1.25); return;
      case 'ArrowLeft': e.preventDefault(); outils.deplacerSelection(e.shiftKey ? -10 : -1, 0); return;
      case 'ArrowRight': e.preventDefault(); outils.deplacerSelection(e.shiftKey ? 10 : 1, 0); return;
      case 'ArrowUp': e.preventDefault(); outils.deplacerSelection(0, e.shiftKey ? -10 : -1); return;
      case 'ArrowDown': e.preventDefault(); outils.deplacerSelection(0, e.shiftKey ? 10 : 1); return;
      case '?': e.preventDefault(); emettre('ouvrir-aide'); return;
      case 'r': case 'R': e.preventDefault(); outils.tournerSelection(e.shiftKey ? -90 : 90); return;
      case 'e': case 'E': e.preventDefault(); emettre('basculer-etiquettes'); return;
      case 'a': case 'A': e.preventDefault(); etat.accrochageAngulaire = !etat.accrochageAngulaire; emettre('reglage-accrochage'); notifier('Accrochage angulaire ' + (etat.accrochageAngulaire ? 'activé (0° / 45° / 90°)' : 'désactivé')); return;
      case 'f': case 'F': e.preventDefault(); if (etat.selection.size === 1) emettre('ouvrir-fiche', [...etat.selection][0]); return;
      case 'x': case 'X': e.preventDefault(); outils.definirOutil('gomme'); return;
      case 'Tab': return;
      default: break;
    }
    const outil = outils.OUTILS.find((o) => o.touche === e.key);
    if (outil) { e.preventDefault(); outils.definirOutil(outil.id); }
  });
}
