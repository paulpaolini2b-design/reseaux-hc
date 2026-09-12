/* main.js — amorçage : nomenclature → base → interface → service worker → dernier projet. */
import { etat, notifier, sur } from './etat.js';
import { CHARTE } from './charte.js';
import { bd } from './bd.js';
import { chargerNomenclature } from './nomenclature.js';
import { initialiserFond } from './fond.js';
import { initialiserRendu } from './rendu-svg.js';
import { initialiserPointeur } from './pointeur.js';
import { initialiserOutils } from './outils.js';
import { initialiserClavier } from './clavier.js';
import { initialiserProjet, dernierProjetId, ouvrirProjet } from './projet.js';
import { tailleEcran } from './vue.js';
import { definirMesureurCanvas } from './export-pdf.js';
import { initialiserBarreOutils } from './ui/barre-outils.js';
import { initialiserPalette } from './ui/palette.js';
import { initialiserFiche } from './ui/fiche-objet.js';
import { initialiserCalques } from './ui/calques.js';
import { initialiserProjetsUI, ouvrirListeProjets } from './ui/projets.js';
import { initialiserACompleter } from './ui/a-completer.js';
import { initialiserMenuContextuel } from './ui/menu-contextuel.js';

async function chargerPolice() {
  try {
    const police = new FontFace('DejaVu Sans', 'url(vendor/fonts/DejaVuSans.ttf)');
    await police.load();
    document.fonts.add(police);
    etat.police_prete = true;
  } catch (e) {
    console.warn('Police DejaVu Sans indisponible, repli sur la police système', e);
  }
  // Mesureur de texte partagé (largeurs identiques entre l'écran et le calcul des cadres)
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  definirMesureurCanvas((texte, taille) => {
    ctx.font = `${taille * 10}px ${CHARTE.texte.police}`;   // ×10 pour la précision, puis /10
    return ctx.measureText(texte).width / 10;
  });
}

async function chargerPrefs() {
  try {
    const f = await bd.get('prefs', 'favoris'); if (f) etat.prefs.favoris = f.valeur || [];
    const r = await bd.get('prefs', 'recents'); if (r) etat.prefs.recents = r.valeur || [];
  } catch (e) { /* première ouverture */ }
}

function orientation() {
  document.getElementById('app').dataset.orientation = window.innerWidth >= window.innerHeight ? 'paysage' : 'portrait';
}

async function demarrer() {
  orientation();
  window.addEventListener('resize', orientation);
  tailleEcran();

  await bd.ouvrir();
  bd.persister();
  await chargerPrefs();
  await chargerPolice();
  try { await chargerNomenclature(); }
  catch (e) { console.error(e); notifier('Nomenclature introuvable : vérifiez le déploiement de nomenclature.json', 6000); etat.nomenclature = { articles: [], categories: [], regles: {}, designations_supports: null }; }

  initialiserFond();
  initialiserRendu();
  initialiserOutils();
  initialiserPointeur();
  initialiserClavier();
  initialiserProjet();
  initialiserBarreOutils();
  initialiserPalette();
  initialiserFiche();
  initialiserCalques();
  initialiserProjetsUI();
  initialiserACompleter();
  initialiserMenuContextuel();

  // Service worker : rend l'application disponible hors ligne après la première ouverture
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nv = reg.installing;
        nv && nv.addEventListener('statechange', () => { if (nv.state === 'installed' && navigator.serviceWorker.controller) notifier('Nouvelle version installée : relancez l’application pour l’utiliser', 5000); });
      });
    }).catch((e) => console.warn('Service worker non enregistré', e));
  }

  // Réouverture du dernier projet à l'identique (vue, sélection d'outil par défaut)
  const id = await dernierProjetId();
  if (id) { try { await ouvrirProjet(id); return; } catch (e) { console.warn(e); } }
  ouvrirListeProjets();
}

sur('projet-ouvert', () => { document.body.classList.add('projet-ouvert'); });
sur('projet-ferme', () => { document.body.classList.remove('projet-ouvert'); });

demarrer().catch((e) => { console.error(e); notifier('Erreur au démarrage : ' + (e.message || e), 8000); });
