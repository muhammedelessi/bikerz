-- Default Saudi VAT % for practical training Tap charges (admin can change in Trainings page).
insert into public.admin_settings (key, category, value)
values (
  'training_platform_vat_percent',
  'training',
  '{"percent": 15}'::jsonb
)
on conflict (key) do nothing;
