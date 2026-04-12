import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MoreHorizontal, DollarSign, Clock, CheckCircle, XCircle, Download, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
  type UnifiedPayment,
  normalizeStatus,
  getStatusBadge,
  getSourceBadge,
  getPaymentMethodLabel,
} from "@/pages/admin/adminPaymentsShared";
import { AdminPaymentDetailDialog } from "@/components/admin/payments/AdminPaymentDetailDialog";
import { parseTrainingBookingPaymentBreakdown } from "@/lib/trainingPaymentBreakdown";

type Props = {
  trainerId: string;
  /** When true, show a link to the full dedicated payments page. */
  embed?: boolean;
};

export function TrainerAdminPaymentsSection({ trainerId, embed }: Props) {
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-trainer-payments", trainerId],
    queryFn: async () => {
      const { data: courseRows, error: ce } = await supabase
        .from("trainer_courses")
        .select("id, training_id")
        .eq("trainer_id", trainerId);
      if (ce) throw ce;
      const ids = (courseRows || []).map((c) => c.id);
      if (!ids.length) return [];

      const orFilter = ids.map((id) => `metadata->>trainer_course_id.eq.${id}`).join(",");
      const { data: tapRows, error: te } = await supabase
        .from("tap_charges")
        .select("*")
        .or(orFilter)
        .order("created_at", { ascending: false });
      if (te) throw te;

      const tapData: UnifiedPayment[] = (tapRows || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        course_id: p.course_id,
        training_id: p.training_id,
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
        device_info: (p as { device_info?: string | null }).device_info || null,
      }));

      const userIds = [...new Set(tapData.map((p) => p.user_id))];
      const trainingIds = [...new Set(tapData.map((p) => p.training_id).filter(Boolean))] as string[];

      const [profilesRes, trainingsRes] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from("profiles")
              .select("user_id, full_name, phone, city, country, postal_code, profile_complete")
              .in("user_id", userIds)
          : { data: [] },
        trainingIds.length > 0
          ? supabase.from("trainings").select("id, name_ar, name_en").in("id", trainingIds)
          : { data: [] },
      ]);

      return tapData.map((p) => {
        const tr = p.training_id ? trainingsRes.data?.find((t) => t.id === p.training_id) : null;
        return {
          ...p,
          profile: profilesRes.data?.find((pr: { user_id: string }) => pr.user_id === p.user_id) || null,
          course: tr
            ? {
                title: tr.name_en,
                title_ar: tr.name_ar,
                price: null,
                discount_percentage: null,
              }
            : null,
        };
      });
    },
    enabled: !!trainerId,
  });

  const filteredPayments = payments?.filter((payment) => {
    const displayName = payment.customer_name || payment.profile?.full_name;
    const matchesSearch =
      displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.charge_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customer_email?.toLowerCase().includes(searchQuery.toLowerCase());
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
      "Training",
      "Amount",
      "Currency",
      "Trainer due (SAR)",
      "Bikerz fee+VAT (SAR)",
      "Commission (SAR)",
      "VAT (SAR)",
      "Status",
      "Payment Method",
      "Transaction ID",
      "Source",
      "Device Info",
      "Error Message",
      "Profile Complete",
    ];
    const rows = filteredPayments.map((p) => {
      const displayName = p.customer_name || p.profile?.full_name;
      const trainingLabel = p.course?.title || "";
      const bd = parseTrainingBookingPaymentBreakdown(p.metadata, p.amount);
      return [
        format(new Date(p.created_at), "yyyy-MM-dd HH:mm:ss"),
        displayName || "",
        p.customer_email || "",
        p.customer_phone || p.profile?.phone || "",
        p.profile?.city || "",
        p.profile?.country || "",
        trainingLabel,
        p.amount.toFixed(2),
        p.currency,
        bd ? bd.trainerSar.toFixed(2) : "",
        bd ? bd.bikerzSar.toFixed(2) : "",
        bd?.platformMarkupSar != null ? bd.platformMarkupSar.toFixed(2) : "",
        bd?.vatSar != null ? bd.vatSar.toFixed(2) : "",
        normalizeStatus(p.status, p.source),
        getPaymentMethodLabel(p),
        p.charge_id || "",
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
    a.download = `trainer_payments_${trainerId}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {embed ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <p className="text-sm text-muted-foreground max-w-prose">
            {isRTL
              ? "مدفوعات حجوزات التدريب العملي المرتبطة بهذا المدرب (بطاقة فقط)."
              : "Practical training booking card payments linked to this trainer."}
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to={`/admin/trainers/${trainerId}/payments`}>
                <ExternalLink className="h-4 w-4" />
                {isRTL ? "صفحة المدفوعات الكاملة" : "Full payments page"}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!filteredPayments?.length} className="gap-2">
              <Download className="h-4 w-4" />
              {isRTL ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="outline" onClick={exportToCSV} disabled={!filteredPayments?.length}>
            <Download className="w-4 h-4 me-2" />
            {isRTL ? "تصدير CSV" : "Export CSV"}
          </Button>
        </div>
      )}

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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? "البحث بالاسم أو البريد أو رقم العملية..." : "Search by name, email, or charge ID..."}
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

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "سجل المدفوعات" : "Payment Records"}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "المستخدم" : "User"}</TableHead>
                  <TableHead>{isRTL ? "التدريب" : "Training"}</TableHead>
                  <TableHead className="min-w-[9rem] whitespace-normal">
                    {isRTL ? "تقسيم المبلغ (ريال)" : "Split (SAR)"}
                  </TableHead>
                  <TableHead>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                  <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                  <TableHead>{isRTL ? "طريقة الدفع" : "Method"}</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments?.map((payment) => {
                  const displayName = payment.customer_name || payment.profile?.full_name || "Unknown";
                  const isFailed = normalizeStatus(payment.status, payment.source) === "rejected";
                  const bd = parseTrainingBookingPaymentBreakdown(payment.metadata, payment.amount);
                  return (
                    <TableRow
                      key={payment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{displayName}</span>
                          {payment.customer_email && (
                            <p className="text-xs text-muted-foreground">{payment.customer_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isRTL
                          ? payment.course?.title_ar || payment.course?.title || "—"
                          : payment.course?.title || "—"}
                      </TableCell>
                      <TableCell className="align-top text-xs tabular-nums">
                        {bd ? (
                          <div className="space-y-1 max-w-[14rem]">
                            <div>
                              <span className="text-muted-foreground">{isRTL ? "مدرب: " : "Trainer: "}</span>
                              <span className="font-medium">{bd.trainerSar.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{isRTL ? "بايكرز: " : "Bikerz: "}</span>
                              <span className="font-medium">{bd.bikerzSar.toFixed(2)}</span>
                            </div>
                            {bd.platformMarkupSar != null && bd.vatSar != null ? (
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                {isRTL
                                  ? `عمولة ${bd.platformMarkupSar.toFixed(2)} + ضريبة ${bd.vatSar.toFixed(2)}`
                                  : `Fee ${bd.platformMarkupSar.toFixed(2)} + VAT ${bd.vatSar.toFixed(2)}`}
                              </p>
                            ) : null}
                            <div className="pt-0.5 border-t border-border/50 text-foreground">
                              <span className="text-muted-foreground">{isRTL ? "مجموع: " : "Total: "}</span>
                              <span className="font-semibold">{bd.totalSar.toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
                              }}
                            >
                              <Eye className="w-4 h-4 me-2" />
                              {isRTL ? "عرض التفاصيل" : "View Details"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPayments?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد مدفوعات لهذا المدرب" : "No payments for this trainer"}
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
      />
    </div>
  );
}
