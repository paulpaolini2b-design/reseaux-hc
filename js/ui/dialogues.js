/* ui/dialogues.js — aides pour les <dialog> : confirmation, saisie, message. */

export function ouvrirDialogue(id, html) {
  const d = document.getElementById(id);
  d.innerHTML = html;
  if (!d.open) d.showModal();
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }, { once: true });
  return d;
}

export function fermerDialogue(id) {
  const d = document.getElementById(id);
  if (d && d.open) d.close();
}

/* Confirmation : résout true / false. */
export function confirmer(message, { ok = 'Confirmer', annuler = 'Annuler', danger = false } = {}) {
  return new Promise((resolve) => {
    const d = ouvrirDialogue('dlg-generique', `
      <form method="dialog" class="dialogue">
        <p>${echapper(message)}</p>
        <div class="boutons">
          <button type="button" class="btn" data-r="non">${echapper(annuler)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primaire'}" data-r="oui" autofocus>${echapper(ok)}</button>
        </div>
      </form>`);
    d.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { resolve(b.dataset.r === 'oui'); d.close(); }));
    d.addEventListener('close', () => resolve(false), { once: true });
  });
}

/* Saisie d'un ou plusieurs champs : champs = [{ nom, libelle, valeur, type }]. Résout un objet ou null. */
export function demander(titre, champs, { ok = 'Valider' } = {}) {
  return new Promise((resolve) => {
    const d = ouvrirDialogue('dlg-generique', `
      <form method="dialog" class="dialogue">
        <h2>${echapper(titre)}</h2>
        ${champs.map((c) => `<label>${echapper(c.libelle)}<input name="${c.nom}" type="${c.type || 'text'}" value="${echapper(c.valeur ?? '')}" ${c.placeholder ? `placeholder="${echapper(c.placeholder)}"` : ''}></label>`).join('')}
        <div class="boutons">
          <button type="button" class="btn" data-r="non">Annuler</button>
          <button type="submit" class="btn btn-primaire">${echapper(ok)}</button>
        </div>
      </form>`);
    const form = d.querySelector('form');
    let resolu = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = {};
      for (const c of champs) res[c.nom] = form.elements[c.nom].value;
      resolu = true; resolve(res); d.close();
    });
    d.querySelector('[data-r="non"]').addEventListener('click', () => d.close());
    d.addEventListener('close', () => { if (!resolu) resolve(null); }, { once: true });
    const premier = form.querySelector('input'); if (premier) setTimeout(() => premier.focus(), 50);
  });
}

export function message(titre, html) {
  const d = ouvrirDialogue('dlg-generique', `
    <form method="dialog" class="dialogue">
      <h2>${echapper(titre)}</h2>
      <div>${html}</div>
      <div class="boutons"><button type="submit" class="btn btn-primaire" autofocus>Fermer</button></div>
    </form>`);
  return d;
}

export function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
