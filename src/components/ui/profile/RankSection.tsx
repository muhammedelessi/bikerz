import React, { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trophy,
  Target,
  Star,
  Check,
  CheckCircle2,
  Shield,
  Lock,
  Rocket,
  GraduationCap,
  Route,
  ShieldCheck,
  Crown,
  Award,
  Gem,
  Zap,
  Medal,
  Flame,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ExtendedProfile,
  RANK_DEFINITIONS,
  RankName,
  RankRequirement,
  calculateRank,
  useRankDefinitions,
  dbRankToRequirement,
  calculateRankDynamic,
} from "@/hooks/useUserProfile";

/** Maps icon-name strings (from DB) to LucideIcon components. */
const ICON_MAP: Record<string, LucideIcon> = {
  Rocket, Target, Zap, Shield, Trophy, Award, Crown, Star, Medal, Flame,
  GraduationCap, Route, ShieldCheck, Gem,
};

/** Returns the best icon for a rank, preferring the DB-defined icon name. */
function getIconForRank(rankName: string, dbIconName?: string): LucideIcon {
  if (dbIconName && ICON_MAP[dbIconName]) return ICON_MAP[dbIconName];
  // minimal fallback for known legacy names
  const fallbacks: Record<string, LucideIcon> = {
    "FUTURE RIDER": Rocket,
    TRAINEE: GraduationCap,
    "1500KM BUILDER": Route,
    "SAFE RIDER": ShieldCheck,
    CHAMPION: Crown,
    TRAINER: Award,
    MASTER: Gem,
    LEGEND: Trophy,
  };
  return fallbacks[rankName] ?? Star;
}

interface RankSectionProps {
  profile: ExtendedProfile;
  enrollments: any[];
}

const ADMIN_ONLY_RANKS: RankName[] = ["CHAMPION", "TRAINER"];

interface RequirementRow {
  label_ar: string;
  label_en: string;
  met: boolean;
  isAdminOnly?: boolean;
  isKm?: boolean;
  current?: number;
  kmTarget?: number;
}

function buildRequirementRows(
  profile: ExtendedProfile,
  enrollments: any[],
  rank: RankRequirement,
): RequirementRow[] {
  const reqs = rank.requirements;
  const lbl = rank.req_labels ?? {};
  const items: RequirementRow[] = [];

  if (reqs.hasPurchasedFirstCourse !== undefined) {
    items.push({
      label_ar: lbl.first_course_ar || "شراء أول كورس",
      label_en: lbl.first_course_en || "Purchase first course",
      met: enrollments.length > 0,
    });
  }
  if (reqs.hasLicense !== undefined) {
    items.push({
      label_ar: lbl.has_license_ar || "رخصة دراجة نارية موثقة",
      label_en: lbl.has_license_en || "Verified motorcycle license",
      met: !!profile.has_license && !!profile.license_verified,
    });
  }
  if (reqs.hasMotorcycleVIN !== undefined) {
    items.push({
      label_ar: lbl.motorcycle_vin_ar || "رقم هيكل الدراجة (VIN) موثق",
      label_en: lbl.motorcycle_vin_en || "Verified motorcycle VIN",
      met: !!profile.motorcycle_vin && !!profile.vin_verified,
    });
  }
  if (reqs.kmLogged !== undefined) {
    const km = profile.km_logged || 0;
    const kmTarget = reqs.kmLogged;
    items.push({
      label_ar: lbl.km_logged_ar || `${kmTarget.toLocaleString()} كم مسجلة`,
      label_en: lbl.km_logged_en || `${kmTarget.toLocaleString()} km logged`,
      met: km >= kmTarget,
      isKm: true,
      current: km,
      kmTarget,
    });
  }
  if (reqs.hasCompletedCoreTraining !== undefined) {
    items.push({
      label_ar: lbl.core_training_ar || "إكمال التدريب الأساسي",
      label_en: lbl.core_training_en || "Complete core training",
      met: false,
    });
  }
  if (reqs.coursesSoldCount !== undefined) {
    items.push({
      label_ar: lbl.courses_sold_ar || "بيع كورس أصلي على المنصة",
      label_en: lbl.courses_sold_en || "Sold an original course on the platform",
      met: (profile.courses_sold_count || 0) >= reqs.coursesSoldCount,
    });
  }
  if (reqs.trainingProgramsSoldCount !== undefined) {
    items.push({
      label_ar: lbl.programs_sold_ar || "بيع 4+ برامج تدريبية",
      label_en: lbl.programs_sold_en || "Sold 4+ training programs",
      met: (profile.courses_sold_count || 0) >= reqs.trainingProgramsSoldCount,
    });
  }
  if (rank.isAdminOnly ?? ADMIN_ONLY_RANKS.includes(rank.name as RankName)) {
    items.push({
      label_ar: lbl.admin_only_ar || "يتطلب موافقة الأدمن",
      label_en: lbl.admin_only_en || "Requires admin approval",
      met: false,
      isAdminOnly: true,
    });
  }

  // Freeform custom requirements added by admin.
  for (const cr of rank.custom_requirements ?? []) {
    if (cr.label_en || cr.label_ar) {
      items.push({
        label_ar: cr.label_ar || cr.label_en,
        label_en: cr.label_en || cr.label_ar,
        met: false,
        isAdminOnly: true,
      });
    }
  }

  return items;
}

