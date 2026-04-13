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
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) => (
  <div className={`flex items-start gap-2 ${className}`}>
    {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium break-all">{value || "-"}</div>
    </div>
  </div>
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
            <div className="space-y-5">
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
                  <DetailRow icon={Mail} label={isRTL ? "البريد الإلكتروني" : "Email"} value={payment.customer_email} />
                  <DetailRow
                    icon={Phone}
                    label={isRTL ? "الهاتف" : "Phone"}
                    value={payment.customer_phone || payment.profile?.phone}
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

              {payment.source === "training_booking" && payment.training_booking_meta && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-3">{isRTL ? "حجز التدريب" : "Training booking"}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow
                        label={isRTL ? "التدريب" : "Training"}
                        value={
                          isRTL
                            ? payment.training_booking_meta.training_name_ar ||
                              payment.training_booking_meta.training_name_en
                            : payment.training_booking_meta.training_name_en ||
                              payment.training_booking_meta.training_name_ar
                        }
                      />
                      <DetailRow
                        label={isRTL ? "المدرب" : "Trainer"}
                        value={
                          isRTL
                            ? payment.training_booking_meta.trainer_name_ar ||
                              payment.training_booking_meta.trainer_name_en
                            : payment.training_booking_meta.trainer_name_en ||
                              payment.training_booking_meta.trainer_name_ar
                        }
                      />
                      <DetailRow
                        label={isRTL ? "حالة الحجز" : "Booking status"}
                        value={payment.training_booking_meta.booking_status}
                      />
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-3">{isRTL ? "تفاصيل الدفع" : "Payment Details"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const breakdown = getPriceBreakdown(payment);
                    if (breakdown.isTrainingBooking) {
                      const trainerShare = breakdown.trainingTrainerSar ?? breakdown.originalAmount ?? 0;
                      return (
                        <>
                          <DetailRow
                            label={isRTL ? "حصة المدرب (أساس السعر)" : "Trainer share (listed price)"}
                            value={`${trainerShare.toFixed(2)} ${payment.currency}`}
                          />
                          <DetailRow
                            label={isRTL ? "عمولة بايكرز (قبل الضريبة)" : "Bikerz commission (ex VAT)"}
                            value={`${(breakdown.trainingPlatformCommissionSar ?? 0).toFixed(2)} ${payment.currency}`}
                          />
                          <DetailRow
                            label={isRTL ? "المجموع قبل ضريبة القيمة المضافة" : "Subtotal before VAT"}
                            value={`${(breakdown.trainingSubtotalBeforeVatSar ?? breakdown.amountBeforeVAT).toFixed(2)} ${payment.currency}`}
                          />
                          <DetailRow
                            label={
                              isRTL
                                ? `ضريبة القيمة المضافة (${breakdown.vatPct || 15}%)`
                                : `VAT (${breakdown.vatPct || 15}%)`
                            }
                            value={`${breakdown.vatAmount.toFixed(2)} ${payment.currency}`}
                          />
                          <DetailRow
                            label={isRTL ? "إجمالي المدفوع" : "Total charged"}
                            value={
                              <span className="font-semibold">
                                {payment.amount.toFixed(2)} {payment.currency}
                              </span>
                            }
                          />
                        </>
                      );
                    }
                    return (
                      <>
                        {breakdown.originalAmount && (
                          <DetailRow
                            label={isRTL ? "السعر الأصلي" : "Original Price"}
                            value={`${breakdown.originalAmount.toFixed(2)} ${payment.currency}`}
                          />
                        )}
                        {breakdown.courseDiscount > 0 && (
                          <DetailRow
                            label={isRTL ? "خصم الدورة" : "Course Discount"}
                            value={
                              <span className="text-green-500">
                                -{breakdown.courseDiscount.toFixed(2)} {payment.currency}
                              </span>
                            }
                          />
                        )}
                        {breakdown.couponDiscount > 0 && (
                          <DetailRow
                            label={isRTL ? "خصم الكوبون" : "Coupon Discount"}
                            value={
                              <span className="text-green-500">
                                -{breakdown.couponDiscount.toFixed(2)} {payment.currency}
                                {breakdown.couponCode && (
                                  <span className="text-muted-foreground ms-1">({breakdown.couponCode})</span>
                                )}
                              </span>
                            }
                          />
                        )}
                        <DetailRow
                          label={isRTL ? "المبلغ قبل الضريبة" : "Amount Before VAT"}
                          value={`${breakdown.amountBeforeVAT.toFixed(2)} ${payment.currency}`}
                        />
                        <DetailRow
                          label={
                            isRTL
                              ? `ضريبة القيمة المضافة (${breakdown.hasVat ? breakdown.vatPct || 15 : 0}%)`
                              : `VAT (${breakdown.hasVat ? breakdown.vatPct || 15 : 0}%)`
                          }
                          value={`${breakdown.vatAmount.toFixed(2)} ${payment.currency}`}
                        />
                        <DetailRow
                          label={isRTL ? "المبلغ بعد الضريبة" : "Amount After VAT"}
                          value={
                            <span className="font-semibold">
                              {payment.amount.toFixed(2)} {payment.currency}
                            </span>
                          }
                        />
                      </>
                    );
                  })()}
                  <DetailRow
                    label={isRTL ? "إجمالي المحصّل" : "Total Charged"}
                    value={
                      <span className="text-base font-bold">
                        {payment.amount.toFixed(2)} {payment.currency}
                      </span>
                    }
                  />
                  <DetailRow label={isRTL ? "العملة" : "Currency"} value={payment.currency} />
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
                    />
                  )}

                  {payment.source === "tap" && (
                    <>
                      <DetailRow
                        label={isRTL ? "تم التحقق من الويب هوك" : "Webhook Verified"}
                        value={
                          payment.webhook_verified ? (
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-500 border-green-500/20 text-xs"
                            >
                              ✓ {isRTL ? "نعم" : "Yes"}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs"
                            >
                              {isRTL ? "لا" : "No"}
                            </Badge>
                          )
                        }
                      />
                      {payment.device_info && (
                        <DetailRow
                          label={isRTL ? "جهاز المستخدم" : "User Device"}
                          value={<span className="text-xs font-mono">{payment.device_info}</span>}
                        />
                      )}
                    </>
                  )}

                  {payment.source === "manual" && payment.reference_number && (
                    <DetailRow
                      label={isRTL ? "رقم المرجع" : "Reference Number"}
                      value={<span className="font-mono">{payment.reference_number}</span>}
                    />
                  )}

                  <DetailRow
                    label={isRTL ? "التاريخ والوقت" : "Date & Time"}
                    value={format(new Date(payment.created_at), "MMM dd, yyyy — HH:mm:ss")}
                  />
                </div>
              </div>

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
