import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Dumbbell, Loader2, Star, MapPin, Clock, DollarSign, Users, ChevronRight, ChevronLeft, GraduationCap, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/common/SEOHead";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import TrainerProfileModal from "@/components/landing/TrainerProfileModal";
import { cn } from "@/lib/utils";
import PromoPopup from "@/components/common/PromoPopup";

const Trainings: React.FC = () => {
  const { isRTL } = useLanguage();
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ["trainings-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainings").select("*").eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: trainerCourses } = useQuery({
    queryKey: ["trainings-page-trainer-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainer_courses").select("*, trainers(*)");
      if (error) throw error;
      return data;
    },
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["trainings-page-review-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_reviews").select("trainer_id, rating");
      const stats: Record<string, { avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      data?.forEach((r) => {
        if (!grouped[r.trainer_id]) grouped[r.trainer_id] = [];
        grouped[r.trainer_id].push(r.rating);
      });
      Object.entries(grouped).forEach(([id, ratings]) => {
        stats[id] = { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
      });
      return stats;
    },
  });

  const levelConfig: Record<string, { color: string; label: { en: string; ar: string } }> = {
    beginner: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: { en: "Beginner", ar: "مبتدئ" } },
    intermediate: { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: { en: "Intermediate", ar: "متوسط" } },
    advanced: { color: "bg-red-500/10 text-red-600 border-red-500/20", label: { en: "Advanced", ar: "متقدم" } },
  };

  const getTrainersForTraining = (trainingId: string) => trainerCourses?.filter((tc) => tc.training_id === trainingId) || [];
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      <PromoPopup trigger="scroll" />
      <div className="min-h-screen bg-background">
        <SEOHead
          title={isRTL ? "التدريب العملي | بايكرز" : "Practical Training | BIKERZ"}
          description={isRTL ? "تصفح التدريبات العملية المتاحة مع مدربين محترفين" : "Browse available practical training programs with professional trainers."}
          canonical="/trainings"
          breadcrumbs={[
            { name: isRTL ? "الرئيسية" : "Home", url: "/" },
            { name: isRTL ? "التدريب العملي" : "Practical Training", url: "/trainings" },
          ]}
        />
        <Navbar />

        <main className="pt-[var(--navbar-h)]">
          <section className="section-container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h1 className="section-title text-foreground mb-3 sm:mb-4">
                {isRTL ? "التدريب العملي" : "Practical Training"}
              </h1>
              <p className="section-subtitle">
                {isRTL ? "اختر البرنامج التدريبي المناسب لمستواك وابدأ رحلتك مع مدربين محترفين" : "Choose the perfect training program for your skill level and start your journey with expert trainers"}
              </p>
            </motion.div>

            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {!isLoading && trainings.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                  <Dumbbell className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {isRTL ? "لا توجد تدريبات متاحة حالياً" : "No Trainings Available"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {isRTL ? "سيتم إضافة تدريبات جديدة قريباً" : "New training programs will be added soon"}
                </p>
              </div>
            )}

            {!isLoading && trainings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
                {trainings.map((t: any, index: number) => {
                  const level = levelConfig[t.level] || levelConfig.beginner;
                  const trainersCount = getTrainersForTraining(t.id).length;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      onClick={() => setSelectedTraining(t)}
                      className={cn(
                        "group relative bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer flex flex-col",
                        "transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30"
                      )}
                    >
                      <div className="p-5 sm:p-6 flex-1 flex flex-col">
                        {/* Icon + badges */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-md shadow-primary/20">
                            {t.type === "theory" ? <GraduationCap className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                          </div>
                          <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", level.color)}>
                            {isRTL ? level.label.ar : level.label.en}
                          </span>
                        </div>

                        {/* Title & description */}
                        <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-1">
                          {isRTL ? t.name_ar : t.name_en}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                          {isRTL ? t.description_ar : t.description_en}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted font-medium">
                            {t.type === "theory" ? (isRTL ? "نظري" : "Theory") : (isRTL ? "عملي" : "Practical")}
                          </span>
                          {trainersCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted font-medium">
                              <Users className="w-3 h-3" />
                              {trainersCount} {isRTL ? "مدرب" : "trainers"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                        <button className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          {isRTL ? "عرض التفاصيل" : "View Details"}
                          <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <Footer />
      </div>

      {/* Training Detail Dialog */}
      <Dialog open={!!selectedTraining} onOpenChange={() => setSelectedTraining(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTraining && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    {selectedTraining.type === "theory" ? <GraduationCap className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <DialogTitle className="text-lg">{isRTL ? selectedTraining.name_ar : selectedTraining.name_en}</DialogTitle>
                </div>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{isRTL ? selectedTraining.description_ar : selectedTraining.description_en}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">
                  {selectedTraining.type === "theory" ? (isRTL ? "نظري" : "Theory") : (isRTL ? "عملي" : "Practical")}
                </Badge>
                <Badge variant="outline" className={levelConfig[selectedTraining.level]?.color}>
                  {isRTL ? levelConfig[selectedTraining.level]?.label.ar : levelConfig[selectedTraining.level]?.label.en}
                </Badge>
              </div>

              <h3 className="text-base font-semibold mt-6 mb-3">{isRTL ? "المدربون المتاحون" : "Available Trainers"}</h3>
              <div className="space-y-2.5">
                {getTrainersForTraining(selectedTraining.id).map((tc: any) => {
                  const trainer = tc.trainers;
                  if (!trainer) return null;
                  const stats = reviewStats?.[trainer.id];
                  return (
                    <div
                      key={tc.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-muted/50 hover:border-primary/20 transition-all"
                      onClick={() => { setSelectedTraining(null); setSelectedTrainerId(trainer.id); }}
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                        <AvatarImage src={trainer.photo_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{isRTL ? trainer.name_ar : trainer.name_en}</h4>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                          {stats && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {stats.avg.toFixed(1)}
                            </span>
                          )}
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Number(tc.duration_hours)}h</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{tc.location}</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{Number(tc.price)} SAR</span>
                        </div>
                      </div>
                      <Arrow className="w-4 h-4 text-muted-foreground" />
                    </div>
                  );
                })}
                {getTrainersForTraining(selectedTraining.id).length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">
                    {isRTL ? "لا يوجد مدربون لهذا التدريب حالياً" : "No trainers available for this training yet"}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TrainerProfileModal trainerId={selectedTrainerId} onClose={() => setSelectedTrainerId(null)} />
    </>
  );
};

export default Trainings;
