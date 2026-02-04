-- Insert default landing page content into admin_settings
INSERT INTO admin_settings (key, category, value) VALUES
('hero', 'landing', '{
  "title_en": "Master the Art of Riding",
  "title_ar": "أتقن فن القيادة",
  "subtitle_en": "Join 15,000+ GCC riders on their journey from beginner to confident road master. Learn safety, control, and the freedom of the open road.",
  "subtitle_ar": "انضم إلى أكثر من 15,000 راكب في الخليج في رحلتهم من المبتدئين إلى أساتذة الطريق. تعلّم السلامة والتحكم وحرية الطريق المفتوح.",
  "cta_en": "Start Your Journey",
  "cta_ar": "ابدأ رحلتك",
  "secondary_cta_en": "Explore Courses",
  "secondary_cta_ar": "استكشف الدورات",
  "badge_text_en": "GCC Riders",
  "badge_text_ar": "راكب في الخليج"
}'::jsonb),
('why', 'landing', '{
  "title_en": "Why Learn With Us?",
  "title_ar": "لماذا تتعلم معنا؟",
  "subtitle_en": "Most riders learn through trial and error—dangerous and inefficient. We have built the comprehensive system that transforms beginners into confident riders.",
  "subtitle_ar": "معظم الراكبين يتعلمون بالتجربة والخطأ—طريقة خطيرة وغير فعّالة. لقد بنينا نظاماً شاملاً يحوّل المبتدئين إلى راكبين واثقين.",
  "cards": [
    {
      "title_en": "Safety First",
      "title_ar": "السلامة أولاً",
      "description_en": "Learn proper techniques that prevent accidents and build lifelong safe riding habits from day one.",
      "description_ar": "تعلّم التقنيات الصحيحة التي تمنع الحوادث وتبني عادات قيادة آمنة مدى الحياة من اليوم الأول.",
      "icon": "Shield"
    },
    {
      "title_en": "Expert Instructors",
      "title_ar": "مدربون خبراء",
      "description_en": "Our instructors are certified professionals with decades of experience on GCC roads.",
      "description_ar": "مدربونا محترفون معتمدون بعقود من الخبرة على طرق الخليج.",
      "icon": "Award"
    },
    {
      "title_en": "Real Road Skills",
      "title_ar": "مهارات الطريق الحقيقية",
      "description_en": "From traffic navigation to emergency maneuvers—skills that matter in real-world situations.",
      "description_ar": "من التنقل في حركة المرور إلى مناورات الطوارئ—مهارات مهمة في المواقف الحقيقية.",
      "icon": "Navigation"
    },
    {
      "title_en": "Community Support",
      "title_ar": "دعم المجتمع",
      "description_en": "Join a brotherhood of 15,000+ riders who support and learn from each other.",
      "description_ar": "انضم إلى أخوية تضم أكثر من 15,000 راكب يدعمون ويتعلمون من بعضهم البعض.",
      "icon": "Users"
    }
  ]
}'::jsonb),
('journey', 'landing', '{
  "title_en": "Your Path to Mastery",
  "title_ar": "طريقك نحو الإتقان",
  "subtitle_en": "A structured journey designed to take you from complete beginner to confident rider",
  "subtitle_ar": "رحلة منظمة مصممة لتأخذك من مبتدئ تماماً إلى راكب واثق",
  "steps": [
    {
      "number": "01",
      "title_en": "Basics & Safety",
      "title_ar": "الأساسيات والسلامة",
      "description_en": "Understand your machine, gear essentials, and fundamental safety protocols.",
      "description_ar": "افهم دراجتك، أساسيات المعدات، وبروتوكولات السلامة الأساسية.",
      "icon": "Shield"
    },
    {
      "number": "02",
      "title_en": "Control & Balance",
      "title_ar": "التحكم والتوازن",
      "description_en": "Master throttle control, braking techniques, and low-speed maneuvering.",
      "description_ar": "أتقن التحكم في الوقود، تقنيات الفرملة، والمناورة بسرعات منخفضة.",
      "icon": "Bike"
    },
    {
      "number": "03",
      "title_en": "Road Skills",
      "title_ar": "مهارات الطريق",
      "description_en": "Navigate traffic, handle intersections, and read road conditions.",
      "description_ar": "تنقل في حركة المرور، تعامل مع التقاطعات، واقرأ ظروف الطريق.",
      "icon": "Route"
    },
    {
      "number": "04",
      "title_en": "Advanced Riding",
      "title_ar": "القيادة المتقدمة",
      "description_en": "Corner like a pro, handle emergencies, and ride in all conditions.",
      "description_ar": "انعطف كالمحترفين، تعامل مع الطوارئ، وقُد في جميع الظروف.",
      "icon": "Trophy"
    }
  ]
}'::jsonb),
('learn', 'landing', '{
  "title_en": "What You Will Master",
  "title_ar": "ما ستتقنه",
  "subtitle_en": "Comprehensive curriculum designed for real-world riding excellence",
  "subtitle_ar": "منهج شامل مصمم للتميز في القيادة الحقيقية",
  "skills": [
    { "key": "skill1", "text_en": "Pre-ride Safety Checks", "text_ar": "فحوصات السلامة قبل الركوب", "icon": "CheckCircle2" },
    { "key": "skill2", "text_en": "Throttle & Brake Control", "text_ar": "التحكم في الوقود والفرامل", "icon": "Gauge" },
    { "key": "skill3", "text_en": "Cornering Techniques", "text_ar": "تقنيات الانعطاف", "icon": "CornerDownRight" },
    { "key": "skill4", "text_en": "Traffic Navigation", "text_ar": "التنقل في المرور", "icon": "Navigation" },
    { "key": "skill5", "text_en": "Emergency Maneuvers", "text_ar": "مناورات الطوارئ", "icon": "AlertTriangle" },
    { "key": "skill6", "text_en": "Night & Weather Riding", "text_ar": "القيادة الليلية وفي الطقس", "icon": "CloudRain" },
    { "key": "skill7", "text_en": "Highway Riding", "text_ar": "القيادة على الطريق السريع", "icon": "Map" },
    { "key": "skill8", "text_en": "Group Riding Etiquette", "text_ar": "آداب القيادة الجماعية", "icon": "Users2" }
  ]
}'::jsonb),
('cta', 'landing', '{
  "title_en": "Ready to Ride?",
  "title_ar": "مستعد للانطلاق؟",
  "subtitle_en": "Your journey to becoming a confident, skilled rider starts with a single step.",
  "subtitle_ar": "رحلتك لتصبح راكباً واثقاً وماهراً تبدأ بخطوة واحدة.",
  "button_en": "Start Learning Today",
  "button_ar": "ابدأ التعلم اليوم",
  "trust_badges": [
    { "text_en": "Start Free", "text_ar": "ابدأ مجاناً" },
    { "text_en": "No Credit Card", "text_ar": "بدون بطاقة ائتمان" },
    { "text_en": "Cancel Anytime", "text_ar": "إلغاء في أي وقت" }
  ]
}'::jsonb),
('community', 'landing', '{
  "title_en": "Join the Brotherhood",
  "title_ar": "انضم إلى الأخوية",
  "subtitle_en": "15,000+ riders across the GCC have chosen to learn the right way",
  "subtitle_ar": "أكثر من 15,000 راكب في الخليج اختاروا التعلم بالطريقة الصحيحة"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();