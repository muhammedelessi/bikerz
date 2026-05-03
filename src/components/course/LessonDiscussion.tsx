import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface Discussion {
  id: string;
  lesson_id: string;
  user_id: string;
  question: string;
  question_ar: string | null;
  is_approved: boolean;
  is_featured: boolean;
  admin_reply: string | null;
  admin_reply_ar: string | null;
  replied_at: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface LessonDiscussionProps {
  lessonId: string;
  lessonTitle: string;
}

const LessonDiscussion: React.FC<LessonDiscussionProps> = ({ lessonId, lessonTitle }) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  // Fetch approved discussions for this lesson
  const { data: discussions = [], isLoading } = useQuery({
    queryKey: ['lesson-discussions', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_discussions')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('is_approved', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Discussion[];
    },
    enabled: !!lessonId,
  });

  // Fetch user's pending questions
  const { data: userPendingQuestions = [] } = useQuery({
    queryKey: ['user-pending-questions', lessonId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('lesson_discussions')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Discussion[];
    },
    enabled: !!lessonId && !!user,
  });

  // Fetch profiles for discussion authors
  const userIds = [...new Set([...discussions, ...userPendingQuestions].map(d => d.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['discussion-profiles', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      if (error) throw error;
      return data as Profile[];
    },
    enabled: userIds.length > 0,
  });

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  // Submit question mutation
  const submitQuestionMutation = useMutation({
    mutationFn: async (questionText: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('lesson_discussions').insert({
        lesson_id: lessonId,
        user_id: user.id,
        question: questionText,
        question_ar: isRTL ? questionText : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pending-questions'] });
      setQuestion('');
      toast.success(
        isRTL
          ? 'تم إرسال سؤالك! سيتم مراجعته قريباً.'
          : 'Your question was submitted! It will be reviewed soon.'
      );
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) {
      toast.error(isRTL ? 'يرجى كتابة سؤال' : 'Please enter a question');
      return;
    }
    if (!user) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      return;
    }
    submitQuestionMutation.mutate(question.trim());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const displayedDiscussions = showAllQuestions ? discussions : discussions.slice(0, 3);
  const hasMoreQuestions = discussions.length > 3;

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {isRTL ? 'أسئلة ونقاشات' : 'Questions & Discussion'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اسأل سؤالاً حول هذا الدرس' : 'Ask a question about this lesson'}
          </p>
        </div>
      </div>

      {/* Submit Question Form */}
      {user && (
        <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isRTL ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
            className="min-h-[100px] bg-background/50 mb-3 resize-none"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={submitQuestionMutation.isPending || !question.trim()}
              size="sm"
            >
              <Send className="w-4 h-4 me-2" />
              {isRTL ? 'إرسال السؤال' : 'Submit Question'}
            </Button>
          </div>
        </div>
      )}

      {/* User's Pending Questions */}
      {userPendingQuestions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {isRTL ? 'أسئلتك قيد المراجعة' : 'Your questions pending review'}
          </h4>
          <div className="space-y-3">
            {userPendingQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <p className="text-sm text-foreground">{isRTL && q.question_ar ? q.question_ar : q.question}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(q.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Discussions */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-border">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : discussions.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence>
            {displayedDiscussions.map((discussion, index) => {
              const profile = getProfile(discussion.user_id);
              return (
                <motion.div
                  key={discussion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border ${
                    discussion.is_featured
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/20 border-border'
                  }`}
                >
                  {discussion.is_featured && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isRTL ? 'سؤال مميز' : 'Featured Question'}
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {profile?.full_name?.charAt(0) || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">
                          {profile?.full_name || (isRTL ? 'مستخدم' : 'User')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(discussion.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {isRTL && discussion.question_ar ? discussion.question_ar : discussion.question}
                      </p>
                    </div>
                  </div>

                  {/* Admin Reply */}
                  {discussion.admin_reply && (
                    <div className="mt-4 ms-12 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-primary">
                          {isRTL ? 'رد الإدارة' : 'Admin Reply'}
                        </span>
                        {discussion.replied_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(discussion.replied_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {isRTL && discussion.admin_reply_ar ? discussion.admin_reply_ar : discussion.admin_reply}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {hasMoreQuestions && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowAllQuestions(!showAllQuestions)}
            >
              {showAllQuestions ? (
                <>
                  <ChevronUp className="w-4 h-4 me-2" />
                  {isRTL ? 'إظهار أقل' : 'Show Less'}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 me-2" />
                  {isRTL ? `عرض الكل (${discussions.length})` : `Show All (${discussions.length})`}
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {isRTL ? 'لا توجد أسئلة حتى الآن. كن أول من يسأل!' : 'No questions yet. Be the first to ask!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LessonDiscussion;
