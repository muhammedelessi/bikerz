import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useUpsertSurveyQuestion, uploadSurveyImage, type SurveyQuestionUpsert } from "@/hooks/survey/useSurveyAdminMutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { QuestionType } from "@/types/survey";

const emptyOption = () => ({
  id: undefined as string | undefined,
  label_ar: "",
  label_en: "",
  image_url: null as string | null,
  is_correct: false,
  sort_order: 0,
});

const AdminQuestionEdit: React.FC = () => {
  const { surveyId, questionId } = useParams<{ surveyId: string; questionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const isNew = questionId === "new";
  const { data: questions = [], isLoading } = useAdminSurveyQuestions(surveyId);
  const existing = useMemo(() => (!isNew ? questions.find((q) => q.id === questionId) : undefined), [questions, questionId, isNew]);
  const upsert = useUpsertSurveyQuestion();

  const [questionType, setQuestionType] = useState<QuestionType>("yes_no");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);
  const [correctIndex, setCorrectIndex] = useState("0");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setQuestionType(existing.question_type);
    setTitleAr(existing.title_ar);
    setTitleEn(existing.title_en);
    setImageUrl(existing.image_url);
    setSortOrder(existing.sort_order);
    setIsActive(existing.is_active !== false);
    const opts = (existing.options || []).length ? existing.options!.map((o, i) => ({ ...o, sort_order: o.sort_order ?? i })) : [emptyOption(), emptyOption()];
    setOptions(
      opts.map((o, i) => ({
        id: o.id,
        label_ar: o.label_ar,
        label_en: o.label_en,
        image_url: o.image_url,
        is_correct: o.is_correct,
        sort_order: o.sort_order ?? i,
      })),
    );
    const ci = opts.findIndex((o) => o.is_correct);
    setCorrectIndex(String(ci >= 0 ? ci : 0));
  }, [existing]);

  useEffect(() => {
    if (existing) return;
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0);
    setSortOrder(max + 1);
  }, [existing, questions]);

  const handleQImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSurveyImage(file);
      setImageUrl(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleOptImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSurveyImage(file);
      setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, image_url: url } : o)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((o) => [...o, emptyOption()]);
  };

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!surveyId) return;
    if (!titleAr.trim() || !titleEn.trim()) {
      toast.error(t("validation.required"));
      return;
    }
    let payloadOptions = options.map((o, i) => ({
      ...o,
      sort_order: i,
      is_correct: false,
    }));
    if (questionType === "multiple_choice") {
      if (payloadOptions.length < 2) {
        toast.error(t("survey.min_options_warning"));
        return;
      }
      const idx = Math.min(payloadOptions.length - 1, Math.max(0, Number.parseInt(correctIndex, 10) || 0));
      payloadOptions = payloadOptions.map((o, i) => ({ ...o, is_correct: i === idx }));
      const correctCount = payloadOptions.filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        toast.error(t("survey.one_correct_warning"));
        return;
      }
      for (const o of payloadOptions) {
        if (!o.label_ar.trim() || !o.label_en.trim()) {
          toast.error(t("validation.required"));
          return;
        }
      }
    }

    const payload: SurveyQuestionUpsert = {
      id: isNew ? undefined : questionId,
      survey_id: surveyId,
      question_type: questionType,
      title_ar: titleAr.trim(),
      title_en: titleEn.trim(),
      image_url: imageUrl,
      catalog_ref_id: existing?.catalog_ref_id ?? null,
      catalog_ref_type: existing?.catalog_ref_type ?? null,
      sort_order: sortOrder,
      is_active: isActive,
      options: questionType === "multiple_choice" ? payloadOptions : [],
    };

    try {
      await upsert.mutateAsync(payload);
      toast.success(t("common.success"));
      navigate(`/admin/surveys/${surveyId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  if (!surveyId || !questionId) return null;

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to={`/admin/surveys/${surveyId}`}>
            <ArrowLeft className="w-4 h-4" />
            {t("survey.survey_detail")}
          </Link>
        </Button>

        <h1 className="text-2xl font-bold">{isNew ? t("survey.add_question") : t("common.edit")}</h1>

        {isLoading && !isNew && !existing ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Label>{t("survey.type_label")}</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={questionType === "yes_no" ? "default" : "outline"} onClick={() => setQuestionType("yes_no")}>
                  {t("survey.question_type_yesno")}
                </Button>
                <Button type="button" size="sm" variant={questionType === "multiple_choice" ? "default" : "outline"} onClick={() => setQuestionType("multiple_choice")}>
                  {t("survey.question_type_mc")}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("survey.titles")} (AR)</Label>
                <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("survey.titles")} (EN)</Label>
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("survey.question_image")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="file" accept="image/*" onChange={handleQImage} disabled={uploading} className="max-w-xs" />
                {imageUrl ? <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imageUrl}</span> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 items-center">
              <div className="space-y-2">
                <Label>{t("survey.sort_order")}</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
                <Label htmlFor="active">{isActive ? t("survey.active") : t("survey.inactive")}</Label>
              </div>
            </div>

            {questionType === "multiple_choice" ? (
              <div className="space-y-4 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{t("survey.options_heading")}</h2>
                  <Button type="button" size="sm" variant="outline" onClick={addOption}>
                    {t("survey.add_option")}
                  </Button>
                </div>
                <RadioGroup value={correctIndex} onValueChange={setCorrectIndex} className="space-y-4">
                  {options.map((o, i) => (
                    <div key={o.id ?? `opt-${i}`} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={String(i)} id={`c-${i}`} />
                          <Label htmlFor={`c-${i}`} className="text-xs font-normal">
                            {t("survey.mark_correct")}
                          </Label>
                        </div>
                        {options.length > 2 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(i)}>
                            {t("common.delete")}
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input placeholder="AR" value={o.label_ar} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label_ar: e.target.value } : x)))} />
                        <Input placeholder="EN" value={o.label_en} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label_en: e.target.value } : x)))} />
                      </div>
                      <Input type="file" accept="image/*" onChange={(e) => void handleOptImage(i, e)} disabled={uploading} className="max-w-xs" />
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ) : null}

            <Button type="button" onClick={() => void submit()} disabled={upsert.isPending || uploading} className="gap-2">
              {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("survey.save_question")}
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminQuestionEdit;
