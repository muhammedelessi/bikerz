import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useAdminTrainerApplications,
  type AdminTrainerApplicationFilter,
  type AdminTrainerApplicationRow,
} from "@/hooks/useAdminTrainerApplications";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrainerApplicationDetailDialog } from "@/components/admin/trainer/TrainerApplicationDetailDialog";
import { ClipboardList, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

function displayName(row: AdminTrainerApplicationRow): string {
  const p = row.profile?.full_name?.trim();
  if (p) return p;
  const en = row.name_en?.trim();
  if (en) return en;
  const ar = row.name_ar?.trim();
  if (ar) return ar;
  return "—";
}

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400";
  if (status === "approved") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-400";
  if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
  return "border-border";
}

const TrainerApplicationsList: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dateLocale = isRTL ? arLocale : enUS;
  const tableDir = isRTL ? "rtl" : "ltr";

  const [filter, setFilter] = useState<AdminTrainerApplicationFilter>("pending");
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState<AdminTrainerApplicationRow | null>(null);

  const { applications, isLoading, approveApplication, rejectApplication, isApproving, isRejecting } =
    useAdminTrainerApplications(filter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((row) => {
      const name = displayName(row).toLowerCase();
      const phone = (row.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [applications, search]);

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("admin.trainerApplications.title")}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as AdminTrainerApplicationFilter)}
            dir={tableDir}
          >
            <SelectTrigger className="w-full sm:w-[200px]" dir={tableDir}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir={tableDir}>
              <SelectItem value="all">{t("admin.trainerApplications.filters.all")}</SelectItem>
              <SelectItem value="pending">{t("admin.trainerApplications.filters.pending")}</SelectItem>
              <SelectItem value="approved">{t("admin.trainerApplications.filters.approved")}</SelectItem>
              <SelectItem value="rejected">{t("admin.trainerApplications.filters.rejected")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("admin.trainerApplications.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
            dir={tableDir}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("admin.trainerApplications.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto" dir={tableDir}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("admin.trainerApplications.columns.name")}</TableHead>
                    <TableHead>{t("admin.trainerApplications.columns.phone")}</TableHead>
                    <TableHead>{t("admin.trainerApplications.columns.city")}</TableHead>
                    <TableHead>{t("admin.trainerApplications.columns.experience")}</TableHead>
                    <TableHead>{t("admin.trainerApplications.columns.status")}</TableHead>
                    <TableHead>{t("admin.trainerApplications.columns.submitted")}</TableHead>
                    <TableHead className="min-w-[100px]">{t("admin.trainerApplications.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const initial = displayName(row).charAt(0) || "?";
                    const photo = row.profile?.avatar_url || row.photo_url || "";
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
                            <Avatar className="h-9 w-9 shrink-0 border border-border">
                              <AvatarImage src={photo} className="object-cover" />
                              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate font-medium text-sm">{displayName(row)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums" dir="ltr">
                          {row.phone || "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">{row.city || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums">
                          {row.years_of_experience != null ? row.years_of_experience : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs font-medium", statusBadgeClass(row.status))}>
                            {t(`admin.trainerApplications.status.${row.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(row.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => setDetailRow(row)}>
                            <Eye className="h-3.5 w-3.5" />
                            {t("admin.trainerApplications.viewButton")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TrainerApplicationDetailDialog
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        row={detailRow}
        approveApplication={approveApplication}
        rejectApplication={rejectApplication}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    </div>
  );
};

export default TrainerApplicationsList;
