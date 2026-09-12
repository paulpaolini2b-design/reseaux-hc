/* historique.js — annuler / rétablir illimité.
 *
 * Principe : chaque action validée enregistre une copie complète de la liste
 * des objets du plan courant (200 objets ≈ 100 ko : négligeable). C'est plus
 * simple et plus sûr que des commandes inversibles, et tout passe par un seul
 * point : valider(). Chaque validation déclenche l'événement 'objets' qui
 * provoque le re-rendu et la sauvegarde automatique.
 */
import { etat, emettre } from './etat.js';
import { cloner, mettreAJourComplet } from './modele.js';
import { actualiserDesignation } from './designation.js';

let pile = [];      // états passés (le dernier = état courant)
let futur = [];     // états annulés
let etiquetteCourante = '';

function instantane() {
  return cloner(etat.plan.objets);
}

/* Réinitialise l'historique (ouverture d'un projet). */
export function reinitialiserHistorique() {
  pile = etat.plan ? [instantane()] : [];
  futur = [];
  emettre('historique', infos());
}

/* Valide l'état courant après une modification des objets. */
export function valider(etiquette = '') {
  if (!etat.plan) return;
  // Recalculs systématiques : désignation automatique et indicateur « complet ».
  for (const o of etat.plan.objets) { actualiserDesignation(o); mettreAJourComplet(o); }
  pile.push(instantane());
  futur = [];
  etiquetteCourante = etiquette;
  emettre('objets', { etiquette });
  emettre('historique', infos());
}

/* Rafraîchit l'affichage sans créer d'étape (pendant un glissement). */
export function apercu() {
  emettre('objets-apercu');
}

export function annuler() {
  if (pile.length <= 1) return false;
  futur.push(pile.pop());
  etat.plan.objets = cloner(pile[pile.length - 1]);
  nettoyerSelection();
  emettre('objets', { etiquette: 'annuler' });
  emettre('historique', infos());
  return true;
}

export function retablir() {
  if (futur.length === 0) return false;
  const s = futur.pop();
  pile.push(s);
  etat.plan.objets = cloner(s);
  nettoyerSelection();
  emettre('objets', { etiquette: 'retablir' });
  emettre('historique', infos());
  return true;
}

function nettoyerSelection() {
  const ids = new Set(etat.plan.objets.map((o) => o.id));
  let change = false;
  for (const id of [...etat.selection]) if (!ids.has(id)) { etat.selection.delete(id); change = true; }
  if (change) emettre('selection', [...etat.selection]);
}

export function infos() {
  return { peutAnnuler: pile.length > 1, peutRetablir: futur.length > 0, etiquette: etiquetteCourante };
}

/* Restaure le dernier état validé (abandon d'un glissement avec Échap). */
export function restaurerDernier() {
  if (!pile.length) return;
  etat.plan.objets = cloner(pile[pile.length - 1]);
  emettre('objets', { etiquette: 'restauration' });
}
