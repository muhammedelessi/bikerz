import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

// Mistake types as defined in requirements
export type MistakeType = 'knowledge' | 'scenario_judgment' | 'overconfidence';

// Internal pattern classifications (never exposed to user)
export type PatternType = 'knowledge_gap' | 'risk_underestimation' | 'reaction_timing' | 'situational_awareness';

// Reinforcement action types
export type ReinforcementType = 'lesson_suggestion' | 'recap_insert' | 'scenario_inject' | 'pace_adjustment';

// Concept areas for grouping
export const CONCEPT_AREAS = [
  'braking',
  'cornering',
  'awareness',
  'traffic_rules',
  'emergency_response',
  'visibility',
  'speed_control',
  'lane_positioning',
  'hazard_detection',
  'weather_conditions'
] as const;

export type ConceptArea = typeof CONCEPT_AREAS[number] | string;

// Situation types for grouping
export const SITUATION_TYPES = [
  'traffic',
  'low_visibility',
  'emergency',
  'intersection',
  'highway',
  'urban',
  'rural',
  'night_riding',
  'wet_conditions',
  'group_riding'
] as const;

export type SituationType = typeof SITUATION_TYPES[number] | string;

interface MistakeEventParams {
  mistakeType: MistakeType;
  conceptArea: ConceptArea;
  situationType?: SituationType;
  sourceType: string;
  sourceId?: string;
  lessonId?: string;
  chapterId?: string;
  courseId?: string;
  contextData?: Record<string, unknown>;
}

interface PatternDetectionResult {
  patternDetected: boolean;
  patternType?: PatternType;
  reinforcementQueued?: boolean;
}

// Pattern thresholds
const PATTERN_THRESHOLD = 2; // Minimum occurrences to detect pattern
const DECAY_DAYS = 30; // Days after which patterns start to fade
const STRENGTH_DECAY_RATE = 0.1; // How much strength decreases per decay period

/**
 * Maps mistake types to internal pattern classifications
 * This logic is never exposed to the user
 */
function classifyPattern(
  mistakeType: MistakeType,
  conceptArea: ConceptArea,
  situationType?: SituationType
): PatternType {
  // Risk underestimation: scenario judgment errors or overconfidence
  if (mistakeType === 'scenario_judgment' || mistakeType === 'overconfidence') {
    if (situationType && ['emergency', 'traffic', 'intersection'].includes(situationType)) {
      return 'risk_underestimation';
    }
    if (conceptArea === 'hazard_detection' || conceptArea === 'awareness') {
      return 'situational_awareness';
    }
    return 'reaction_timing';
  }
  
  // Knowledge mistakes default to knowledge gap
  return 'knowledge_gap';
}

/**
 * Determines appropriate reinforcement based on pattern
 */
function determineReinforcement(
  patternType: PatternType,
  occurrenceCount: number
): ReinforcementType {
  // More occurrences = more intensive reinforcement
  if (occurrenceCount >= 4) {
    return 'pace_adjustment';
  }
  
  switch (patternType) {
    case 'knowledge_gap':
      return 'lesson_suggestion';
    case 'risk_underestimation':
    case 'situational_awareness':
      return 'scenario_inject';
    case 'reaction_timing':
      return 'recap_insert';
    default:
      return 'lesson_suggestion';
  }
}

/**
 * Silent mistake pattern detection engine
 * Acts as a digital riding coach - never shames, only guides
 */
