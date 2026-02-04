-- Add header menu configuration to admin_settings
INSERT INTO admin_settings (key, category, value) 
VALUES (
  'header', 
  'landing', 
  '{
    "logo_url": "",
    "logo_alt_en": "BIKERZ",
    "logo_alt_ar": "بايكرز",
    "show_language_toggle": true,
    "menu_items": [
      {
        "id": "home",
        "title_en": "Home",
        "title_ar": "الرئيسية",
        "link": "/",
        "is_visible": true,
        "open_in_new_tab": false
      },
      {
        "id": "courses",
        "title_en": "Courses",
        "title_ar": "الدورات",
        "link": "/courses",
        "is_visible": true,
        "open_in_new_tab": false
      },
      {
        "id": "mentors",
        "title_en": "Mentors",
        "title_ar": "المدربون",
        "link": "/mentors",
        "is_visible": true,
        "open_in_new_tab": false
      },
      {
        "id": "about",
        "title_en": "About",
        "title_ar": "من نحن",
        "link": "/about",
        "is_visible": true,
        "open_in_new_tab": false
      }
    ],
    "cta_button": {
      "text_en": "Get Started",
      "text_ar": "ابدأ الآن",
      "link": "/signup",
      "is_visible": true,
      "style": "cta"
    },
    "login_button": {
      "text_en": "Login",
      "text_ar": "تسجيل الدخول",
      "link": "/login",
      "is_visible": true
    }
  }'::jsonb
)
ON CONFLICT (key) WHERE category = 'landing' 
DO UPDATE SET value = EXCLUDED.value, updated_at = now();