/* ── Connector helpers ──────────────────────────────────── */

function getConnectorColor(lowerIndex: number, rankIndex: number): string {
  if (lowerIndex < rankIndex) return "bg-emerald-500";
  if (lowerIndex === rankIndex) return "bg-primary/60";
  return "bg-border/40";
}

/* ── Rank Card ──────────────────────────────────────────── */

const RankCard: React.FC<{
  def: RankRequirement;
  index: number;
  rankIndex: number;
  isRTL: boolean;
  onClick: () => void;
}> = ({ def, index, rankIndex, isRTL, onClick }) => {
  const isActive = index === rankIndex;
  const isPast = index < rankIndex;
  const isFuture = index > rankIndex;
  const Icon = getIconForRank(def.name, def.icon);

  // Use DB color for active icon text; keep emerald for past, muted for future.
  const iconColorClass = isActive
    ? (def.color || "text-primary")
    : isPast
      ? "text-emerald-500"
      : "text-muted-foreground/30";

  // Use DB bg_color for the active icon circle; keep emerald / muted for other states.
  const iconBgClass = isActive
    ? (def.bg_color || "bg-primary/15")
    : isPast
      ? "bg-emerald-500/15"
      : "bg-muted/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full h-24 sm:h-28 rounded-2xl border-2 transition-all duration-300",
        "flex flex-col items-center justify-center gap-1.5 p-2",
        "hover:scale-[1.02] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive && "border-primary bg-primary/10",
        isPast  && "border-emerald-500/50 bg-emerald-500/5",
        isFuture && "border-border/30 bg-muted/10",
      )}
      style={isActive ? { boxShadow: "0 0 0 3px hsl(var(--primary) / 0.15)" } : undefined}
    >
      <div className={cn("relative w-11 h-11 rounded-full flex items-center justify-center", iconBgClass)}>
        <Icon className={cn("w-5 h-5", iconColorClass)} />
        {isPast && (
          <span className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
            <Check className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {isFuture && (
          <span className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-muted border border-border/50 flex items-center justify-center">
            <Lock className="w-2 h-2 text-muted-foreground/50" />
          </span>
        )}
      </div>

      <span
        className={cn(
          "text-[11px] font-bold text-center leading-tight px-1",
          isActive  && (def.color || "text-primary"),
          isPast    && "text-emerald-600 dark:text-emerald-400",
          isFuture  && "text-muted-foreground/40",
        )}
      >
        {isRTL ? def.name_ar : def.name}
      </span>

      {isActive && (
        <span className="bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">
          {isRTL ? "رتبتك" : "Yours"}
        </span>
      )}
    </button>
  );
};

/* ── Loading Skeleton ───────────────────────────────────── */

