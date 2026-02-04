-- Insert footer settings if not exists
INSERT INTO public.admin_settings (key, category, value)
VALUES (
  'footer',
  'landing',
  '{
    "email": "info@bikerz.sa",
    "phone": "+966 50 111 1111",
    "tagline_en": "Empowering riders across the GCC",
    "tagline_ar": "تمكين الراكبين في جميع أنحاء الخليج",
    "social_links": [
      {"platform": "x", "url": "", "is_visible": true},
      {"platform": "instagram", "url": "", "is_visible": true},
      {"platform": "tiktok", "url": "", "is_visible": true},
      {"platform": "snapchat", "url": "", "is_visible": true},
      {"platform": "youtube", "url": "", "is_visible": true}
    ]
  }'::jsonb
)
ON CONFLICT (key) WHERE category = 'landing' 
DO NOTHING;