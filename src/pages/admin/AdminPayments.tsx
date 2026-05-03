import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminPayments } from '@/hooks/admin/useAdminPayments';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AdminPaymentDetailDialog } from "@/components/admin/payments/AdminPaymentDetailDialog";
import {
  type UnifiedPayment,
  getPaymentMethodLabel,
  getSourceBadge,
  getStatusBadge,
  normalizeStatus,
} from "@/pages/admin/adminPaymentsShared";
import {
  Search,
  MoreHorizontal,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Check,
  X,
  Download,
  CreditCard,
  Banknote,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

const AdminPayments = () => {
  const { useRQ, useRM, queryClient, dbFrom } = useAdminPayments();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<UnifiedPayment | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: payments, isLoading } = useRQ({
    queryKey: ["admin-payments-unified"],
    queryFn: async () => {
      const [manualRes, tapRes, bookingRes] = await Promise.all([
        dbFrom("manual_payments").select("*").order("created_at", { ascending: false }),
        dbFrom("tap_charges").select("*").order("created_at", { ascending: false }),
        supabase
          .from("training_bookings")
          .select(
            `
            id, user_id, training_id, amount, currency, payment_id, payment_status, status, created_at,
            full_name, email, phone,
            trainings(name_ar, name_en),
            trainers(name_ar, name_en)
          `,
          )
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false }),
      ]);

      if (bookingRes.error) {
        console.error("booking payments fetch:", bookingRes.error);
        throw bookingRes.error;
      }

      const manualData: UnifiedPayment[] = (manualRes.data || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        course_id: p.course_id,
        amount: Number(p.amount),
        currency: p.currency || "SAR",
        status: p.status || "pending",
        created_at: p.created_at,
        source: "manual" as const,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        notes: p.notes,
        approved_by: p.approved_by,
        approved_at: p.approved_at,
      }));

      const tapData: UnifiedPayment[] = (tapRes.data || []).map((p) => ({
        ...(() => {
          const metadata = (p.metadata || {}) as Record<string, unknown>;
          const bundleIds = Array.isArray(metadata.bundle_course_ids)
            ? metadata.bundle_course_ids.filter((id): id is string => typeof id === "string")
            : [];
          const toNumber = (value: unknown) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          };
          return {
            bundle_course_ids: bundleIds,
            bundle_discount_pct: toNumber(metadata.bundle_discount_pct),
            bundle_original_price_sar: toNumber(metadata.bundle_original_price_sar),
            bundle_final_price_sar: toNumber(metadata.bundle_final_price_sar),
          };
        })(),
        id: p.id,
        user_id: p.user_id,
        course_id: p.course_id,
        amount: Number(p.amount),
        currency: p.currency || "SAR",
        status: p.status,
        created_at: p.created_at,
        source: "tap" as const,
        charge_id: p.charge_id,
        card_brand: p.card_brand,
        card_last_four: p.card_last_four,
        customer_name: p.customer_name,
        customer_email: p.customer_email,
        customer_phone: p.customer_phone,
        error_message: p.error_message,
        webhook_verified: p.webhook_verified,
        metadata: p.metadata as Record<string, unknown> | null,
        tap_response: p.tap_response as Record<string, unknown> | null,
        payment_method: p.payment_method || "card",
        device_info: (p as any).device_info || null,
      }));

      type BookingJoin = {
        id: string;
        user_id: string;
        training_id: string;
        amount: number | string;
        currency: string;
        payment_id: string | null;
        payment_status: string;
        status: string;
        created_at: string;
        full_name: string;
        email: string;
        phone: string;
        trainings: { name_ar: string; name_en: string } | null;
        trainers: { name_ar: string; name_en: string } | null;
      };

      const bookingRows = (bookingRes.data || []) as BookingJoin[];
      const bookingPayments: UnifiedPayment[] = bookingRows.map((b) => ({
        id: b.id,
        user_id: b.user_id,
        course_id: null,
        training_id: b.training_id,
        amount: Number(b.amount),
        currency: b.currency || "SAR",
        status: b.payment_status,
        created_at: b.created_at,
        source: "training_booking" as const,
        charge_id: b.payment_id,
        customer_name: b.full_name,
        customer_email: b.email,
        customer_phone: b.phone,
        payment_method: "Tap",
        training_booking_meta: {
          booking_status: b.status,
          payment_status: b.payment_status,
          training_name_ar: b.trainings?.name_ar ?? null,
          training_name_en: b.trainings?.name_en ?? null,
          trainer_name_ar: b.trainers?.name_ar ?? null,
          trainer_name_en: b.trainers?.name_en ?? null,
        },
      }));

      const all = [...manualData, ...tapData, ...bookingPayments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const userIds = [...new Set(all.map((p) => p.user_id))];
      const directCourseIds = all.filter((p) => p.course_id).map((p) => p.course_id!);
      const bundleCourseIds = all.flatMap((p) => p.bundle_course_ids || []);
      const courseIds = [...new Set([...directCourseIds, ...bundleCourseIds])];

      const [profilesRes, coursesRes] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from("profiles")
              .select("user_id, full_name, phone, city, country, postal_code, profile_complete")
              .in("user_id", userIds)
          : { data: [] },
        courseIds.length > 0
          ? dbFrom("courses").select("id, title, title_ar, price, discount_percentage").in("id", courseIds)
          : { data: [] },
      ]);

      return all.map((p) => ({
        ...p,
        profile: profilesRes.data?.find((pr: any) => pr.user_id === p.user_id) || null,
        course: coursesRes.data?.find((c: any) => c.id === p.course_id) || null,
        bundle_courses: (p.bundle_course_ids || [])
          .map((bundleCourseId) => coursesRes.data?.find((c: any) => c.id === bundleCourseId) || null)
          .filter(Boolean) as UnifiedPayment["bundle_courses"],
      }));
    },
  });

  const updatePaymentMutation = useRM({
    mutationFn: async ({ paymentId, status, notes }: { paymentId: string; status: string; notes?: string }) => {
      if (!selectedPayment || selectedPayment.source !== "manual") return;
      const updateData: any = { status, notes: notes || null };
      if (status === "approved") {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }
      const { error } = await dbFrom("manual_payments").update(updateData).eq("id", paymentId);
      if (error) throw error;

      if (status === "approved" && selectedPayment?.course_id) {
        const { error: enrollError } = await (supabase as any).rpc("admin_enroll_user", {
          p_user_id: selectedPayment.user_id,
          p_course_id: selectedPayment.course_id,
        });
        if (enrollError && !enrollError.message.includes("duplicate")) throw enrollError;
      }

      await logAction({
        action: status === "approved" ? "payment_approved" : "payment_rejected",
        entityType: "payment",
        entityId: paymentId,
        oldData: { status: selectedPayment?.status },
        newData: { status, notes, amount: selectedPayment?.amount },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments-unified"] });
      setSelectedPayment(null);
      setAdminNotes("");
      toast({
        title: isRTL ? "تم التحديث" : "Updated",
        description: isRTL ? "تم تحديث حالة الدفع بنجاح" : "Payment status updated successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في تحديث الدفع" : "Failed to update payment",
      });
    },
  });

  const deletePaymentMutation = useRM({
    mutationFn: async (paymentId: string) => {
      const { error } = await dbFrom("tap_charges").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments-unified"] });
      setPaymentToDelete(null);
      toast({
        title: isRTL ? "تم الحذف" : "Deleted",
        description: isRTL ? "تم حذف سجل الدفع نهائيًا" : "Payment record was permanently deleted",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل حذف سجل الدفع" : "Failed to delete payment record",
      });
    },
  });

  const filteredPayments = payments?.filter((payment) => {
    const displayName =
      payment.source === "tap" || payment.source === "training_booking"
        ? payment.customer_name || payment.profile?.full_name
        : payment.profile?.full_name;
    const trainingQ =
      payment.source === "training_booking"
        ? `${payment.training_booking_meta?.training_name_ar ?? ""} ${payment.training_booking_meta?.training_name_en ?? ""}`
        : "";
    const matchesSearch =
      displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.charge_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainingQ.toLowerCase().includes(searchQuery.toLowerCase());
    const normalized = normalizeStatus(payment.status, payment.source);
    const matchesStatus = statusFilter === "all" || normalized === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const approvedPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === "approved") || [];
  const pendingPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === "pending") || [];
  const rejectedPayments = payments?.filter((p) => normalizeStatus(p.status, p.source) === "rejected") || [];
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    {
      titleEn: "Total Revenue",
      titleAr: "إجمالي الإيرادات",
      value: `SAR ${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      titleEn: "Pending",
      titleAr: "المعلقة",
      value: pendingPayments.length,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      titleEn: "Approved",
      titleAr: "المعتمدة",
      value: approvedPayments.length,
      icon: CheckCircle,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      titleEn: "Rejected",
      titleAr: "المرفوضة",
      value: rejectedPayments.length,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];


  const exportToCSV = () => {
    if (!filteredPayments?.length) return;
    const headers = [
      "Date",
      "Customer Name",
      "Email",
      "Phone",
      "City",
      "Country",
      "Course",
      "Amount",
      "Currency",
      "Status",
      "Payment Method",
      "Transaction ID",
      "Source",
      "Device Info",
      "Error Message",
      "Profile Complete",
    ];
    const rows = filteredPayments.map((p) => {
      const displayName =
        p.source === "tap" || p.source === "training_booking"
          ? p.customer_name || p.profile?.full_name
          : p.profile?.full_name;
      const courseTitle =
        p.source === "training_booking" && p.training_booking_meta
          ? (isRTL ? p.training_booking_meta.training_name_ar : p.training_booking_meta.training_name_en) || ""
          : p.course?.title || "";
      return [
        format(new Date(p.created_at), "yyyy-MM-dd HH:mm:ss"),
        displayName || "",
        p.customer_email || "",
        p.customer_phone || p.profile?.phone || "",
        p.profile?.city || "",
        p.profile?.country || "",
        courseTitle,
        p.amount.toFixed(2),
        p.currency,
        normalizeStatus(p.status, p.source),
        getPaymentMethodLabel(p),
        p.charge_id || p.reference_number || "",
        p.source,
        p.device_info || "",
        p.error_message || "",
        p.profile?.profile_complete ? "Yes" : "No",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isRTL ? "إدارة المدفوعات" : "Payment Management"}</h1>
            <p className="text-muted-foreground">
              {isRTL ? "جميع المدفوعات — البطاقات واليدوية" : "All payments — card & manual"}
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={!filteredPayments?.length}>
            <Download className="w-4 h-4 me-2" />
            {isRTL ? "تصدير CSV" : "Export CSV"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{isRTL ? stat.titleAr : stat.titleEn}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={
                    isRTL ? "البحث بالاسم أو البريد أو رقم المرجع..." : "Search by name, email, or reference..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="all">{isRTL ? "الكل" : "All"}</TabsTrigger>
                  <TabsTrigger value="pending">{isRTL ? "معلق" : "Pending"}</TabsTrigger>
                  <TabsTrigger value="approved">{isRTL ? "معتمد" : "Approved"}</TabsTrigger>
                  <TabsTrigger value="rejected">{isRTL ? "مرفوض" : "Rejected"}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? "سجل المدفوعات" : "Payment Records"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "المستخدم" : "User"}</TableHead>
                    <TableHead>{isRTL ? "الدورة" : "Course"}</TableHead>
                    <TableHead>{isRTL ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isRTL ? "طريقة الدفع" : "Method"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments?.map((payment) => {
                    const displayName =
                      payment.source === "tap" || payment.source === "training_booking"
                        ? payment.customer_name || payment.profile?.full_name || "Unknown"
                        : payment.profile?.full_name || "Unknown";
                    const courseOrTrainingLabel =
                      payment.source === "training_booking" && payment.training_booking_meta
                        ? isRTL
                          ? payment.training_booking_meta.training_name_ar || payment.training_booking_meta.training_name_en || "N/A"
                          : payment.training_booking_meta.training_name_en || payment.training_booking_meta.training_name_ar || "N/A"
                        : isRTL
                          ? payment.course?.title_ar || payment.course?.title || "N/A"
                          : payment.course?.title || "N/A";
                    const isFailed = normalizeStatus(payment.status, payment.source) === "rejected";
                    return (
                      <TableRow
                        key={`${payment.source}-${payment.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setAdminNotes("");
                        }}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium">{displayName}</span>
                            {payment.customer_email && (
                              <p className="text-xs text-muted-foreground">{payment.customer_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{courseOrTrainingLabel}</TableCell>
                        <TableCell>
                          {payment.amount.toFixed(2)} {payment.currency}
                        </TableCell>
                        <TableCell>{getSourceBadge(payment.source, isRTL)}</TableCell>
                        <TableCell className="capitalize">{getPaymentMethodLabel(payment)}</TableCell>
                        <TableCell>{format(new Date(payment.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(payment.status, payment.source, isRTL)}
                            {isFailed && payment.error_message && (
                              <p className="text-xs text-red-500 max-w-[150px] truncate" title={payment.error_message}>
                                {payment.error_message}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {payment.source === "tap" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentToDelete(payment);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setAdminNotes("");
                                  }}
                                >
                                  <Eye className="w-4 h-4 me-2" />
                                  {isRTL ? "عرض التفاصيل" : "View Details"}
                                </DropdownMenuItem>
                                {payment.source === "manual" && payment.status === "pending" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setAdminNotes("");
                                      }}
                                      className="text-green-600"
                                    >
                                      <Check className="w-4 h-4 me-2" />
                                      {isRTL ? "اعتماد" : "Approve"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setAdminNotes("");
                                      }}
                                      className="text-destructive"
                                    >
                                      <X className="w-4 h-4 me-2" />
                                      {isRTL ? "رفض" : "Reject"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredPayments?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد مدفوعات" : "No payments found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AdminPaymentDetailDialog
          payment={selectedPayment}
          onOpenChange={(open) => {
            if (!open) setSelectedPayment(null);
          }}
          isRTL={isRTL}
          manualActions={
            selectedPayment?.source === "manual" && selectedPayment.status === "pending"
              ? {
                  adminNotes,
                  setAdminNotes,
                  onApprove: () =>
                    updatePaymentMutation.mutate({
                      paymentId: selectedPayment.id,
                      status: "approved",
                      notes: adminNotes,
                    }),
                  onReject: () =>
                    updatePaymentMutation.mutate({
                      paymentId: selectedPayment.id,
                      status: "rejected",
                      notes: adminNotes,
                    }),
                  isPending: updatePaymentMutation.isPending,
                }
              : null
          }
        />

        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>{isRTL ? "تأكيد حذف الدفعة" : "Confirm Payment Deletion"}</AlertDialogTitle>
              <AlertDialogDescription>
                {isRTL
                  ? "هذا الإجراء نهائي وسيتم حذف سجل الدفعة نهائيًا من قاعدة البيانات ولا يمكن التراجع عنه."
                  : "This action is permanent. The payment record will be permanently removed from the database and cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (paymentToDelete) deletePaymentMutation.mutate(paymentToDelete.id);
                }}
              >
                {isRTL ? "تأكيد الحذف" : "Delete Permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;
