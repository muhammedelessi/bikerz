import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TrainerAdminPaymentsSection } from "@/components/admin/trainer/TrainerAdminPaymentsSection";

const AdminTrainerPayments = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const { data: trainer } = useQuery({
    queryKey: ["admin-trainer-name", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainers").select("name_ar, name_en").eq("id", id!).single();
      if (error) throw error;
      return data as { name_ar: string; name_en: string };
    },
    enabled: !!id,
  });

  const displayName = trainer ? (isRTL ? trainer.name_ar || trainer.name_en : trainer.name_en || trainer.name_ar) : "";

  return (
    <AdminLayout>
      <div
        className="mx-auto w-full min-w-0 min-h-0 max-w-[1600px] space-y-4 px-2 sm:px-4 lg:px-6"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2 -ms-2" asChild>
              <Link to={id ? `/admin/trainers/${id}` : "/admin/trainers"}>
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {isRTL ? "العودة لملف المدرب" : "Back to trainer profile"}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin/trainers")}>
              {isRTL ? "كل المدربين" : "All trainers"}
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "مدفوعات المدرب" : "Trainer payments"}
            {displayName ? (
              <span className="block text-base font-normal text-muted-foreground mt-1">{displayName}</span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isRTL
              ? "نفس عرض صفحة المدفوعات العامة، لكن مفلتر لحجوزات التدريب العملي لهذا المدرب فقط."
              : "Same layout as the main payments page, filtered to this trainer’s practical training card charges."}
          </p>
        </div>

        {id ? <TrainerAdminPaymentsSection trainerId={id} /> : null}
      </div>
    </AdminLayout>
  );
};

export default AdminTrainerPayments;
