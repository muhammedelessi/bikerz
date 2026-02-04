-- Insert page settings for CMS
INSERT INTO admin_settings (key, category, value)
VALUES 
  ('privacy_page', 'landing', '{"is_enabled": true, "last_updated": "2024-01-01"}'),
  ('terms_page', 'landing', '{"is_enabled": true, "last_updated": "2024-01-01"}'),
  ('contact_page', 'landing', '{"is_enabled": true, "title_en": "Contact Us", "title_ar": "اتصل بنا", "subtitle_en": "Have questions or need help? We are here for you.", "subtitle_ar": "لديك أسئلة أو تحتاج مساعدة؟ نحن هنا من أجلك.", "email": "support@bikerz.sa", "phone": "+966 12 XXX XXXX", "location_en": "Jeddah, Saudi Arabia", "location_ar": "جدة، المملكة العربية السعودية", "hours_en": "Sun - Thu: 9AM - 6PM", "hours_ar": "الأحد - الخميس: 9 صباحاً - 6 مساءً"}')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();