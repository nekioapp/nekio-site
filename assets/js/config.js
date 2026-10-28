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
  siteUrl: 'https://nekio.app',

  // Public contact / privacy e-mail. Leave empty until confirmed: the footer "Contact"
  // link then points to the research section instead of a mailto: link.
  contactEmail: 'matchme@nekio.app',

  // Bump when the privacy notice or consent wording changes materially.
  // It is stored with each submission so you know which wording the person agreed to.
  consentVersion: '2026-10-28',

  submission: {
    // 'none'     → forms refuse to send and say so (default, safe)
    // 'supabase' → insert-only REST call to your Supabase project (recommended)
    // 'endpoint' → POST JSON to a hosted form service (Formspree, Web3Forms, …)
    provider: 'supabase',

    supabase: {
      url: 'https://xvqetnxetcvadxytquql.supabase.co',
      anonKey: 'sb_publishable_X4nlvEKvfqQG2dIucgxKZQ_3FH1beg4',   // public publishable key (insert-only via RLS)
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
    provider: 'goatcounter',     // 'none' | 'plausible' | 'goatcounter' (goatcounter: the script tag is in index.html / privacy.html)
    plausibleDomain: '',  // e.g. nekio.app
    plausibleScript: 'https://plausible.io/js/script.js',
    debug: false          // true → log events to the browser console instead of / besides sending
  }
};