const RankSectionSkeleton: React.FC = () => (
  <div className="card-premium p-6 space-y-6">
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 rounded bg-muted/40 animate-pulse" />
      <div className="h-5 w-24 rounded bg-muted/40 animate-pulse" />
    </div>
    <Separator />
    <div className="flex flex-col items-center gap-3">
      <div className="h-16 w-16 rounded-full bg-muted/40 animate-pulse" />
      <div className="h-6 w-32 rounded bg-muted/40 animate-pulse" />
      <div className="h-2.5 w-full rounded-full bg-muted/40 animate-pulse" />
    </div>
    <Separator />
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
      ))}
    </div>
  </div>
);

/* ── Main component ──────────────────────────────────────── */

export const RankSection: React.FC<RankSectionProps> = ({
  profile,
  enrollments,
}) => {
  const { isRTL } = useLanguage();
  const [selectedRank, setSelectedRank] = useState<RankRequirement | null>(null);

  // Always fetch from DB — admin-managed rank definitions.
  const { data: dbRanks = [], isLoading: ranksLoading } = useRankDefinitions();

  // Map DB rows → RankRequirement. Fall back to hardcoded only if DB truly empty.
  const effectiveDefs: RankRequirement[] = useMemo(
    () => (dbRanks.length > 0 ? dbRanks.map(dbRankToRequirement) : RANK_DEFINITIONS),
    [dbRanks],
  );

  const dbRankMap = useMemo(
    () => new Map(dbRanks.map((r) => [r.name, r])),
    [dbRanks],
  );

  const currentRank = useMemo<RankName>(() => {
    if (profile.rank_override && profile.experience_level) {
      return profile.experience_level as RankName;
    }
    return dbRanks.length > 0
      ? calculateRankDynamic(profile, enrollments, dbRanks)
      : calculateRank(profile, enrollments);
  }, [profile, enrollments, dbRanks]);

  const rankIndex   = effectiveDefs.findIndex((r) => r.name === currentRank);
  const currentDef  = effectiveDefs[rankIndex] ?? effectiveDefs[0];
  const nextDef     = rankIndex < effectiveDefs.length - 1 ? effectiveDefs[rankIndex + 1] : null;
  const lastDef     = effectiveDefs[effectiveDefs.length - 1];

  const progressPercent =
    effectiveDefs.length > 1 ? (rankIndex / (effectiveDefs.length - 1)) * 100 : 100;

  const selectedRankIndex  = selectedRank ? effectiveDefs.findIndex((r) => r.name === selectedRank.name) : -1;
  const selectedIsPast     = selectedRankIndex >= 0 && selectedRankIndex < rankIndex;
  const selectedIsCurrent  = selectedRankIndex >= 0 && selectedRankIndex === rankIndex;

  const dialogRequirements = useMemo(() => {
    if (!selectedRank) return [];
    return buildRequirementRows(profile, enrollments, selectedRank);
  }, [selectedRank, profile, enrollments]);

  // Show skeleton while rank definitions are being loaded from DB.
  if (ranksLoading) {
    return <RankSectionSkeleton />;
  }

  return (
    <div className="card-premium p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">
          {isRTL ? "رتبتك" : "Your Rank"}
        </h3>
      </div>

      <Separator />

      {/* Current Rank Hero */}
      <div className="text-center space-y-3">
        {(() => {
          const CurrentIcon = getIconForRank(currentRank, dbRankMap.get(currentRank)?.icon ?? currentDef.icon);
          const heroBg     = currentDef.bg_color     || "bg-primary/10";
          const heroColor  = currentDef.color        || "text-primary";
          return (
            <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-primary/20", heroBg)}>
              <CurrentIcon className={cn("h-8 w-8", heroColor)} />
            </div>
          );
        })()}
        <div>
          <p className="text-xl font-black text-foreground">
            {isRTL ? currentDef.name_ar : currentDef.name}
          </p>
          {currentDef.description_en && (
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              {isRTL ? currentDef.description_ar : currentDef.description_en}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-2">
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {rankIndex + 1} / {effectiveDefs.length}
            </span>
            {nextDef && (
              <span>
                {isRTL ? "للترقي إلى" : "Progress to"}{" "}
                {isRTL ? nextDef.name_ar : nextDef.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rank Journey */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">
            {isRTL
              ? `الطريق إلى ${lastDef?.name_ar || "الأسطورة"}`
              : `Road to ${lastDef?.name || "Legend"}`}
          </h4>
        </div>

        {/* Snake grid — row-1 (first 4) + row-2 (remaining, reversed) */}
        {(() => {
          const row1       = effectiveDefs.slice(0, 4);
          const row2Source = effectiveDefs.slice(4);
          const row2Rev    = [...row2Source].reverse();
          const row2RealIdx = (vi: number) => 4 + row2Source.length - 1 - vi;

          return (
            <div dir={isRTL ? "rtl" : "ltr"}>
              {/* Row 1 */}
              <div className="grid grid-cols-4 gap-4 sm:gap-5">
                {row1.map((def, i) => (
                  <div key={def.name} className="relative">
                    <RankCard def={def} index={i} rankIndex={rankIndex} isRTL={isRTL} onClick={() => setSelectedRank(def)} />
                    {i < row1.length - 1 && (
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 z-0 h-[2px] pointer-events-none",
                        "-end-4 sm:-end-5 w-4 sm:w-5",
                        getConnectorColor(i, rankIndex),
                      )} />
                    )}
                    {i === row1.length - 1 && row2Rev.length > 0 && (
                      <div className="absolute inset-x-0 top-full flex justify-center pointer-events-none z-0">
                        <div className={cn("w-[2px] h-2 sm:h-2.5", getConnectorColor(row1.length - 1, rankIndex))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {row2Rev.length > 0 && <div className="h-4 sm:h-5" />}

              {/* Row 2 — reversed snake */}
              {row2Rev.length > 0 && (
                <div className="grid grid-cols-4 gap-4 sm:gap-5">
                  {row2Rev.map((def, vi) => {
                    const realIdx = row2RealIdx(vi);
                    return (
                      <div key={def.name} className="relative">
                        <RankCard def={def} index={realIdx} rankIndex={rankIndex} isRTL={isRTL} onClick={() => setSelectedRank(def)} />
                        {vi < row2Rev.length - 1 && (
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 z-0 h-[2px] pointer-events-none",
                            "-end-4 sm:-end-5 w-4 sm:w-5",
                            getConnectorColor(realIdx - 1, rankIndex),
                          )} />
                        )}
                        {vi === row2Rev.length - 1 && (
                          <div className="absolute inset-x-0 bottom-full flex justify-center pointer-events-none z-0">
                            <div className={cn("w-[2px] h-2 sm:h-2.5", getConnectorColor(row1.length - 1, rankIndex))} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Rank Detail Dialog */}
      <Dialog open={!!selectedRank} onOpenChange={(open) => { if (!open) setSelectedRank(null); }}>
        <DialogContent
          className="p-0 overflow-hidden max-w-sm rounded-2xl gap-0 max-h-[90vh] overflow-y-auto"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <DialogTitle className="sr-only">
            {isRTL ? selectedRank?.name_ar : selectedRank?.name}
          </DialogTitle>

          {selectedRank && (() => {
            const dbEntry  = dbRankMap.get(selectedRank.name);
            const RankIcon = getIconForRank(selectedRank.name, dbEntry?.icon ?? selectedRank.icon);
            const isFuture = !selectedIsPast && !selectedIsCurrent;

            // Use DB colors for the dialog icon — fall back to state-based colors.
            const dialogIconColor = selectedIsPast
              ? "text-emerald-500"
              : selectedIsCurrent
                ? (selectedRank.color || "text-primary")
                : "text-muted-foreground/40";

            const dialogIconBg = selectedIsPast
              ? "bg-emerald-500/15 border-emerald-500/30"
              : selectedIsCurrent
                ? `${selectedRank.bg_color || "bg-primary/15"} ${selectedRank.border_color || "border-primary/30"}`
                : "bg-muted/30 border-border/30";

            return (
              <>
                {/* ── Gradient Header ── */}
                <div className={cn(
                  "relative rounded-t-2xl px-6 py-8 flex flex-col items-center gap-3 text-center",
                  selectedIsPast    && "bg-gradient-to-b from-emerald-500/20 to-emerald-500/5",
                  selectedIsCurrent && "bg-gradient-to-b from-primary/20 to-primary/5",
                  isFuture          && "bg-gradient-to-b from-muted/40 to-muted/10",
                )}>
                  {/* Icon circle */}
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-lg", dialogIconBg)}>
                    <RankIcon className={cn("w-7 h-7", dialogIconColor)} />
                  </div>

                  {/* Name */}
                  <div>
                    <h2 className="text-xl font-black text-foreground">
                      {isRTL ? selectedRank.name_ar : selectedRank.name}
                    </h2>
                  </div>

                  {/* Status badge */}
                  <span className={cn(
                    "text-xs font-semibold px-3 py-1 rounded-full border",
                    selectedIsPast    && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                    selectedIsCurrent && "bg-primary/10 text-primary border-primary/20",
                    isFuture          && "bg-muted/30 text-muted-foreground border-border/30",
                  )}>
                    {selectedIsPast    && (isRTL ? "✅ أنجزت هذه الرتبة" : "✅ Achieved")}
                    {selectedIsCurrent && (isRTL ? "⭐ رتبتك الحالية"     : "⭐ Your Current Rank")}
                    {isFuture          && (isRTL ? "🔒 مقفلة"             : "🔒 Locked")}
                  </span>

                  {/* Description from DB */}
                  <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
                    {isRTL ? selectedRank.description_ar : selectedRank.description_en}
                  </p>
                </div>

                {/* ── Requirements ── */}
                {selectedIsPast ? (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                        {isRTL
                          ? "لقد أتممت هذه المرحلة في مسيرتك."
                          : "You have completed this stage of your journey."}
                      </p>
                    </div>
                  </div>
                ) : dialogRequirements.length > 0 ? (
                  <div className="px-5 py-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      {isRTL ? "📋 المتطلبات" : "📋 Requirements"}
                    </p>
                    <div className="space-y-2">
                      {dialogRequirements.map((req, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl",
                            req.isAdminOnly
                              ? "bg-primary/5 border border-primary/15"
                              : req.met
                                ? "bg-emerald-500/5 border border-emerald-500/15"
                                : "bg-muted/20 border border-border/30",
                          )}
                        >
                          {req.isAdminOnly ? (
                            <Shield className="w-4 h-4 text-primary shrink-0" />
                          ) : req.met ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 bg-muted/40 shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium",
                              req.isAdminOnly              && "text-primary",
                              req.met && !req.isAdminOnly  && "text-foreground",
                              !req.met && !req.isAdminOnly && "text-muted-foreground",
                            )}>
                              {isRTL ? req.label_ar : req.label_en}
                            </p>

                            {req.isKm && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${Math.min(((req.current ?? 0) / (req.kmTarget ?? 1500)) * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0" dir="ltr">
                                  {req.current ?? 0} / {(req.kmTarget ?? 1500).toLocaleString()} km
                                </span>
                              </div>
                            )}
                          </div>

                          {req.isAdminOnly && (
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">
                              {isRTL ? "أدمن" : "Admin"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <p className="text-sm text-muted-foreground italic">
                      {isRTL
                        ? "لا توجد متطلبات محددة لهذه الرتبة."
                        : "No specific requirements for this rank."}
                    </p>
                  </div>
                )}

                {/* ── How to advance ── */}
                {!selectedIsPast && (selectedRank.promotionTrigger_en || selectedRank.promotionTrigger_ar) && (
                  <div className="px-5 pb-5">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-primary" />
                        {isRTL ? "كيف تنتقل لهذه الرتبة؟" : "How to advance?"}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {isRTL
                          ? selectedRank.promotionTrigger_ar
                          : selectedRank.promotionTrigger_en}
                      </p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
