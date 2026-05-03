import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const PROGRAM_CAP = 500;
const COURSE_ID_SETTING_KEY = 'honda_program_course_id';

type HondaApplicationStatus =
  | 'pending_ai'
  | 'needs_manual_review'
  | 'approved'
  | 'rejected'
  | 'limit_reached';

interface HondaApplication {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  country: string;
  city: string;
  motorcycle_model: string;
  motorcycle_year: number;
  registration_document_path: string;
  ai_attempts: number;
  ai_decision: string | null;
  ai_decision_reason: string | null;
  ai_last_response: Record<string, unknown> | null;
  status: HondaApplicationStatus;
  manual_review_notes: string | null;
  manual_reviewer_id: string | null;
  manual_reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Untyped DB shim — types.ts hasn't been regenerated for the new table yet.
// We isolate the cast here so the rest of the page can stay strongly typed.
const sb = supabase as unknown as {
  from: (table: string) => any;
};

const AdminHondaApplications: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HondaApplicationStatus>('all');
  const [selected, setSelected] = useState<HondaApplication | null>(null);

  // ── Applications list ──────────────────────────────────────────────
  const applicationsQuery = useQuery({
    queryKey: ['admin-honda-applications', statusFilter, search],
    queryFn: async () => {
      let query = sb
        .from('honda_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (search.trim()) {
        // PostgREST `or` filter — match on name, model, or city.
        const q = search.trim().replace(/[%,]/g, '');
        query = query.or(
          `full_name.ilike.%${q}%,motorcycle_model.ilike.%${q}%,city.ilike.%${q}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HondaApplication[];
    },
  });

  // ── Stats (unaffected by search/filter — always reflect real totals) ─
  const statsQuery = useQuery({
    queryKey: ['admin-honda-stats'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('honda_applications')
        .select('status');
      if (error) throw error;
      const rows = (data ?? []) as { status: HondaApplicationStatus }[];
      const counts = {
        total: rows.length,
        approved: 0,
        needs_manual_review: 0,
        rejected: 0,
        pending_ai: 0,
        limit_reached: 0,
      };
      for (const r of rows) {
        counts[r.status] = (counts[r.status] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 30_000,
  });
  const stats = statsQuery.data;

  // ── Course-id setting (admin configures the unlocked course once) ─
  const courseSettingQuery = useQuery({
    queryKey: ['honda-program-course-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', COURSE_ID_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as { course_id?: string } | null)?.course_id ?? '';
    },
  });

  // List of courses to populate the picker.
  const coursesQuery = useQuery({
    queryKey: ['admin-courses-for-honda'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const [savingCourseId, setSavingCourseId] = useState(false);
  const handleCourseIdSave = async (courseId: string) => {
    setSavingCourseId(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          {
            key: COURSE_ID_SETTING_KEY,
            value: { course_id: courseId },
            category: 'honda',
          },
          { onConflict: 'key' },
        );
      if (error) throw error;
      toast.success(isRTL ? 'تم حفظ الكورس المُختار' : 'Course saved');
      await queryClient.invalidateQueries({ queryKey: ['honda-program-course-id'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSavingCourseId(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isRTL ? 'ملاك هوندا' : 'Honda Owners'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? 'إدارة طلبات برنامج Honda والتحقق من الوثائق.'
                  : 'Manage Honda program applications and verifications.'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label={isRTL ? 'الإجمالي' : 'Total'}
            value={stats?.total ?? 0}
            icon={<ShieldCheck className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            label={isRTL ? `معتمد ${stats?.approved ?? 0}/${PROGRAM_CAP}` : `Approved ${stats?.approved ?? 0}/${PROGRAM_CAP}`}
            value={stats?.approved ?? 0}
            tone="success"
            icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
          />
          <StatCard
            label={isRTL ? 'قيد المراجعة' : 'Manual review'}
            value={stats?.needs_manual_review ?? 0}
            tone="warning"
            icon={<Clock className="w-4 h-4 text-amber-600" />}
          />
          <StatCard
            label={isRTL ? 'مرفوض' : 'Rejected'}
            value={stats?.rejected ?? 0}
            tone="destructive"
            icon={<XCircle className="w-4 h-4 text-destructive" />}
          />
          <StatCard
            label={isRTL ? 'البرنامج ممتلئ' : 'Limit reached'}
            value={stats?.limit_reached ?? 0}
            icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
          />
        </div>

        {/* Course-id setting */}
        <Card>
          <CardContent className="py-5 space-y-2">
            <Label className="text-sm font-semibold">
              {isRTL
                ? 'الكورس الذي يُفتح للمعتمدين تلقائياً'
                : 'Course unlocked on approval'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? 'اختر الكورس الذي سيتم تفعيله مجاناً عند قبول طلب ملاك هوندا.'
                : 'Pick the course that auto-enrolls when a Honda application is approved.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={courseSettingQuery.data || ''}
                onValueChange={handleCourseIdSave}
                disabled={savingCourseId || coursesQuery.isLoading}
              >
                <SelectTrigger className="w-full sm:w-[420px]">
                  <SelectValue
                    placeholder={isRTL ? 'اختر الكورس…' : 'Select course…'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(coursesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savingCourseId && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث بالاسم أو المدينة أو الموديل…' : 'Search name, city, model…'}
              className="ps-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All statuses'}</SelectItem>
              <SelectItem value="needs_manual_review">
                {isRTL ? 'قيد المراجعة' : 'Manual review'}
              </SelectItem>
              <SelectItem value="approved">{isRTL ? 'معتمد' : 'Approved'}</SelectItem>
              <SelectItem value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</SelectItem>
              <SelectItem value="pending_ai">
                {isRTL ? 'بانتظار التحقق' : 'Pending AI'}
              </SelectItem>
              <SelectItem value="limit_reached">
                {isRTL ? 'البرنامج ممتلئ' : 'Limit reached'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications table */}
        <Card>
          <CardContent className="p-0">
            {applicationsQuery.isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : applicationsQuery.data?.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {isRTL ? 'لا توجد طلبات.' : 'No applications.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'الموديل' : 'Model'}</TableHead>
                      <TableHead>{isRTL ? 'السنة' : 'Year'}</TableHead>
                      <TableHead>{isRTL ? 'البلد / المدينة' : 'Country / City'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'المحاولات' : 'Attempts'}</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Submitted'}</TableHead>
                      <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(applicationsQuery.data ?? []).map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.full_name}</TableCell>
                        <TableCell>{app.motorcycle_model}</TableCell>
                        <TableCell>{app.motorcycle_year}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {app.country} / {app.city}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={app.status} isRTL={isRTL} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {app.ai_attempts}/3
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(app.created_at), 'd MMM yyyy', {
                            locale: isRTL ? ar : undefined,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(app)}
                          >
                            {isRTL ? 'تفاصيل' : 'Details'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <ApplicationDetailDialog
          application={selected}
          isRTL={isRTL}
          onClose={() => setSelected(null)}
          onMutated={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-honda-applications'] });
            queryClient.invalidateQueries({ queryKey: ['admin-honda-stats'] });
            setSelected(null);
          }}
        />
      )}
    </AdminLayout>
  );
};

// ────────────────────────────────────────────────────────────────────
// Status badge — bilingual + colour-coded.
// ────────────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: HondaApplicationStatus; isRTL: boolean }> = ({
  status,
  isRTL,
}) => {
  const labels: Record<HondaApplicationStatus, [string, string, string]> = {
    pending_ai: ['Pending', 'بانتظار التحقق', 'bg-muted text-muted-foreground'],
    needs_manual_review: ['Manual review', 'مراجعة يدوية', 'bg-amber-500/15 text-amber-700 dark:text-amber-400'],
    approved: ['Approved', 'معتمد', 'bg-green-500/15 text-green-700 dark:text-green-400'],
    rejected: ['Rejected', 'مرفوض', 'bg-destructive/15 text-destructive'],
    limit_reached: ['Limit reached', 'البرنامج ممتلئ', 'bg-amber-500/15 text-amber-700 dark:text-amber-400'],
  };
  const [en, ar, cls] = labels[status] ?? ['', '', ''];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        cls,
      )}
    >
      {isRTL ? ar : en}
    </span>
  );
};

// ────────────────────────────────────────────────────────────────────
// Stat card — small KPI tile.
// ────────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: 'success' | 'warning' | 'destructive';
}> = ({ label, value, icon, tone }) => {
  const toneClass =
    tone === 'success'
      ? 'border-green-500/30 bg-green-500/5'
      : tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/5'
        : tone === 'destructive'
          ? 'border-destructive/30 bg-destructive/5'
          : '';
  return (
    <Card className={toneClass}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────
// Detail dialog — view doc + AI trail + manual approve/reject.
// ────────────────────────────────────────────────────────────────────
const ApplicationDetailDialog: React.FC<{
  application: HondaApplication;
  isRTL: boolean;
  onClose: () => void;
  onMutated: () => void;
}> = ({ application, isRTL, onClose, onMutated }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedLoading, setSignedLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState(application.manual_review_notes ?? '');
  const [acting, setActing] = useState(false);

  // Mint a signed URL on mount so the admin can preview the document.
  // 5-minute TTL is plenty for inspection without persisting public links.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setSignedLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('honda-registrations')
          .createSignedUrl(application.registration_document_path, 300);
        if (error) throw error;
        if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
      } catch (err) {
        console.error('[Honda admin] sign url failed:', err);
        if (!cancelled) toast.error(isRTL ? 'تعذر تحميل المستند' : 'Could not load document');
      } finally {
        if (!cancelled) setSignedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application.registration_document_path, isRTL]);

  const isImage = useMemo(() => {
    const ext = application.registration_document_path.split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
  }, [application.registration_document_path]);

  const performAction = async (action: 'approve' | 'reject') => {
    setActing(true);
    try {
      const sbAny = supabase as unknown as { from: (t: string) => any };
      const { data: userResp } = await supabase.auth.getUser();
      const reviewerId = userResp.user?.id ?? null;

      const updates: Record<string, unknown> = {
        manual_review_notes: adminNotes.trim() || null,
        manual_reviewer_id: reviewerId,
        manual_reviewed_at: new Date().toISOString(),
        status: action === 'approve' ? 'approved' : 'rejected',
      };
      const { error } = await sbAny
        .from('honda_applications')
        .update(updates)
        .eq('id', application.id);
      if (error) throw error;

      toast.success(
        action === 'approve'
          ? isRTL ? 'تم الاعتماد — سيُفتح الكورس للمستخدم.' : 'Approved — course will unlock for the user.'
          : isRTL ? 'تم الرفض' : 'Rejected',
      );
      onMutated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const aiResp = application.ai_last_response;
  const aiContent =
    aiResp && typeof aiResp === 'object'
      ? // OpenAI-shaped: { choices: [{ message: { content: "json string" } }] }
        ((aiResp as Record<string, unknown>).choices as Array<{ message?: { content?: string } }> | undefined)?.[0]
          ?.message?.content
      : null;
  const parsedAi = useMemo(() => {
    if (typeof aiContent !== 'string') return null;
    try {
      return JSON.parse(aiContent) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [aiContent]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRTL ? 'تفاصيل الطلب' : 'Application details'}
          </DialogTitle>
        </DialogHeader>

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label={isRTL ? 'الاسم' : 'Full name'}>{application.full_name}</Field>
          <Field label={isRTL ? 'تاريخ الميلاد' : 'Date of birth'}>
            {application.date_of_birth}
          </Field>
          <Field label={isRTL ? 'البلد' : 'Country'}>{application.country}</Field>
          <Field label={isRTL ? 'المدينة' : 'City'}>{application.city}</Field>
          <Field label={isRTL ? 'الموديل' : 'Model'}>{application.motorcycle_model}</Field>
          <Field label={isRTL ? 'السنة' : 'Year'}>{application.motorcycle_year}</Field>
          <Field label={isRTL ? 'محاولات الذكاء' : 'AI attempts'}>
            {application.ai_attempts} / 3
          </Field>
          <Field label={isRTL ? 'الحالة' : 'Status'}>
            <StatusBadge status={application.status} isRTL={isRTL} />
          </Field>
        </div>

        {/* Document preview */}
        <div className="space-y-2">
          <Label>{isRTL ? 'وثيقة التسجيل' : 'Registration document'}</Label>
          <div className="rounded-xl border border-border overflow-hidden bg-muted/20">
            {signedLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !signedUrl ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {isRTL ? 'لا يمكن تحميل المستند' : 'Could not load the document'}
              </div>
            ) : isImage ? (
              <img
                src={signedUrl}
                alt="Honda registration"
                className="w-full max-h-[480px] object-contain bg-black/5"
              />
            ) : (
              <div className="py-8 px-4 flex flex-col items-center gap-3 text-center">
                <FileText className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'مستند PDF — اضغط للفتح' : 'PDF document — open to view'}
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 me-2" />
                    {isRTL ? 'فتح المستند' : 'Open document'}
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* AI verdict */}
        {parsedAi && (
          <div className="space-y-2">
            <Label>{isRTL ? 'نتيجة الذكاء الاصطناعي' : 'AI verdict'}</Label>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1.5">
              <KV
                label={isRTL ? 'وثيقة تسجيل دراجة' : 'Is registration doc'}
                value={String(parsedAi.is_motorcycle_registration_doc)}
              />
              <KV
                label={isRTL ? 'هوندا' : 'Is Honda'}
                value={String(parsedAi.is_honda)}
              />
              <KV
                label={isRTL ? 'الاسم مطابق' : 'Name matches'}
                value={String(parsedAi.name_matches)}
              />
              <KV
                label={isRTL ? 'الموديل مطابق' : 'Model matches'}
                value={String(parsedAi.model_matches)}
              />
              <KV
                label={isRTL ? 'السنة مطابقة' : 'Year matches'}
                value={String(parsedAi.year_matches)}
              />
              <KV
                label={isRTL ? 'الثقة' : 'Confidence'}
                value={typeof parsedAi.confidence === 'number' ? parsedAi.confidence.toFixed(2) : '—'}
              />
              {parsedAi.reason_en && (
                <p className="pt-1 text-muted-foreground">
                  {isRTL ? (parsedAi.reason_ar as string) : (parsedAi.reason_en as string)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Manual review notes */}
        <div className="space-y-2">
          <Label htmlFor="honda-notes">
            {isRTL ? 'ملاحظات الادمن (اختياري)' : 'Admin notes (optional)'}
          </Label>
          <Textarea
            id="honda-notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            placeholder={
              isRTL
                ? 'سبب القبول أو الرفض، يظهر للمستخدم عند الرفض.'
                : 'Reason for the decision; shown to the applicant on rejection.'
            }
          />
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={acting}>
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
          {application.status !== 'approved' && application.status !== 'rejected' && (
            <div className="flex gap-2 sm:flex-row">
              <Button
                variant="destructive"
                onClick={() => performAction('reject')}
                disabled={acting}
              >
                {acting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <XCircle className="w-4 h-4 me-2" />}
                {isRTL ? 'رفض' : 'Reject'}
              </Button>
              <Button onClick={() => performAction('approve')} disabled={acting}>
                {acting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 me-2" />}
                {isRTL ? 'اعتماد' : 'Approve'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="font-medium">{children}</div>
  </div>
);

const KV: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default AdminHondaApplications;
