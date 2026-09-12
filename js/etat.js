/* etat.js — état partagé de l'application et bus d'événements.
 * Évite les dépendances circulaires : tous les modules lisent/écrivent ici.
 */

export const etat = {
  nomenclature: null,     // objet nomenclature.json (éventuellement enrichi par l'utilisateur)
  projet: null,           // projet courant (voir modele.js)
  plan: null,             // plan courant du projet (projet.plans[projet.plan_courant])
  fondBlob: null,         // Blob du fond de plan du plan courant
  selection: new Set(),   // ids des objets sélectionnés
  outil: 'selection',     // outil courant
  preset: null,           // préréglage de pose (issu de la palette) : { type, attributs, domaine, pose }
  courant: { domaine: 'BTS', pose: 'aerien', etat: 'a_poser' }, // couple réseau + état en cours de tracé
  accrochageAngulaire: false,
  etiquettesVisibles: true,
  modePapier: false,
  gomme: false,
  prefs: { favoris: [], recents: [], taille_texte: 1, echelle_symbole: 1, accrochage_angulaire: false },
  police_prete: false
};

const abonnes = new Map();

/* S'abonner à un événement. Retourne une fonction de désabonnement. */
export function sur(nom, fn) {
  if (!abonnes.has(nom)) abonnes.set(nom, new Set());
  abonnes.get(nom).add(fn);
  return () => abonnes.get(nom).delete(fn);
}

/* Émettre un événement (synchrone). */
export function emettre(nom, donnees) {
  const s = abonnes.get(nom);
  if (!s) return;
  for (const fn of s) {
    try { fn(donnees); } catch (e) { console.error('Erreur dans un abonné de', nom, e); }
  }
}

/* Raccourcis */
export function objets() { return etat.plan ? etat.plan.objets : []; }
export function objetParId(id) { return objets().find((o) => o.id === id) || null; }
export function objetsSelectionnes() { return objets().filter((o) => etat.selection.has(o.id)); }

export function selectionner(ids, { ajouter = false } = {}) {
  if (!ajouter) etat.selection.clear();
  for (const id of ids) etat.selection.add(id);
  emettre('selection', [...etat.selection]);
}
export function deselectionner() {
  if (etat.selection.size === 0) return;
  etat.selection.clear();
  emettre('selection', []);
}

/* Notification brève à l'écran */
export function notifier(message, duree = 2200) {
  const zone = document.getElementById('notifications');
  if (!zone) { console.log(message); return; }
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(() => { el.classList.add('sortie'); setTimeout(() => el.remove(), 350); }, duree);
}
