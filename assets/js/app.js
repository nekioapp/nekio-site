/*
 * NEKIO — page behaviour: language switching, mobile navigation, privacy-friendly event tracking.
 * Plain JavaScript, no build step. Works on index.html and privacy.html.
 */
(function () {
  'use strict';

  var CFG = window.NEKIO_CONFIG || {};
  var DICT = window.NEKIO_I18N || { en: {}, hu: {} };
  var root = document.documentElement;
  var isPrivacyPage = document.body && document.body.getAttribute('data-page') === 'privacy';

  root.classList.add('js');

  /* ---------------------------------------------------------------- helpers */
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  function currentLang() { return root.lang === 'hu' ? 'hu' : 'en'; }

  function t(key) {
    var l = currentLang();
    if (DICT[l] && DICT[l][key] != null) return DICT[l][key];
    if (DICT.en && DICT.en[key] != null) return DICT.en[key];
    return key;
  }
  window.nekioT = t;
  window.nekioLang = currentLang;

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked: fine */ } }

  /* ---------------------------------------------------------------- tracking */
  var A = CFG.analytics || {};
  var trackingOn = A.provider === 'plausible' && !!A.plausibleDomain;

  if (trackingOn) {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    var s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', A.plausibleDomain);
    s.src = A.plausibleScript || 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }

  /**
   * nekioTrack(eventName, props)
   * Never pass personal data (names, e-mails, free text). Only coarse, non-identifying values
   * such as the CTA placement or the yes/no/maybe choice.
   */
  window.nekioTrack = function (name, props) {
    try {
      if (A.debug && window.console) console.info('[nekio:track]', name, props || {});
      if (trackingOn && typeof window.plausible === 'function') {
        window.plausible(name, props ? { props: props } : undefined);
      }
    } catch (e) { /* measurement must never break the page */ }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el) return;
    var parts = (el.getAttribute('data-track') || '').split(':');
    if (!parts[0]) return;
    window.nekioTrack(parts[0], parts[1] ? { placement: parts[1] } : undefined);
  });

  /* ---------------------------------------------------------------- language */
  function setMeta(selector, attr, value) {
    var el = qs(selector);
    if (el) el.setAttribute(attr, value);
  }

  function applyLang(lang, persist) {
    lang = lang === 'hu' ? 'hu' : 'en';
    root.lang = lang;

    qsa('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    qsa('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    qsa('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
      });
    });

    var titleKey = isPrivacyPage ? 'pv.title' : 'meta.title';
    var descKey = isPrivacyPage ? 'pv.description' : 'meta.description';
    document.title = t(titleKey);
    setMeta('meta[name="description"]', 'content', t(descKey));
    setMeta('meta[property="og:title"]', 'content', t(titleKey));
    setMeta('meta[property="og:description"]', 'content', t(descKey));
    setMeta('meta[name="twitter:title"]', 'content', t(titleKey));
    setMeta('meta[name="twitter:description"]', 'content', t(descKey));
    setMeta('meta[property="og:locale"]', 'content', lang === 'hu' ? 'hu_HU' : 'en_US');

    qsa('[data-set-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-set-lang') === lang ? 'true' : 'false');
    });

    if (persist) store('nekio-lang', lang);
    root.classList.remove('lang-pending');
    document.dispatchEvent(new CustomEvent('nekio:lang', { detail: { lang: lang } }));
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-set-lang]') : null;
    if (!btn) return;
    applyLang(btn.getAttribute('data-set-lang'), true);
  });

  // An explicit ?lang= link counts as a choice, so it also survives navigation to the privacy page.
  var urlLang = null;
  try { urlLang = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  applyLang(currentLang(), urlLang === 'hu' || urlLang === 'en');

  /* ---------------------------------------------------------------- contact link */
  qsa('[data-contact-link]').forEach(function (a) {
    if (CFG.contactEmail) {
      a.setAttribute('href', 'mailto:' + CFG.contactEmail);
    }
  });
  qsa('[data-contact-email]').forEach(function (el) {
    if (CFG.contactEmail) {
      el.textContent = CFG.contactEmail;
      if (el.tagName === 'A') el.setAttribute('href', 'mailto:' + CFG.contactEmail);
      el.classList.remove('ph');
    }
  });

  /* ---------------------------------------------------------------- mobile nav */
  var menuBtn = qs('#menu-btn');
  var nav = qs('#nav');
  if (menuBtn && nav) {
    var mq = window.matchMedia('(max-width: 820px)');

    function setOpen(open) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
      // keep hidden links out of the tab order on mobile while closed
      if (mq.matches) {
        qsa('a', nav).forEach(function (a) { a.tabIndex = open ? 0 : -1; });
      } else {
        qsa('a', nav).forEach(function (a) { a.removeAttribute('tabindex'); });
      }
    }

    menuBtn.addEventListener('click', function () { setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setOpen(false); menuBtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
    });
    var onChange = function () { setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    setOpen(false);
  }

  /* ---------------------------------------------------------------- reveal on scroll (progressive enhancement) */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window && !isPrivacyPage) {
    var targets = qsa('.card, .principle, .option, .stages, .about__copy, .final__inner, .section__head, .note');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal');
        io.observe(el);
      }
    });
  }
})();
