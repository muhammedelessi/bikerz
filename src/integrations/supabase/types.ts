export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_badges: {
        Row: {
          category: string
          code: string
          coin_reward: number
          created_at: string
          description: string
          description_ar: string | null
          icon_name: string
          id: string
          is_hidden: boolean
          name: string
          name_ar: string | null
          rarity: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          category?: string
          code: string
          coin_reward?: number
          created_at?: string
          description: string
          description_ar?: string | null
          icon_name?: string
          id?: string
          is_hidden?: boolean
          name: string
          name_ar?: string | null
          rarity?: string
          requirement_type: string
          requirement_value?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          code?: string
          coin_reward?: number
          created_at?: string
          description?: string
          description_ar?: string | null
          icon_name?: string
          id?: string
          is_hidden?: boolean
          name?: string
          name_ar?: string | null
          rarity?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          message_ar: string | null
          title: string
          title_ar: string | null
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          message_ar?: string | null
          title: string
          title_ar?: string | null
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          message_ar?: string | null
          title?: string
          title_ar?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          category: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          email: string | null
          id: string
          name: string
          name_ar: string | null
          status: string
          total_commission_earned: number
          total_conversions: number
          total_revenue_generated: number
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          name_ar?: string | null
          status?: string
          total_commission_earned?: number
          total_conversions?: number
          total_revenue_generated?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          status?: string
          total_commission_earned?: number
          total_conversions?: number
          total_revenue_generated?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily_aggregates: {
        Row: {
          aggregate_date: string
          breakdown_dimension: string | null
          breakdown_value: string | null
          created_at: string
          id: string
          metric_name: string
          metric_value: number
        }
        Insert: {
          aggregate_date?: string
          breakdown_dimension?: string | null
          breakdown_value?: string | null
          created_at?: string
          id?: string
          metric_name: string
          metric_value: number
        }
        Update: {
          aggregate_date?: string
          breakdown_dimension?: string | null
          breakdown_value?: string | null
          created_at?: string
          id?: string
          metric_name?: string
          metric_value?: number
        }
        Relationships: []
      }
      chapter_tests: {
        Row: {
          chapter_id: string
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          is_published: boolean
          passing_score: number
          time_limit_minutes: number | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          time_limit_minutes?: number | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          time_limit_minutes?: number | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          is_free: boolean
          is_published: boolean
          position: number
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          position?: number
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          position?: number
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          city: string
          considering_purchase: string | null
          country: string
          created_at: string
          email: string
          full_name: string
          has_motorcycle: boolean
          id: string
          phone: string
        }
        Insert: {
          city: string
          considering_purchase?: string | null
          country: string
          created_at?: string
          email: string
          full_name: string
          has_motorcycle?: boolean
          id?: string
          phone: string
        }
        Update: {
          city?: string
          considering_purchase?: string | null
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          has_motorcycle?: boolean
          id?: string
          phone?: string
        }
        Relationships: []
      }
      coupon_rate_limits: {
        Row: {
          attempt_count: number
          id: string
          last_attempt_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          id?: string
          last_attempt_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          id?: string
          last_attempt_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      coupon_usage_logs: {
        Row: {
          applied_at: string
          charge_id: string | null
          coupon_id: string
          course_id: string | null
          discount_amount: number
          failure_reason: string | null
          final_amount: number
          id: string
          order_id: string | null
          original_amount: number
          result: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          charge_id?: string | null
          coupon_id: string
          course_id?: string | null
          discount_amount?: number
          failure_reason?: string | null
          final_amount?: number
          id?: string
          order_id?: string | null
          original_amount?: number
          result: string
          user_id: string
        }
        Update: {
          applied_at?: string
          charge_id?: string | null
          coupon_id?: string
          course_id?: string | null
          discount_amount?: number
          failure_reason?: string | null
          final_amount?: number
          id?: string
          order_id?: string | null
          original_amount?: number
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_logs_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          affiliate_id: string | null
          code: string
          code_normalized: string
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          description_ar: string | null
          expiry_date: string
          id: string
          is_deleted: boolean
          is_global: boolean
          is_stackable: boolean
          max_per_user: number
          max_usage: number
          minimum_amount: number | null
          start_date: string
          status: string
          type: string
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          affiliate_id?: string | null
          code: string
          code_normalized?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          expiry_date: string
          id?: string
          is_deleted?: boolean
          is_global?: boolean
          is_stackable?: boolean
          max_per_user?: number
          max_usage?: number
          minimum_amount?: number | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Update: {
          affiliate_id?: string | null
          code?: string
          code_normalized?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          expiry_date?: string
          id?: string
          is_deleted?: boolean
          is_global?: boolean
          is_stackable?: boolean
          max_per_user?: number
          max_usage?: number
          minimum_amount?: number | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_country_prices: {
        Row: {
          country_code: string
          course_id: string
          created_at: string
          currency: string
          discount_percentage: number
          id: string
          original_price: number
          price: number
          updated_at: string
        }
        Insert: {
          country_code: string
          course_id: string
          created_at?: string
          currency?: string
          discount_percentage?: number
          id?: string
          original_price?: number
          price?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          course_id?: string
          created_at?: string
          currency?: string
          discount_percentage?: number
          id?: string
          original_price?: number
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_country_prices_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          progress_percentage: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          progress_percentage?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          progress_percentage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          fake_name: string | null
          id: string
          is_fake: boolean
          rating: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          fake_name?: string | null
          id?: string
          is_fake?: boolean
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          fake_name?: string | null
          id?: string
          is_fake?: boolean
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          base_rating: number
          base_review_count: number
          certificate_enabled: boolean | null
          created_at: string
          currency: string | null
          description: string | null
          description_ar: string | null
          difficulty_level: string
          discount_expires_at: string | null
          discount_percentage: number | null
          drip_enabled: boolean | null
          duration_hours: number | null
          id: string
          instructor_id: string | null
          is_published: boolean
          learning_outcomes: Json | null
          preview_video_thumbnail: string | null
          preview_video_url: string | null
          price: number
          seo_description: string | null
          seo_title: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          title_ar: string | null
          total_lessons: number | null
          updated_at: string
        }
        Insert: {
          base_rating?: number
          base_review_count?: number
          certificate_enabled?: boolean | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          difficulty_level?: string
          discount_expires_at?: string | null
          discount_percentage?: number | null
          drip_enabled?: boolean | null
          duration_hours?: number | null
          id?: string
          instructor_id?: string | null
          is_published?: boolean
          learning_outcomes?: Json | null
          preview_video_thumbnail?: string | null
          preview_video_url?: string | null
          price?: number
          seo_description?: string | null
          seo_title?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          title_ar?: string | null
          total_lessons?: number | null
          updated_at?: string
        }
        Update: {
          base_rating?: number
          base_review_count?: number
          certificate_enabled?: boolean | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          difficulty_level?: string
          discount_expires_at?: string | null
          discount_percentage?: number | null
          drip_enabled?: boolean | null
          duration_hours?: number | null
          id?: string
          instructor_id?: string | null
          is_published?: boolean
          learning_outcomes?: Json | null
          preview_video_thumbnail?: string | null
          preview_video_url?: string | null
          price?: number
          seo_description?: string | null
          seo_title?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string | null
          total_lessons?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          challenge_date: string
          challenge_type: string
          coin_reward: number
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          target_value: number
          title: string
          title_ar: string | null
          xp_reward: number
        }
        Insert: {
          challenge_date: string
          challenge_type: string
          coin_reward?: number
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          target_value?: number
          title: string
          title_ar?: string | null
          xp_reward?: number
        }
        Update: {
          challenge_date?: string
          challenge_type?: string
          coin_reward?: number
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          target_value?: number
          title?: string
          title_ar?: string | null
          xp_reward?: number
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          country: string | null
          course_id: string | null
          created_at: string
          device_type: string | null
          funnel_step: string
          id: string
          previous_step: string | null
          session_id: string | null
          time_from_previous_step_seconds: number | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          course_id?: string | null
          created_at?: string
          device_type?: string | null
          funnel_step: string
          id?: string
          previous_step?: string | null
          session_id?: string | null
          time_from_previous_step_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          course_id?: string | null
          created_at?: string
          device_type?: string | null
          funnel_step?: string
          id?: string
          previous_step?: string | null
          session_id?: string | null
          time_from_previous_step_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_ads: {
        Row: {
          created_at: string
          id: string
          image_desktop_ar: string | null
          image_desktop_en: string | null
          image_mobile_ar: string | null
          image_mobile_en: string | null
          is_active: boolean
          position: number
          target_url: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_desktop_ar?: string | null
          image_desktop_en?: string | null
          image_mobile_ar?: string | null
          image_mobile_en?: string | null
          is_active?: boolean
          position?: number
          target_url?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_desktop_ar?: string | null
          image_desktop_en?: string | null
          image_mobile_ar?: string | null
          image_mobile_en?: string | null
          is_active?: boolean
          position?: number
          target_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text_ar: string | null
          cta_text_en: string | null
          headline_ar: string | null
          headline_en: string | null
          id: string
          image_url: string
          is_published: boolean
          position: number
          subtitle_ar: string | null
          subtitle_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text_ar?: string | null
          cta_text_en?: string | null
          headline_ar?: string | null
          headline_en?: string | null
          id?: string
          image_url: string
          is_published?: boolean
          position?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text_ar?: string | null
          cta_text_en?: string | null
          headline_ar?: string | null
          headline_en?: string | null
          id?: string
          image_url?: string
          is_published?: boolean
          position?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      infrastructure_metrics: {
        Row: {
          id: string
          metric_type: string
          percentile: string | null
          recorded_at: string
          region: string | null
          sample_count: number | null
          value: number
        }
        Insert: {
          id?: string
          metric_type: string
          percentile?: string | null
          recorded_at?: string
          region?: string | null
          sample_count?: number | null
          value: number
        }
        Update: {
          id?: string
          metric_type?: string
          percentile?: string | null
          recorded_at?: string
          region?: string | null
          sample_count?: number | null
          value?: number
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          lessons_completed: number
          period_start: string
          period_type: string
          quizzes_passed: number
          rank: number | null
          streak_days: number
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          lessons_completed?: number
          period_start: string
          period_type: string
          quizzes_passed?: number
          rank?: number | null
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          lessons_completed?: number
          period_start?: string
          period_type?: string
          quizzes_passed?: number
          rank?: number | null
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_activities: {
        Row: {
          activity_type: string
          created_at: string
          data: Json
          difficulty_level: number
          id: string
          is_published: boolean
          lesson_id: string
          position: number
          time_limit_seconds: number | null
          title: string
          title_ar: string | null
          updated_at: string
          xp_reward: number
        }
        Insert: {
          activity_type: string
          created_at?: string
          data?: Json
          difficulty_level?: number
          id?: string
          is_published?: boolean
          lesson_id: string
          position?: number
          time_limit_seconds?: number | null
          title: string
          title_ar?: string | null
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          activity_type?: string
          created_at?: string
          data?: Json
          difficulty_level?: number
          id?: string
          is_published?: boolean
          lesson_id?: string
          position?: number
          time_limit_seconds?: number | null
          title?: string
          title_ar?: string | null
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_discussions: {
        Row: {
          admin_reply: string | null
          admin_reply_ar: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_featured: boolean
          lesson_id: string
          question: string
          question_ar: string | null
          replied_at: string | null
          replied_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_ar?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          lesson_id: string
          question: string
          question_ar?: string | null
          replied_at?: string | null
          replied_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_ar?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          lesson_id?: string
          question?: string
          question_ar?: string | null
          replied_at?: string | null
          replied_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_discussions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          is_completed: boolean
          last_watched_at: string | null
          lesson_id: string
          user_id: string
          watch_time_seconds: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          last_watched_at?: string | null
          lesson_id: string
          user_id: string
          watch_time_seconds?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          last_watched_at?: string | null
          lesson_id?: string
          user_id?: string
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          resource_type: string
          resource_url: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          resource_type?: string
          resource_url: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          resource_type?: string
          resource_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          content_html: string | null
          content_html_ar: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          duration_minutes: number | null
          id: string
          is_free: boolean
          is_published: boolean
          position: number
          title: string
          title_ar: string | null
          updated_at: string
          video_provider: string | null
          video_thumbnail: string | null
          video_url: string | null
        }
        Insert: {
          chapter_id: string
          content_html?: string | null
          content_html_ar?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          position?: number
          title: string
          title_ar?: string | null
          updated_at?: string
          video_provider?: string | null
          video_thumbnail?: string | null
          video_url?: string | null
        }
        Update: {
          chapter_id?: string
          content_html?: string | null
          content_html_ar?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          position?: number
          title?: string
          title_ar?: string | null
          updated_at?: string
          video_provider?: string | null
          video_thumbnail?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          course_id: string | null
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          payment_method: string
          reference_number: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          payment_method: string
          reference_number?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reference_number?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          bio: string | null
          created_at: string
          experience_years: number
          fees_per_hour: number
          id: string
          is_available: boolean
          license_type: string | null
          motorbike_brand: string | null
          motorbike_type: string
          payout_status: string | null
          rating: number | null
          revenue_share_percentage: number | null
          specializations: string[] | null
          total_students: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          fees_per_hour?: number
          id?: string
          is_available?: boolean
          license_type?: string | null
          motorbike_brand?: string | null
          motorbike_type: string
          payout_status?: string | null
          rating?: number | null
          revenue_share_percentage?: number | null
          specializations?: string[] | null
          total_students?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          fees_per_hour?: number
          id?: string
          is_available?: boolean
          license_type?: string | null
          motorbike_brand?: string | null
          motorbike_type?: string
          payout_status?: string | null
          rating?: number | null
          revenue_share_percentage?: number | null
          specializations?: string[] | null
          total_students?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_view_events: {
        Row: {
          created_at: string
          id: string
          page_path: string
          page_title: string | null
          referrer: string | null
          scroll_depth_percentage: number | null
          session_id: string | null
          time_on_page_seconds: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth_percentage?: number | null
          session_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth_percentage?: number | null
          session_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_view_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bike_brand: string | null
          bike_model: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          engine_size_cc: number | null
          experience_level: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          postal_code: string | null
          profile_complete: boolean
          rider_nickname: string | null
          riding_experience_years: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bike_brand?: string | null
          bike_model?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          engine_size_cc?: number | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          profile_complete?: boolean
          rider_nickname?: string | null
          riding_experience_years?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bike_brand?: string | null
          bike_model?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          engine_size_cc?: number | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          profile_complete?: boolean
          rider_nickname?: string | null
          riding_experience_years?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      realtime_presence: {
        Row: {
          current_lesson_id: string | null
          current_page: string | null
          id: string
          is_watching_video: boolean | null
          last_heartbeat_at: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          current_lesson_id?: string | null
          current_page?: string | null
          id?: string
          is_watching_video?: boolean | null
          last_heartbeat_at?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          current_lesson_id?: string | null
          current_page?: string | null
          id?: string
          is_watching_video?: boolean | null
          last_heartbeat_at?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realtime_presence_current_lesson_id_fkey"
            columns: ["current_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_analytics: {
        Row: {
          amount: number
          cohort_month: string | null
          course_id: string | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          payment_id: string | null
          user_id: string
          user_lifetime_day: number | null
        }
        Insert: {
          amount: number
          cohort_month?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          payment_id?: string | null
          user_id: string
          user_lifetime_day?: number | null
        }
        Update: {
          amount?: number
          cohort_month?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          payment_id?: string | null
          user_id?: string
          user_lifetime_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_analytics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_analytics_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "manual_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          course_id: string | null
          created_at: string
          description: string
          description_ar: string | null
          first_response_at: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          subject_ar: string | null
          ticket_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          course_id?: string | null
          created_at?: string
          description: string
          description_ar?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          subject_ar?: string | null
          ticket_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string
          description_ar?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          subject_ar?: string | null
          ticket_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tap_charges: {
        Row: {
          amount: number
          card_brand: string | null
          card_last_four: string | null
          charge_id: string | null
          course_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          device_info: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          metadata: Json | null
          payment_method: string | null
          status: string
          tap_response: Json | null
          updated_at: string
          user_id: string
          webhook_verified: boolean | null
        }
        Insert: {
          amount: number
          card_brand?: string | null
          card_last_four?: string | null
          charge_id?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_info?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json | null
          payment_method?: string | null
          status?: string
          tap_response?: Json | null
          updated_at?: string
          user_id: string
          webhook_verified?: boolean | null
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last_four?: string | null
          charge_id?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_info?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: string
          tap_response?: Json | null
          updated_at?: string
          user_id?: string
          webhook_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tap_charges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          passed: boolean | null
          score: number | null
          started_at: string
          test_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          test_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "chapter_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          options: Json
          points: number
          position: number
          question: string
          question_ar: string | null
          question_type: string
          test_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          options?: Json
          points?: number
          position?: number
          question: string
          question_ar?: string | null
          question_type?: string
          test_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          options?: Json
          points?: number
          position?: number
          question?: string
          question_ar?: string | null
          question_type?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "chapter_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_internal_note: boolean
          message: string
          message_ar: string | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal_note?: boolean
          message: string
          message_ar?: string | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal_note?: boolean
          message?: string
          message_ar?: string | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_courses: {
        Row: {
          available_schedule: Json | null
          created_at: string
          duration_hours: number
          id: string
          location: string
          price: number
          services: string[] | null
          trainer_id: string
          training_id: string
        }
        Insert: {
          available_schedule?: Json | null
          created_at?: string
          duration_hours?: number
          id?: string
          location?: string
          price?: number
          services?: string[] | null
          trainer_id: string
          training_id: string
        }
        Update: {
          available_schedule?: Json | null
          created_at?: string
          duration_hours?: number
          id?: string
          location?: string
          price?: number
          services?: string[] | null
          trainer_id?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_courses_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_courses_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          rating: number
          student_name: string
          trainer_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          student_name?: string
          trainer_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          student_name?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_reviews_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          bike_type: string
          bio_ar: string
          bio_en: string
          city: string
          country: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          photo_url: string | null
          services: string[] | null
          status: Database["public"]["Enums"]["trainer_status"]
          years_of_experience: number
        }
        Insert: {
          bike_type?: string
          bio_ar?: string
          bio_en?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          photo_url?: string | null
          services?: string[] | null
          status?: Database["public"]["Enums"]["trainer_status"]
          years_of_experience?: number
        }
        Update: {
          bike_type?: string
          bio_ar?: string
          bio_en?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          photo_url?: string | null
          services?: string[] | null
          status?: Database["public"]["Enums"]["trainer_status"]
          years_of_experience?: number
        }
        Relationships: []
      }
      training_students: {
        Row: {
          email: string
          enrolled_at: string
          full_name: string
          id: string
          phone: string
          trainer_id: string
          training_id: string
        }
        Insert: {
          email?: string
          enrolled_at?: string
          full_name?: string
          id?: string
          phone?: string
          trainer_id: string
          training_id: string
        }
        Update: {
          email?: string
          enrolled_at?: string
          full_name?: string
          id?: string
          phone?: string
          trainer_id?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_students_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_students_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          background_image: string | null
          created_at: string
          description_ar: string
          description_en: string
          id: string
          level: Database["public"]["Enums"]["training_level"]
          name_ar: string
          name_en: string
          status: Database["public"]["Enums"]["training_status"]
          type: Database["public"]["Enums"]["training_type"]
        }
        Insert: {
          background_image?: string | null
          created_at?: string
          description_ar?: string
          description_en?: string
          id?: string
          level?: Database["public"]["Enums"]["training_level"]
          name_ar?: string
          name_en?: string
          status?: Database["public"]["Enums"]["training_status"]
          type?: Database["public"]["Enums"]["training_type"]
        }
        Update: {
          background_image?: string | null
          created_at?: string
          description_ar?: string
          description_en?: string
          id?: string
          level?: Database["public"]["Enums"]["training_level"]
          name_ar?: string
          name_en?: string
          status?: Database["public"]["Enums"]["training_status"]
          type?: Database["public"]["Enums"]["training_type"]
        }
        Relationships: []
      }
      user_activity_attempts: {
        Row: {
          activity_id: string
          answers: Json
          attempt_number: number
          combo_applied: number
          completed_at: string
          id: string
          max_score: number
          passed: boolean
          score: number
          time_taken_seconds: number | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          activity_id: string
          answers?: Json
          attempt_number?: number
          combo_applied?: number
          completed_at?: string
          id?: string
          max_score?: number
          passed?: boolean
          score?: number
          time_taken_seconds?: number | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          activity_id?: string
          answers?: Json
          attempt_number?: number
          combo_applied?: number
          completed_at?: string
          id?: string
          max_score?: number
          passed?: boolean
          score?: number
          time_taken_seconds?: number | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lesson_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lesson_activities_student"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_timeline: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          description_ar: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          title: string
          title_ar: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          title: string
          title_ar?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          title?: string
          title_ar?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "achievement_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_course_statuses: {
        Row: {
          course_id: string
          course_name: string
          created_at: string
          id: string
          order_status: string
          status_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          course_name?: string
          created_at?: string
          id?: string
          order_status?: string
          status_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          course_name?: string
          created_at?: string
          id?: string
          order_status?: string
          status_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_course_statuses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_progress: {
        Row: {
          challenge_id: string
          claimed_reward: boolean
          completed: boolean
          completed_at: string | null
          created_at: string
          current_value: number
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_reward?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_reward?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_engagement_scores: {
        Row: {
          churn_risk_score: number | null
          created_at: string
          drop_off_recovery_score: number | null
          engagement_score: number | null
          id: string
          lesson_completion_score: number | null
          lessons_completed: number | null
          quizzes_taken: number | null
          return_frequency_score: number | null
          score_date: string
          sessions_count: number | null
          speed_stability_score: number | null
          total_watch_time_minutes: number | null
          user_id: string
          watch_consistency_score: number | null
        }
        Insert: {
          churn_risk_score?: number | null
          created_at?: string
          drop_off_recovery_score?: number | null
          engagement_score?: number | null
          id?: string
          lesson_completion_score?: number | null
          lessons_completed?: number | null
          quizzes_taken?: number | null
          return_frequency_score?: number | null
          score_date?: string
          sessions_count?: number | null
          speed_stability_score?: number | null
          total_watch_time_minutes?: number | null
          user_id: string
          watch_consistency_score?: number | null
        }
        Update: {
          churn_risk_score?: number | null
          created_at?: string
          drop_off_recovery_score?: number | null
          engagement_score?: number | null
          id?: string
          lesson_completion_score?: number | null
          lessons_completed?: number | null
          quizzes_taken?: number | null
          return_frequency_score?: number | null
          score_date?: string
          sessions_count?: number | null
          speed_stability_score?: number | null
          total_watch_time_minutes?: number | null
          user_id?: string
          watch_consistency_score?: number | null
        }
        Relationships: []
      }
      user_gamification: {
        Row: {
          coins: number
          combo_multiplier: number
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          streak_freeze_count: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          combo_multiplier?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          streak_freeze_count?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          combo_multiplier?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          streak_freeze_count?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mistake_events: {
        Row: {
          chapter_id: string | null
          concept_area: string
          context_data: Json | null
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          mistake_type: string
          situation_type: string | null
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          concept_area: string
          context_data?: Json | null
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          mistake_type: string
          situation_type?: string | null
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          concept_area?: string
          context_data?: Json | null
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          mistake_type?: string
          situation_type?: string | null
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mistake_events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mistake_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mistake_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mistake_patterns: {
        Row: {
          concept_area: string
          created_at: string
          decay_factor: number
          id: string
          is_active: boolean
          last_occurrence_at: string
          occurrence_count: number
          pattern_type: string
          situation_type: string | null
          strength_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_area: string
          created_at?: string
          decay_factor?: number
          id?: string
          is_active?: boolean
          last_occurrence_at?: string
          occurrence_count?: number
          pattern_type: string
          situation_type?: string | null
          strength_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_area?: string
          created_at?: string
          decay_factor?: number
          id?: string
          is_active?: boolean
          last_occurrence_at?: string
          occurrence_count?: number
          pattern_type?: string
          situation_type?: string | null
          strength_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reinforcement_queue: {
        Row: {
          content_data: Json | null
          created_at: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          is_delivered: boolean
          is_dismissed: boolean
          pattern_id: string | null
          priority: number
          reinforcement_type: string
          target_chapter_id: string | null
          target_lesson_id: string | null
          user_id: string
        }
        Insert: {
          content_data?: Json | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_delivered?: boolean
          is_dismissed?: boolean
          pattern_id?: string | null
          priority?: number
          reinforcement_type: string
          target_chapter_id?: string | null
          target_lesson_id?: string | null
          user_id: string
        }
        Update: {
          content_data?: Json | null
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_delivered?: boolean
          is_dismissed?: boolean
          pattern_id?: string | null
          priority?: number
          reinforcement_type?: string
          target_chapter_id?: string | null
          target_lesson_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reinforcement_queue_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "user_mistake_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reinforcement_queue_target_chapter_id_fkey"
            columns: ["target_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reinforcement_queue_target_lesson_id_fkey"
            columns: ["target_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          os: string | null
          page_views: number | null
          screen_height: number | null
          screen_width: number | null
          session_token: string
          started_at: string
          timezone: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          os?: string | null
          page_views?: number | null
          screen_height?: number | null
          screen_width?: number | null
          session_token: string
          started_at?: string
          timezone?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          os?: string | null
          page_views?: number | null
          screen_height?: number | null
          screen_width?: number | null
          session_token?: string
          started_at?: string
          timezone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_skill_proficiency: {
        Row: {
          avg_response_time_ms: number | null
          chapter_id: string | null
          correct_attempts: number
          course_id: string
          created_at: string
          difficulty_level: number
          id: string
          last_assessed_at: string | null
          proficiency_score: number
          skill_area: string
          total_attempts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_response_time_ms?: number | null
          chapter_id?: string | null
          correct_attempts?: number
          course_id: string
          created_at?: string
          difficulty_level?: number
          id?: string
          last_assessed_at?: string | null
          proficiency_score?: number
          skill_area: string
          total_attempts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_response_time_ms?: number | null
          chapter_id?: string | null
          correct_attempts?: number
          course_id?: string
          created_at?: string
          difficulty_level?: number
          id?: string
          last_assessed_at?: string | null
          proficiency_score?: number
          skill_area?: string
          total_attempts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_proficiency_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skill_proficiency_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      video_playback_events: {
        Row: {
          buffering_duration_ms: number | null
          created_at: string
          event_type: string
          id: string
          lesson_id: string
          metadata: Json | null
          playback_speed: number | null
          quality_level: string | null
          session_id: string | null
          user_id: string
          video_duration_seconds: number | null
          video_position_seconds: number | null
        }
        Insert: {
          buffering_duration_ms?: number | null
          created_at?: string
          event_type: string
          id?: string
          lesson_id: string
          metadata?: Json | null
          playback_speed?: number | null
          quality_level?: string | null
          session_id?: string | null
          user_id: string
          video_duration_seconds?: number | null
          video_position_seconds?: number | null
        }
        Update: {
          buffering_duration_ms?: number | null
          created_at?: string
          event_type?: string
          id?: string
          lesson_id?: string
          metadata?: Json | null
          playback_speed?: number | null
          quality_level?: string | null
          session_id?: string | null
          user_id?: string
          video_duration_seconds?: number | null
          video_position_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_playback_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_playback_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_behavior: {
        Row: {
          completion_percentage: number
          course_id: string
          created_at: string
          id: string
          last_position_seconds: number
          lesson_id: string
          rewatched_segments: Json
          skipped_segments: Json
          total_watched_seconds: number
          updated_at: string
          user_id: string
          video_duration_seconds: number
        }
        Insert: {
          completion_percentage?: number
          course_id: string
          created_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id: string
          rewatched_segments?: Json
          skipped_segments?: Json
          total_watched_seconds?: number
          updated_at?: string
          user_id: string
          video_duration_seconds?: number
        }
        Update: {
          completion_percentage?: number
          course_id?: string
          created_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id?: string
          rewatched_segments?: Json
          skipped_segments?: Json
          total_watched_seconds?: number
          updated_at?: string
          user_id?: string
          video_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_behavior_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_watch_behavior_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_sessions: {
        Row: {
          average_playback_speed: number | null
          buffering_events: number | null
          completed: boolean | null
          completion_percentage: number | null
          device_type: string | null
          ended_at: string | null
          id: string
          ip_address: string | null
          lesson_id: string
          max_position_reached_seconds: number | null
          pause_count: number | null
          rewatched_segments: Json | null
          rewind_count: number | null
          seek_count: number | null
          session_id: string | null
          skipped_segments: Json | null
          speed_changes: number | null
          started_at: string
          total_buffering_time_ms: number | null
          total_watch_time_seconds: number | null
          user_id: string
          video_duration_seconds: number | null
        }
        Insert: {
          average_playback_speed?: number | null
          buffering_events?: number | null
          completed?: boolean | null
          completion_percentage?: number | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          lesson_id: string
          max_position_reached_seconds?: number | null
          pause_count?: number | null
          rewatched_segments?: Json | null
          rewind_count?: number | null
          seek_count?: number | null
          session_id?: string | null
          skipped_segments?: Json | null
          speed_changes?: number | null
          started_at?: string
          total_buffering_time_ms?: number | null
          total_watch_time_seconds?: number | null
          user_id: string
          video_duration_seconds?: number | null
        }
        Update: {
          average_playback_speed?: number | null
          buffering_events?: number | null
          completed?: boolean | null
          completion_percentage?: number | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          lesson_id?: string
          max_position_reached_seconds?: number | null
          pause_count?: number | null
          rewatched_segments?: Json | null
          rewind_count?: number | null
          seek_count?: number | null
          session_id?: string | null
          skipped_segments?: Json | null
          speed_changes?: number | null
          started_at?: string
          total_buffering_time_ms?: number | null
          total_watch_time_seconds?: number | null
          user_id?: string
          video_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          multiplier: number
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          multiplier?: number
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          multiplier?: number
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      lesson_activities_student: {
        Row: {
          activity_type: string | null
          created_at: string | null
          data: Json | null
          difficulty_level: number | null
          id: string | null
          is_published: boolean | null
          lesson_id: string | null
          position: number | null
          time_limit_seconds: number | null
          title: string | null
          title_ar: string | null
          updated_at: string | null
          xp_reward: number | null
        }
        Insert: {
          activity_type?: string | null
          created_at?: string | null
          data?: never
          difficulty_level?: number | null
          id?: string | null
          is_published?: boolean | null
          lesson_id?: string | null
          position?: number | null
          time_limit_seconds?: number | null
          title?: string | null
          title_ar?: string | null
          updated_at?: string | null
          xp_reward?: number | null
        }
        Update: {
          activity_type?: string | null
          created_at?: string | null
          data?: never
          difficulty_level?: number | null
          id?: string | null
          is_published?: boolean | null
          lesson_id?: string | null
          position?: number | null
          time_limit_seconds?: number | null
          title?: string | null
          title_ar?: string | null
          updated_at?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions_student: {
        Row: {
          created_at: string | null
          id: string | null
          options: Json | null
          points: number | null
          position: number | null
          question: string | null
          question_ar: string | null
          question_type: string | null
          test_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          options?: Json | null
          points?: number | null
          position?: number | null
          question?: string | null
          question_ar?: string | null
          question_type?: string | null
          test_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          options?: Json | null
          points?: number | null
          position?: number | null
          question?: string | null
          question_ar?: string | null
          question_type?: string | null
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "chapter_tests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_xp_secure: {
        Args: {
          p_amount: number
          p_description?: string
          p_description_ar?: string
          p_source_id?: string
          p_source_type: string
        }
        Returns: Json
      }
      award_badge_secure: { Args: { p_badge_id: string }; Returns: Json }
      check_google_provider: { Args: { p_email: string }; Returns: boolean }
      get_all_user_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_auth_providers: { Args: { p_email: string }; Returns: Json }
      get_email_by_phone: { Args: { p_phone: string }; Returns: string }
      get_user_course_statuses: {
        Args: { p_user_id: string }
        Returns: {
          courses_json: string
          total_purchased: number
        }[]
      }
      grade_lesson_activity: {
        Args: { p_activity_id: string; p_user_answers: string[] }
        Returns: {
          attempt_number: number
          is_correct: boolean
          xp_earned: number
        }[]
      }
      grade_test_attempt: {
        Args: { p_test_id: string; p_user_answers: Json }
        Returns: {
          correct_count: number
          passed: boolean
          score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: {
          p_charge_id: string
          p_coupon_id: string
          p_course_id: string
          p_discount_amount: number
          p_final_amount: number
          p_order_id: string
          p_original_amount: number
          p_user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      upsert_course_status: {
        Args: {
          p_course_id: string
          p_course_name: string
          p_order_status: string
          p_user_id: string
        }
        Returns: {
          courses_json: string
          total_purchased: number
        }[]
      }
      validate_and_apply_coupon: {
        Args: {
          p_code: string
          p_course_id?: string
          p_original_amount?: number
          p_user_id: string
        }
        Returns: {
          coupon_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
          error_message: string
          final_amount: number
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "academy_admin"
        | "instructor"
        | "moderator"
        | "finance"
        | "support"
        | "student"
      ticket_category:
        | "technical"
        | "billing"
        | "course_content"
        | "account"
        | "refund"
        | "certificate"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_response"
        | "resolved"
        | "closed"
      trainer_status: "active" | "inactive"
      training_level: "beginner" | "intermediate" | "advanced"
      training_status: "active" | "archived"
      training_type: "theory" | "practical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "academy_admin",
        "instructor",
        "moderator",
        "finance",
        "support",
        "student",
      ],
      ticket_category: [
        "technical",
        "billing",
        "course_content",
        "account",
        "refund",
        "certificate",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_response",
        "resolved",
        "closed",
      ],
      trainer_status: ["active", "inactive"],
      training_level: ["beginner", "intermediate", "advanced"],
      training_status: ["active", "archived"],
      training_type: ["theory", "practical"],
    },
  },
} as const
