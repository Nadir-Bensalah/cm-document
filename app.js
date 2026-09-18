/* Comportements du document. Aucune dépendance. */
/* Les comportements de la page. Appelés une fois le contenu déchiffré et
   injecté, jamais avant : il n'existe rien à animer sur la porte. */
window.demarrerPage = function () {
  'use strict';
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Barre haute ---------- */
  var topbar = document.getElementById('topbar');
  if (topbar) {
    var onScroll = function () { topbar.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Accordéons des postes ---------- */
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.poste__toggle'));

  function openPanel(toggle) {
    var panel = document.getElementById(toggle.getAttribute('aria-controls'));
    var poste = toggle.closest('.poste');
    if (!panel || toggle.getAttribute('aria-expanded') === 'true') return;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.poste__toggle-label').textContent = 'Réduire';
    poste.classList.add('is-open');
    panel.hidden = false;
    if (reduceMotion) { panel.classList.add('is-open'); return; }
    // Deux cadres pour que la transition parte bien de 0fr.
    requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-open'); }); });
  }

  function closePanel(toggle) {
    var panel = document.getElementById(toggle.getAttribute('aria-controls'));
    var poste = toggle.closest('.poste');
    if (!panel || toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.poste__toggle-label').textContent = 'Voir le détail';
    poste.classList.remove('is-open');
    panel.classList.remove('is-open');
    if (reduceMotion) { panel.hidden = true; return; }
    var done = function (e) {
      if (e && e.target !== panel) return;
      panel.removeEventListener('transitionend', done);
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    };
    panel.addEventListener('transitionend', done);
    // Sécurité si transitionend ne se déclenche pas.
    setTimeout(done, 600);
  }

  toggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closePanel(toggle); else openPanel(toggle);
    });
  });

  var expandAll = document.querySelector('[data-expand-all]');
  var collapseAll = document.querySelector('[data-collapse-all]');
  if (expandAll) expandAll.addEventListener('click', function () { toggles.forEach(openPanel); });
  if (collapseAll) collapseAll.addEventListener('click', function () { toggles.forEach(closePanel); });

  // Un lien vers #poste-N ouvre le poste visé.
  function openFromHash() {
    var id = location.hash.replace('#', '');
    if (!id) return;
    var poste = document.getElementById(id);
    if (poste && poste.classList.contains('poste')) openPanel(poste.querySelector('.poste__toggle'));
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // À l'impression, tout est déplié.
  window.addEventListener('beforeprint', function () { toggles.forEach(openPanel); });

  /* ---------- Démo : onglets ---------- */
  var demo = document.querySelector('[data-demo]');
  if (demo) {
    var tabs = Array.prototype.slice.call(demo.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(demo.querySelectorAll('[role="tabpanel"]'));

    function activateTab(tab, focus) {
      tabs.forEach(function (t) {
        var active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (p) {
        var active = p.id === tab.getAttribute('aria-controls');
        p.hidden = !active;
        if (active) p.classList.add('is-active'); else p.classList.remove('is-active');
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { activateTab(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activateTab(next, true); }
      });
    });

    /* Filtres de gravité (structure seulement) */
    var chips = Array.prototype.slice.call(demo.querySelectorAll('.chip'));
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('is-active');
        chip.setAttribute('aria-pressed', 'true');
      });
    });

    /* Panneau « détail d'une exécution » */
    var openRun = demo.querySelector('[data-open-run]');
    var closeRun = demo.querySelector('[data-close-run]');
    var runPanel = document.getElementById('run-panel');
    var auto = demo.querySelector('.auto');
    if (openRun && closeRun && runPanel) {
      openRun.addEventListener('click', function () {
        runPanel.hidden = false;
        auto.classList.add('has-run');
        openRun.setAttribute('aria-expanded', 'true');
        closeRun.focus();
      });
      closeRun.addEventListener('click', function () {
        runPanel.hidden = true;
        auto.classList.remove('has-run');
        openRun.setAttribute('aria-expanded', 'false');
        openRun.focus();
      });
      openRun.setAttribute('aria-expanded', 'false');
      openRun.setAttribute('aria-controls', 'run-panel');
    }
  }
  /* ---------- Barre de navigation : ombre et section active ---------- */
  var barre = document.getElementById('barre');
  if (barre) {
    var marquer = function () { barre.classList.toggle('is-collee', window.scrollY > 4); };
    window.addEventListener('scroll', marquer, { passive: true });
    marquer();

    var liens = Array.prototype.slice.call(barre.querySelectorAll('a[href^="#"]'));
    var sections = liens
      .map(function (a) { return { lien: a, bloc: document.querySelector(a.getAttribute('href')) }; })
      .filter(function (x) { return x.bloc; });

    if (sections.length && 'IntersectionObserver' in window && !reduceMotion) {
      var vues = new Set();
      var oeil = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) vues.add(e.target); else vues.delete(e.target);
        });
        // La section active est la plus haute de celles qui sont à l écran.
        var visibles = sections.filter(function (x) { return vues.has(x.bloc); });
        sections.forEach(function (x) { x.lien.classList.remove('is-actif'); });
        if (visibles.length) visibles[0].lien.classList.add('is-actif');
      }, { rootMargin: '-58px 0px -55% 0px', threshold: 0 });
      sections.forEach(function (x) { oeil.observe(x.bloc); });
    }
  }

};
