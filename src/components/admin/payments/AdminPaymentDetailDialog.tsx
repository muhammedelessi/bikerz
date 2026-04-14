import React from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  User,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  Shield,
  Check,
  X,
  ShoppingBag,
  GraduationCap,
} from "lucide-react";
import {
  type UnifiedPayment,
  getFailureDetails,
  getPaymentMethodLabel,
  getPriceBreakdown,
  getSourceBadge,
} from "@/pages/admin/adminPaymentsShared";

const DetailRow = ({
  label,
  value,
  icon: Icon,
  className = "",
  valueDir,
  labelDir,
  numeric = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  valueDir?: "ltr" | "rtl" | "auto";
  labelDir?: "ltr" | "rtl" | "auto";
  numeric?: boolean;
}) => (
  <div className={`flex items-start gap-2 text-start ${className}`}>
    {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground text-start" dir={labelDir}>{label}</p>
      <div className="text-sm font-medium break-all text-start" dir={valueDir}>
        {numeric ? (
          <span dir="ltr" className="tabular-nums font-medium">
            {value || "-"}
          </span>
        ) : (
          value || "-"
        )}
      </div>
    </div>
  </div>
);

const formatAmount = (amount: number, currency: string) => (
  <span dir="ltr" className="inline-block text-start tabular-nums font-medium">
    {amount.toFixed(2)} {currency}
  </span>
);

export type AdminPaymentDetailManualActions = {
  adminNotes: string;
  setAdminNotes: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
};

type Props = {
  payment: UnifiedPayment | null;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  /** When set and payment is manual pending, show approve/reject UI. */
  manualActions?: AdminPaymentDetailManualActions | null;
};

export function AdminPaymentDetailDialog({ payment, onOpenChange, isRTL, manualActions }: Props) {
  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isRTL ? "تفاصيل الطلب" : "Order Details"}
          </DialogTitle>
          <DialogDescription>
            {payment?.charge_id || payment?.reference_number || payment?.id}
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
            <div dir={isRTL ? "rtl" : "ltr"} className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
              {(() => {
                const failureDetails = getFailureDetails(payment, isRTL);
                if (failureDetails) {
                  return (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-red-500 font-semibold">
                        <AlertTriangle className="w-5 h-5" />
                        {isRTL ? "فشل الدفع" : "Payment Failed"}
                      </div>
                      <p className="text-sm text-red-400 font-medium">{failureDetails.reason}</p>
                      {failureDetails.code && (
                        <p className="text-xs text-red-400/70">
                          {isRTL ? "رمز الخطأ" : "Error Code"}:{" "}
                          <span className="font-mono">{failureDetails.code}</span>
                        </p>
                      )}
                      {failureDetails.tapDeclineMessage &&
                        failureDetails.tapDeclineMessage !== failureDetails.reason && (
                          <p className="text-xs text-red-400/70">
                            {isRTL ? "تفاصيل الرفض" : "Decline Details"}: {failureDetails.tapDeclineMessage}
                          </p>
                        )}
                      {failureDetails.gatewayResponse && (
                        <p className="text-xs text-red-400/70">
                          {isRTL ? "استجابة البوابة" : "Gateway Response"}: {failureDetails.gatewayResponse}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <h4 className="text-sm font-semibold mb-3">{isRTL ? "معلومات العميل" : "Customer Info"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow
                    icon={User}
                    label={isRTL ? "الاسم" : "Name"}
                    value={
                      payment.source === "tap" || payment.source === "training_booking"
                        ? payment.customer_name || payment.profile?.full_name
                        : payment.profile?.full_name
                    }
                  />
                  <DetailRow
                    icon={Mail}
                    label={isRTL ? "البريد الإلكتروني" : "Email"}
                    value={payment.customer_email}
                    valueDir="ltr"
                  />
                  <DetailRow
                    icon={Phone}
                    label={isRTL ? "الهاتف" : "Phone"}
                    value={payment.customer_phone || payment.profile?.phone}
                    valueDir="ltr"
                  />
                  <DetailRow icon={MapPin} label={isRTL ? "المدينة" : "City"} value={payment.profile?.city} />
                  <DetailRow icon={MapPin} label={isRTL ? "الدولة" : "Country"} value={payment.profile?.country} />
                  <DetailRow
                    icon={Shield}
                    label={isRTL ? "حالة الملف الشخصي" : "Profile Status"}
                    value={
                      payment.profile?.profile_complete ? (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-500 border-green-500/20 text-xs"
                        >
                          {isRTL ? "مكتمل" : "Complete"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs"
                        >
                          {isRTL ? "غير مكتمل" : "Incomplete"}
                        </Badge>
                      )
                    }
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  {isRTL ? "المشتريات" : "Purchased Items"}
                </h4>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  {(() => {
                    const breakdown = getPriceBreakdown(payment);
                    if (payment.source === "training_booking" && payment.training_booking_meta) {
                      const trainingName = isRTL
                        ? payment.training_booking_meta.training_name_ar || payment.training_booking_meta.training_name_en
                        : payment.training_booking_meta.training_name_en || payment.training_booking_meta.training_name_ar;
                      const trainerName = isRTL
                        ? payment.training_booking_meta.trainer_name_ar || payment.training_booking_meta.trainer_name_en
                        : payment.training_booking_meta.trainer_name_en || payment.training_booking_meta.trainer_name_ar;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="min-w-0 text-start">
                              <p className="font-medium truncate">{trainingName || "-"}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" />
                                {trainerName || "-"}
                              </p>
                            </div>
                            {formatAmount(payment.amount, payment.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? "الجلسات" : "Sessions"}:{" "}
                            <span className="font-medium">{payment.training_booking_meta.booking_status}</span>
                          </div>
                        </>
                      );
                    }

                    if (breakdown.isBundle) {
                      const bundleCourses = payment.bundle_courses || [];
                      return (
                        <>
                          {bundleCourses.map((course) => {
                            const title = isRTL ? course.title_ar || course.title : course.title || course.title_ar;
                            return (
                              <div key={course.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate text-start">✓ {title || "-"}</span>
                                {formatAmount(Number(course.price || 0), payment.currency)}
                              </div>
                            );
                          })}
                          <Separator />
                          {(breakdown.bundleDiscountPct || 0) > 0 && breakdown.bundleOriginalPriceSar != null && (
                            <div className="flex items-center justify-between gap-2 text-sm text-green-600">
                              <span className="text-start">
                                {isRTL ? "خصم الباقة" : "Bundle discount"} ({(breakdown.bundleDiscountPct || 0).toFixed(0)}%)
                              </span>
                              {formatAmount(
                                -(breakdown.bundleOriginalPriceSar - (breakdown.bundleFinalPriceSar || payment.amount)),
                                payment.currency,
                              )}
                            </div>
                          )}
                          <Separator />
                          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                            <span>{isRTL ? "الإجمالي" : "Total"}</span>
                            {formatAmount(breakdown.bundleFinalPriceSar || payment.amount, payment.currency)}
                          </div>
                        </>
                      );
                    }

                    const courseTitle = isRTL
                      ? payment.course?.title_ar || payment.course?.title
                      : payment.course?.title || payment.course?.title_ar;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-start">✓ {courseTitle || "-"}</span>
                          {formatAmount(breakdown.originalAmount || payment.amount, payment.currency)}
                        </div>
                        {breakdown.courseDiscount > 0 && (
                          <div className="flex items-center justify-between gap-2 text-sm text-green-600">
                            <span className="text-start">
                              {isRTL ? "خصم الدورة" : "Course discount"}
                            </span>
                            {formatAmount(-breakdown.courseDiscount, payment.currency)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3">{isRTL ? "تفصيل الدفع" : "Payment Breakdown"}</h4>
                <div className="space-y-2">
                  {(() => {
                    const breakdown = getPriceBreakdown(payment);
                    if (breakdown.isTrainingBooking) {
                      const trainerShare = breakdown.trainingTrainerSar ?? breakdown.originalAmount ?? 0;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{isRTL ? "حصة المدرب (أساس السعر)" : "Trainer share (listed price)"}</span>
                            {formatAmount(trainerShare, payment.currency)}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{isRTL ? "عمولة بايكرز (قبل الضريبة)" : "Bikerz commission (ex VAT)"}</span>
                            {formatAmount(breakdown.trainingPlatformCommissionSar ?? 0, payment.currency)}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{isRTL ? "المجموع قبل ضريبة القيمة المضافة" : "Subtotal before VAT"}</span>
                            {formatAmount(breakdown.trainingSubtotalBeforeVatSar ?? breakdown.amountBeforeVAT, payment.currency)}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>
                              {isRTL ? `ضريبة القيمة المضافة (${breakdown.vatPct || 15}%)` : `VAT (${breakdown.vatPct || 15}%)`}
                            </span>
                            {breakdown.vatAmount > 0 ? (
                              formatAmount(breakdown.vatAmount, payment.currency)
                            ) : (
                              <span className="text-xs text-muted-foreground" dir={isRTL ? "rtl" : "ltr"}>
                                {isRTL ? "لا تشمل ضريبة" : "VAT not applicable"}
                              </span>
                            )}
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                            <span>{isRTL ? "إجمالي المدفوع" : "Total charged"}</span>
                            {formatAmount(payment.amount, payment.currency)}
                          </div>
                        </>
                      );
                    }
                    return (
                      <>
                        {breakdown.originalAmount && (
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{isRTL ? "السعر الأصلي" : "Original Price"}</span>
                            {formatAmount(breakdown.originalAmount, payment.currency)}
                          </div>
                        )}
                        {breakdown.courseDiscount > 0 && (
                          <div className="flex items-center justify-between gap-3 text-sm text-green-500">
                            <span>{isRTL ? "خصم الدورة" : "Course Discount"}</span>
                            {formatAmount(-breakdown.courseDiscount, payment.currency)}
                          </div>
                        )}
                        {breakdown.couponDiscount > 0 && (
                          <div className="flex items-center justify-between gap-3 text-sm text-green-500">
                            <span>{isRTL ? "خصم الكوبون" : "Coupon Discount"}</span>
                            <span className="inline-flex items-center gap-1">
                              {formatAmount(-breakdown.couponDiscount, payment.currency)}
                              {breakdown.couponCode && <span className="text-muted-foreground">({breakdown.couponCode})</span>}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{isRTL ? "المبلغ قبل الضريبة" : "Amount Before VAT"}</span>
                          {formatAmount(breakdown.amountBeforeVAT, payment.currency)}
                        </div>
                        {breakdown.hasVat ? (
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>
                              {isRTL ? `ضريبة القيمة المضافة (${breakdown.vatPct || 0}%)` : `VAT (${breakdown.vatPct || 0}%)`}
                            </span>
                            {formatAmount(breakdown.vatAmount, payment.currency)}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{isRTL ? "ضريبة القيمة المضافة" : "VAT"}</span>
                            <span className="text-xs text-muted-foreground" dir={isRTL ? "rtl" : "ltr"}>
                              {isRTL ? "لا تشمل ضريبة" : "VAT not applicable"}
                            </span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span>{isRTL ? "المبلغ بعد الضريبة" : "Amount After VAT"}</span>
                          {formatAmount(payment.amount, payment.currency)}
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex items-center justify-between gap-3 text-base font-bold pt-1">
                    <span>{isRTL ? "إجمالي المحصّل" : "Total Charged"}</span>
                    {formatAmount(payment.amount, payment.currency)}
                  </div>
                  <DetailRow label={isRTL ? "العملة" : "Currency"} value={payment.currency} numeric />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3">{isRTL ? "طريقة الدفع والمعاملة" : "Payment Method & Transaction"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow
                    label={isRTL ? "طريقة الدفع" : "Payment Method"}
                    value={getPaymentMethodLabel(payment)}
                  />
                  <DetailRow
                    label={isRTL ? "المصدر" : "Source"}
                    value={getSourceBadge(payment.source, isRTL)}
                  />

                  {(payment.source === "tap" || payment.source === "training_booking") && (
                    <DetailRow
                      label={isRTL ? "رقم العملية" : "Transaction ID"}
                      value={<span className="font-mono text-xs">{payment.charge_id || "-"}</span>}
                      valueDir="ltr"
                    />
                  )}

                  {payment.source === "manual" && payment.reference_number && (
                    <DetailRow
                      label={isRTL ? "رقم المرجع" : "Reference Number"}
                      value={<span className="font-mono">{payment.reference_number}</span>}
                      valueDir="ltr"
                    />
                  )}

                  <DetailRow
                    label={isRTL ? "التاريخ والوقت" : "Date & Time"}
                    value={format(new Date(payment.created_at), "MMM dd, yyyy — HH:mm:ss")}
                    valueDir="ltr"
                  />
                </div>
              </div>

              {(payment.source === "tap" || payment.device_info) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3">{isRTL ? "الويب هوك / معلومات الجهاز" : "Webhook / Device info"}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {payment.source === "tap" && (
                        <DetailRow
                          label={isRTL ? "تم التحقق من الويب هوك" : "Webhook Verified"}
                          value={
                            payment.webhook_verified ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                                ✓ {isRTL ? "نعم" : "Yes"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
                                {isRTL ? "لا" : "No"}
                              </Badge>
                            )
                          }
                        />
                      )}
                      {payment.device_info && (
                        <DetailRow
                          label={isRTL ? "جهاز المستخدم" : "User Device"}
                          value={<span className="text-xs font-mono">{payment.device_info}</span>}
                          valueDir="ltr"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {payment.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{isRTL ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{payment.notes}</p>
                  </div>
                </>
              )}

              {payment.source === "manual" && payment.status === "pending" && manualActions && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm text-muted-foreground">
                      {isRTL ? "ملاحظات المشرف" : "Admin Notes"}
                    </label>
                    <Textarea
                      value={manualActions.adminNotes}
                      onChange={(e) => manualActions.setAdminNotes(e.target.value)}
                      placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={manualActions.onApprove}
                      disabled={manualActions.isPending}
                    >
                      <Check className="w-4 h-4 me-2" />
                      {isRTL ? "اعتماد" : "Approve"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={manualActions.onReject}
                      disabled={manualActions.isPending}
                    >
                      <X className="w-4 h-4 me-2" />
                      {isRTL ? "رفض" : "Reject"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
