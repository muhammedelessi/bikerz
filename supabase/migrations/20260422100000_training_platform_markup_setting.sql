-- Default: no markup (backward compatible). Admins set % in Trainings → Platform commission.
insert into public.admin_settings (key, category, value)
values (
  'training_platform_markup_percent',
  'training',
  '{"percent": 0}'::jsonb
)
on conflict (key) do nothing;
