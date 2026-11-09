-- NEKIO research forms — Supabase schema (insert-only for the public website)
--
-- Run this once in: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Create the project in an EU region (e.g. Frankfurt, eu-central-1) for GDPR reasons.
--
-- Security model
--   * The website uses the PUBLIC "anon"/"publishable" key. That key can ONLY insert rows
--     into these two tables. It cannot read, update or delete anything.
--   * You read the submissions yourself in the Supabase dashboard (Table Editor) or via the
--     service_role key on your own machine. NEVER put the service_role key in the website.
--   * submission_id is generated in the browser; a retry of the same submission is ignored
--     (unique constraint) instead of creating duplicates.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- candidates
create table if not exists public.research_candidates (
  id                   bigint generated always as identity primary key,
  submission_id        uuid        not null unique,
  created_at           timestamptz not null default now(),
  locale               text        check (locale in ('en', 'hu')),
  name                 text        not null check (char_length(name) between 1 and 120),
  email                text        check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),   -- only collected when interview_willing = 'yes'
  recent_role          text        not null check (char_length(recent_role) between 1 and 160),
  seeking              text        not null check (char_length(seeking) between 1 and 1000),
  location_preference  text        check (location_preference is null or char_length(location_preference) <= 200),
  frustration          text        not null check (char_length(frustration) between 1 and 2000),
  interview_willing    text        not null check (interview_willing in ('yes', 'no')),
  consent_version      text        check (consent_version is null or char_length(consent_version) <= 60),
  consent_at           timestamptz not null,
  utm_source           text        check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium           text        check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign         text        check (utm_campaign is null or char_length(utm_campaign) <= 100),
  constraint research_candidates_email_if_willing check (interview_willing <> 'yes' or email is not null)
);

-- ---------------------------------------------------------------- employers
create table if not exists public.research_employers (
  id                   bigint generated always as identity primary key,
  submission_id        uuid        not null unique,
  created_at           timestamptz not null default now(),
  locale               text        check (locale in ('en', 'hu')),
  name                 text        not null check (char_length(name) between 1 and 120),
  email                text        check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  company              text        not null check (char_length(company) between 1 and 160),
  job_title            text        not null check (char_length(job_title) between 1 and 160),
  roles                text        not null check (char_length(roles) between 1 and 1000),
  ats                  text        check (ats is null or char_length(ats) <= 160),
  challenge            text        not null check (char_length(challenge) between 1 and 2000),
  pilot_interest       text        not null check (pilot_interest in ('yes', 'no', 'maybe')),
  consent_version      text        check (consent_version is null or char_length(consent_version) <= 60),
  consent_at           timestamptz not null,
  utm_source           text        check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium           text        check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign         text        check (utm_campaign is null or char_length(utm_campaign) <= 100)
);

-- ---------------------------------------------------------------- row level security
alter table public.research_candidates enable row level security;
alter table public.research_employers  enable row level security;

-- Start from nothing, then grant exactly what the website needs: INSERT.
revoke all on public.research_candidates from anon, authenticated;
revoke all on public.research_employers  from anon, authenticated;
grant insert on public.research_candidates to anon;
grant insert on public.research_employers  to anon;

drop policy if exists "website can insert candidates" on public.research_candidates;
create policy "website can insert candidates"
  on public.research_candidates for insert to anon
  with check (true);

drop policy if exists "website can insert employers" on public.research_employers;
create policy "website can insert employers"
  on public.research_employers for insert to anon
  with check (true);

-- No select / update / delete policies exist, so the public key cannot read or change data.
-- (The identity sequences need no grant: inserting through the API uses the table owner's defaults.)

-- ---------------------------------------------------------------- housekeeping helpers (run manually)
-- Delete everything older than 12 months (adjust to the retention period in the privacy notice):
--   delete from public.research_candidates where created_at < now() - interval '12 months';
--   delete from public.research_employers  where created_at < now() - interval '12 months';
--
-- Erase one person on request:
--   delete from public.research_candidates where email = 'person@example.com';
--   delete from public.research_employers  where email = 'person@example.com';

-- ---------------------------------------------------------------- migration for an EXISTING project (2026-10-28)
-- The candidate form now asks for the e-mail address only when the person answers YES to the research conversation.
-- Run this once on a project that was created from the earlier version of this file:
--   alter table public.research_candidates alter column email drop not null;
--   alter table public.research_candidates add constraint research_candidates_email_if_willing
--     check (interview_willing <> 'yes' or email is not null);
-- Employer form (2026-10-28): the e-mail is required only when pilot_interest is 'yes' or 'maybe'.
--   alter table public.research_employers alter column email drop not null;
--   alter table public.research_employers add constraint research_employers_email_if_interested
--     check (pilot_interest = 'no' or email is not null);
