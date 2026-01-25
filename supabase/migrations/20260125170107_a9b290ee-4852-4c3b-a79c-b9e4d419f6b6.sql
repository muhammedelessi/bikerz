-- =====================================================
-- GAMIFIED LEARNING SYSTEM - COMPREHENSIVE DATABASE SCHEMA
-- =====================================================

-- 1. USER GAMIFICATION PROFILE
-- Tracks XP, level, streaks, and overall progress
CREATE TABLE public.user_gamification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    streak_freeze_count INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    combo_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. ACHIEVEMENT BADGES
-- Defines all available badges/achievements
CREATE TABLE public.achievement_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    description TEXT NOT NULL,
    description_ar TEXT,
    icon_name TEXT NOT NULL DEFAULT 'trophy',
    category TEXT NOT NULL DEFAULT 'general',
    rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
    xp_reward INTEGER NOT NULL DEFAULT 0,
    coin_reward INTEGER NOT NULL DEFAULT 0,
    requirement_type TEXT NOT NULL, -- lesson_count, quiz_score, streak_days, speed_challenge, perfect_chapter, etc.
    requirement_value INTEGER NOT NULL DEFAULT 1,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. USER EARNED BADGES
-- Tracks which badges users have earned
CREATE TABLE public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    badge_id UUID NOT NULL REFERENCES public.achievement_badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, badge_id)
);

-- 4. XP TRANSACTIONS LOG
-- Tracks all XP gains/losses for transparency
CREATE TABLE public.xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    source_type TEXT NOT NULL, -- lesson_complete, quiz_pass, streak_bonus, badge_reward, combo_bonus, speed_bonus
    source_id TEXT,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    description TEXT,
    description_ar TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. LESSON ACTIVITIES (Post-lesson micro-challenges)
-- Defines different activity types for lessons
CREATE TABLE public.lesson_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- micro_quiz, rapid_fire, drag_drop, scenario, fix_mistake, memory_recall, boss_question
    title TEXT NOT NULL,
    title_ar TEXT,
    data JSONB NOT NULL DEFAULT '{}', -- Activity-specific data (questions, options, correct answers)
    xp_reward INTEGER NOT NULL DEFAULT 10,
    time_limit_seconds INTEGER,
    difficulty_level INTEGER NOT NULL DEFAULT 1, -- 1-5
    position INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. USER ACTIVITY ATTEMPTS
-- Tracks user attempts on lesson activities
CREATE TABLE public.user_activity_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_id UUID NOT NULL REFERENCES public.lesson_activities(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    time_taken_seconds INTEGER,
    answers JSONB NOT NULL DEFAULT '{}',
    xp_earned INTEGER NOT NULL DEFAULT 0,
    combo_applied NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    passed BOOLEAN NOT NULL DEFAULT false,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. DAILY CHALLENGES
-- Rotating daily objectives
CREATE TABLE public.daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_date DATE NOT NULL,
    challenge_type TEXT NOT NULL, -- complete_lessons, pass_quiz, earn_xp, maintain_streak, perfect_activity
    target_value INTEGER NOT NULL DEFAULT 1,
    xp_reward INTEGER NOT NULL DEFAULT 50,
    coin_reward INTEGER NOT NULL DEFAULT 10,
    title TEXT NOT NULL,
    title_ar TEXT,
    description TEXT,
    description_ar TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. USER DAILY CHALLENGE PROGRESS
CREATE TABLE public.user_daily_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
    current_value INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_reward BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- 9. LEADERBOARD ENTRIES (Weekly/Monthly)
CREATE TABLE public.leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    period_type TEXT NOT NULL, -- weekly, monthly, all_time
    period_start DATE NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    quizzes_passed INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id, period_type, period_start)
);

-- 10. USER SKILL PROFICIENCY (Adaptive Difficulty)
CREATE TABLE public.user_skill_proficiency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    skill_area TEXT NOT NULL, -- overall, theory, practical, speed, accuracy
    proficiency_score NUMERIC(5,2) NOT NULL DEFAULT 50.0, -- 0-100
    total_attempts INTEGER NOT NULL DEFAULT 0,
    correct_attempts INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms INTEGER,
    difficulty_level INTEGER NOT NULL DEFAULT 2, -- Current recommended difficulty 1-5
    last_assessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id, chapter_id, skill_area)
);

-- Enable RLS on all tables
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_proficiency ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- user_gamification: Users can view/update their own data
CREATE POLICY "Users can view their own gamification data" ON public.user_gamification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gamification data" ON public.user_gamification FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gamification data" ON public.user_gamification FOR UPDATE USING (auth.uid() = user_id);

