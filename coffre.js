/* ==========================================================================
   LE COFFRE

   Deux serrures indépendantes, deux phrases de passe distinctes :
   la page entière, puis le bilan à l'intérieur.

   Ce qui est publié ne contient rien de lisible. Le contenu voyage chiffré
   en AES-256-GCM, la clé étant dérivée de la phrase par PBKDF2-SHA256 à
   600 000 itérations, ce qui rend chaque essai coûteux et la recherche
   exhaustive hors de portée. Une phrase fausse fait échouer la vérification
   d'intégrité du mode GCM : il n'y a pas de déchiffrement partiel, donc
   aucune fuite progressive.

   Rien n'est conservé. Ni dans le stockage local, ni dans un cookie, ni
   dans l'adresse. Fermer l'onglet, recharger, ou laisser la page cinq
   minutes sans y toucher referme tout et efface le contenu du document.
   ========================================================================== */

const INACTIVITE_MS = 5 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const octets = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Déchiffre un coffre, ou lève si la phrase ne convient pas. */
const ouvrirCoffre = async (fichier, phrase) => {
  const reponse = await fetch(fichier, { cache: 'no-store' });
  if (!reponse.ok) throw new Error('coffre introuvable');
  const coffre = await reponse.json();

  const matiere = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
  const cle = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: octets(coffre.sel), iterations: coffre.it, hash: 'SHA-256' },
    matiere, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: octets(coffre.iv) }, cle, octets(coffre.d));

  // Le contenu est complété d'espaces à l'écriture pour que la taille du
  // fichier ne trahisse pas sa longueur. On les retire ici.
  return new TextDecoder().decode(clair).trimEnd();
};

/* --- La serrure de la page --------------------------------------------- */

const porte = $('porte');
const forme = $('porte-forme');
const champ = $('porte-mdp');
const bouton = $('porte-ouvrir');
const etat = $('porte-etat');
const contenu = $('contenu');
const verrou = $('verrou');

let minuteur = null;
let surveille = false;

const dire = (texte, genre = '') => {
  etat.textContent = texte;
  etat.className = 'prive-etat' + (genre ? ' prive-etat--' + genre : '');
};

/** Referme tout : le document redevient une coquille vide. */
const refermer = (afficherAvis) => {
  clearTimeout(minuteur);
  contenu.innerHTML = '';
  contenu.hidden = true;
  document.body.classList.remove('ouvert');
  porte.hidden = false;
  champ.value = '';
  dire('');
  if (afficherAvis) verrou.hidden = false;
  // On remonte en haut : aucune ancre ne doit laisser deviner la structure.
  window.scrollTo(0, 0);
};

const relancerMinuteur = () => {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => refermer(true), INACTIVITE_MS);
};

const surveillerActivite = () => {
  if (surveille) return;
  surveille = true;
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((e) =>
    window.addEventListener(e, relancerMinuteur, { passive: true }));
  // Onglet quitté ou masqué : on referme sans attendre.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !contenu.hidden) refermer(false);
  });
  window.addEventListener('pagehide', () => refermer(false));
};

/* --- La serrure du bilan ------------------------------------------------ */

const armerBilan = () => {
  const f = $('prive-forme');
  if (!f) return;
  const c = $('prive-mdp');
  const b = $('prive-ouvrir');
  const e = $('prive-etat');
  const cible = $('bilan');

  const direBilan = (texte, genre = '') => {
    e.textContent = texte;
    e.className = 'prive-etat' + (genre ? ' prive-etat--' + genre : '');
  };

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const phrase = c.value.trim();
    if (!phrase) { direBilan('Saisissez la phrase de passe.', 'erreur'); c.focus(); return; }

    b.disabled = true; c.disabled = true;
    direBilan('Déchiffrement en cours...');
    try {
      cible.innerHTML = await ouvrirCoffre('./bilan.enc', phrase);
      cible.hidden = false;
      f.hidden = true;
      cible.setAttribute('tabindex', '-1');
      cible.focus();

      // La bascule entre montants bruts et montants nets.
      const boutons = cible.querySelectorAll('.bsc');
      boutons.forEach((bt) => {
        bt.addEventListener('click', () => {
          const net = bt.dataset.mode === 'net';
          cible.classList.toggle('montre-net', net);
          boutons.forEach((x) => {
            const choisi = x === bt;
            x.classList.toggle('actif', choisi);
            x.setAttribute('aria-pressed', choisi ? 'true' : 'false');
          });
        });
      });
      relancerMinuteur();
    } catch (err) {
      direBilan('Phrase de passe refusée.', 'erreur');
      c.value = '';
    } finally {
      b.disabled = false; c.disabled = false;
      if (cible.hidden) c.focus();
    }
  });
};

/* --- Ouverture de la page ---------------------------------------------- */

if (forme && window.crypto && window.crypto.subtle) {
  forme.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phrase = champ.value.trim();
    if (!phrase) { dire('Saisissez la phrase de passe.', 'erreur'); champ.focus(); return; }

    bouton.disabled = true; champ.disabled = true;
    dire('Ouverture...');
    try {
      contenu.innerHTML = await ouvrirCoffre('./page.enc', phrase);
      contenu.hidden = false;
      porte.hidden = true;
      verrou.hidden = true;
      document.body.classList.add('ouvert');
      champ.value = '';
      dire('');

      if (typeof window.demarrerPage === 'function') window.demarrerPage();
      armerBilan();
      surveillerActivite();
      relancerMinuteur();
    } catch (err) {
      dire('Phrase de passe refusée.', 'erreur');
      champ.value = '';
    } finally {
      bouton.disabled = false; champ.disabled = false;
      if (contenu.hidden) champ.focus();
    }
  });

  $('verrou-rouvrir').addEventListener('click', () => {
    verrou.hidden = true;
    champ.focus();
  });

  champ.focus();
} else if (forme) {
  dire("Ce navigateur ne sait pas déchiffrer cette page. Essayez un navigateur à jour.", 'erreur');
}
