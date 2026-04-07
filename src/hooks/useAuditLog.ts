import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";

export type AuditAction = 
  | 'role_assigned'
  | 'role_removed'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_deleted'
  | 'course_created'
  | 'course_updated'
  | 'course_deleted'
  | 'course_published'
  | 'course_unpublished'
  | 'chapter_created'
  | 'chapter_updated'
  | 'chapter_deleted'
  | 'lesson_created'
  | 'lesson_updated'
  | 'lesson_deleted'
  | 'user_updated'
  | 'settings_updated'
  | 'ticket_status_changed'
  | 'ticket_assigned'
  | 'ticket_priority_changed'
  | 'instructor_updated';

export type EntityType = 
  | 'user'
  | 'role'
  | 'payment'
  | 'course'
  | 'chapter'
  | 'lesson'
  | 'settings'
  | 'ticket'
  | 'instructor';

interface AuditLogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = useCallback(async ({
    action,
    entityType,
    entityId,
    oldData,
    newData
  }: AuditLogParams) => {
    if (!user) {
      console.warn('Audit log: No user authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_audit_logs')
        .insert([{
          action,
          entity_type: entityType,
          entity_id: entityId || null,
          admin_user_id: user.id,
          old_data: (oldData || null) as Json,
          new_data: (newData || null) as Json,
          ip_address: null,
          user_agent: navigator.userAgent
        }]);

      if (error) {
        console.error('Failed to log audit action:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, [user]);

  return { logAction };
};