-- achievement_badges: Anyone can view badges
CREATE POLICY "Anyone can view non-hidden badges" ON public.achievement_badges FOR SELECT USING (is_hidden = false OR is_admin(auth.uid()));
CREATE POLICY "Admins can manage badges" ON public.achievement_badges FOR ALL USING (is_admin(auth.uid()));

-- user_badges: Users can view their own, admins can manage
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can earn badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all badges" ON public.user_badges FOR SELECT USING (is_admin(auth.uid()));

-- xp_transactions: Users can view/create their own
CREATE POLICY "Users can view their own XP transactions" ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create XP transactions" ON public.xp_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- lesson_activities: Anyone can view published, admins can manage
CREATE POLICY "Anyone can view published activities" ON public.lesson_activities FOR SELECT USING (is_published = true OR is_admin(auth.uid()));
CREATE POLICY "Admins can manage activities" ON public.lesson_activities FOR ALL USING (is_admin(auth.uid()));

-- user_activity_attempts: Users can manage their own
CREATE POLICY "Users can view their own attempts" ON public.user_activity_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create attempts" ON public.user_activity_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attempts" ON public.user_activity_attempts FOR UPDATE USING (auth.uid() = user_id);

-- daily_challenges: Anyone can view today's challenges
CREATE POLICY "Anyone can view daily challenges" ON public.daily_challenges FOR SELECT USING (challenge_date >= CURRENT_DATE - INTERVAL '1 day');
CREATE POLICY "Admins can manage challenges" ON public.daily_challenges FOR ALL USING (is_admin(auth.uid()));

-- user_daily_progress: Users can manage their own
CREATE POLICY "Users can view their own progress" ON public.user_daily_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create progress" ON public.user_daily_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own progress" ON public.user_daily_progress FOR UPDATE USING (auth.uid() = user_id);

-- leaderboard_entries: Anyone can view
CREATE POLICY "Anyone can view leaderboard" ON public.leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Users can update their own entry" ON public.leaderboard_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can modify their own entry" ON public.leaderboard_entries FOR UPDATE USING (auth.uid() = user_id);

-- user_skill_proficiency: Users can manage their own
CREATE POLICY "Users can view their own proficiency" ON public.user_skill_proficiency FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create proficiency" ON public.user_skill_proficiency FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own proficiency" ON public.user_skill_proficiency FOR UPDATE USING (auth.uid() = user_id);

-- INDEXES for performance
CREATE INDEX idx_user_gamification_user_id ON public.user_gamification(user_id);
CREATE INDEX idx_user_gamification_level ON public.user_gamification(level);
CREATE INDEX idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX idx_xp_transactions_user_id ON public.xp_transactions(user_id);
CREATE INDEX idx_xp_transactions_created_at ON public.xp_transactions(created_at);
CREATE INDEX idx_lesson_activities_lesson_id ON public.lesson_activities(lesson_id);
CREATE INDEX idx_user_activity_attempts_user_id ON public.user_activity_attempts(user_id);
CREATE INDEX idx_user_activity_attempts_activity_id ON public.user_activity_attempts(activity_id);
CREATE INDEX idx_daily_challenges_date ON public.daily_challenges(challenge_date);
CREATE INDEX idx_leaderboard_entries_period ON public.leaderboard_entries(period_type, period_start);
CREATE INDEX idx_leaderboard_entries_xp ON public.leaderboard_entries(xp_earned DESC);
CREATE INDEX idx_user_skill_proficiency_user ON public.user_skill_proficiency(user_id, course_id);

-- Trigger to update updated_at
CREATE TRIGGER update_user_gamification_updated_at BEFORE UPDATE ON public.user_gamification 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lesson_activities_updated_at BEFORE UPDATE ON public.lesson_activities 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_skill_proficiency_updated_at BEFORE UPDATE ON public.user_skill_proficiency 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaderboard_entries_updated_at BEFORE UPDATE ON public.leaderboard_entries 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED INITIAL BADGES
INSERT INTO public.achievement_badges (code, name, name_ar, description, description_ar, icon_name, category, rarity, xp_reward, coin_reward, requirement_type, requirement_value, is_hidden) VALUES
-- Lesson Badges
('first_lesson', 'First Steps', 'أولى الخطوات', 'Complete your first lesson', 'أكمل أول درس لك', 'footprints', 'lessons', 'common', 25, 5, 'lesson_count', 1, false),
('lesson_5', 'Getting Started', 'البداية', 'Complete 5 lessons', 'أكمل 5 دروس', 'play-circle', 'lessons', 'common', 50, 10, 'lesson_count', 5, false),
('lesson_10', 'Dedicated Learner', 'متعلم مجتهد', 'Complete 10 lessons', 'أكمل 10 دروس', 'book-open', 'lessons', 'rare', 100, 25, 'lesson_count', 10, false),
('lesson_25', 'Knowledge Seeker', 'طالب المعرفة', 'Complete 25 lessons', 'أكمل 25 درس', 'graduation-cap', 'lessons', 'epic', 250, 50, 'lesson_count', 25, false),

