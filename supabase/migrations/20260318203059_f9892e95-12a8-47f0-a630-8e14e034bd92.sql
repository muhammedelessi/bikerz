
-- 1. Create SECURITY DEFINER function for adding XP
CREATE OR REPLACE FUNCTION public.add_xp_secure(
  p_amount integer,
  p_source_type text,
  p_source_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_description_ar text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_gam RECORD;
  v_multiplier NUMERIC;
  v_final_amount INTEGER;
  v_new_total_xp INTEGER;
  v_new_level INTEGER;
  v_new_streak INTEGER;
  v_today DATE;
  v_diff_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate amount
  IF p_amount <= 0 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  -- Get current gamification data
  SELECT * INTO v_gam FROM user_gamification WHERE user_id = v_user_id;
  IF v_gam IS NULL THEN
    INSERT INTO user_gamification (user_id) VALUES (v_user_id)
    RETURNING * INTO v_gam;
  END IF;

  v_multiplier := COALESCE(v_gam.combo_multiplier, 1.0);
  v_final_amount := ROUND(p_amount * v_multiplier);
  v_today := CURRENT_DATE;

  -- Log XP transaction
  INSERT INTO xp_transactions (user_id, amount, source_type, source_id, multiplier, description, description_ar)
  VALUES (v_user_id, v_final_amount, p_source_type, p_source_id, v_multiplier, p_description, p_description_ar);

  v_new_total_xp := v_gam.total_xp + v_final_amount;

  -- Calculate level from XP thresholds
  v_new_level := CASE
    WHEN v_new_total_xp >= 38000 THEN 20
    WHEN v_new_total_xp >= 32000 THEN 19
    WHEN v_new_total_xp >= 27000 THEN 18
    WHEN v_new_total_xp >= 22500 THEN 17
    WHEN v_new_total_xp >= 18500 THEN 16
    WHEN v_new_total_xp >= 15000 THEN 15
    WHEN v_new_total_xp >= 12000 THEN 14
    WHEN v_new_total_xp >= 9700 THEN 13
    WHEN v_new_total_xp >= 7700 THEN 12
    WHEN v_new_total_xp >= 6000 THEN 11
    WHEN v_new_total_xp >= 4600 THEN 10
    WHEN v_new_total_xp >= 3500 THEN 9
    WHEN v_new_total_xp >= 2600 THEN 8
    WHEN v_new_total_xp >= 1900 THEN 7
    WHEN v_new_total_xp >= 1300 THEN 6
    WHEN v_new_total_xp >= 850 THEN 5
    WHEN v_new_total_xp >= 500 THEN 4
    WHEN v_new_total_xp >= 250 THEN 3
    WHEN v_new_total_xp >= 100 THEN 2
    ELSE 1
  END;

  -- Calculate streak
  v_new_streak := v_gam.current_streak;
  IF v_gam.last_activity_date IS NOT NULL THEN
    v_diff_days := v_today - v_gam.last_activity_date::date;
    IF v_diff_days = 1 THEN
      v_new_streak := v_new_streak + 1;
    ELSIF v_diff_days > 1 THEN
      v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Update gamification data
  UPDATE user_gamification SET
    total_xp = v_new_total_xp,
    level = v_new_level,
    current_streak = v_new_streak,
    longest_streak = GREATEST(v_new_streak, v_gam.longest_streak),
    last_activity_date = v_today::text,
    combo_multiplier = LEAST(2.0, 1.0 + (v_new_streak * 0.05))
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'xpGained', v_final_amount,
    'newTotalXP', v_new_total_xp,
    'newLevel', v_new_level,
    'leveledUp', v_new_level > v_gam.level,
    'newStreak', v_new_streak
  );
END;
$$;

-- 2. Create SECURITY DEFINER function for awarding badges
CREATE OR REPLACE FUNCTION public.award_badge_secure(p_badge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_badge RECORD;
  v_result RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify badge exists
  SELECT * INTO v_badge FROM achievement_badges WHERE id = p_badge_id;
  IF v_badge IS NULL THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  -- Check if already earned
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = v_user_id AND badge_id = p_badge_id) THEN
    RETURN jsonb_build_object('already_earned', true);
  END IF;

  -- Award badge
  INSERT INTO user_badges (user_id, badge_id)
  VALUES (v_user_id, p_badge_id);

  RETURN jsonb_build_object(
    'awarded', true,
    'badge_name', v_badge.name,
    'badge_name_ar', v_badge.name_ar,
    'xp_reward', v_badge.xp_reward,
    'coin_reward', v_badge.coin_reward
  );
END;
$$;

-- 3. Drop permissive INSERT/UPDATE policies on gamification tables
DROP POLICY IF EXISTS "Users can create XP transactions" ON xp_transactions;
DROP POLICY IF EXISTS "Users can insert their own gamification data" ON user_gamification;
DROP POLICY IF EXISTS "Users can update their own gamification data" ON user_gamification;
DROP POLICY IF EXISTS "Users can earn badges" ON user_badges;
DROP POLICY IF EXISTS "Users can update their own entry" ON leaderboard_entries;
DROP POLICY IF EXISTS "Users can modify their own entry" ON leaderboard_entries;

-- 4. Add admin-only write policies as fallback
CREATE POLICY "Only system can insert XP transactions"
ON xp_transactions FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only system can insert gamification data"
ON user_gamification FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only system can update gamification data"
ON user_gamification FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only system can award badges"
ON user_badges FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can write leaderboard"
ON leaderboard_entries FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update leaderboard"
ON leaderboard_entries FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));
