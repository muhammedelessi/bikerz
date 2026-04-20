import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminCheckoutPaymentVisits } from "@/hooks/admin/useAdminCheckoutPaymentVisits";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  digitsForWhatsApp,
  formatProfileAddressLine,
  formatProfilePhoneDisplay,
} from "@/lib/profileContactDisplay";

function localDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const AdminCheckoutPaymentVisits: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const [day, setDay] = useState(() => localDateInputValue(new Date()));
  const { data: rows = [], isLoading, isError } = useAdminCheckoutPaymentVisits(day);

  const visitTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [language],
  );

  const sourceLabel = useMemo(
    () => (source: string) => {
      const key = `admin.checkoutVisits.sources.${source}`;
      const translated = t(key);
      return translated === key ? source : translated;
    },
    [t],
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl" dir={isRTL ? "rtl" : "ltr"}>
        <div>
          <h1 className="text-2xl font-bold">{t("admin.checkoutVisits.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.checkoutVisits.subtitle")}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="visit-day">{t("admin.checkoutVisits.pickDay")}</Label>
            <Input id="visit-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-full sm:w-auto sm:max-w-xs" />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("admin.checkoutVisits.totalForDay")}</p>
            <p className="text-2xl font-black tabular-nums">{isLoading ? "—" : rows.length}</p>
          </div>
        </div>

        {isError ? (
          <p className="text-destructive text-sm">{t("common.error")}</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("admin.checkoutVisits.columns.time")}</TableHead>
                  <TableHead>{t("admin.checkoutVisits.columns.user")}</TableHead>
                  <TableHead className="min-w-[160px]">{t("admin.checkoutVisits.columns.address")}</TableHead>
                  <TableHead>{t("admin.checkoutVisits.columns.phone")}</TableHead>
                  <TableHead>{t("admin.checkoutVisits.columns.course")}</TableHead>
                  <TableHead>{t("admin.checkoutVisits.columns.source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>{t("common.loading")}</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("admin.checkoutVisits.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const p = row.profile;
                    const waDigits = digitsForWhatsApp(p?.phone);
                    const phoneLabel = p?.phone ? formatProfilePhoneDisplay(p.phone) : "";
                    const addressLine = p ? formatProfileAddressLine(p.country, p.city, isRTL) : "";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums">
                          {visitTimeFormatter.format(new Date(row.created_at))}
                        </TableCell>
                        <TableCell className="min-w-[140px] max-w-[200px]">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p?.full_name?.trim() || "—"}</p>
                            {p?.rider_nickname?.trim() ? (
                              <p className="text-xs text-muted-foreground truncate" title={p.rider_nickname}>
                                {p.rider_nickname}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                          {addressLine ? <span className="leading-snug">{addressLine}</span> : "—"}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          {phoneLabel ? (
                            <div dir="ltr" className="flex items-center gap-1.5 justify-start flex-wrap">
                              <span className="text-sm tabular-nums tracking-tight">{phoneLabel}</span>
                              {waDigits ? (
                                <a
                                  href={`https://wa.me/${waDigits}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 inline-flex"
                                  title={t("admin.checkoutVisits.whatsappContact")}
                                  aria-label={t("admin.checkoutVisits.whatsappContact")}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10"
                                  >
                                    <svg viewBox="0 0 32 32" className="w-4 h-4" fill="currentColor" aria-hidden>
                                      <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.132 6.744 3.058 9.378L1.058 31.14l5.962-1.966c2.518 1.656 5.518 2.622 8.734 2.622h.008c8.822 0 15.996-7.18 15.996-16.008C31.758 7.176 24.826 0 16.004 0zm9.466 22.616c-.396 1.116-2.328 2.076-3.21 2.21-.882.132-2.004.188-3.234-.204a29.48 29.48 0 01-2.928-1.082c-5.152-2.228-8.516-7.45-8.776-7.798-.258-.348-2.112-2.812-2.112-5.364 0-2.554 1.336-3.808 1.812-4.33.476-.52 1.04-.65 1.386-.65.346 0 .694.004 1 .018.32.014.75-.122 1.172.894.432 1.04 1.466 3.578 1.594 3.836.128.26.214.562.042.906-.172.346-.258.562-.516.866-.258.304-.542.678-.774.91-.258.26-.528.542-.228 1.062.302.52 1.338 2.21 2.874 3.58 1.974 1.76 3.638 2.306 4.158 2.566.52.258.826.216 1.128-.13.304-.346 1.3-1.518 1.646-2.04.346-.52.694-.432 1.172-.258.476.172 3.022 1.424 3.542 1.684.52.258.866.39.994.606.128.214.128 1.244-.268 2.36z" />
                                    </svg>
                                  </Button>
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {row.course ? (isRTL && row.course.title_ar ? row.course.title_ar : row.course.title) : t("admin.checkoutVisits.bundleOrUnknown")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {sourceLabel(row.source)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCheckoutPaymentVisits;