-- Quiz Badges
('first_quiz', 'Quiz Taker', 'محاور الاختبار', 'Pass your first quiz', 'اجتز أول اختبار لك', 'clipboard-check', 'quizzes', 'common', 30, 5, 'quiz_pass', 1, false),
('perfect_quiz', 'Perfectionist', 'الكمال', 'Score 100% on a quiz', 'احصل على 100% في اختبار', 'star', 'quizzes', 'rare', 100, 25, 'quiz_score', 100, false),
('quiz_master', 'Quiz Master', 'سيد الاختبارات', 'Pass 10 quizzes', 'اجتز 10 اختبارات', 'award', 'quizzes', 'epic', 200, 50, 'quiz_pass', 10, false),

-- Streak Badges
('streak_3', 'Warming Up', 'الإحماء', '3 day streak', 'سلسلة 3 أيام', 'flame', 'streaks', 'common', 50, 10, 'streak_days', 3, false),
('streak_7', 'On Fire', 'مشتعل', '7 day streak', 'سلسلة 7 أيام', 'flame', 'streaks', 'rare', 150, 30, 'streak_days', 7, false),
('streak_30', 'Unstoppable', 'لا يمكن إيقافه', '30 day streak', 'سلسلة 30 يوم', 'zap', 'streaks', 'legendary', 500, 100, 'streak_days', 30, false),

-- Speed Badges
('speed_demon', 'Speed Demon', 'شيطان السرعة', 'Complete a quiz in under 2 minutes', 'أكمل اختبار في أقل من دقيقتين', 'timer', 'speed', 'rare', 75, 15, 'speed_challenge', 120, false),
('lightning', 'Lightning Fast', 'سريع كالبرق', 'Answer 10 questions correctly in rapid fire', 'أجب على 10 أسئلة صحيحة في التحدي السريع', 'zap', 'speed', 'epic', 150, 35, 'rapid_fire', 10, false),

-- Special Badges
('night_owl', 'Night Owl', 'بومة الليل', 'Study after midnight', 'ادرس بعد منتصف الليل', 'moon', 'special', 'rare', 50, 10, 'time_based', 0, true),
('early_bird', 'Early Bird', 'عصفور الصباح', 'Study before 6 AM', 'ادرس قبل 6 صباحاً', 'sun', 'special', 'rare', 50, 10, 'time_based', 6, true),
('comeback', 'Comeback Kid', 'العودة القوية', 'Return after 7 days away', 'عد بعد غياب 7 أيام', 'rotate-ccw', 'special', 'rare', 100, 20, 'comeback', 7, true),

-- XP Badges
('xp_100', 'Rookie', 'مبتدئ', 'Earn 100 XP', 'اكسب 100 نقطة خبرة', 'trending-up', 'xp', 'common', 0, 5, 'total_xp', 100, false),
('xp_500', 'Apprentice', 'متدرب', 'Earn 500 XP', 'اكسب 500 نقطة خبرة', 'trending-up', 'xp', 'rare', 0, 15, 'total_xp', 500, false),
('xp_1000', 'Expert', 'خبير', 'Earn 1000 XP', 'اكسب 1000 نقطة خبرة', 'crown', 'xp', 'epic', 0, 30, 'total_xp', 1000, false),
('xp_5000', 'Legend', 'أسطورة', 'Earn 5000 XP', 'اكسب 5000 نقطة خبرة', 'sparkles', 'xp', 'legendary', 0, 100, 'total_xp', 5000, false);

-- INSERT SAMPLE DAILY CHALLENGES
INSERT INTO public.daily_challenges (challenge_date, challenge_type, target_value, xp_reward, coin_reward, title, title_ar, description, description_ar) VALUES
(CURRENT_DATE, 'complete_lessons', 3, 50, 10, 'Lesson Trio', 'ثلاثي الدروس', 'Complete 3 lessons today', 'أكمل 3 دروس اليوم'),
(CURRENT_DATE, 'earn_xp', 100, 30, 5, 'XP Hunter', 'صياد النقاط', 'Earn 100 XP today', 'اكسب 100 نقطة خبرة اليوم'),
(CURRENT_DATE, 'perfect_activity', 1, 75, 15, 'Perfect Score', 'نتيجة مثالية', 'Get a perfect score on any activity', 'احصل على نتيجة مثالية في أي نشاط');