export const useMistakePatternDetection = () => {
  const { user } = useAuth();

  /**
   * Record a mistake event silently
   * Called when wrong answers or unsafe choices are detected
   */
  const recordMistake = useCallback(async (params: MistakeEventParams): Promise<PatternDetectionResult> => {
    if (!user) {
      return { patternDetected: false };
    }

    const {
      mistakeType,
      conceptArea,
      situationType,
      sourceType,
      sourceId,
      lessonId,
      chapterId,
      courseId,
      contextData = {}
    } = params;

    try {
      // 1. Insert the mistake event
      const { error: insertError } = await supabase
        .from('user_mistake_events')
        .insert([{
          user_id: user.id,
          mistake_type: mistakeType,
          concept_area: conceptArea,
          situation_type: situationType || null,
          source_type: sourceType,
          source_id: sourceId || null,
          lesson_id: lessonId || null,
          chapter_id: chapterId || null,
          course_id: courseId || null,
          context_data: contextData as Json
        }]);

      if (insertError) {
        console.error('Failed to record mistake:', insertError);
        return { patternDetected: false };
      }

      // 2. Check for pattern (count similar mistakes)
      const { count, error: countError } = await supabase
        .from('user_mistake_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('concept_area', conceptArea)
        .gte('created_at', new Date(Date.now() - DECAY_DAYS * 24 * 60 * 60 * 1000).toISOString());

      if (countError || count === null) {
        return { patternDetected: false };
      }

      // 3. Pattern detected if threshold reached
      if (count >= PATTERN_THRESHOLD) {
        const patternType = classifyPattern(mistakeType, conceptArea, situationType);
        
        // Upsert pattern record
        const { data: existingPattern } = await supabase
          .from('user_mistake_patterns')
          .select('id, occurrence_count, strength_score')
          .eq('user_id', user.id)
          .eq('concept_area', conceptArea)
          .maybeSingle();

        let patternId: string;
        let occurrenceCount = count;

        if (existingPattern) {
          // Update existing pattern
          const newStrength = Math.min(1, existingPattern.strength_score + 0.1);
          const { error: updateError } = await supabase
            .from('user_mistake_patterns')
            .update({
              occurrence_count: count,
              strength_score: newStrength,
              last_occurrence_at: new Date().toISOString(),
              is_active: true
            })
            .eq('id', existingPattern.id);

          if (updateError) {
            console.error('Failed to update pattern:', updateError);
          }
          patternId = existingPattern.id;
          occurrenceCount = count;
        } else {
          // Create new pattern
          const { data: newPattern, error: patternError } = await supabase
            .from('user_mistake_patterns')
            .insert({
              user_id: user.id,
              pattern_type: patternType,
              concept_area: conceptArea,
              situation_type: situationType || null,
              occurrence_count: count,
              strength_score: 0.5
            })
            .select('id')
            .single();

          if (patternError || !newPattern) {
            console.error('Failed to create pattern:', patternError);
            return { patternDetected: true, patternType };
          }
          patternId = newPattern.id;
        }

        // 4. Queue reinforcement action
        const reinforcementType = determineReinforcement(patternType, occurrenceCount);
        
        // Check if there's already a pending reinforcement for this pattern
        const { data: existingReinforcement } = await supabase
          .from('user_reinforcement_queue')
          .select('id')
          .eq('pattern_id', patternId)
          .eq('is_delivered', false)
          .eq('is_dismissed', false)
          .maybeSingle();

        if (!existingReinforcement) {
          const { error: queueError } = await supabase
            .from('user_reinforcement_queue')
            .insert({
              user_id: user.id,
              pattern_id: patternId,
              reinforcement_type: reinforcementType,
              target_lesson_id: lessonId || null,
              target_chapter_id: chapterId || null,
              priority: Math.min(10, occurrenceCount),
              content_data: {
                concept_area: conceptArea,
                situation_type: situationType || null,
                pattern_type: patternType
              } as Json,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            });

          if (queueError) {
            console.error('Failed to queue reinforcement:', queueError);
          }
        }

        return {
          patternDetected: true,
          patternType,
          reinforcementQueued: !existingReinforcement
        };
      }

      return { patternDetected: false };
    } catch (error) {
      console.error('Pattern detection error:', error);
      return { patternDetected: false };
    }
  }, [user]);

  /**
   * Apply decay to old patterns (should be called periodically)
   * Patterns fade if behavior improves
   */
  const applyPatternDecay = useCallback(async () => {
    if (!user) return;

    try {
      // Get patterns that haven't been updated recently
      const decayDate = new Date(Date.now() - DECAY_DAYS * 24 * 60 * 60 * 1000);
      
      const { data: stalePatterns } = await supabase
        .from('user_mistake_patterns')
        .select('id, strength_score')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .lt('last_occurrence_at', decayDate.toISOString());

      if (stalePatterns && stalePatterns.length > 0) {
        for (const pattern of stalePatterns) {
          const newStrength = Math.max(0, pattern.strength_score - STRENGTH_DECAY_RATE);
          
          await supabase
            .from('user_mistake_patterns')
            .update({
              strength_score: newStrength,
              is_active: newStrength > 0
            })
            .eq('id', pattern.id);
        }
      }
    } catch (error) {
      console.error('Pattern decay error:', error);
    }
  }, [user]);

  /**
   * Get pending reinforcements for the current context
   * Returns coach-like suggestions, never raw data
   */
  const getPendingReinforcements = useCallback(async (lessonId?: string, chapterId?: string) => {
    if (!user) return [];

    try {
      let query = supabase
        .from('user_reinforcement_queue')
        .select(`
          id,
          reinforcement_type,
          target_lesson_id,
          content_data,
          priority
        `)
        .eq('user_id', user.id)
        .eq('is_delivered', false)
        .eq('is_dismissed', false)
        .order('priority', { ascending: false });

      // Filter by context if provided
      if (lessonId) {
        query = query.or(`target_lesson_id.eq.${lessonId},target_lesson_id.is.null`);
      }
      if (chapterId) {
        query = query.or(`target_chapter_id.eq.${chapterId},target_chapter_id.is.null`);
      }

      const { data, error } = await query.limit(3);

      if (error) {
        console.error('Failed to fetch reinforcements:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Reinforcement fetch error:', error);
      return [];
    }
  }, [user]);

  /**
   * Mark a reinforcement as delivered (shown to user)
   */
  const markReinforcementDelivered = useCallback(async (reinforcementId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('user_reinforcement_queue')
        .update({
          is_delivered: true,
          delivered_at: new Date().toISOString()
        })
        .eq('id', reinforcementId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to mark reinforcement delivered:', error);
    }
  }, [user]);

  /**
   * Dismiss a reinforcement (user chose to skip)
   */
  const dismissReinforcement = useCallback(async (reinforcementId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('user_reinforcement_queue')
        .update({ is_dismissed: true })
        .eq('id', reinforcementId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to dismiss reinforcement:', error);
    }
  }, [user]);

  return {
    recordMistake,
    applyPatternDecay,
    getPendingReinforcements,
    markReinforcementDelivered,
    dismissReinforcement
  };
};
