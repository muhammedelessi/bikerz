-- Add custom label overrides and custom (free-text) requirements to rank_definitions.
-- req_labels  : object keyed by requirement slug → {en, ar} label strings
-- custom_requirements : array of {label_en, label_ar} objects shown in the profile

alter table public.rank_definitions
  add column if not exists req_labels         jsonb not null default '{}',
  add column if not exists custom_requirements jsonb not null default '[]';
