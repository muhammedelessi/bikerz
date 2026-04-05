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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 OR p_amount > 500 THEN RAISE EXCEPTION 'Invalid XP amount'; END IF;

  SELECT * INTO v_gam FROM user_gamification WHERE user_id = v_user_id;
  IF v_gam IS NULL THEN
    INSERT INTO user_gamification (user_id) VALUES (v_user_id) RETURNING * INTO v_gam;
  END IF;

  v_multiplier := COALESCE(v_gam.combo_multiplier, 1.0);
  v_final_amount := ROUND(p_amount * v_multiplier);
  v_today := CURRENT_DATE;

  INSERT INTO xp_transactions (user_id, amount, source_type, source_id, multiplier, description, description_ar)
  VALUES (v_user_id, v_final_amount, p_source_type, p_source_id, v_multiplier, p_description, p_description_ar);

  v_new_total_xp := v_gam.total_xp + v_final_amount;

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

  v_new_streak := v_gam.current_streak;
  IF v_gam.last_activity_date IS NOT NULL THEN
    v_diff_days := v_today - v_gam.last_activity_date;
    IF v_diff_days = 1 THEN v_new_streak := v_new_streak + 1;
    ELSIF v_diff_days > 1 THEN v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE user_gamification SET
    total_xp = v_new_total_xp,
    level = v_new_level,
    current_streak = v_new_streak,
    longest_streak = GREATEST(v_new_streak, v_gam.longest_streak),
    last_activity_date = v_today,
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