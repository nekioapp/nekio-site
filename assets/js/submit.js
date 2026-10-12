/*
 * NEKIO — submission adapter.
 *
 * This is the ONLY file that knows where form data goes. To switch services, change
 * `submission.provider` in config.js or replace the body of `send()` below.
 *
 *   provider 'none'     → refuses to send (never pretends). Default until configured.
 *   provider 'supabase' → insert-only REST call (see supabase/schema.sql).
 *   provider 'endpoint' → JSON POST to a hosted form service (Formspree, Web3Forms, …).
 */
(function () {
  'use strict';

  var CFG = (window.NEKIO_CONFIG && window.NEKIO_CONFIG.submission) || { provider: 'none' };
  var TIMEOUT_MS = 15000;

  function NotConfiguredError() {
    var e = new Error('Form submission is not configured');
    e.code = 'NOT_CONFIGURED';
    return e;
  }

  function isConfigured() {
    if (CFG.provider === 'supabase') {
      return !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey);
    }
    if (CFG.provider === 'endpoint') {
      return !!(CFG.endpoint && (CFG.endpoint.candidates || CFG.endpoint.employers));
    }
    return false;
  }

  function withTimeout(url, options) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    if (ctl) options.signal = ctl.signal;
    return fetch(url, options).then(
      function (res) { if (timer) clearTimeout(timer); return res; },
      function (err) { if (timer) clearTimeout(timer); throw err; }
    );
  }

  function sendSupabase(type, row) {
    var sb = CFG.supabase || {};
    var table = type === 'candidate' ? (sb.candidatesTable || 'research_candidates') : (sb.employersTable || 'research_employers');
    var headers = {
      'Content-Type': 'application/json',
      'apikey': sb.anonKey,
      // Resend of the same submission_id is ignored instead of creating a duplicate row.
      'Prefer': 'return=minimal,resolution=ignore-duplicates'
    };
    // Legacy anon keys are JWTs and go in Authorization too; new publishable keys use the apikey header only.
    if (/^eyJ/.test(sb.anonKey)) headers['Authorization'] = 'Bearer ' + sb.anonKey;

    var url = sb.url.replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?on_conflict=submission_id';
    return withTimeout(url, { method: 'POST', headers: headers, body: JSON.stringify(row), credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' })
      .then(function (res) {
        if (res.ok || res.status === 409) return { ok: true };   // 409 = already stored (duplicate retry)
        throw new Error('Supabase responded with HTTP ' + res.status);
      });
  }

  function sendEndpoint(type, row) {
    var ep = CFG.endpoint || {};
    var url = type === 'candidate' ? ep.candidates : ep.employers;
    if (!url) throw NotConfiguredError();
    var body = {};
    var k;
    for (k in row) if (Object.prototype.hasOwnProperty.call(row, k)) body[k] = row[k];
    body.form_type = type;
    var extra = ep.extraFields || {};
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];

    return withTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin'
    }).then(function (res) {
      if (res.ok) return { ok: true };
      throw new Error('Endpoint responded with HTTP ' + res.status);
    });
  }

  /**
   * send('candidate' | 'employer', row) → Promise<{ok:true}>
   * Rejects with err.code === 'NOT_CONFIGURED' when no destination is set up.
   */
  function send(type, row) {
    if (!isConfigured()) {
      if (window.console) console.warn('[nekio] Form submission is not configured. Nothing was sent. See README.md → "Making the forms live".');
      return Promise.reject(NotConfiguredError());
    }
    try {
      if (CFG.provider === 'supabase') return sendSupabase(type, row);
      if (CFG.provider === 'endpoint') return sendEndpoint(type, row);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.reject(NotConfiguredError());
  }

  window.NekioSubmit = { isConfigured: isConfigured, send: send };
})();
