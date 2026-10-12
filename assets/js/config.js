/*
 * NEKIO site configuration.
 *
 * Everything in this file is PUBLIC: it ships to every visitor's browser.
 * Never put a secret here (no Supabase service_role key, no private API token).
 * The Supabase "anon"/"publishable" key is designed to be public and is only safe
 * because supabase/schema.sql restricts it to INSERT-only (Row Level Security).
 *
 * The forms are NOT live until `submission.provider` is configured and tested.
 * See README.md → "Making the forms live".
 */
window.NEKIO_CONFIG = {
  // Primary public URL (used for sharing; also update the <meta> URLs in index.html if it changes).
  siteUrl: 'https://nekio.hu',

  // Public contact / privacy e-mail. Leave empty until confirmed: the footer "Contact"
  // link then points to the research section instead of a mailto: link.
  contactEmail: '',

  // Bump when the privacy notice or consent wording changes materially.
  // It is stored with each submission so you know which wording the person agreed to.
  consentVersion: '2026-10-draft-1',

  submission: {
    // 'none'     → forms refuse to send and say so (default, safe)
    // 'supabase' → insert-only REST call to your Supabase project (recommended)
    // 'endpoint' → POST JSON to a hosted form service (Formspree, Web3Forms, …)
    provider: 'none',

    supabase: {
      url: '',            // e.g. https://abcdefgh.supabase.co
      anonKey: '',        // the public anon / publishable key
      candidatesTable: 'research_candidates',
      employersTable: 'research_employers'
    },

    endpoint: {
      candidates: '',     // full URL for the candidate form
      employers: '',      // full URL for the employer form
      extraFields: {}     // e.g. { access_key: '...' } for services that need a public key in the body
    }
  },

  // Privacy-friendly measurement. Off by default: nothing is loaded and nothing is sent.
  // 'plausible' loads a cookieless script (see README → Analytics). No personal data is ever
  // included in events. Check with your legal advisor before enabling.
  analytics: {
    provider: 'none',     // 'none' | 'plausible'
    plausibleDomain: '',  // e.g. nekio.hu
    plausibleScript: 'https://plausible.io/js/script.js',
    debug: false          // true → log events to the browser console instead of / besides sending
  }
};
