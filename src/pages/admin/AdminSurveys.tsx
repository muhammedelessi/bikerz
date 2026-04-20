import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Pencil } from "lucide-react";

const AdminSurveys: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: surveys, isLoading } = useAdminAllSurveys();

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("survey.admin_list_title")}</h1>
            <p className="text-muted-foreground text-sm">{t("survey.all_surveys")}</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/surveys/statistics">
              <BarChart3 className="w-4 h-4" />
              {t("survey.admin_stats_nav")}
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("survey.table_title")}</TableHead>
                <TableHead>{t("survey.type_label")}</TableHead>
                <TableHead>{t("survey.sort_order")}</TableHead>
                <TableHead>{t("survey.active")}</TableHead>
                <TableHead className="text-end">{t("common.view")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>{t("common.loading")}</TableCell>
                </TableRow>
              ) : (
                (surveys || []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{isRTL ? s.title_ar : s.title_en}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.type}</Badge>
                    </TableCell>
                    <TableCell>{s.sort_order}</TableCell>
                    <TableCell>{s.is_active ? t("survey.active") : t("survey.inactive")}</TableCell>
                    <TableCell className="text-end">
                      <Button asChild size="sm" variant="ghost" className="gap-1">
                        <Link to={`/admin/surveys/${s.id}`}>
                          <Pencil className="w-4 h-4" />
                          {t("survey.survey_detail")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSurveys;
