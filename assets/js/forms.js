/*
 * NEKIO — research forms: dialogs, validation, submission, states, privacy-safe events.
 */
(function () {
  'use strict';

  var CFG = window.NEKIO_CONFIG || {};
  var t = window.nekioT || function (k) { return k; };
  var track = window.nekioTrack || function () {};

  var FORMS = {
    candidate: {
      dialog: document.getElementById('dlg-candidate'),
      form: document.getElementById('form-candidate'),
      hash: '#candidate-form',
      fields: ['name', 'email', 'recent_role', 'seeking', 'location_preference', 'frustration', 'interview_willing'],
      choiceField: 'interview_willing',
      choiceEvent: 'candidate_interview_willing'
    },
    employer: {
      dialog: document.getElementById('dlg-employer'),
      form: document.getElementById('form-employer'),
      hash: '#employer-form',
      fields: ['name', 'email', 'company', 'job_title', 'roles', 'ats', 'challenge', 'pilot_interest'],
      choiceField: 'pilot_interest',
      choiceEvent: 'employer_pilot_interest'
    }
  };

  var MIN_FILL_MS = 2500;                    // faster than this is almost certainly a bot
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var lastTrigger = null;
  var mouseDownOnBackdrop = false;

  /* ------------------------------------------------------------ small helpers */
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function utm(name) {
    try { return (new URLSearchParams(location.search).get(name) || '').slice(0, 100) || null; } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ dialog open / close */
  function openForm(type, trigger) {
    var f = FORMS[type];
    if (!f || !f.dialog) return;
    lastTrigger = trigger || document.activeElement;

    showView(f, 'form');
    setStatus(f, '', null);
    var warn = qs('[data-setup-warning]', f.dialog);
    if (warn) warn.hidden = !!(window.NekioSubmit && window.NekioSubmit.isConfigured());

    f.openedAt = Date.now();
    f.started = false;

    if (typeof f.dialog.showModal === 'function') {
      if (!f.dialog.open) f.dialog.showModal();
    } else {
      f.dialog.setAttribute('open', '');           // very old browsers: non-modal fallback
    }
    document.body.classList.add('dialog-open');
    try { history.replaceState(null, '', f.hash); } catch (e) {}
    track(type + '_form_open');
  }

  function closeForm(f) {
    if (f.dialog.open) {
      if (typeof f.dialog.close === 'function') f.dialog.close(); else f.dialog.removeAttribute('open');
    }
  }

  function onClosed(f) {
    document.body.classList.remove('dialog-open');
    try {
      if (location.hash === f.hash) history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {}
    if (lastTrigger && typeof lastTrigger.focus === 'function' && document.contains(lastTrigger)) lastTrigger.focus();
  }

  function showView(f, name) {
    qsa('[data-view]', f.dialog).forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    if (name === 'success') {
      var s = qs('[data-view="success"]', f.dialog);
      if (s) { s.focus(); }
    }
  }

  /** Shows a status line. `key` is an i18n key so the text can follow a language switch. */
  function setStatus(f, state, key) {
    var el = qs('[data-status]', f.form);
    if (!el) return;
    el.textContent = key ? t(key) : '';
    if (key) el.setAttribute('data-key', key); else el.removeAttribute('data-key');
    if (state) el.setAttribute('data-state', state); else el.removeAttribute('data-state');
  }

  /* ------------------------------------------------------------ validation */
  function errorElFor(el) {
    var box = el.closest('fieldset') || el.closest('div');
    return box ? box.querySelector('.field__error') : null;
  }

  function setInvalid(el, message) {
    var err = errorElFor(el);
    var group = el.closest('fieldset.choice, .consent');
    if (el.type === 'radio' || el.type === 'checkbox') {
      if (group) group.setAttribute('data-invalid', 'true');
    } else {
      el.setAttribute('aria-invalid', 'true');
    }
    if (err) {
      err.textContent = message;
      err.hidden = false;
      var base = el.getAttribute('data-base-describedby');
      if (base === null) { base = el.getAttribute('aria-describedby') || ''; el.setAttribute('data-base-describedby', base); }
      el.setAttribute('aria-describedby', (base + ' ' + err.id).trim());
    }
  }

  function clearInvalid(el) {
    var err = errorElFor(el);
    var group = el.closest('fieldset.choice, .consent');
    if (group) group.removeAttribute('data-invalid');
    el.removeAttribute('aria-invalid');
    if (err) { err.hidden = true; err.textContent = ''; }
    var base = el.getAttribute('data-base-describedby');
    if (base !== null) { if (base) el.setAttribute('aria-describedby', base); else el.removeAttribute('aria-describedby'); }
  }

  /** Returns a message key if the control is invalid, otherwise null. */
  function problemWith(form, el) {
    if (el.type === 'radio') {
      var checked = form.querySelector('input[name="' + el.name + '"]:checked');
      return checked ? null : 'f.err.choice';
    }
    if (el.type === 'checkbox') return el.checked ? null : 'f.err.consent';
    var v = (el.value || '').trim();
    if (el.required && !v) return 'f.err.required';
    if (el.type === 'email' && v && (v.length > 254 || !EMAIL_RE.test(v))) return 'f.err.email';
    return null;
  }

  function validate(f) {
    var form = f.form;
    var firstBad = null;
    var seenRadio = {};
    qsa('input, textarea', form).forEach(function (el) {
      if (el.name === 'nk_hp') return;
      if (el.type === 'radio') {
        if (seenRadio[el.name]) return;
        seenRadio[el.name] = true;
        if (!el.required && !form.querySelector('input[name="' + el.name + '"][required]')) return;
        // the "required" attribute lives on the first radio of the group
        el = form.querySelector('input[name="' + el.name + '"]');
      }
      if (!el.required && el.type !== 'email') { clearInvalid(el); return; }
      var key = problemWith(form, el);
      if (key) { setInvalid(el, t(key)); if (!firstBad) firstBad = el; }
      else clearInvalid(el);
    });
    return firstBad;
  }

  /* ------------------------------------------------------------ submit */
  function collect(f, type) {
    var fd = new FormData(f.form);
    var row = {};
    f.fields.forEach(function (name) {
      var v = fd.get(name);
      v = v == null ? '' : String(v).trim();
      row[name] = v === '' ? null : v;
    });
    row.submission_id = f.submissionId;
    row.locale = window.nekioLang ? window.nekioLang() : 'en';
    row.consent_version = CFG.consentVersion || null;
    row.consent_at = new Date().toISOString();
    row.utm_source = utm('utm_source');
    row.utm_medium = utm('utm_medium');
    row.utm_campaign = utm('utm_campaign');
    return row;
  }

  function onSubmit(type, e) {
    e.preventDefault();
    var f = FORMS[type];
    if (f.busy) return;                                  // duplicate-submit guard

    var firstBad = validate(f);
    if (firstBad) {
      setStatus(f, 'error', 'f.summary');
      firstBad.focus();
      return;
    }

    // Spam checks: filled honeypot → pretend success to the bot, send nothing.
    var hp = f.form.elements['nk_hp'];
    if (hp && hp.value) { finish(f, type, null, true); return; }
    if (Date.now() - f.openedAt < MIN_FILL_MS) {
      setStatus(f, 'error', 'f.err.fast');
      f.openedAt = Date.now() - MIN_FILL_MS + 1200;      // allow a retry shortly
      return;
    }

    if (!f.submissionId) f.submissionId = uuid();        // reused on retries → server can de-duplicate
    var row = collect(f, type);

    f.busy = true;
    var btn = qs('[data-submit]', f.form);
    var labelKey = type === 'candidate' ? 'fc.submit' : 'fe.submit';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = t('f.sending');
    setStatus(f, 'busy', 'f.sending');

    window.NekioSubmit.send(type, row).then(function () {
      finish(f, type, row, false);
    }, function (err) {
      var notConfigured = err && err.code === 'NOT_CONFIGURED';
      setStatus(f, 'error', notConfigured ? 'f.err.notConfigured' : 'f.err.send');
      track(type + '_form_error', { reason: notConfigured ? 'not_configured' : 'send_failed' });
    }).then(function () {
      f.busy = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = t(labelKey);
    });
  }

  function finish(f, type, row, silent) {
    if (!silent && row) {
      // Only coarse, non-identifying values leave the page for measurement.
      track(type + '_form_submit');
      var answer = row[f.choiceField];
      if (answer) track(f.choiceEvent, { answer: answer });
    }
    f.form.reset();
    qsa('[aria-invalid]', f.form).forEach(clearInvalid);
    f.submissionId = null;
    setStatus(f, '', null);
    showView(f, 'success');
  }

  /* ------------------------------------------------------------ wiring */
  Object.keys(FORMS).forEach(function (type) {
    var f = FORMS[type];
    if (!f.dialog || !f.form) return;

    f.form.addEventListener('submit', function (e) { onSubmit(type, e); });

    // first interaction = "form start"
    f.form.addEventListener('input', function () {
      if (!f.started) { f.started = true; track(type + '_form_start'); }
    });
    // live re-validation once a field has been flagged
    function revalidate(e) {
      var el = e.target;
      if (!el || el.name === 'nk_hp') return;
      var flagged = el.getAttribute('aria-invalid') === 'true' || !!el.closest('[data-invalid="true"]');
      if (!flagged) return;
      var key = problemWith(f.form, el);
      if (key) setInvalid(el, t(key)); else clearInvalid(el);
    }
    f.form.addEventListener('input', revalidate);
    f.form.addEventListener('change', revalidate);

    // close buttons
    qsa('[data-close]', f.dialog).forEach(function (b) { b.addEventListener('click', function () { closeForm(f); }); });

    // click on the backdrop closes (but not when a text selection started inside and ended outside)
    f.dialog.addEventListener('mousedown', function (e) { mouseDownOnBackdrop = e.target === f.dialog; });
    f.dialog.addEventListener('click', function (e) {
      if (e.target === f.dialog && mouseDownOnBackdrop) closeForm(f);
    });
    f.dialog.addEventListener('close', function () { onClosed(f); });
  });

  // Re-translate any visible error messages when the language changes.
  document.addEventListener('nekio:lang', function () {
    Object.keys(FORMS).forEach(function (type) {
      var f = FORMS[type];
      if (!f.form) return;
      var btn = qs('[data-submit]', f.form);
      if (btn && !f.busy) btn.textContent = t(type === 'candidate' ? 'fc.submit' : 'fe.submit');
      var status = qs('[data-status]', f.form);
      if (status && status.getAttribute('data-key')) status.textContent = t(status.getAttribute('data-key'));
      validateSilentRelabel(f);
    });
  });

  function validateSilentRelabel(f) {
    qsa('[aria-invalid="true"], [data-invalid="true"] input', f.form).forEach(function (el) {
      var key = problemWith(f.form, el);
      var err = errorElFor(el);
      if (key && err && !err.hidden) err.textContent = t(key);
    });
  }

  // CTA triggers
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-open-form]') : null;
    if (!trigger) return;
    e.preventDefault();
    openForm(trigger.getAttribute('data-open-form'), trigger);
  });

  // Deep links: nekio.hu/#candidate-form  /  nekio.hu/#employer-form
  function openFromHash() {
    Object.keys(FORMS).forEach(function (type) {
      if (location.hash === FORMS[type].hash && FORMS[type].dialog && !FORMS[type].dialog.open) openForm(type, null);
    });
  }
  window.addEventListener('hashchange', openFromHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openFromHash); else openFromHash();
})();
